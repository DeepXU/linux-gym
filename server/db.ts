import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { INITIAL_LEVELS } from '../constants';
import {
  FormalRun,
  TelemetryEvent,
  TestCase,
  Level,
  CEWSubmission,
  CEWScore,
  ExpertReview,
  DefectRecord,
  GuardrailEventRecord,
  GuardrailDecisionRecord,
  TelemetryValidationReport,
  ResearchLog,
  User,
  AIConfig,
  GroundTruthRecord,
  SequesteredCaseRecord,
  CaseExecutionRecord,
  TutorInteractionRecord,
  ExecutionIntegrityReport,
  ContainerSessionRecord,
  TerminalCommandRecord,
  TerminalOutputRecord,
  RegressionComparisonRecord
} from '../types';
import {
  DEFAULT_AI_PROVIDER,
  DEFAULT_OLLAMA_URL,
  DEFAULT_TUTOR_MODEL,
  DEFAULT_GUARD_MODEL,
  validateOllamaModelRole
} from './protocolV5';
import {
  buildInitialGroundTruthRecords,
  getCanonicalSequesteredCases
} from './studyInstrumentation';

export interface DatabaseState {
  version: string;
  users: Record<string, { user: User; passwordHash: string }>;
  levels: Level[];
  formal_runs: FormalRun[];
  telemetry_events: TelemetryEvent[];
  test_cases: TestCase[];
  ground_truth: GroundTruthRecord[];
  sequestered_cases: SequesteredCaseRecord[];
  knownCaseRegressionComplete: boolean;
  case_executions: CaseExecutionRecord[];
  interactions: TutorInteractionRecord[];
  integrity_reports: ExecutionIntegrityReport[];
  container_sessions: ContainerSessionRecord[];
  terminal_commands: TerminalCommandRecord[];
  terminal_outputs: TerminalOutputRecord[];
  regression_comparisons: RegressionComparisonRecord[];
  cew_submissions: CEWSubmission[];
  cew_scores: CEWScore[];
  expert_reviews: ExpertReview[];
  expert_reviews_history: ExpertReview[];
  exportedReviewIds: string[];
  defects: DefectRecord[];
  guardrail_events: GuardrailEventRecord[];
  guardrail_decisions?: GuardrailDecisionRecord[];
  telemetry_validations: TelemetryValidationReport[];
  research_logs: ResearchLog[];
  config: AIConfig | null;
  activeRunId: string | null;
}

export class DatabaseManager {
  private dataDir: string;
  private jsonPath: string;
  private jsonlPath: string;
  private cmdJsonlPath: string;
  private outJsonlPath: string;
  private state: DatabaseState;
  private writeLock: Promise<void> = Promise.resolve();
  private sessionSequences: Map<string, number> = new Map();
  private idempotencyKeys: Map<string, TelemetryEvent> = new Map();

  public static hashPassword(password: string): string {
    if (password.startsWith('scrypt$')) return password;
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${derived}`;
  }

  public static verifyPassword(password: string, hash: string): boolean {
    if (!password || !hash) return false;
    if (hash.startsWith('scrypt$')) {
      const parts = hash.split('$');
      if (parts.length !== 3) return false;
      const [, salt, keyHex] = parts;
      const derived = crypto.scryptSync(password, salt, 64);
      const keyBuf = Buffer.from(keyHex, 'hex');
      if (derived.length !== keyBuf.length) return false;
      return crypto.timingSafeEqual(derived, keyBuf);
    }
    const legacyComputed = crypto.createHash('sha256').update(password + '_ctf_salt').digest('hex');
    return hash === legacyComputed;
  }

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.jsonPath = path.join(this.dataDir, 'research_lab.json');
    this.jsonlPath = path.join(this.dataDir, 'telemetry_events_append_only.jsonl');
    this.cmdJsonlPath = path.join(this.dataDir, 'terminal_commands_append_only.jsonl');
    this.outJsonlPath = path.join(this.dataDir, 'terminal_outputs_append_only.jsonl');

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.state = this.loadState();
  }

  private getDefaultState(): DatabaseState {
    const isProd = process.env.NODE_ENV === 'production';
    const allowDemo = process.env.ALLOW_DEMO_ACCOUNTS === 'true';

    let adminPass = process.env.ADMIN_INITIAL_PASSWORD;
    if (isProd && !adminPass) {
      adminPass = crypto.randomBytes(12).toString('hex');
      console.log(`\n===================================================================`);
      console.log(`[FIRST-RUN SECURITY PROVISIONING] Generated initial admin password:`);
      console.log(`  Username: admin`);
      console.log(`  Password: ${adminPass}`);
      console.log(`Please log in and update your administrative password immediately.`);
      console.log(`===================================================================\n`);
    } else if (!adminPass) {
      adminPass = 'admin';
    }

    const defaultUsers: Record<string, { user: User; passwordHash: string }> = {
      admin: {
        user: { id: 'admin-root', username: 'admin', role: 'admin' },
        passwordHash: DatabaseManager.hashPassword(adminPass)
      }
    };

    if (!isProd || allowDemo) {
      defaultUsers['faculty_reviewer'] = {
        user: { id: 'evaluator-fac1', username: 'faculty_reviewer', role: 'evaluator' },
        passwordHash: DatabaseManager.hashPassword('faculty')
      };
      defaultUsers['demo_cadet'] = {
        user: { id: 'student-demo1', username: 'demo_cadet', role: 'student', condition: 'guided' },
        passwordHash: DatabaseManager.hashPassword('password')
      };
    }

    return {
      version: '3.0.0',
      users: defaultUsers,
      levels: [],
      formal_runs: [],
      telemetry_events: [],
      test_cases: [],
      ground_truth: [],
      sequestered_cases: getCanonicalSequesteredCases(),
      knownCaseRegressionComplete: false,
      case_executions: [],
      interactions: [],
      integrity_reports: [],
      container_sessions: [],
      terminal_commands: [],
      terminal_outputs: [],
      regression_comparisons: [],
      cew_submissions: [],
      cew_scores: [],
      expert_reviews: [],
      expert_reviews_history: [],
      exportedReviewIds: [],
      defects: [],
      guardrail_events: [],
      guardrail_decisions: [],
      telemetry_validations: [],
      research_logs: [],
      config: {
        provider: DEFAULT_AI_PROVIDER,
        ollamaUrl: process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL,
        ollamaModel: process.env.OLLAMA_MODEL || DEFAULT_TUTOR_MODEL,
        llamaGuardModel: process.env.LLAMA_GUARD_MODEL || DEFAULT_GUARD_MODEL,
        enableLlamaGuard: true,
        tutorProvider: DEFAULT_AI_PROVIDER,
        tutorModel: process.env.OLLAMA_MODEL || DEFAULT_TUTOR_MODEL,
        evaluatorProvider: DEFAULT_AI_PROVIDER,
        evaluatorModel: process.env.OLLAMA_MODEL || DEFAULT_TUTOR_MODEL,
        sameModelAsTutor: true,
        temperature: 0.1,
        topP: 0.95,
        maxTokens: 512,
        seed: 42,
        deploymentMode: 'local_llm',
        executionEnvironment: 'native_pty'
      },
      activeRunId: null
    };
  }

  private normalizeConfigToOllamaDefault(cfg: any, defaultCfg: AIConfig): AIConfig {
    if (!cfg) return defaultCfg;
    const merged: AIConfig = { ...defaultCfg, ...cfg };
    if (!merged.provider || merged.provider === 'gemini') {
      merged.provider = DEFAULT_AI_PROVIDER;
    }
    if (!merged.tutorProvider || merged.tutorProvider === 'gemini') {
      merged.tutorProvider = DEFAULT_AI_PROVIDER;
    }
    if (!merged.evaluatorProvider || merged.evaluatorProvider === 'gemini') {
      merged.evaluatorProvider = DEFAULT_AI_PROVIDER;
    }
    if (
      !merged.ollamaModel ||
      merged.ollamaModel === 'llama3' ||
      merged.ollamaModel === 'llama3.3:70b' ||
      merged.ollamaModel.toLowerCase().includes('embed')
    ) {
      merged.ollamaModel = process.env.OLLAMA_MODEL || DEFAULT_TUTOR_MODEL;
    }
    if (
      !merged.tutorModel ||
      merged.tutorModel.startsWith('gemini') ||
      merged.tutorModel === 'llama3' ||
      merged.tutorModel === 'llama3.3:70b' ||
      merged.tutorModel.toLowerCase().includes('embed')
    ) {
      merged.tutorModel = merged.ollamaModel || DEFAULT_TUTOR_MODEL;
    }
    if (
      !merged.evaluatorModel ||
      merged.evaluatorModel.startsWith('gemini') ||
      merged.evaluatorModel === 'llama3' ||
      merged.evaluatorModel === 'llama3.3:70b' ||
      merged.evaluatorModel.toLowerCase().includes('embed')
    ) {
      merged.evaluatorModel = merged.ollamaModel || DEFAULT_TUTOR_MODEL;
    }
    if (
      !merged.ollamaUrl ||
      merged.ollamaUrl.includes('localhost:2004') ||
      merged.ollamaUrl.includes('localhost:11434') ||
      merged.ollamaUrl.endsWith('/api/chat') ||
      merged.ollamaUrl.endsWith('/api/generate')
    ) {
      merged.ollamaUrl = (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL)
        .replace(/\/+$/, '')
        .replace(/\/api\/(chat|generate)$/i, '');
    }
    if (!merged.llamaGuardModel || merged.llamaGuardModel.toLowerCase().includes('embed')) {
      merged.llamaGuardModel = process.env.LLAMA_GUARD_MODEL || DEFAULT_GUARD_MODEL;
    }
    merged.deploymentMode = 'local_llm';
    merged.executionEnvironment = 'native_pty';
    return merged;
  }

  private loadState(): DatabaseState {
    const defaultState = this.getDefaultState();
    if (!fs.existsSync(this.jsonPath)) {
      this.persistSync(defaultState);
      return defaultState;
    }

    try {
      const raw = fs.readFileSync(this.jsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      const merged: DatabaseState = {
        version: parsed.version || '3.0.0',
        users: parsed.users || defaultState.users,
        levels: Array.isArray(parsed.levels) ? parsed.levels.filter((t: any) => t && t.id >= 1 && t.id <= 8) : [],
        formal_runs: Array.isArray(parsed.formal_runs) ? parsed.formal_runs : [],
        telemetry_events: Array.isArray(parsed.telemetry_events) ? parsed.telemetry_events : [],
        test_cases: Array.isArray(parsed.test_cases) ? parsed.test_cases : [],
        ground_truth: Array.isArray(parsed.ground_truth) ? parsed.ground_truth : [],
        sequestered_cases:
          Array.isArray(parsed.sequestered_cases) && parsed.sequestered_cases.length === 6
            ? parsed.sequestered_cases
            : getCanonicalSequesteredCases(),
        knownCaseRegressionComplete: Boolean(parsed.knownCaseRegressionComplete),
        case_executions: Array.isArray(parsed.case_executions) ? parsed.case_executions : [],
        interactions: Array.isArray(parsed.interactions) ? parsed.interactions : [],
        integrity_reports: Array.isArray(parsed.integrity_reports) ? parsed.integrity_reports : [],
        container_sessions: Array.isArray(parsed.container_sessions) ? parsed.container_sessions : [],
        terminal_commands: Array.isArray(parsed.terminal_commands) ? parsed.terminal_commands : [],
        terminal_outputs: Array.isArray(parsed.terminal_outputs) ? parsed.terminal_outputs : [],
        regression_comparisons: Array.isArray(parsed.regression_comparisons) ? parsed.regression_comparisons : [],
        cew_submissions: Array.isArray(parsed.cew_submissions)
          ? parsed.cew_submissions.map((sub: any) => ({
              ...sub,
              claim: sub.claim || sub.claimText || '',
              evidence: sub.evidence || sub.evidenceText || '',
              warrant: sub.warrant || sub.warrantText || '',
              claimText: sub.claimText || sub.claim || '',
              evidenceText: sub.evidenceText || sub.evidence || '',
              warrantText: sub.warrantText || sub.warrant || '',
              confidenceRaw: sub.confidenceRaw ?? sub.studentConfidence ?? 3
            }))
          : [],
        cew_scores: Array.isArray(parsed.cew_scores) ? parsed.cew_scores : [],
        expert_reviews: Array.isArray(parsed.expert_reviews) ? parsed.expert_reviews : [],
        expert_reviews_history: Array.isArray(parsed.expert_reviews_history) ? parsed.expert_reviews_history : [],
        exportedReviewIds: Array.isArray(parsed.exportedReviewIds) ? parsed.exportedReviewIds : [],
        defects: Array.isArray(parsed.defects) ? parsed.defects : [],
        guardrail_events: Array.isArray(parsed.guardrail_events) ? parsed.guardrail_events : [],
        guardrail_decisions: Array.isArray(parsed.guardrail_decisions) ? parsed.guardrail_decisions : [],
        telemetry_validations: Array.isArray(parsed.telemetry_validations) ? parsed.telemetry_validations : [],
        research_logs: Array.isArray(parsed.research_logs) ? parsed.research_logs : [],
        config: this.normalizeConfigToOllamaDefault(parsed.config, defaultState.config!),
        activeRunId: parsed.activeRunId || null
      };

      if (merged.ground_truth.length === 0 && merged.test_cases.length > 0) {
        merged.ground_truth = buildInitialGroundTruthRecords(merged.test_cases);
      }

      this.persistSync(merged);
      return merged;
    } catch (e) {
      console.error('Error loading database JSON, using default state:', e);
      return defaultState;
    }
  }

  private persistSync(state: DatabaseState): void {
    const tmpPath = `${this.jsonPath}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.jsonPath);
  }

  public async persist(): Promise<void> {
    this.writeLock = this.writeLock.then(async () => {
      try {
        const tmpPath = `${this.jsonPath}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
        await fs.promises.writeFile(tmpPath, JSON.stringify(this.state, null, 2), 'utf8');
        await fs.promises.rename(tmpPath, this.jsonPath);
      } catch (err) {
        console.error('Failed to write database file atomically:', err);
      }
    });
    return this.writeLock;
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public getConfig(): AIConfig | null {
    return this.state.config;
  }

  public async setConfig(config: AIConfig): Promise<void> {
    if (config.ollamaModel) validateOllamaModelRole(config.ollamaModel, 'tutor');
    if (config.tutorModel) validateOllamaModelRole(config.tutorModel, 'tutor');
    if (config.llamaGuardModel) validateOllamaModelRole(config.llamaGuardModel, 'guard');
    this.state.config = config;
    await this.persist();
  }

  public getActiveRun(): FormalRun | null {
    if (!this.state.activeRunId) return null;
    return this.state.formal_runs.find(r => r.runId === this.state.activeRunId) || null;
  }

  public getFormalRuns(): FormalRun[] {
    return this.state.formal_runs;
  }

  public async saveFormalRun(run: FormalRun): Promise<void> {
    const idx = this.state.formal_runs.findIndex(r => r.runId === run.runId);
    if (idx >= 0) {
      this.state.formal_runs[idx] = run;
    } else {
      this.state.formal_runs.push(run);
    }
    if (run.isLocked) {
      this.state.activeRunId = run.runId;
    } else if (this.state.activeRunId === run.runId) {
      this.state.activeRunId = null;
    }
    await this.persist();
  }

  // Tasks (Canonical 8 Tasks, preserving server-only flags & prohibitedDisclosures)
  public getTasks(): Level[] {
    return this.state.levels
      .filter(t => t.id >= 1 && t.id <= 8)
      .map(t => {
        const canonical = INITIAL_LEVELS.find(c => c.id === t.id);
        if (!canonical) return t;
        return {
          ...t,
          description: canonical.description,
          objective: canonical.objective,
          studentTask: canonical.studentTask,
          goal: canonical.goal,
          context: canonical.context,
          successEvidence: canonical.successEvidence,
          howToWork: canonical.howToWork,
          constraints: canonical.constraints
        };
      });
  }

  public getTaskById(id: number): Level | undefined {
    return this.getTasks().find(t => t.id === id);
  }

  public async setTasks(tasks: Level[]): Promise<void> {
    const existingById = new Map<number, Level>(this.state.levels.map(t => [t.id, t]));
    const sanitizedEight = tasks
      .filter(t => t && typeof t.id === 'number' && t.id >= 1 && t.id <= 8)
      .map(incoming => {
        const existing = existingById.get(incoming.id);
        return {
          ...existing,
          ...incoming,
          flag: incoming.flag !== undefined ? incoming.flag : existing?.flag,
          prohibitedDisclosures:
            incoming.prohibitedDisclosures !== undefined
              ? incoming.prohibitedDisclosures
              : existing?.prohibitedDisclosures,
          systemContext:
            incoming.systemContext !== undefined ? incoming.systemContext : existing?.systemContext
        };
      });
    if (sanitizedEight.length > 0) {
      this.state.levels = sanitizedEight;
      await this.persist();
    }
  }

  public async saveTask(task: Level): Promise<void> {
    if (task.id < 1 || task.id > 8) return;
    const idx = this.state.levels.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      const existing = this.state.levels[idx];
      this.state.levels[idx] = {
        ...existing,
        ...task,
        flag: task.flag !== undefined ? task.flag : existing.flag,
        prohibitedDisclosures:
          task.prohibitedDisclosures !== undefined
            ? task.prohibitedDisclosures
            : existing.prohibitedDisclosures,
        systemContext:
          task.systemContext !== undefined ? task.systemContext : existing.systemContext
      };
    } else {
      this.state.levels.push(task);
    }
    await this.persist();
  }

  // Users
  public getUsers(): Record<string, { user: User; passwordHash: string }> {
    return this.state.users;
  }

  public async saveUser(username: string, user: User, passwordOrHash: string): Promise<void> {
    const passwordHash =
      passwordOrHash.startsWith('scrypt$') || passwordOrHash.length === 64
        ? passwordOrHash
        : DatabaseManager.hashPassword(passwordOrHash);
    const cleanUser: User = {
      id: user.id || `user-${username}`,
      username: user.username || username,
      role: user.role || 'student',
      condition: 'guided'
    };
    this.state.users[username] = { user: cleanUser, passwordHash };
    await this.persist();
  }

  // Telemetry Events
  public getTelemetryEvents(filter?: {
    runId?: string;
    sessionId?: string;
    taskId?: number;
    userId?: string;
    actorType?: string;
    eventType?: string;
    testCaseId?: string;
    executionId?: string;
  }): TelemetryEvent[] {
    const events = this.state.telemetry_events;
    if (!filter) return events;
    return events.filter(e => {
      if (filter.runId && e.runId !== filter.runId) return false;
      if (filter.sessionId && e.sessionId !== filter.sessionId) return false;
      if (filter.taskId !== undefined && e.taskId !== filter.taskId) return false;
      if (filter.userId && e.userId !== filter.userId) return false;
      if (filter.actorType && e.actorType !== filter.actorType) return false;
      if (filter.eventType && e.eventType !== filter.eventType) return false;
      if (filter.testCaseId && e.testCaseId !== filter.testCaseId) return false;
      if (filter.executionId && e.executionId !== filter.executionId) return false;
      return true;
    });
  }

  public async appendTelemetryEvent(event: TelemetryEvent): Promise<TelemetryEvent> {
    const idempKey = event.idempotencyKey || event.details?.idempotencyKey || event.eventId;
    if (idempKey) {
      const existing =
        this.idempotencyKeys.get(idempKey) ||
        this.state.telemetry_events.find(
          e =>
            e.eventId === idempKey ||
            e.idempotencyKey === idempKey ||
            (e.details?.idempotencyKey && e.details.idempotencyKey === idempKey)
        );
      if (existing) {
        return existing;
      }
    }

    const sessId = event.sessionId || 'default_session';
    const execId = event.executionId || event.details?.executionId || sessId;
    const prevSessionMax =
      this.sessionSequences.get(sessId) ??
      this.state.telemetry_events
        .filter(e => e.sessionId === sessId || (e.executionId && e.executionId === execId))
        .reduce((max, e) => Math.max(max, e.sequenceNumber || 0), 0);
    const nextSeq = prevSessionMax + 1;
    this.sessionSequences.set(sessId, nextSeq);
    if (execId !== sessId) {
      this.sessionSequences.set(execId, nextSeq);
    }
    event.sequenceNumber = nextSeq;
    event.executionId = execId;
    event.serverTimestamp = event.serverTimestamp || new Date().toISOString();
    event.payload = event.payload || {
      ...(event.input !== undefined ? { input: event.input } : {}),
      ...(event.output !== undefined ? { output: event.output } : {}),
      ...(event.details || {})
    };
    event.payloadSha256 =
      event.payloadSha256 ||
      'sha256:' + crypto.createHash('sha256').update(JSON.stringify(event.payload)).digest('hex');

    if (idempKey) {
      this.idempotencyKeys.set(idempKey, event);
    }
    this.state.telemetry_events.push(event);

    try {
      await fs.promises.appendFile(this.jsonlPath, JSON.stringify(event) + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to append to telemetry JSONL stream:', err);
    }

    const legacyLog: ResearchLog = {
      timestamp: event.timestamp,
      userId: event.userId,
      username: event.userId,
      levelId: event.taskId,
      type:
        event.eventType === 'flag_submit'
          ? 'flag_attempt'
          : event.eventType === 'level_start' || event.eventType === 'task_started'
          ? 'level_start'
          : event.eventType === 'suggestion_accepted' || event.eventType === 'suggestion_rejected'
          ? 'override_event'
          : 'command',
      input: event.input || '',
      output: event.output || '',
      condition: event.assignedCondition,
      runId: event.runId,
      sessionId: event.sessionId,
      sequenceNumber: event.sequenceNumber,
      eventId: event.eventId,
      ...(event.details?.legacyMetrics ? { metrics: event.details.legacyMetrics } : {}),
      ...(event.details?.isCorrect !== undefined ? { isCorrect: event.details.isCorrect } : {})
    };
    this.state.research_logs.push(legacyLog);

    await this.persist();
    return event;
  }

  public auditSequenceIntegrity(sessionId?: string): {
    totalEvents: number;
    isMonotonic: boolean;
    missingSequences: number[];
    duplicateSequences: number[];
    outOfOrderCount: number;
    conflictingTimestampsCount: number;
  } {
    const events = sessionId
      ? this.state.telemetry_events.filter(e => e.sessionId === sessionId)
      : this.state.telemetry_events;

    const seenSeq = new Set<number>();
    const duplicateSequences: number[] = [];
    const missingSequences: number[] = [];
    let outOfOrderCount = 0;
    let conflictingTimestampsCount = 0;

    const seqNums = events.map(e => e.sequenceNumber).filter(n => typeof n === 'number');
    const minSeq = seqNums.length > 0 ? Math.min(...seqNums) : 1;
    const maxSeq = seqNums.length > 0 ? Math.max(...seqNums) : 0;

    for (const num of seqNums) {
      if (seenSeq.has(num)) {
        duplicateSequences.push(num);
      }
      seenSeq.add(num);
    }

    for (let i = minSeq; i <= maxSeq; i++) {
      if (!seenSeq.has(i)) {
        missingSequences.push(i);
      }
    }

    for (let i = 1; i < events.length; i++) {
      if (events[i].sequenceNumber < events[i - 1].sequenceNumber) {
        outOfOrderCount++;
      }
      if (new Date(events[i].timestamp).getTime() < new Date(events[i - 1].timestamp).getTime()) {
        conflictingTimestampsCount++;
      }
    }

    return {
      totalEvents: events.length,
      isMonotonic: missingSequences.length === 0 && duplicateSequences.length === 0 && outOfOrderCount === 0,
      missingSequences,
      duplicateSequences,
      outOfOrderCount,
      conflictingTimestampsCount
    };
  }

  public validateRecordLinkages(): {
    totalSubmissions: number;
    orphanedSubmissions: number;
    unscoredSubmissions: number;
    orphanedScores: number;
    orphanedReviews: number;
    linkagePassRate: number;
  } {
    const taskIds = new Set(this.state.levels.map(l => l.id));
    const subIds = new Set(this.state.cew_submissions.map(s => s.submissionId));

    let orphanedSubmissions = 0;
    for (const sub of this.state.cew_submissions) {
      if (!taskIds.has(sub.taskId)) {
        orphanedSubmissions++;
      }
    }

    let unscoredSubmissions = 0;
    const scoredSubIds = new Set(this.state.cew_scores.map(s => s.submissionId));
    for (const sub of this.state.cew_submissions) {
      if (!scoredSubIds.has(sub.submissionId)) {
        unscoredSubmissions++;
      }
    }

    let orphanedScores = 0;
    for (const score of this.state.cew_scores) {
      if (!subIds.has(score.submissionId)) {
        orphanedScores++;
      }
    }

    let orphanedReviews = 0;
    for (const rev of this.state.expert_reviews) {
      if (!taskIds.has(rev.taskId)) {
        orphanedReviews++;
      }
    }

    const totalRecords = this.state.cew_submissions.length + this.state.cew_scores.length + this.state.expert_reviews.length;
    const totalAnomalies = orphanedSubmissions + unscoredSubmissions + orphanedScores + orphanedReviews;
    const linkagePassRate = totalRecords > 0 ? Number((((totalRecords - totalAnomalies) / totalRecords) * 100).toFixed(1)) : 100;

    return {
      totalSubmissions: this.state.cew_submissions.length,
      orphanedSubmissions,
      unscoredSubmissions,
      orphanedScores,
      orphanedReviews,
      linkagePassRate
    };
  }

  // Test Cases
  public getTestCases(): TestCase[] {
    return this.state.test_cases;
  }

  public async setTestCases(cases: TestCase[]): Promise<void> {
    this.state.test_cases = cases;
    if (this.state.ground_truth.length === 0 && cases.length > 0) {
      this.state.ground_truth = buildInitialGroundTruthRecords(cases);
    }
    await this.persist();
  }

  public async saveTestCase(tc: TestCase): Promise<void> {
    const idx = this.state.test_cases.findIndex(t => t.testCaseId === tc.testCaseId || t.id === tc.id);
    if (idx >= 0) {
      this.state.test_cases[idx] = tc;
    } else {
      this.state.test_cases.push(tc);
    }
    await this.persist();
  }

  // Ground Truth Records (Requirement 3.3)
  public getGroundTruthRecords(): GroundTruthRecord[] {
    if (this.state.ground_truth.length === 0 && this.state.test_cases.length > 0) {
      this.state.ground_truth = buildInitialGroundTruthRecords(this.state.test_cases);
    }
    return this.state.ground_truth;
  }

  public getGroundTruthByCaseId(caseId: string): GroundTruthRecord | undefined {
    return this.getGroundTruthRecords().find(g => g.caseId === caseId);
  }

  public async saveGroundTruthRecord(record: GroundTruthRecord): Promise<void> {
    const list = this.getGroundTruthRecords();
    const idx = list.findIndex(g => g.caseId === record.caseId);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.push(record);
    }
    this.state.ground_truth = list;
    await this.persist();
  }

  public async setGroundTruthRecords(records: GroundTruthRecord[]): Promise<void> {
    this.state.ground_truth = records;
    await this.persist();
  }

  public deleteGroundTruthRecord(caseId: string): void {
    this.state.ground_truth = this.getGroundTruthRecords().filter(g => g.caseId !== caseId);
    void this.persist();
  }

  // Sequestered Cases & Gate (Requirement 3.4)
  public getSequesteredCases(): SequesteredCaseRecord[] {
    if (!this.state.sequestered_cases || this.state.sequestered_cases.length === 0) {
      this.state.sequestered_cases = getCanonicalSequesteredCases();
    }
    return this.state.sequestered_cases;
  }

  public isKnownCaseRegressionComplete(): boolean {
    return Boolean(this.state.knownCaseRegressionComplete);
  }

  public setKnownCaseRegressionComplete(completed: boolean): void {
    this.state.knownCaseRegressionComplete = completed;
    if (!completed) {
      this.state.sequestered_cases = this.getSequesteredCases().map(sq => ({
        ...sq,
        sealed: true
      }));
    }
    void this.persist();
  }

  public releaseSequesteredCases(releasedBy: string): SequesteredCaseRecord[] {
    if (!this.state.knownCaseRegressionComplete) {
      throw new Error(
        'SEQUESTERED_LOCKED: Sequestered acceptance cases (SQ-01..SQ-06) cannot be unsealed or executed until knownCaseRegressionComplete === true.'
      );
    }
    const now = new Date().toISOString();
    this.state.sequestered_cases = this.getSequesteredCases().map(sq => ({
      ...sq,
      sealed: false,
      releasedAt: sq.releasedAt || now,
      releasedBy: sq.releasedBy || releasedBy
    }));
    void this.persist();
    return this.state.sequestered_cases;
  }

  // Case Executions
  public getCaseExecutions(filter?: { runId?: string; testCaseId?: string; executionId?: string; runType?: string }): CaseExecutionRecord[] {
    const list = this.state.case_executions || [];
    if (!filter) return list;
    return list.filter(e => {
      if (filter.runId && e.runId !== filter.runId) return false;
      if (filter.testCaseId && e.testCaseId !== filter.testCaseId) return false;
      if (filter.executionId && e.executionId !== filter.executionId) return false;
      if (filter.runType && e.runType !== filter.runType && e.data_classification !== filter.runType) return false;
      return true;
    });
  }

  public async saveCaseExecution(exec: CaseExecutionRecord): Promise<void> {
    if (!this.state.case_executions) this.state.case_executions = [];
    const idx = this.state.case_executions.findIndex(e => e.executionId === exec.executionId);
    if (idx >= 0) {
      this.state.case_executions[idx] = exec;
    } else {
      this.state.case_executions.push(exec);
    }
    await this.persist();
  }

  // Tutor Interactions (Requirement 3.5)
  public getInteractions(filter?: { runId?: string; caseId?: string; executionId?: string; sessionId?: string; taskId?: number }): TutorInteractionRecord[] {
    const list = this.state.interactions || [];
    if (!filter) return list;
    return list.filter(i => {
      if (filter.runId && i.runId !== filter.runId) return false;
      if (filter.caseId && i.caseId !== filter.caseId) return false;
      if (filter.executionId && i.executionId !== filter.executionId) return false;
      if (filter.sessionId && i.sessionId !== filter.sessionId) return false;
      if (filter.taskId !== undefined && i.taskId !== filter.taskId) return false;
      return true;
    });
  }

  public async appendInteraction(record: TutorInteractionRecord): Promise<void> {
    if (!this.state.interactions) this.state.interactions = [];
    const idx = this.state.interactions.findIndex(i => i.interactionId === record.interactionId);
    if (idx >= 0) {
      this.state.interactions[idx] = record;
    } else {
      this.state.interactions.push(record);
    }
    await this.persist();
  }

  // Record Integrity Reports (Requirement 3.2)
  public getIntegrityReports(filter?: { runId?: string; caseId?: string; executionId?: string }): ExecutionIntegrityReport[] {
    const list = this.state.integrity_reports || [];
    if (!filter) return list;
    return list.filter(r => {
      if (filter.runId && r.runId !== filter.runId) return false;
      if (filter.caseId && r.caseId !== filter.caseId) return false;
      if (filter.executionId && r.executionId !== filter.executionId) return false;
      return true;
    });
  }

  public async saveIntegrityReport(report: ExecutionIntegrityReport): Promise<void> {
    if (!this.state.integrity_reports) this.state.integrity_reports = [];
    const idx = this.state.integrity_reports.findIndex(r => r.executionId === report.executionId);
    if (idx >= 0) {
      this.state.integrity_reports[idx] = report;
    } else {
      this.state.integrity_reports.push(report);
    }
    await this.persist();
  }

  // Container Sessions (Requirement 3.7)
  public getContainerSessions(filter?: { sessionId?: string; taskId?: number; caseId?: string }): ContainerSessionRecord[] {
    const list = this.state.container_sessions || [];
    if (!filter) return list;
    return list.filter(c => {
      if (filter.sessionId && c.sessionId !== filter.sessionId) return false;
      if (filter.taskId !== undefined && c.taskId !== filter.taskId) return false;
      if (filter.caseId && c.caseId !== filter.caseId) return false;
      return true;
    });
  }

  public async saveContainerSession(rec: ContainerSessionRecord): Promise<void> {
    if (!this.state.container_sessions) this.state.container_sessions = [];
    const idx = this.state.container_sessions.findIndex(
      c => c.sessionId === rec.sessionId && c.containerId === rec.containerId
    );
    if (idx >= 0) {
      this.state.container_sessions[idx] = rec;
    } else {
      this.state.container_sessions.push(rec);
    }
    await this.persist();
  }

  // Terminal Commands & Outputs (Requirement 3.8)
  public getTerminalCommands(filter?: { sessionId?: string; taskId?: number; caseId?: string; executionId?: string; runId?: string }): TerminalCommandRecord[] {
    const list = this.state.terminal_commands || [];
    if (!filter) return list;
    return list.filter(c => {
      if (filter.sessionId && c.sessionId !== filter.sessionId) return false;
      if (filter.taskId !== undefined && c.taskId !== filter.taskId) return false;
      if (filter.caseId && c.caseId !== filter.caseId) return false;
      if (filter.executionId && c.executionId !== filter.executionId) return false;
      if (filter.runId && c.runId !== filter.runId) return false;
      return true;
    });
  }

  public async appendTerminalCommand(cmd: TerminalCommandRecord): Promise<TerminalCommandRecord> {
    if (!this.state.terminal_commands) this.state.terminal_commands = [];
    const sessCmds = this.state.terminal_commands.filter(c => c.sessionId === cmd.sessionId);
    const nextSeq = sessCmds.reduce((m, c) => Math.max(m, c.sequenceNumber || 0), 0) + 1;
    cmd.sequenceNumber = cmd.sequenceNumber || nextSeq;
    this.state.terminal_commands.push(cmd);
    try {
      await fs.promises.appendFile(this.cmdJsonlPath, JSON.stringify(cmd) + '\n', 'utf8');
    } catch {
      // ignore jsonl write failure
    }
    await this.persist();
    return cmd;
  }

  public getTerminalOutputs(filter?: { sessionId?: string; taskId?: number; caseId?: string; executionId?: string; runId?: string }): TerminalOutputRecord[] {
    const list = this.state.terminal_outputs || [];
    if (!filter) return list;
    return list.filter(o => {
      if (filter.sessionId && o.sessionId !== filter.sessionId) return false;
      if (filter.taskId !== undefined && o.taskId !== filter.taskId) return false;
      if (filter.caseId && o.caseId !== filter.caseId) return false;
      if (filter.executionId && o.executionId !== filter.executionId) return false;
      if (filter.runId && o.runId !== filter.runId) return false;
      return true;
    });
  }

  public async appendTerminalOutput(out: TerminalOutputRecord): Promise<TerminalOutputRecord> {
    if (!this.state.terminal_outputs) this.state.terminal_outputs = [];
    const sessOuts = this.state.terminal_outputs.filter(o => o.sessionId === out.sessionId);
    const nextSeq = sessOuts.reduce((m, o) => Math.max(m, o.sequenceNumber || 0), 0) + 1;
    out.sequenceNumber = out.sequenceNumber || nextSeq;
    this.state.terminal_outputs.push(out);
    try {
      await fs.promises.appendFile(this.outJsonlPath, JSON.stringify(out) + '\n', 'utf8');
    } catch {
      // ignore jsonl write failure
    }
    await this.persist();
    return out;
  }

  // Regression Comparisons (Requirement 3.10 & 3.11)
  public getRegressionComparisons(runId?: string): RegressionComparisonRecord[] {
    const list = this.state.regression_comparisons || [];
    if (!runId) return list;
    return list.filter(c => c.regressionRunId === runId || c.round1RunId === runId);
  }

  public async saveRegressionComparison(comp: RegressionComparisonRecord): Promise<void> {
    if (!this.state.regression_comparisons) this.state.regression_comparisons = [];
    const idx = this.state.regression_comparisons.findIndex(c => c.comparisonId === comp.comparisonId);
    if (idx >= 0) {
      this.state.regression_comparisons[idx] = comp;
    } else {
      this.state.regression_comparisons.push(comp);
    }
    await this.persist();
  }

  // CEW Submissions & Scores
  public getCEWSubmissions(filter?: { runId?: string; taskId?: number; userId?: string }): CEWSubmission[] {
    const list = this.state.cew_submissions;
    if (!filter) return list;
    return list.filter(s => {
      if (filter.runId && s.runId !== filter.runId) return false;
      if (filter.taskId !== undefined && s.taskId !== filter.taskId) return false;
      if (filter.userId && s.userId !== filter.userId) return false;
      return true;
    });
  }

  public async appendCEWSubmission(sub: CEWSubmission): Promise<void> {
    this.state.cew_submissions.push(sub);
    await this.persist();
  }

  public getCEWScores(submissionId?: string): CEWScore[] {
    if (!submissionId) return this.state.cew_scores;
    return this.state.cew_scores.filter(s => s.submissionId === submissionId);
  }

  public async appendCEWScore(score: CEWScore): Promise<void> {
    this.state.cew_scores.push(score);
    await this.persist();
  }

  // Expert Reviews (with Versioned Edits and Exported Read-Only Lock per Requirement 3.10)
  public getExpertReviews(filter?: { runId?: string; taskId?: number; testCaseId?: string; executionId?: string }): ExpertReview[] {
    const list = this.state.expert_reviews;
    if (!filter) return list;
    return list.filter(r => {
      if (filter.runId && r.runId !== filter.runId) return false;
      if (filter.taskId !== undefined && r.taskId !== filter.taskId) return false;
      if (filter.testCaseId && r.testCaseId !== filter.testCaseId) return false;
      if (filter.executionId && r.executionId !== filter.executionId) return false;
      return true;
    });
  }

  public getExpertReviewsHistory(): ExpertReview[] {
    return this.state.expert_reviews_history || [];
  }

  public async markReviewsExported(reviewIds: string[]): Promise<void> {
    if (!this.state.exportedReviewIds) this.state.exportedReviewIds = [];
    const set = new Set([...this.state.exportedReviewIds, ...reviewIds]);
    this.state.exportedReviewIds = Array.from(set);
    for (const r of this.state.expert_reviews) {
      if (set.has(r.reviewId)) {
        r.readOnlyAfterExport = true;
      }
    }
    await this.persist();
  }

  public async saveExpertReview(review: ExpertReview, editedBy?: string): Promise<ExpertReview> {
    if (!this.state.expert_reviews_history) this.state.expert_reviews_history = [];
    if (!this.state.exportedReviewIds) this.state.exportedReviewIds = [];

    const idx = this.state.expert_reviews.findIndex(r => r.reviewId === review.reviewId);
    if (idx >= 0) {
      const existing = this.state.expert_reviews[idx];
      if (existing.readOnlyAfterExport || this.state.exportedReviewIds.includes(existing.reviewId)) {
        throw new Error(
          `READ_ONLY_EXPORTED_RECORD: Review ${existing.reviewId} has been exported in a formal archive and is immutable.`
        );
      }
      const prevVersion = existing.version || 1;
      const snapshotId = `${existing.reviewId}-v${prevVersion}`;
      this.state.expert_reviews_history.push({
        ...existing,
        reviewId: snapshotId
      });

      const updated: ExpertReview = {
        ...existing,
        ...review,
        version: prevVersion + 1,
        previousVersionId: snapshotId,
        editedBy: editedBy || review.editedBy || review.reviewerId,
        editedAt: new Date().toISOString()
      };
      this.state.expert_reviews[idx] = updated;
      await this.persist();
      return updated;
    } else {
      const created: ExpertReview = {
        ...review,
        version: review.version || 1,
        editedBy: editedBy || review.editedBy || review.reviewerId,
        editedAt: review.editedAt || review.timestamp || new Date().toISOString()
      };
      this.state.expert_reviews.push(created);
      await this.persist();
      return created;
    }
  }

  // Guardrail Events
  public getGuardrailEvents(runId?: string): GuardrailEventRecord[] {
    if (!runId) return this.state.guardrail_events;
    return this.state.guardrail_events.filter(g => g.runId === runId);
  }

  public async appendGuardrailEvent(event: GuardrailEventRecord): Promise<void> {
    this.state.guardrail_events.push(event);
    await this.persist();
  }

  public getGuardrailDecisions(runId?: string): GuardrailDecisionRecord[] {
    if (!this.state.guardrail_decisions) return [];
    if (!runId) return this.state.guardrail_decisions;
    return this.state.guardrail_decisions.filter(d => d.sessionId === runId || (d as any).runId === runId);
  }

  public async appendGuardrailDecision(decision: GuardrailDecisionRecord): Promise<void> {
    if (!this.state.guardrail_decisions) this.state.guardrail_decisions = [];
    this.state.guardrail_decisions.push(decision);
    await this.persist();
  }

  // Defects
  public getDefects(): DefectRecord[] {
    return this.state.defects;
  }

  public async saveDefect(defect: DefectRecord): Promise<void> {
    const idx = this.state.defects.findIndex(d => d.defectId === defect.defectId);
    if (idx >= 0) {
      this.state.defects[idx] = defect;
    } else {
      this.state.defects.push(defect);
    }
    await this.persist();
  }

  // Telemetry Validations
  public getTelemetryValidations(runId?: string): TelemetryValidationReport[] {
    if (!runId) return this.state.telemetry_validations;
    return this.state.telemetry_validations.filter(v => v.runId === runId);
  }

  public async saveTelemetryValidation(val: TelemetryValidationReport): Promise<void> {
    const idx = this.state.telemetry_validations.findIndex(v => v.validationId === val.validationId);
    if (idx >= 0) {
      this.state.telemetry_validations[idx] = val;
    } else {
      this.state.telemetry_validations.push(val);
    }
    await this.persist();
  }

  // Data Retention / Cleanup
  public async deleteNonFormalData(types: ('pilot' | 'demonstration' | 'regression' | 'synthetic' | 'dev_smoke')[]): Promise<{ deletedEvents: number; deletedRuns: number }> {
    const initialEvents = this.state.telemetry_events.length;
    const initialRuns = this.state.formal_runs.length;

    this.state.telemetry_events = this.state.telemetry_events.filter(e => !types.includes(e.dataClassification as any));
    this.state.formal_runs = this.state.formal_runs.filter(r => !types.includes(r.runType as any) || r.isLocked);
    this.state.research_logs = this.state.research_logs.filter(l => l.runId && this.state.formal_runs.some(r => r.runId === l.runId));

    await this.persist();
    return {
      deletedEvents: initialEvents - this.state.telemetry_events.length,
      deletedRuns: initialRuns - this.state.formal_runs.length
    };
  }

  /**
   * Confirmed Archive-and-Reset (Requirement 3.10):
   * Requires explicit confirmation token 'CONFIRM_ARCHIVE_AND_RESET' (never silent).
   * Archives existing research_lab.json and JSONL files before resetting to a clean study baseline.
   */
  public async archiveAndResetStudyData(
    confirmToken: string,
    initialLevels: Level[] = [],
    initialTestCases: TestCase[] = []
  ): Promise<{ archiveDir: string; archivedFiles: string[]; timestamp: string }> {
    const validTokens = new Set(['CONFIRM_ARCHIVE_AND_RESET', 'ARCHIVE_AND_RESET_STUDY_DATA', 'START NEW COLLECTION']);
    if (!validTokens.has(confirmToken)) {
      throw new Error(
        'CONFIRMATION_REQUIRED: archiveAndResetStudyData requires confirmToken === "CONFIRM_ARCHIVE_AND_RESET".'
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = path.join(this.dataDir, 'archives', `archive_${timestamp}`);
    fs.mkdirSync(archiveDir, { recursive: true });

    const archivedFiles: string[] = [];
    for (const filePath of [this.jsonPath, this.jsonlPath, this.cmdJsonlPath, this.outJsonlPath]) {
      if (fs.existsSync(filePath)) {
        const baseName = path.basename(filePath);
        const dest = path.join(archiveDir, baseName);
        fs.copyFileSync(filePath, dest);
        archivedFiles.push(baseName);
      }
    }

    await this.resetToCleanBaseline(initialLevels, initialTestCases);
    return { archiveDir, archivedFiles, timestamp };
  }

  /**
   * Resets data/research_lab.json and JSONL streams to a clean, unpolluted baseline.
   */
  public async resetToCleanBaseline(initialLevels: Level[] = [], initialTestCases: TestCase[] = []): Promise<void> {
    const cleanState = this.getDefaultState();
    cleanState.levels = initialLevels.filter(l => l.id >= 1 && l.id <= 8);
    cleanState.test_cases = initialTestCases;
    cleanState.ground_truth = buildInitialGroundTruthRecords(initialTestCases);
    cleanState.sequestered_cases = getCanonicalSequesteredCases();
    this.state = cleanState;
    this.sessionSequences.clear();
    this.idempotencyKeys.clear();
    for (const p of [this.jsonlPath, this.cmdJsonlPath, this.outJsonlPath]) {
      if (fs.existsSync(p)) {
        fs.writeFileSync(p, '', 'utf8');
      }
    }
    await this.persist();
  }

  public isFreezeStateLocked(): boolean {
    const activeRun = this.getActiveRun();
    return Boolean(activeRun && activeRun.isLocked);
  }

  public getGovernanceState(): {
    currentState: 'DEVELOPMENT' | 'PILOT_ACTIVE' | 'FORMAL_LOCKED';
    researchMode: string;
    protocolVersion: string;
    applicationVersion: string;
    tutorVersion: string;
    datasetId: string;
    learningMeasureDefined: boolean;
    activeManifest: any;
    protocolDeviations: any[];
    transitionHistory: any[];
  } {
    const activeRun = this.getActiveRun();
    const currentState = activeRun?.isLocked
      ? activeRun.runType === 'pilot'
        ? 'PILOT_ACTIVE'
        : 'FORMAL_LOCKED'
      : 'DEVELOPMENT';
    return {
      currentState,
      researchMode: activeRun?.runType || 'development',
      protocolVersion: 'V5.0.0',
      applicationVersion: '1.0.0',
      tutorVersion: '5.0.0',
      datasetId: activeRun?.runId || 'dataset_v5_baseline',
      learningMeasureDefined: true,
      activeManifest: (activeRun as any)?.frozenManifest || null,
      protocolDeviations: [],
      transitionHistory: []
    };
  }

  public runPreflightCheck(
    targetPhase: string = 'PILOT_ACTIVE',
    allowSkipLiveInfra: boolean = false
  ): {
    targetPhase: string;
    totalChecks: number;
    passedCount: number;
    allMandatoryPassed: boolean;
    checks: { checkId: string; name: string; passed: boolean; detail: string }[];
  } {
    const tasksOk = this.getTasks().length === 8;
    const casesOk = this.getTestCases().length === 24;
    const checks = [
      {
        checkId: 'PF-01',
        name: '8 Canonical Tasks Loaded',
        passed: tasksOk,
        detail: `Loaded ${this.getTasks().length} tasks`
      },
      {
        checkId: 'PF-02',
        name: '24 Standardized Cases Loaded',
        passed: casesOk,
        detail: `Loaded ${this.getTestCases().length} cases`
      },
      {
        checkId: 'PF-03',
        name: 'Live Infrastructure Verification',
        passed: allowSkipLiveInfra,
        detail: allowSkipLiveInfra
          ? 'Live infra skipped by flag'
          : 'Requires live Docker and Ollama on local Ubuntu VM'
      }
    ];
    const passedCount = checks.filter(c => c.passed).length;
    return {
      targetPhase,
      totalChecks: checks.length,
      passedCount,
      allMandatoryPassed: passedCount === checks.length,
      checks
    };
  }
}

export const db = new DatabaseManager();
