import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  FormalRun,
  ResearchConfiguration,
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
  AIConfig
} from '../types';

export interface DatabaseState {
  version: string;
  users: Record<string, { user: User; passwordHash: string }>;
  levels: Level[];
  formal_runs: FormalRun[];
  telemetry_events: TelemetryEvent[];
  test_cases: TestCase[];
  cew_submissions: CEWSubmission[];
  cew_scores: CEWScore[];
  expert_reviews: ExpertReview[];
  defects: DefectRecord[];
  guardrail_events: GuardrailEventRecord[];
  guardrail_decisions?: GuardrailDecisionRecord[];
  telemetry_validations: TelemetryValidationReport[];
  research_logs: ResearchLog[]; // Legacy compatibility array
  config: AIConfig | null;
  activeRunId: string | null;
}

export class DatabaseManager {
  private dataDir: string;
  private jsonPath: string;
  private jsonlPath: string;
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
      adminPass = 'admin'; // Dev default only
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
      version: '2.0.0',
      users: defaultUsers,
      levels: [],
      formal_runs: [],
      telemetry_events: [],
      test_cases: [],
      cew_submissions: [],
      cew_scores: [],
      expert_reviews: [],
      defects: [],
      guardrail_events: [],
      guardrail_decisions: [],
      telemetry_validations: [],
      research_logs: [],
      config: {
        provider: 'gemini',
        ollamaUrl: process.env.OLLAMA_BASE_URL ? `${process.env.OLLAMA_BASE_URL}/api/chat` : 'http://localhost:2004/api/chat',
        ollamaModel: 'llama3',
        tutorProvider: 'gemini',
        tutorModel: 'gemini-3-flash-preview',
        evaluatorProvider: 'gemini',
        evaluatorModel: 'gemini-3-flash-preview',
        sameModelAsTutor: true,
        temperature: 0.1,
        topP: 0.95,
        maxTokens: 512,
        seed: 42,
        deploymentMode: 'hosted_model',
        executionEnvironment: 'ai_simulated'
      },
      activeRunId: null
    };
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
      // Non-destructive merge with default schema
      const merged: DatabaseState = {
        version: parsed.version || '2.0.0',
        users: parsed.users || defaultState.users,
        levels: Array.isArray(parsed.levels) ? parsed.levels : [],
        formal_runs: Array.isArray(parsed.formal_runs) ? parsed.formal_runs : [],
        telemetry_events: Array.isArray(parsed.telemetry_events) ? parsed.telemetry_events : [],
        test_cases: Array.isArray(parsed.test_cases) ? parsed.test_cases : [],
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
        defects: Array.isArray(parsed.defects) ? parsed.defects : [],
        guardrail_events: Array.isArray(parsed.guardrail_events) ? parsed.guardrail_events : [],
        guardrail_decisions: Array.isArray(parsed.guardrail_decisions) ? parsed.guardrail_decisions : [],
        telemetry_validations: Array.isArray(parsed.telemetry_validations) ? parsed.telemetry_validations : [],
        research_logs: Array.isArray(parsed.research_logs) ? parsed.research_logs : [],
        config: parsed.config ? { ...defaultState.config, ...parsed.config } : defaultState.config,
        activeRunId: parsed.activeRunId || null
      };

      // Auto-migrate legacy research_logs into telemetry_events if events is empty but logs exist
      if (merged.telemetry_events.length === 0 && merged.research_logs.length > 0) {
        merged.telemetry_events = merged.research_logs.map((legacy, idx) => ({
          eventId: `legacy-evt-${idx + 1}`,
          timestamp: legacy.timestamp || new Date().toISOString(),
          runId: legacy.runId || 'legacy_migration_run',
          sessionId: legacy.sessionId || `legacy-sess-${legacy.userId}`,
          interactionId: `legacy-int-${idx + 1}`,
          userId: legacy.userId || 'unknown',
          actorType: 'student',
          assignedCondition: legacy.condition || 'guided',
          effectiveCondition: legacy.condition || 'guided',
          taskId: legacy.levelId || 1,
          taskDefinitionVersion: '1.0.0-legacy',
          eventType: legacy.type === 'flag_attempt' ? 'flag_submit' : (legacy.type as any) || 'command',
          input: legacy.input,
          output: legacy.output,
          sequenceNumber: idx + 1,
          serverTimestamp: legacy.timestamp || new Date().toISOString(),
          dataClassification: 'pilot',
          applicationVersion: '1.0.0-legacy',
          telemetrySchemaVersion: '1.0.0-legacy',
          details: { legacyMetrics: legacy.metrics, isCorrect: legacy.isCorrect }
        }));
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

  // --- GETTERS & SETTERS ---

  public getState(): DatabaseState {
    return this.state;
  }

  // Config
  public getConfig(): AIConfig | null {
    return this.state.config;
  }

  public async setConfig(config: AIConfig): Promise<void> {
    this.state.config = config;
    await this.persist();
  }

  // Active Run Lock
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
    return this.state.levels.filter(t => t.id >= 1 && t.id <= 8);
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
          // Never allow undefined from sanitized client payloads to erase secret server fields
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
      return true;
    });
  }

  public async appendTelemetryEvent(event: TelemetryEvent): Promise<TelemetryEvent> {
    // Idempotency protection: prevent retries or reconnects from duplicating events or sequence numbers
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

    // Atomically determine next monotonic sequence number for this session
    const sessId = event.sessionId || 'default_session';
    const prevMax =
      this.sessionSequences.get(sessId) ??
      this.state.telemetry_events
        .filter(e => e.sessionId === sessId)
        .reduce((max, e) => Math.max(max, e.sequenceNumber || 0), 0);
    const nextSeq = prevMax + 1;
    this.sessionSequences.set(sessId, nextSeq);
    event.sequenceNumber = nextSeq;
    event.serverTimestamp = event.serverTimestamp || new Date().toISOString();

    if (idempKey) {
      this.idempotencyKeys.set(idempKey, event);
    }
    this.state.telemetry_events.push(event);

    // Append to immutable JSONL audit log
    try {
      await fs.promises.appendFile(this.jsonlPath, JSON.stringify(event) + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to append to telemetry JSONL stream:', err);
    }

    // Also push to legacy research_logs for backward compatibility
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

  /**
   * RQ4 Audit: Checks for missing sequence values, duplicate sequence values,
   * out-of-order sequence values, and timestamp order conflicts.
   */
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

  /**
   * RQ4 Record Linkage Audit: Verifies foreign keys and relationships between
   * sessions, tasks, submissions, scores, and reviews.
   */
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
    await this.persist();
  }

  public async saveTestCase(tc: TestCase): Promise<void> {
    const idx = this.state.test_cases.findIndex(t => t.testCaseId === tc.testCaseId);
    if (idx >= 0) {
      this.state.test_cases[idx] = tc;
    } else {
      this.state.test_cases.push(tc);
    }
    await this.persist();
  }

  // CEW Submissions & Scores
  public getCEWSubmissions(filter?: { runId?: string; taskId?: number; userId?: string }): CEWSubmission[] {
    let list = this.state.cew_submissions;
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

  // Expert Reviews
  public getExpertReviews(filter?: { runId?: string; taskId?: number; testCaseId?: string }): ExpertReview[] {
    let list = this.state.expert_reviews;
    if (!filter) return list;
    return list.filter(r => {
      if (filter.runId && r.runId !== filter.runId) return false;
      if (filter.taskId !== undefined && r.taskId !== filter.taskId) return false;
      if (filter.testCaseId && r.testCaseId !== filter.testCaseId) return false;
      return true;
    });
  }

  public async saveExpertReview(review: ExpertReview): Promise<void> {
    const idx = this.state.expert_reviews.findIndex(r => r.reviewId === review.reviewId);
    if (idx >= 0) {
      this.state.expert_reviews[idx] = review;
    } else {
      this.state.expert_reviews.push(review);
    }
    await this.persist();
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
  public async deleteNonFormalData(types: ('pilot' | 'demonstration' | 'regression' | 'synthetic')[]): Promise<{ deletedEvents: number; deletedRuns: number }> {
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
}

export const db = new DatabaseManager();
