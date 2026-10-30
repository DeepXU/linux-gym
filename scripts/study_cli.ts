import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import { execFileSync } from 'child_process';
import { db } from '../server/db';
import { INITIAL_RESEARCH_TASKS } from '../server/serverTasks';
import { SandboxProvider } from '../server/sandboxProvider';
import { RuntimeDigestService } from '../server/runtimeDigests';
import { SocraticTutorEngine } from '../server/socraticTutorEngine';
import { TutorOrchestrator } from '../server/tutorOrchestrator';
import { TestRunnerService } from '../server/testRunner';
import {
  PROTOCOL_VERSION,
  DEFAULT_AI_PROVIDER,
  DEFAULT_OLLAMA_URL,
  DEFAULT_TUTOR_MODEL,
  DEFAULT_GUARD_MODEL,
  validateOllamaModelRole
} from '../server/protocolV5';

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256String(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export async function runStudyBackup(): Promise<{
  backupDir: string;
  dbBackupPath: string;
  sha256: string;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', `collection_backup_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const dbPath = path.join(process.cwd(), 'data', 'research_lab.json');
  if (!fs.existsSync(dbPath)) {
    await db.persist();
  }

  const dbBackupPath = path.join(backupDir, 'research_lab.json');
  fs.copyFileSync(dbPath, dbBackupPath);
  const checksum = sha256File(dbBackupPath);
  const telemetryPath = path.join(process.cwd(), 'data', 'telemetry_events_append_only.jsonl');
  const telemetryBackupPath = path.join(backupDir, 'telemetry_events_append_only.jsonl');
  const telemetryExists = fs.existsSync(telemetryPath);
  if (telemetryExists) fs.copyFileSync(telemetryPath, telemetryBackupPath);
  const telemetryChecksum = telemetryExists ? sha256File(telemetryBackupPath) : undefined;
  const events = db.getTelemetryEvents();

  const sumsContent =
    `${checksum}  research_lab.json\n` +
    (telemetryChecksum ? `${telemetryChecksum}  telemetry_events_append_only.jsonl\n` : '');
  fs.writeFileSync(path.join(backupDir, 'SHA256SUMS.txt'), sumsContent, 'utf8');

  const manifest = {
    backupCreatedAt: new Date().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    sourceFile: 'data/research_lab.json',
    sha256: checksum,
    telemetrySha256: telemetryChecksum,
    recordCounts: {
      executions: new Set(events.map(event => event.details?.executionId).filter(Boolean)).size,
      interactions: new Set(events.map(event => event.interactionId).filter(Boolean)).size,
      telemetryEvents: events.length,
      reviews: db.getExpertReviews().length
    }
  };
  fs.writeFileSync(path.join(backupDir, 'backup_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  return { backupDir, dbBackupPath, sha256: checksum, timestamp };
}

async function promptConfirmation(): Promise<string> {
  if (process.env.CONFIRM_RESET) {
    return process.env.CONFIRM_RESET.trim();
  }
  const confirmArgIdx = process.argv.indexOf('--confirm');
  if (confirmArgIdx !== -1 && process.argv[confirmArgIdx + 1]) {
    return process.argv[confirmArgIdx + 1].trim();
  }
  if (!process.stdin.isTTY) {
    return '';
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question('Type "START NEW COLLECTION" to confirm study archive and reset: ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function runStudyReset(explicitConfirm?: string): Promise<{
  backupDir: string;
  backupSha256: string;
  newRunId: string;
  manifestPath: string;
  sha256SumsPath: string;
}> {
  const confirmation = explicitConfirm ?? (await promptConfirmation());
  if (confirmation !== 'START NEW COLLECTION') {
    throw new Error(
      'Confirmation rejected. You must pass --confirm "START NEW COLLECTION" or CONFIRM_RESET="START NEW COLLECTION".'
    );
  }

  const activeRun = db.getActiveRun();
  const forceUnlock = process.argv.includes('--force-unlock');
  if (activeRun && activeRun.isLocked && !forceUnlock) {
    throw new Error(
      `Active formal run "${activeRun.runId}" is currently locked. Unlock it first or pass --force-unlock.`
    );
  }
  const readiness = await runCollectionReadinessCheck();
  if (!readiness.readyForFormalCollection) {
    const blockers = readiness.checks
      .filter(check => check.status !== 'PASS')
      .map(check => `${check.id}: ${check.detail}`)
      .join(' ');
    throw new Error(`Formal collection reset blocked: ${blockers}`);
  }

  if (activeRun?.isLocked && forceUnlock) {
    await db.saveFormalRun({ ...activeRun, isLocked: false });
  }

  // 1. Create verified backup first
  const backup = await runStudyBackup();

  // 2. Ensure canonical tasks and test cases are initialized
  await TestRunnerService.initTestCases();
  const canonicalCases = db.getTestCases();

  // 3. Archive and reset generated development records via DatabaseManager
  await db.archiveAndResetStudyData('ARCHIVE_AND_RESET_STUDY_DATA', INITIAL_RESEARCH_TASKS, canonicalCases);

  // 4. Create new formal capability run ID and manifest
  const newRunId = `run_formal_cap_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${crypto
    .randomBytes(3)
    .toString('hex')}`;
  const digests = RuntimeDigestService.getRuntimeDigests();
  const cfg = db.getConfig();
  const sandboxHealth = SandboxProvider.checkHealth();

  const runFolder = path.join(process.cwd(), 'data', 'runs', newRunId);
  fs.mkdirSync(runFolder, { recursive: true });

  const collectionManifest = {
    runId: newRunId,
    runType: 'FORMAL_CAPABILITY',
    dataClassification: 'FORMAL_CAPABILITY',
    createdAt: new Date().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    gitCommitSha: digests.applicationCommit,
    backupDir: backup.backupDir,
    backupSha256: backup.sha256,
    deploymentProfile: sandboxHealth.profile,
    dockerAvailable: sandboxHealth.dockerAvailable,
    aiProvider: cfg?.provider || DEFAULT_AI_PROVIDER,
    ollamaUrl: cfg?.ollamaUrl || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL,
    tutorModel: cfg?.ollamaModel || cfg?.tutorModel || DEFAULT_TUTOR_MODEL,
    tutorModelDigest: digests.tutorModelDigest,
    guardModel: cfg?.llamaGuardModel || DEFAULT_GUARD_MODEL,
    guardModelDigest: digests.guardModelDigest,
    sandboxImageTag: SandboxProvider.DEFAULT_DOCKER_IMAGE,
    sandboxImageDigest: digests.sandboxImageDigest,
    systemPromptDigest: digests.systemPromptDigest,
    tasksCount: db.getTasks().length,
    standardizedCasesCount: db.getTestCases().length,
    sequesteredCasesCount: 0,
    sequesteredCaseWorkflowImplemented: false,
    generatedRecordsCleared: true
  };

  const manifestPath = path.join(runFolder, 'collection_manifest.json');
  const manifestJson = JSON.stringify(collectionManifest, null, 2);
  fs.writeFileSync(manifestPath, manifestJson, 'utf8');

  const sha256SumsPath = path.join(runFolder, 'SHA256SUMS.txt');
  const manifestHash = sha256String(manifestJson);
  fs.writeFileSync(sha256SumsPath, `${manifestHash}  collection_manifest.json\n`, 'utf8');

  return {
    backupDir: backup.backupDir,
    backupSha256: backup.sha256,
    newRunId,
    manifestPath,
    sha256SumsPath
  };
}

export async function runCollectionReadinessCheck(): Promise<{
  readyForFormalCollection: boolean;
  decision: 'READY TO BEGIN FORMAL CAPABILITY DATA COLLECTION' | 'NOT READY';
  checks: Array<{
    id: string;
    name: string;
    category: 'automated_offline' | 'live_infrastructure';
    status: 'PASS' | 'FAIL' | 'NOT VERIFIED';
    detail: string;
  }>;
  timestamp: string;
}> {
  const checks: Array<{
    id: string;
    name: string;
    category: 'automated_offline' | 'live_infrastructure';
    status: 'PASS' | 'FAIL' | 'NOT VERIFIED';
    detail: string;
  }> = [];

  await TestRunnerService.initTestCases();
  if (db.getTasks().length === 0) {
    await db.setTasks(INITIAL_RESEARCH_TASKS);
  }

  // Check 1: Task Instructions Completeness & Non-Disclosure
  const tasks = db.getTasks();
  let tasksValid = tasks.length === 8;
  const taskIssues: string[] = [];
  for (const t of tasks) {
    const constraintsStr = Array.isArray(t.constraints) ? t.constraints.join(' ') : (t.constraints || '');
    if (!t.studentTask?.trim() || !t.goal?.trim() || !t.context?.trim() || !t.successEvidence?.trim() || !t.howToWork?.trim() || !constraintsStr.trim()) {
      tasksValid = false;
      taskIssues.push(`Task ${t.id} missing required instruction fields`);
    }
    const visibleText = `${t.studentTask} ${t.goal} ${t.context} ${t.successEvidence} ${t.howToWork} ${constraintsStr}`;
    if (/FLAG\{[^}]+\}/i.test(visibleText) || /\.hidden_flag|\.secret/i.test(visibleText)) {
      tasksValid = false;
      taskIssues.push(`Task ${t.id} leaks flag or hidden filename in student-visible instructions`);
    }
  }
  checks.push({
    id: 'CHK-01',
    name: 'All 8 Tasks Have Non-Disclosing Student Task Instructions',
    category: 'automated_offline',
    status: tasksValid ? 'PASS' : 'FAIL',
    detail: tasksValid
      ? 'All 8 tasks define studentTask, goal, context, successEvidence, howToWork, and constraints with 0 leaked flags or hidden filenames.'
      : taskIssues.join('; ')
  });

  // Check 2: Socratic Tutor Engine & 7 Guidance States
  try {
    const task1 = tasks[0];
    const snapPlainLs = SocraticTutorEngine.buildCuratedContextSnapshot({
      runId: 'verify_run',
      executionId: 'verify_exec_1',
      sessionId: 'verify_sess_1',
      task: task1,
      dataClassification: 'DEVELOPMENT_TEST',
      commands: [
        {
          commandId: 'c1',
          sessionId: 'verify_sess_1',
          taskId: 1,
          sequenceNumber: 1,
          command: 'ls',
          cwd: '/home/cadet',
          exitStatus: 0,
          timestamp: new Date().toISOString(),
          data_classification: 'dev_smoke'
        }
      ],
      outputs: [
        {
          outputId: 'o1',
          sessionId: 'verify_sess_1',
          taskId: 1,
          sequenceNumber: 1,
          rawBytesLen: 14,
          strippedOutput: 'notes.txt',
          truncated: false,
          timestamp: new Date().toISOString(),
          data_classification: 'dev_smoke'
        }
      ],
      interactions: [],
      telemetryEvents: []
    });
    const decPlainLs = SocraticTutorEngine.determineGuidanceDecision({
      task: task1,
      userQuery: 'I ran ls and only see notes.txt. Where is the flag?',
      snapshot: snapPlainLs
    });
    const replyPlainLs = SocraticTutorEngine.generateEvidenceGroundedSocraticReply({
      task: task1,
      userQuery: 'I ran ls and only see notes.txt. Where is the flag?',
      snapshot: snapPlainLs,
      decision: decPlainLs
    });
    const leaksLsA = /\bls\s+-[aAl]+/i.test(replyPlainLs) || /\.hidden_flag/i.test(replyPlainLs);
    checks.push({
      id: 'CHK-02',
      name: 'Evidence-Grounded Socratic Probing & Non-Disclosure',
      category: 'automated_offline',
      status: !leaksLsA && decPlainLs.guidanceState === 'documentation_probe' ? 'PASS' : 'FAIL',
      detail: !leaksLsA
        ? `Plain 'ls' triggers ${decPlainLs.guidanceState} without revealing 'ls -a' or '.hidden_flag'.`
        : `Unexpected disclosure or state: ${decPlainLs.guidanceState}`
    });
  } catch (err: any) {
    checks.push({
      id: 'CHK-02',
      name: 'Evidence-Grounded Socratic Probing & Non-Disclosure',
      category: 'automated_offline',
      status: 'FAIL',
      detail: err.message
    });
  }

  // Check 3: Reserved ask-ai Command Interception
  const parsedAskAi = SocraticTutorEngine.parseReservedAskAiCommand('ask-ai "Why did ls only show one file?"');
  checks.push({
    id: 'CHK-03',
    name: 'Reserved ask-ai Command Parser & Shell Interception',
    category: 'automated_offline',
    status: parsedAskAi.isAskAi && parsedAskAi.question === 'Why did ls only show one file?' ? 'PASS' : 'FAIL',
    detail: parsedAskAi.isAskAi
      ? 'ask-ai commands are intercepted before Bash execution and routed exclusively to TutorOrchestrator.'
      : 'Failed to intercept ask-ai command.'
  });

  // Check 4: Ollama Model Role Validation (nomic-embed-text blocked, llama3.1:8b labeled accurately)
  let embedBlocked = false;
  try {
    validateOllamaModelRole('nomic-embed-text:latest', 'tutor');
  } catch {
    embedBlocked = true;
  }
  const llama31Guard = validateOllamaModelRole('llama3.1:8b', 'guard');
  checks.push({
    id: 'CHK-04',
    name: 'Model Role Validation (Embedding Blocked & Classifier Labeled)',
    category: 'automated_offline',
    status: embedBlocked && llama31Guard.classifierType === 'prompted_classifier' ? 'PASS' : 'FAIL',
    detail:
      embedBlocked && llama31Guard.classifierType === 'prompted_classifier'
        ? 'nomic-embed-text is rejected as tutor/guard; llama3.1:8b is accurately labeled as prompted_classifier.'
        : 'Model role validation check failed.'
  });

  // Check 5: Docker Daemon & Sandbox Image Availability (Live Infrastructure)
  const sandboxHealth = SandboxProvider.checkHealth();
  let sandboxImageBuilt = false;
  if (sandboxHealth.dockerAvailable) {
    try {
      execFileSync('docker', ['image', 'inspect', SandboxProvider.DEFAULT_DOCKER_IMAGE], {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2500
      });
      sandboxImageBuilt = true;
    } catch {
      sandboxImageBuilt = false;
    }
  }
  const smokeResults = sandboxHealth.dockerAvailable && sandboxImageBuilt
    ? SandboxProvider.runAllEightTaskSmokeTestsTwice(true)
    : [];
  const smokeTestsPassed =
    smokeResults.length === 8 &&
    smokeResults.every(result =>
      result.verifiedWithRealDocker &&
      result.executionBackend === 'docker_container' &&
      result.overallPassed &&
      result.leakedContainers.length === 0
    );
  checks.push({
    id: 'CHK-05',
    name: `Docker Daemon & ${SandboxProvider.DEFAULT_DOCKER_IMAGE} Image`,
    category: 'live_infrastructure',
    status: smokeTestsPassed ? 'PASS' : 'NOT VERIFIED',
    detail:
      smokeTestsPassed
        ? `Docker daemon and ${SandboxProvider.DEFAULT_DOCKER_IMAGE} are available; all eight tasks passed two fresh-container runs with no leaks.`
        : `Docker/image availability or real-Docker smoke verification failed (profile: ${sandboxHealth.profile}). ${smokeResults.map(result => result.evidenceSummary).filter(summary => !summary.includes('two fresh Docker containers passed')).join(' ')}`
  });

  // Check 6: Live Local Ollama Endpoint & Tutor Model Availability (Live Infrastructure)
  const config = db.getConfig();
  const configuredOllamaUrl = process.env.OLLAMA_BASE_URL || config?.ollamaUrl || DEFAULT_OLLAMA_URL;
  const ollamaUrl = configuredOllamaUrl
    .replace(/\/api\/chat\/?$/i, '')
    .replace(/\/api\/?$/i, '')
    .replace(/\/+$/, '');
  const targetTutorModel = process.env.OLLAMA_MODEL ||
    (config?.provider === 'ollama' ? config.ollamaModel || config.tutorModel : config?.tutorModel) ||
    DEFAULT_TUTOR_MODEL;
  const targetGuardModel = config?.llamaGuardModel || DEFAULT_GUARD_MODEL;
  let ollamaReachable = false;
  let installedModels: string[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data: any = await res.json();
      ollamaReachable = true;
      installedModels = Array.isArray(data.models) ? data.models.map((m: any) => String(m.name)) : [];
    }
  } catch {
    ollamaReachable = false;
  }
  const tutorModelInstalled = installedModels.some(model => model.toLowerCase() === targetTutorModel.toLowerCase());
  const guardModelInstalled = installedModels.some(model => model.toLowerCase() === targetGuardModel.toLowerCase());
  const localModelStackReady =
    config?.provider === 'ollama' &&
    ollamaReachable &&
    tutorModelInstalled &&
    guardModelInstalled;
  checks.push({
    id: 'CHK-06',
    name: `Live Local Ollama Models (${ollamaUrl})`,
    category: 'live_infrastructure',
    status: localModelStackReady ? 'PASS' : 'NOT VERIFIED',
    detail: localModelStackReady
      ? `Ollama is reachable and both configured models are installed (tutor: ${targetTutorModel}; guard: ${targetGuardModel}).`
      : `Local model stack is not verified. provider=${config?.provider || 'unset'}, reachable=${ollamaReachable}, tutorInstalled=${tutorModelInstalled}, guardInstalled=${guardModelInstalled}.`
  });

  // Check 7: Clean Dataset State (Zero unarchived development records contaminating formal run)
  const devExecutions = db.getTelemetryEvents().filter(
    event => event.dataClassification === 'dev_smoke' || event.dataClassification === 'DEVELOPMENT_TEST'
  );
  checks.push({
    id: 'CHK-07',
    name: 'Dataset Cleanliness & Classification Separation',
    category: 'automated_offline',
    status: devExecutions.length === 0 ? 'PASS' : 'FAIL',
    detail:
      devExecutions.length === 0
        ? 'Database contains 0 development telemetry events.'
        : `${devExecutions.length} development telemetry events remain; archive/reset them before any collection.`
  });

  checks.push({
    id: 'CHK-08',
    name: 'Ground-truth verification and sequestered-case release workflows',
    category: 'automated_offline',
    status: 'FAIL',
    detail: 'These workflows are not implemented in this build; the API explicitly returns HTTP 501.',
  });

  const allPassed = checks.every(c => c.status === 'PASS');
  const decision: 'READY TO BEGIN FORMAL CAPABILITY DATA COLLECTION' | 'NOT READY' = allPassed
    ? 'READY TO BEGIN FORMAL CAPABILITY DATA COLLECTION'
    : 'NOT READY';

  const reportObj = {
    readyForFormalCollection: allPassed,
    decision,
    protocolVersion: PROTOCOL_VERSION,
    timestamp: new Date().toISOString(),
    checks
  };

  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'collection_readiness.json'), JSON.stringify(reportObj, null, 2), 'utf8');

  const mdLines = [
    '# Collection Readiness Report (Protocol V5.0.0)',
    '',
    `- **Generated At**: \`${reportObj.timestamp}\``,
    `- **Final Readiness Decision**: **\`${decision}\`**`,
    `- **Deployment Profile Detected**: \`${sandboxHealth.profile}\``,
    '',
    '## Verification Matrix',
    '',
    '| ID | Check Name | Category | Status | Details |',
    '| :--- | :--- | :--- | :--- | :--- |',
    ...checks.map(
      c => `| \`${c.id}\` | ${c.name} | \`${c.category}\` | **${c.status}** | ${c.detail} |`
    ),
    '',
    '## Required Commands on Target Ubuntu VM to Reach `READY TO BEGIN FORMAL CAPABILITY DATA COLLECTION`',
    '',
    '```bash',
    '# 1. Build the isolated Ubuntu 24.04 sandbox image',
    'docker build -t linux-tutor-sandbox:latest -f Dockerfile.sandbox .',
    '',
    '# 2. Ensure Ollama is running on 127.0.0.1:2004 and models are pulled',
    'ollama list',
    '# Optional: pull dedicated safety classifier if using Llama Guard 3',
    'ollama pull llama-guard3:1b',
    '',
    '# 3. Archive and reset development records before starting formal collection',
    'npm run study:reset -- --confirm "START NEW COLLECTION"',
    '',
    '# 4. Re-run collection readiness verification',
    'npm run verify:collection-ready',
    '```',
    ''
  ];
  fs.writeFileSync(path.join(process.cwd(), 'COLLECTION_READINESS_REPORT.md'), mdLines.join('\n'), 'utf8');

  return reportObj;
}

async function main() {
  const cmd = process.argv[2] || 'verify';
  if (cmd === 'backup') {
    const res = await runStudyBackup();
    console.log(JSON.stringify({ status: 'ok', action: 'study:backup', ...res }, null, 2));
  } else if (cmd === 'reset') {
    const res = await runStudyReset();
    console.log(JSON.stringify({ status: 'ok', action: 'study:reset', ...res }, null, 2));
  } else if (cmd === 'sandbox-smoke') {
    const results = SandboxProvider.runAllEightTaskSmokeTestsTwice();
    const sandboxHealth = SandboxProvider.checkHealth();
    const passedCount = results.filter(r => r.overallPassed).length;
    console.log(
      JSON.stringify(
        {
          status: passedCount === results.length ? 'ok' : 'failed',
          action: 'test:sandbox-smoke',
          executionMode: sandboxHealth.dockerAvailable ? 'real_docker_daemon_available' : 'host_fixture_smoke_verification',
          totalTasks: results.length,
          passedTasks: passedCount,
          results
        },
        null,
        2
      )
    );
    if (passedCount !== results.length) process.exit(1);
  } else if (cmd === 'verify' || cmd === 'collection-ready') {
    const res = await runCollectionReadinessCheck();
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.error(`Unknown study CLI command: ${cmd}`);
    process.exit(1);
  }
}

const isDirectExecution = process.argv[1] && process.argv[1].endsWith('study_cli.ts');
if (isDirectExecution) {
  main().catch(err => {
    console.error(`[study_cli error] ${err.message}`);
    process.exit(1);
  });
}
