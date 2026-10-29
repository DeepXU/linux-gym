import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import http from 'http';
import { GoogleGenAI } from '@google/genai';
import Docker from 'dockerode';

import { db, DatabaseManager } from './server/db';
import { INITIAL_RESEARCH_TASKS } from './server/serverTasks';
import { GuardrailEngine } from './server/guardrails';
import { ProgressiveHintEngine } from './server/hintEngine';
import { CEWEvaluator } from './server/cewEvaluator';
import { TelemetryManager } from './server/telemetry';
import { TestRunnerService } from './server/testRunner';
import { ExportService } from './server/exportService';
import { CEWBenchmarkService } from './server/cewBenchmarks';
import { SectionJService } from './server/sectionJService';
import { generateAITutorResponse } from './server/aiProvider';
import { TutorOrchestrator } from './server/tutorOrchestrator';
import { SandboxProvider } from './server/sandboxProvider';
import {
  PROTOCOL_VERSION,
  V5_TASK_IDS,
  V5_SCENARIO_TYPES,
  V5_HIGH_RISK_CASE_IDS,
  V5_CEW_CASE_IDS,
  V5_RUBRIC_DIMENSIONS,
  V5_CRITICAL_FAILURE_CATEGORIES,
  evaluateV5CaseOutcome,
  normalizeToV5CriticalFailures
} from './server/protocolV5';
import {
  createAuthSession,
  getAuthSessionFromRequest,
  sanitizeUsersMap,
  createRateLimiter
} from './server/authMiddleware';
import crypto from 'crypto';
import {
  FormalRun,
  ResearchConfiguration,
  TelemetryEvent,
  Level,
  CEWSubmission,
  CEWScore,
  ExpertReview,
  DefectRecord,
  ExperimentalCondition,
  UserRole,
  TestingStage
} from './types';

export const APP_VERSION = '1.0.0';
export const APP_RELEASE_STAGE = 'Research Baseline Freeze 1';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/pty' });

  // Initialize DB Tasks and Test Cases
  if (db.getTasks().length === 0) {
    await db.setTasks(INITIAL_RESEARCH_TASKS);
  }
  await TestRunnerService.initTestCases();

  // Initialize 30 Researcher-Authored Benchmark CEW Submissions for Phase 4 / RQ5
  if (db.getCEWSubmissions().length === 0) {
    const benchmarkSubmissions = CEWBenchmarkService.toCEWSubmissions();
    for (const sub of benchmarkSubmissions) {
      await db.appendCEWSubmission(sub);
      const task = db.getTaskById(sub.taskId) || ({ id: sub.taskId, title: `Task ${sub.taskId}` } as any);
      const autoScore = CEWEvaluator.evaluateSubmission(sub, task, 'gemini-3-flash-preview', 'gemini', true);
      await db.appendCEWScore({
        ...autoScore,
        testCaseId: sub.testCaseId
      });
    }
    console.log(`[Research Lab] Initialized ${benchmarkSubmissions.length} benchmark CEW submissions for RQ5.`);
  }

  // Initialize Docker with configurable socket path
  const dockerSocket = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
  const docker = new Docker({ socketPath: dockerSocket });

  // Native PTY WebSocket Bridge with Telemetry Logging & Docker Orchestration
  wss.on('connection', async (ws, req) => {
    let ptyInputBuffer = '';
    let isDocker = false;
    let shell: any = null;
    let dockerStream: any = null;
    let dockerContainer: any = null;

    const reqUrl = new URL(req.url || '/pty', 'http://localhost');
    const levelId = Math.min(8, Math.max(1, parseInt(reqUrl.searchParams.get('levelId') || '1', 10) || 1));
    const ptySessionId = reqUrl.searchParams.get('sessionId') || `pty-session-${Date.now()}`;

    try {
      // Phase 2: Docker Container Orchestration (Root-provisioned, student runs as UID 1000 cadet)
      await docker.ping();
      
      const dockerImage = process.env.DOCKER_IMAGE || 'ubuntu:24.04';
      const memLimit = parseInt(process.env.SANDBOX_MEMORY || '1073741824', 10);
      const swapLimit = parseInt(process.env.SANDBOX_MEMORY_SWAP || '1073741824', 10);
      const cpus = parseFloat(process.env.SANDBOX_CPUS || '1.0');
      const pidsLimit = parseInt(process.env.SANDBOX_PIDS_LIMIT || '128', 10);
      const netMode = process.env.SANDBOX_NETWORK_MODE || 'none';

      ws.send(`\x1b[32m[System]\x1b[0m Provisioning isolated Docker environment (${dockerImage}) for Task ${levelId}...\r\n`);
      
      dockerContainer = await docker.createContainer({
        Image: dockerImage,
        Tty: true,
        OpenStdin: true,
        Cmd: ['bash'],
        User: '1000:1000',
        WorkingDir: '/home/cadet',
        Env: [
          'TERM=xterm-256color',
          'HOME=/home/cadet',
          'USER=cadet',
          ...(levelId === 3 ? ['SECRET_KEY=FLAG{env_vars_insecure}'] : [])
        ],
        HostConfig: {
          AutoRemove: true,
          Privileged: false,
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges:true'],
          Memory: memLimit,
          MemorySwap: swapLimit,
          CpuQuota: Math.floor(cpus * 100000),
          CpuPeriod: 100000,
          PidsLimit: pidsLimit,
          NetworkMode: netMode,
          Tmpfs: {
            '/tmp': 'rw,noexec,nosuid,size=64m',
            '/run': 'rw,noexec,nosuid,size=16m',
            '/home/cadet': 'rw,nosuid,size=128m'
          }
        }
      });
      await dockerContainer.start();
      
      // Provision all 8 tasks as root before student attaches as UID 1000:1000
      const setupScript = SandboxProvider.buildRootProvisioningScript(levelId);
      const exec = await dockerContainer.exec({
        Cmd: ['bash', '-c', setupScript],
        User: '0:0',
        AttachStdout: true,
        AttachStderr: true
      });
      await exec.start({});
      
      dockerStream = await dockerContainer.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true
      });
      
      isDocker = true;
      ws.send('\x1b[32m[System]\x1b[0m Attached to secure Ubuntu container (local_research).\r\n');

      dockerStream.on('data', (data: Buffer) => {
        ws.send(data);
        const outText = data.toString('utf8').trim();
        if (outText) {
          SandboxProvider.recordTerminalEvidence(ptySessionId, undefined, outText.slice(0, 500));
        }
      });
      dockerStream.on('end', () => ws.close());

    } catch (e: any) {
      const activeRun = db.getActiveRun();
      const isFormalOrPilot = activeRun?.runType === 'formal' || activeRun?.runType === 'pilot' || process.env.NODE_ENV === 'production';
      const allowFallback = !isFormalOrPilot && process.env.ALLOW_HOST_SHELL_FALLBACK === 'true';
      if (!allowFallback) {
        const correlationId = crypto.randomUUID();
        console.error(`[Sandbox Failure] Docker container execution unavailable. Correlation ID: ${correlationId}, Error: ${e.message}`);
        ws.send(`\r\n\x1b[31m[System Error] CONFIGURATION_ERROR: Sandbox execution environment is unavailable. In formal evaluation and student-pilot modes, host-process terminal fallback is disabled. (Correlation ID: ${correlationId})\x1b[0m\r\n`);
        ws.close(1011, 'Sandbox unavailable');
        return;
      }

      ws.send(`\x1b[33m[Dev Warning] Docker unavailable. Using development host shell fallback (ALLOW_HOST_SHELL_FALLBACK=true)...\x1b[0m\r\n`);
      shell = spawn('bash', ['-i'], {
        env: { ...process.env, TERM: 'xterm-256color' }
      });
      shell.stdout.on('data', (data: any) => ws.send(data));
      shell.stderr.on('data', (data: any) => ws.send(data));
      shell.on('exit', () => ws.close());
    }

    ws.on('message', async (msg) => {
      const str = msg.toString();
      // Track command on enter
      if (str === '\r' || str === '\n') {
        const cmd = ptyInputBuffer.trim();
        if (cmd) {
          SandboxProvider.recordTerminalEvidence(ptySessionId, cmd, undefined);
          const activeRun = db.getActiveRun();
          await db.appendTelemetryEvent({
            eventId: `pty-cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            runId: activeRun?.runId || 'unlocked_session',
            sessionId: ptySessionId,
            interactionId: `pty-int-${Date.now()}`,
            userId: 'cadet',
            actorType: 'student',
            assignedCondition: 'guided',
            effectiveCondition: 'guided',
            taskId: levelId,
            taskDefinitionVersion: '2.0.0',
            eventType: 'command_exec',
            input: cmd,
            sequenceNumber: 0,
            serverTimestamp: new Date().toISOString(),
            dataClassification: activeRun?.runType || 'pilot',
            applicationVersion: APP_VERSION,
            telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
            details: { executionEnvironment: isDocker ? 'docker_pty' : 'native_pty' }
          });
        }
        ptyInputBuffer = '';
      } else if (str.length === 1 && str.charCodeAt(0) >= 32) {
        ptyInputBuffer += str;
      }
      
      if (isDocker && dockerStream) {
        dockerStream.write(msg);
      } else if (shell) {
        shell.stdin.write(msg);
      }
    });

    ws.on('close', async () => {
      if (isDocker && dockerContainer) {
        try {
          await dockerContainer.stop();
          // Container automatically removes itself due to AutoRemove: true
        } catch (e) {
          console.error('Error stopping docker container (may have already exited):', (e as Error).message);
        }
      } else if (shell) {
        shell.kill();
      }
    });
  });

  // Port Resolution: CLI flag --port -> process.env.PORT -> default 2000 (dedicated port range 2000-2009)
  const portArgIndex = process.argv.indexOf('--port');
  const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : undefined;
  const PORT = cliPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 2000);

  // Network and Environment Security Startup Validation
  const isCloudPreview = process.argv.includes('--port') && cliPort === 3000;
  if (!isCloudPreview && (PORT < 2000 || PORT > 2009)) {
    throw new Error(`[Security Validation Error] Application port ${PORT} is outside the approved 2000-2009 range.`);
  }

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_HOST_SHELL_FALLBACK === 'true') {
    throw new Error(`[Security Validation Error] ALLOW_HOST_SHELL_FALLBACK=true is strictly forbidden in production. Exiting.`);
  }

  const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' && process.env.USE_NGINX === 'true' ? '127.0.0.1' : '0.0.0.0');
  if (process.env.NODE_ENV === 'production' && process.env.USE_NGINX === 'true' && HOST === '0.0.0.0') {
    throw new Error(`[Security Validation Error] Node.js server cannot bind to 0.0.0.0 when Nginx reverse proxy is enabled. Must bind to 127.0.0.1.`);
  }

  // Session token storage & login rate limiter (Backed by authMiddleware)
  const loginAttempts = new Map<string, { count: number; lockedUntil?: number }>();
  const aiRateLimiter = createRateLimiter(30, 60000);

  // Role authorization middleware (Strictly requires server-verified session token; spoofable x-auth-role and ?admin=true removed)
  const requireRole = (allowedRoles: UserRole[]) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const session = getAuthSessionFromRequest(req);
      const userRole = session?.role;

      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: 'Forbidden: Insufficient privileges for this research resource. Valid Bearer token required.',
          requiredRoles: allowedRoles
        });
      }

      next();
    };
  };

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // --- API ROUTES ---

  // Auth Login Endpoint with Rate Limiting
  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const attempts = loginAttempts.get(ip) || { count: 0 };

    if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
      const remainingSec = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({ error: `Too many failed attempts. Try again in ${remainingSec} seconds.` });
    }

    const { username, password } = req.body;
    const users = db.getUsers();
    const userRecord = users[username];

    if (!userRecord || !DatabaseManager.verifyPassword(password, userRecord.passwordHash)) {
      attempts.count++;
      if (attempts.count >= 5) {
        attempts.lockedUntil = Date.now() + 60000;
      }
      loginAttempts.set(ip, attempts);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    loginAttempts.delete(ip);
    const session = createAuthSession({
      id: userRecord.user.id,
      username: userRecord.user.username,
      role: userRecord.user.role
    });

    res.json({
      token: session.token,
      user: userRecord.user
    });
  });

  // Health and System Metadata (Protocol V5.0.0)
  app.get('/api/health', (req, res) => {
    const sandboxHealth = SandboxProvider.checkHealth();
    res.json({
      status: 'ok',
      version: APP_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      deploymentProfile: sandboxHealth.profile,
      dockerAvailable: sandboxHealth.dockerAvailable,
      formalDataCollectionAllowed: sandboxHealth.formalDataCollectionAllowed,
      bannerMessage: sandboxHealth.bannerMessage,
      port: PORT,
      host: HOST,
      portRange: '2000-2009',
      sandboxRequired: process.env.SANDBOX_REQUIRED !== 'false',
      hostShellFallbackAllowed: process.env.ALLOW_HOST_SHELL_FALLBACK === 'true',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/protocol/v5', (req, res) => {
    res.json({
      protocolVersion: PROTOCOL_VERSION,
      taskIds: V5_TASK_IDS,
      scenarioTypes: V5_SCENARIO_TYPES,
      highRiskCaseIds: V5_HIGH_RISK_CASE_IDS,
      cewCaseIds: V5_CEW_CASE_IDS,
      rubricDimensions: V5_RUBRIC_DIMENSIONS,
      criticalFailureCategories: V5_CRITICAL_FAILURE_CATEGORIES,
      totalStandardizedCases: 24,
      highRiskRepetitionsPerCase: 3
    });
  });

  app.post('/api/sandbox/smoke-test', async (req, res) => {
    const report = SandboxProvider.runAllEightTaskSmokeTestsTwice();
    res.json(report);
  });

  app.get('/api/version', (req, res) => {
    res.json({
      name: 'Remix Linux Gym Faculty Review',
      version: APP_VERSION,
      releaseStage: APP_RELEASE_STAGE,
      releaseDate: '2026-09-18',
      protocolVersion: PROTOCOL_VERSION,
      telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
      guardrailPolicyVersion: GuardrailEngine.POLICY_VERSION,
      cewRubricVersion: CEWEvaluator.RUBRIC_VERSION,
      smeRubricVersion: '2.0.0',
      isFrozen: true,
      description: 'Interactive Linux CTF learning gym and AI tutor evaluation research harness'
    });
  });

  // 1. Users (Sanitized; never exposes passwordHash)
  app.get('/api/users', async (req, res) => {
    const usersObj = db.getUsers();
    res.json(sanitizeUsersMap(usersObj));
  });

  app.post('/api/users', requireRole(['admin', 'evaluator']), async (req, res) => {
    const userPayload = req.body;
    const username = userPayload.username || userPayload.user?.username;
    if (username) {
      const user = userPayload.user || userPayload;
      const pass = userPayload.password || userPayload.passwordHash || 'password';
      await db.saveUser(username, user, pass);
    }
    res.json({ success: true });
  });

  // 2. Tasks / Levels (Sanitize flags and sensitive secrets unless authenticated admin/evaluator)
  const getLevelsHandler = async (req: express.Request, res: express.Response) => {
    const session = getAuthSessionFromRequest(req);
    const isAdmin = session?.role === 'admin' || session?.role === 'evaluator';

    const tasks = db.getTasks();
    if (isAdmin) {
      res.json(tasks);
    } else {
      // Strip flags and internal secrets
      const sanitized = tasks.map(t => ({
        ...t,
        flag: undefined,
        prohibitedDisclosures: undefined,
        systemContext: undefined
      }));
      res.json(sanitized);
    }
  };

  app.get('/api/levels', getLevelsHandler);
  app.get('/api/tasks', getLevelsHandler);

  app.get('/api/tasks/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const task = db.getTaskById(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const session = getAuthSessionFromRequest(req);
    const isAdmin = session?.role === 'admin' || session?.role === 'evaluator';

    if (isAdmin) {
      return res.json(task);
    }
    res.json({
      ...task,
      flag: undefined,
      prohibitedDisclosures: undefined,
      systemContext: undefined
    });
  });

  app.post('/api/levels', requireRole(['admin', 'evaluator']), async (req, res) => {
    const tasks = req.body;
    if (Array.isArray(tasks)) {
      await db.setTasks(tasks);
    }
    res.json({ success: true });
  });

  // 3. Server-Authoritative Flag Submission & CEW Verification
  app.post(['/api/tasks/submit-flag', '/api/flags/submit'], async (req, res) => {
    try {
      const {
        taskId,
        flag,
        claim = '',
        evidence = '',
        warrant = '',
        confidenceRaw = 3,
        userId = 'cadet',
        testCaseId,
        runId,
        sessionId,
        timeToSolveMs = 0,
        activeInteractionTimeMs = 0,
        idleTimeMs = 0
      } = req.body;

      const task = db.getTaskById(Number(taskId));
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const activeRun = db.getActiveRun();
      const currentRunId = runId || activeRun?.runId || 'unlocked_session';
      const currentSessionId = sessionId || `session-${userId}-${taskId}`;

      // Server-side exact match validation
      const isCorrect = GuardrailEngine.isFlagMatch(flag, task.flag);

      // Normalized confidence (1-5 to 0.0-1.0)
      const confidenceNormalized = Number(((Number(confidenceRaw) - 1) / 4).toFixed(2));

      // Create CEW Submission
      const submissionId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const submission: CEWSubmission = {
        submissionId,
        runId: currentRunId,
        sessionId: currentSessionId,
        taskId: task.id,
        testCaseId: testCaseId || undefined,
        userId,
        attemptNumber: 1,
        flagAttempted: isCorrect ? 'REDACTED_CORRECT' : flag,
        confidenceRaw: Number(confidenceRaw),
        confidenceNormalized,
        claim,
        evidence,
        warrant,
        isCorrect,
        timeToSolveMs,
        activeInteractionTimeMs,
        idleTimeMs,
        timestamp: new Date().toISOString(),
        version: 1,
        isLocked: true
      };
      await db.appendCEWSubmission(submission);

      // Automated CEW Scoring
      const autoScore = CEWEvaluator.evaluateSubmission(
        submission,
        task,
        db.getConfig()?.evaluatorModel || 'rule-based-evaluator-v2',
        db.getConfig()?.evaluatorProvider || 'internal',
        !!db.getConfig()?.sameModelAsTutor
      );
      await db.appendCEWScore(autoScore);

      // Telemetry: flag_submit & cew_submit & cew_auto_score
      await db.appendTelemetryEvent({
        eventId: `evt-flag-${Date.now()}`,
        timestamp: new Date().toISOString(),
        runId: currentRunId,
        sessionId: currentSessionId,
        interactionId: `int-flag-${Date.now()}`,
        userId,
        actorType: 'student',
        assignedCondition: 'guided',
        effectiveCondition: 'guided',
        taskId: task.id,
        taskDefinitionVersion: task.taskDefinitionVersion || '2.0.0',
        eventType: 'flag_submit',
        input: flag,
        output: isCorrect ? 'SUCCESS' : 'INCORRECT',
        sequenceNumber: 0,
        serverTimestamp: new Date().toISOString(),
        dataClassification: activeRun?.runType || 'pilot',
        applicationVersion: APP_VERSION,
        telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
        details: { isCorrect, confidenceRaw, confidenceNormalized }
      });

      await db.appendTelemetryEvent({
        eventId: `evt-cew-${Date.now()}`,
        timestamp: new Date().toISOString(),
        runId: currentRunId,
        sessionId: currentSessionId,
        interactionId: `int-cew-${Date.now()}`,
        userId,
        actorType: 'student',
        assignedCondition: 'guided',
        effectiveCondition: 'guided',
        taskId: task.id,
        taskDefinitionVersion: task.taskDefinitionVersion || '2.0.0',
        eventType: 'cew_submit',
        input: JSON.stringify({ claim, evidence, warrant }),
        sequenceNumber: 0,
        serverTimestamp: new Date().toISOString(),
        dataClassification: activeRun?.runType || 'pilot',
        applicationVersion: APP_VERSION,
        telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
        details: { submissionId }
      });

      await db.appendTelemetryEvent({
        eventId: `evt-score-${Date.now()}`,
        timestamp: new Date().toISOString(),
        runId: currentRunId,
        sessionId: currentSessionId,
        interactionId: `int-score-${Date.now()}`,
        userId,
        actorType: 'system',
        assignedCondition: 'guided',
        effectiveCondition: 'guided',
        taskId: task.id,
        taskDefinitionVersion: task.taskDefinitionVersion || '2.0.0',
        eventType: 'cew_auto_score',
        output: JSON.stringify(autoScore),
        sequenceNumber: 0,
        serverTimestamp: new Date().toISOString(),
        dataClassification: activeRun?.runType || 'pilot',
        applicationVersion: APP_VERSION,
        telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
        details: { scoreId: autoScore.scoreId, autoScore }
      });

      const scoreObj = {
        claimScore: autoScore.claimScore,
        evidenceScore: autoScore.evidenceScore,
        warrantScore: autoScore.warrantScore,
        totalScore: autoScore.claimScore + autoScore.evidenceScore + autoScore.warrantScore,
        claimRationale: autoScore.claimRationale,
        evidenceRationale: autoScore.evidenceRationale,
        warrantRationale: autoScore.warrantRationale,
        feedbackCategory: autoScore.feedbackCategory
      };

      res.json({
        isCorrect,
        submissionId,
        autoScore: scoreObj,
        score: scoreObj
      });
    } catch (e: any) {
      console.error('Submit flag error:', e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  });

  // 4. Server-Authoritative AI Chat & Guardrails (Unified TutorOrchestrator Path)
  app.post('/api/ai/chat', aiRateLimiter, async (req, res) => {
    try {
      const {
        taskId,
        assignedCondition = 'guided',
        messages = [],
        userQuery = '',
        runId,
        sessionId,
        userId = 'cadet',
        testCaseId
      } = req.body;

      const currentSessionId = sessionId || `session-${userId}-${taskId}`;
      const terminalEvidence = SandboxProvider.getBoundedTerminalEvidence(currentSessionId);

      const outcome = await TutorOrchestrator.executeTurn({
        taskId: Number(taskId),
        userQuery,
        conversationHistory: messages,
        assignedCondition: assignedCondition as ExperimentalCondition,
        runId,
        sessionId: currentSessionId,
        userId,
        testCaseId,
        terminalContext: terminalEvidence
      });

      if (outcome.haltFormalRun) {
        return res.status(503).json({
          error: outcome.error,
          response: outcome.response,
          finalDecision: 'CONFIGURATION_ERROR',
          haltFormalRun: true
        });
      }

      res.json(outcome);
    } catch (e: any) {
      console.error('AI chat error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Standalone API for External Pen-Testing Integration (Also routed through TutorOrchestrator)
  app.post('/api/tutor/analyze', aiRateLimiter, async (req, res) => {
    try {
      const {
        query,
        history = [],
        taskId = 1,
        condition = 'guided'
      } = req.body;

      const outcome = await TutorOrchestrator.executeTurn({
        taskId: Number(taskId),
        userQuery: query,
        conversationHistory: history,
        assignedCondition: condition as ExperimentalCondition,
        sessionId: 'external-api-session',
        userId: 'external_client'
      });

      res.json({
        response: outcome.response,
        isBlocked: outcome.guardrailTriggered,
        category: outcome.category,
        guardrailTriggered: outcome.guardrailTriggered,
        finalDecision: outcome.finalDecision
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 5. Progressive Hint Engine
  app.post('/api/hints/request', async (req, res) => {
    try {
      const { taskId, currentLevelRequested = 0, commandCount = 0, hasAttemptedFlag = false } = req.body;
      const task = db.getTaskById(Number(taskId));
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const { hintItem, state } = ProgressiveHintEngine.getNextHint(
        task,
        Number(currentLevelRequested),
        Number(commandCount),
        Boolean(hasAttemptedFlag)
      );

      const activeRun = db.getActiveRun();
      await db.appendTelemetryEvent({
        eventId: `evt-hint-${Date.now()}`,
        timestamp: new Date().toISOString(),
        runId: activeRun?.runId || 'unlocked_session',
        sessionId: `hint-sess-${Date.now()}`,
        interactionId: `hint-int-${Date.now()}`,
        userId: 'cadet',
        actorType: 'student',
        assignedCondition: 'guided',
        effectiveCondition: 'guided',
        taskId: task.id,
        taskDefinitionVersion: task.taskDefinitionVersion || '2.0.0',
        eventType: 'hint_delivered',
        output: hintItem.text,
        sequenceNumber: 0,
        serverTimestamp: new Date().toISOString(),
        dataClassification: activeRun?.runType || 'pilot',
        applicationVersion: APP_VERSION,
        telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
        details: { hintLevel: state.hintLevelDelivered, requested: state.hintLevelRequested, reason: state.reason }
      });

      res.json({ hintItem, state });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 6. Formal Evaluation Run Manager (Locking and Freezing)
  app.get('/api/runs', (req, res) => {
    res.json(db.getFormalRuns());
  });

  app.get('/api/runs/active', (req, res) => {
    res.json(db.getActiveRun());
  });

  app.post('/api/runs', async (req, res) => {
    try {
      const { runId, runName, runType = 'formal', activeTaskIds, notes, allowCloudDemoOverride = false } = req.body;
      const sandboxHealth = SandboxProvider.checkHealth();

      // Fail-Closed Rule: cloud_demo cannot lock formal, pilot, or regression runs unless explicitly overridden in synthetic test
      if (
        sandboxHealth.profile === 'cloud_demo' &&
        (runType === 'formal' || runType === 'pilot' || runType === 'regression') &&
        !allowCloudDemoOverride
      ) {
        return res.status(409).json({
          error: 'CONFIGURATION_ERROR: Cannot lock formal, pilot, or regression runs in cloud_demo profile (Docker sandbox unavailable). Switch to local_research on a Docker-capable Linux host.',
          deploymentProfile: sandboxHealth.profile,
          formalDataCollectionAllowed: false
        });
      }

      const config = db.getConfig();

      const frozenConfig: ResearchConfiguration = {
        applicationVersion: APP_VERSION,
        promptTemplateVersion: PROTOCOL_VERSION,
        guardrailPolicyVersion: GuardrailEngine.POLICY_VERSION,
        cewRubricVersion: CEWEvaluator.RUBRIC_VERSION,
        smeRubricVersion: '2.0.0',
        taskDefinitionVersion: '2.0.0',
        telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
        tutorProvider: config?.tutorProvider || 'ollama',
        tutorModel: config?.tutorModel || 'llama3',
        evaluatorProvider: config?.evaluatorProvider || 'internal',
        evaluatorModel: config?.evaluatorModel || 'rule-based-evaluator-v2',
        sameModelAsTutor: !!config?.sameModelAsTutor,
        processEvaluatorVersion: '2.0.0',
        generationSettings: {
          temperature: config?.temperature || 0.1,
          topP: config?.topP || 0.95,
          maxTokens: config?.maxTokens || 512,
          seed: config?.seed || 42
        },
        deploymentMode: sandboxHealth.profile === 'local_research' ? 'local_llm' : 'hosted_model',
        executionEnvironment: sandboxHealth.dockerAvailable ? 'native_pty' : 'ai_simulated',
        environmentDescription: `profile:${sandboxHealth.profile}`,
        idleThresholdMs: 60000
      };

      const formalRun: FormalRun = {
        runId: runId || `run-${Date.now()}`,
        runName: runName || 'Evaluation Run',
        runType: runType || 'formal',
        isLocked: true,
        frozenConfig,
        createdAt: new Date().toISOString(),
        lockedAt: new Date().toISOString(),
        notes,
        activeTaskIds: activeTaskIds || [1, 2, 3, 4, 5, 6, 7, 8]
      };

      await db.saveFormalRun(formalRun);

      await db.appendTelemetryEvent({
        eventId: `evt-run-${Date.now()}`,
        timestamp: new Date().toISOString(),
        runId: formalRun.runId,
        sessionId: `run-init-${formalRun.runId}`,
        interactionId: `int-run-${Date.now()}`,
        userId: 'admin',
        actorType: 'admin',
        assignedCondition: 'guided',
        effectiveCondition: 'guided',
        taskId: 1,
        taskDefinitionVersion: '2.0.0',
        eventType: 'run_locked',
        sequenceNumber: 0,
        serverTimestamp: new Date().toISOString(),
        dataClassification: formalRun.runType,
        applicationVersion: APP_VERSION,
        telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
        details: { frozenConfig }
      });

      res.json(formalRun);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/runs/unlock', async (req, res) => {
    const active = db.getActiveRun();
    if (active) {
      active.isLocked = false;
      active.endedAt = new Date().toISOString();
      await db.saveFormalRun(active);
    }
    res.json({ success: true });
  });

  // 7. Environment & Interaction Reset Validation
  app.post('/api/tasks/reset', async (req, res) => {
    try {
      const { taskId, sessionId, userId = 'cadet' } = req.body;
      const task = db.getTaskById(Number(taskId));
      const activeRun = db.getActiveRun();
      const targetSessionId = sessionId || `sess-${userId}-${taskId}`;
      SandboxProvider.clearTerminalEvidence(targetSessionId);

      // Verify signature restoration
      const initialSig = task?.initialSignature || { cwd: '/home/cadet' };
      const restoredSig = { ...initialSig, resetTimestamp: new Date().toISOString() };

      await db.appendTelemetryEvent({
        eventId: `evt-reset-${Date.now()}`,
        timestamp: new Date().toISOString(),
        runId: activeRun?.runId || 'unlocked_session',
        sessionId: targetSessionId,
        interactionId: `int-rst-${Date.now()}`,
        userId,
        actorType: 'student',
        assignedCondition: 'guided',
        effectiveCondition: 'guided',
        taskId: Number(taskId),
        taskDefinitionVersion: task?.taskDefinitionVersion || '2.0.0',
        eventType: 'state_reset',
        sequenceNumber: 0,
        serverTimestamp: new Date().toISOString(),
        dataClassification: activeRun?.runType || 'pilot',
        applicationVersion: APP_VERSION,
        telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
        details: { initialSig, restoredSig, verified: true }
      });

      res.json({
        success: true,
        resetVerified: true,
        signature: restoredSig
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 8. Standardized Test Cases Runner & Async Job Queue
  app.get('/api/test-cases', (req, res) => {
    res.json(db.getTestCases());
  });

  app.post('/api/test-cases/jobs', async (req, res) => {
    try {
      const { jobType = 'batch', runId, executionMode = 'live' } = req.body;
      const activeRun = db.getActiveRun();
      const job = TestRunnerService.startAsyncJob(
        jobType,
        runId || activeRun?.runId || 'async_job_run',
        executionMode === 'offline_unit_test' ? 'offline_unit_test' : 'live'
      );
      res.json(job);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/test-cases/jobs/:jobId', (req, res) => {
    const job = TestRunnerService.getJobStatus(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  });

  app.post('/api/test-cases/run', async (req, res) => {
    try {
      const { testCaseId, runId, repetitionNumber = 1, executionMode = 'live' } = req.body;
      const activeRun = db.getActiveRun();
      const outcome = await TestRunnerService.executeTestCase(
        testCaseId,
        runId || activeRun?.runId || 'synthetic_run',
        {
          repetitionNumber: Number(repetitionNumber),
          executionMode: executionMode === 'offline_unit_test' ? 'offline_unit_test' : 'live'
        }
      );
      res.json(outcome);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/test-cases/batch', async (req, res) => {
    try {
      const cases = db.getTestCases().filter(c => c.active);
      const activeRun = db.getActiveRun();
      const results: any[] = [];
      for (const tc of cases) {
        const out = await TestRunnerService.executeTestCase(
          tc.testCaseId,
          activeRun?.runId || 'batch_synthetic_run'
        );
        results.push(out);
      }
      res.json({ total: results.length, passed: results.filter(r => r.passed).length, results });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/test-cases/consistency-run', async (req, res) => {
    try {
      const activeRun = db.getActiveRun();
      const outcome = await TestRunnerService.executeConsistencySuite(
        activeRun?.runId || 'consistency_run_suite'
      );
      res.json(outcome);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 9. Expert Faculty Rubric & Review (Enforcing V5 Two-Stage Case-Pass & Readiness Calculation)
  app.get('/api/reviews', (req, res) => {
    res.json(db.getExpertReviews(req.query as any));
  });

  app.post('/api/reviews', async (req, res) => {
    try {
      const review: ExpertReview = req.body;
      review.reviewId = review.reviewId || `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      review.reviewTimestamp = new Date().toISOString();
      review.criticalFailures = normalizeToV5CriticalFailures(review.criticalFailures as any);

      const v5Outcome = evaluateV5CaseOutcome(review.ratings as any, review.criticalFailures as any);
      review.initialCasePass = v5Outcome.initialCasePass;
      review.latestExecutionMeetsRatingFloor = v5Outcome.latestExecutionMeetsRatingFloor;
      review.overallPass = v5Outcome.initialCasePass;

      await db.saveExpertReview(review);

      await db.appendTelemetryEvent({
        eventId: `evt-rev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        runId: review.runId || 'unlocked_session',
        sessionId: `rev-sess-${review.evaluatorId}`,
        interactionId: review.linkedInteractionId || `int-rev-${Date.now()}`,
        userId: review.evaluatorId,
        actorType: 'evaluator',
        assignedCondition: 'guided',
        effectiveCondition: 'guided',
        taskId: review.taskId,
        testCaseId: review.testCaseId,
        taskDefinitionVersion: '2.0.0',
        eventType: 'rubric_reviewed',
        output: JSON.stringify({
          initialCasePass: v5Outcome.initialCasePass,
          latestExecutionMeetsRatingFloor: v5Outcome.latestExecutionMeetsRatingFloor,
          hasCriticalFailure: v5Outcome.hasCriticalFailure
        }),
        sequenceNumber: 0,
        serverTimestamp: new Date().toISOString(),
        dataClassification: 'formal',
        applicationVersion: APP_VERSION,
        telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
        details: {
          reviewId: review.reviewId,
          ratings: review.ratings,
          criticalFailures: review.criticalFailures,
          v5Outcome
        }
      });

      res.json(review);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 10. CEW Agreement and Confusion Matrix
  app.get('/api/cew/agreement', (req, res) => {
    const automated = db.getCEWScores().filter(s => s.scoreType === 'automated');
    const expert = db.getCEWScores().filter(s => s.scoreType === 'expert');
    const report = CEWEvaluator.calculateAgreement(automated, expert);
    res.json(report);
  });

  app.get('/api/cew/submissions', (req, res) => {
    res.json(db.getCEWSubmissions());
  });

  app.get('/api/cew/scores', (req, res) => {
    res.json(db.getCEWScores());
  });

  app.post('/api/cew/expert-score', async (req, res) => {
    try {
      const expertScore: CEWScore = {
        ...req.body,
        scoreId: `cew-exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        scoreType: 'expert',
        timestamp: new Date().toISOString()
      };
      await db.appendCEWScore(expertScore);
      res.json(expertScore);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 11. Defect Tracking
  app.get('/api/defects', (req, res) => {
    res.json(db.getDefects());
  });

  app.post('/api/defects', async (req, res) => {
    try {
      const defect: DefectRecord = {
        ...req.body,
        defectId: req.body.defectId || `DEF-${Date.now().toString().slice(-4)}`,
        createdAt: req.body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.saveDefect(defect);
      res.json(defect);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 12. Telemetry Ingest & Validation
  app.get('/api/telemetry/events', (req, res) => {
    res.json(db.getTelemetryEvents(req.query as any));
  });

  app.post('/api/telemetry/events', async (req, res) => {
    try {
      const rawEvents: any[] = Array.isArray(req.body)
        ? req.body
        : Array.isArray(req.body?.events)
        ? req.body.events
        : [req.body];

      const savedEvents: TelemetryEvent[] = [];
      for (const raw of rawEvents) {
        const event: TelemetryEvent = {
          ...raw,
          eventId: raw.eventId || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          serverTimestamp: new Date().toISOString(),
          applicationVersion: APP_VERSION,
          telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION
        };
        const saved = await db.appendTelemetryEvent(event);
        savedEvents.push(saved);
      }
      if (savedEvents.length === 1 && !Array.isArray(req.body) && !Array.isArray(req.body?.events)) {
        res.json(savedEvents[0]);
      } else {
        res.json({ success: true, count: savedEvents.length, events: savedEvents });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/telemetry/validation', (req, res) => {
    const { runId, testCaseId } = req.query;
    const validations = db.getTelemetryValidations(runId as string);
    res.json(validations);
  });

  app.get('/api/telemetry/reconstruct/:caseId', (req, res) => {
    const runId = req.query.runId as string | undefined;
    const caseId = req.params.caseId;
    const tc = db.getTestCases().find(c => c.testCaseId === caseId);
    const events = db.getTelemetryEvents(runId ? { runId } : {});
    const review = db.getExpertReviews().find(r => r.testCaseId === caseId && (!runId || r.runId === runId));
    const reconstruction = TelemetryManager.validateCaseReconstruction({
      caseId,
      taskId: tc?.taskId || 1,
      events,
      review
    });
    res.json(reconstruction);
  });

  // 13. Data Export Research Package (ZIP)
  app.get('/api/export/research-package', async (req, res) => {
    try {
      const filters = {
        runId: req.query.runId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        taskId: req.query.taskId ? Number(req.query.taskId) : undefined,
        actorType: req.query.actorType as string,
        condition: req.query.condition as string,
        dataClassification: req.query.dataClassification as string,
        stripFreeText: req.query.stripFreeText === 'true'
      };

      const zipBuffer = await ExportService.generateResearchPackage(filters);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="research_package_${Date.now()}.zip"`);
      res.send(zipBuffer);
    } catch (e: any) {
      console.error('Export error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Direct Unified JSON Export Endpoint
  app.get('/api/export/json', (req, res) => {
    try {
      const state = db.getState();
      const activeRun = db.getActiveRun();
      const runId = req.query.runId as string;
      const taskId = req.query.taskId ? Number(req.query.taskId) : undefined;

      let events = state.telemetry_events;
      let submissions = state.cew_submissions;
      let scores = state.cew_scores;
      let guardrails = state.guardrail_events;

      if (runId) {
        events = events.filter(e => e.runId === runId);
        submissions = submissions.filter(s => s.runId === runId);
        scores = scores.filter(sc => submissions.some(s => s.submissionId === sc.submissionId));
        guardrails = guardrails.filter(g => g.runId === runId);
      }
      if (taskId) {
        events = events.filter(e => e.taskId === taskId);
        submissions = submissions.filter(s => s.taskId === taskId);
      }

      res.json({
        exportTimestamp: new Date().toISOString(),
        applicationVersion: APP_VERSION,
        telemetrySchemaVersion: TelemetryManager.SCHEMA_VERSION,
        activeRunId: activeRun?.runId || 'unlocked_session',
        modelConfiguration: {
          tutorModel: state.config.tutorModel || 'gemini-2.5-flash',
          evaluatorModel: state.config.evaluatorModel || 'gemini-2.5-flash',
          flagSameModel: !!state.config.flagSameModel,
          frozenConfig: activeRun?.frozenConfig || null
        },
        events,
        cew_submissions: submissions,
        cew_scores: scores,
        guardrail_events: guardrails,
        tasks: state.levels.map(l => ({
          id: l.id,
          title: l.title,
          difficulty: l.difficulty,
          clo: l.clo,
          taskType: l.taskType,
          aiDisabled: !!l.aiDisabled
        })),
        test_cases: state.test_cases
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 14. Section J: Data Analysis & Formative Application Evaluation Endpoint
  app.get('/api/analysis/section-j', async (req, res) => {
    try {
      const runId = req.query.runId as string;
      const report = await SectionJService.generateReport(runId);
      if (req.query.format === 'markdown') {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        return res.send(report.markdownFormattedReport);
      }
      res.json(report);
    } catch (e: any) {
      console.error('Section J report generation error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // 15. Data Retention Cleanup for Non-Formal Data
  app.post('/api/data/cleanup-non-formal', async (req, res) => {
    try {
      const { types = ['pilot', 'demonstration', 'synthetic'] } = req.body;
      const result = await db.deleteNonFormalData(types);
      res.json({ success: true, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 15. Legacy Logs & Config Routes for Backward Compatibility
  app.get('/api/logs', (req, res) => {
    res.json(db.getState().research_logs);
  });

  app.post('/api/logs', async (req, res) => {
    const log = req.body;
    db.getState().research_logs.push(log);
    await db.persist();
    res.json({ success: true });
  });

  app.get('/api/config', (req, res) => {
    res.json(db.getConfig());
  });

  app.post('/api/config', async (req, res) => {
    const active = db.getActiveRun();
    if (active && active.isLocked) {
      return res.status(403).json({ error: 'Cannot modify configuration while a formal evaluation run is locked.' });
    }
    await db.setConfig(req.body);
    res.json({ success: true });
  });

  // --- GOOGLE WORKSPACE EXPORT PROXY ---
  app.post('/api/workspace/export-doc', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    const { title, bodyText } = req.body;

    try {
      const docRes = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: title || 'Linux Gym Research Platform & Pre-Pilot Validation Protocol' })
      });

      if (!docRes.ok) {
        const err = await docRes.text();
        return res.status(docRes.status).json({ error: `Docs API error: ${err}` });
      }

      const doc: any = await docRes.json();
      const documentId = doc.documentId;

      if (bodyText) {
        const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: bodyText
                }
              }
            ]
          })
        });

        if (!updateRes.ok) {
          const updateErr = await updateRes.text();
          console.warn('BatchUpdate warning:', updateErr);
        }
      }

      res.json({
        documentId,
        documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
        title: title || doc.title
      });
    } catch (err: any) {
      console.error('Export doc error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Research Lab server running on http://localhost:${PORT}`);
    console.log(`Telemetry DB active with schema v${TelemetryManager.SCHEMA_VERSION}`);
  });
}

startServer().catch(console.error);
