import crypto from 'crypto';
import type {
  CuratedContextSnapshot,
  DataClassification,
  Level,
  SocraticGuidanceState
} from '../types';
import { SERVER_TASKS } from './serverTasks';
import { SandboxProvider } from './sandboxProvider';

export interface ContextRetrievalLimits {
  maxRecentCommands: number;
  maxRelevantOutputBytes: number;
  maxPriorTutorExchanges: number;
  maxEarlierSummaryBytes: number;
}

export const DEFAULT_CONTEXT_LIMITS: ContextRetrievalLimits = {
  maxRecentCommands: 20,
  maxRelevantOutputBytes: 8192, // 8 KiB
  maxPriorTutorExchanges: 5,
  maxEarlierSummaryBytes: 2048 // 2 KiB
};

export interface GuidanceDecisionResult {
  guidanceState: SocraticGuidanceState;
  escalationReason: string;
  isStudentReflection: boolean;
  reflectionType?: 'observation' | 'documentation_interpretation' | 'hypothesis' | 'prediction';
  observedCommands: string[];
  openedDocumentation: string[];
  failedAttemptCount: number;
  priorHelpCount: number;
}

const SECRET_AND_HIDDEN_PATTERNS = [
  /FLAG\{[^}]+\}/gi,
  /\.secret_config/gi,
  /\.secret_mission/gi,
  /\.shadow_copy\.bak/gi,
  /\.secret_flag/gi,
  /welcome\.txt/gi,
  /scrypt\$[a-zA-Z0-9$]+/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /sk-[A-Za-z0-9]{16,}/gi
];

export class SocraticTutorEngine {
  /**
   * Detects whether a terminal input line is the reserved `ask-ai` command.
   * Reserved command must NEVER execute in Bash or Docker.
   */
  public static parseReservedTutorCommand(rawCommand: string): {
    isAskAi: boolean;
    isTutorCommand: boolean;
    question: string;
  } {
    const trimmed = (rawCommand || '').trim();
    if (!trimmed) return { isAskAi: false, isTutorCommand: false, question: '' };

    if (/^ask-ai(?:\s+|$)/i.test(trimmed)) {
      const question = trimmed
        .replace(/^ask-ai\s*/i, '')
        .replace(/^["']([\s\S]*)["']$/, '$1')
        .trim();
      return {
        isAskAi: true,
        isTutorCommand: true,
        question
      };
    }
    return { isAskAi: false, isTutorCommand: false, question: '' };
  }

  public static parseReservedAskAiCommand(rawCommand: string): {
    isAskAi: boolean;
    isTutorCommand: boolean;
    question: string;
  } {
    return this.parseReservedTutorCommand(rawCommand);
  }

  /**
   * Detects whether a shell command is a documentation or full-screen viewer action
   * (`man`, `--help`, `-h`, `info`, `less`, `vim`, `nano`).
   */
  public static detectDocumentationCommand(commandText: string): {
    isDocumentation: boolean;
     isFullScreenViewer: boolean;
    documentedCommand: string;
  } {
    const trimmed = (commandText || '').trim();
    if (!trimmed) {
      return { isDocumentation: false, isFullScreenViewer: false, documentedCommand: '' };
    }

    const manMatch = trimmed.match(/^man\s+(?:-\S+\s+)*([a-zA-Z0-9_.-]+)/i);
    if (manMatch) {
      return {
        isDocumentation: true,
        isFullScreenViewer: true,
        documentedCommand: manMatch[1]
      };
    }

    const infoMatch = trimmed.match(/^info\s+([a-zA-Z0-9_.-]+)/i);
    if (infoMatch) {
      return {
        isDocumentation: true,
        isFullScreenViewer: true,
        documentedCommand: infoMatch[1]
      };
    }

    const helpFlagMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\s+(?:--help|-h)\b/i);
    if (helpFlagMatch) {
      return {
        isDocumentation: true,
        isFullScreenViewer: false,
        documentedCommand: helpFlagMatch[1]
      };
    }

    const builtinHelpMatch = trimmed.match(/^help\s+([a-zA-Z0-9_.-]+)/i);
    if (builtinHelpMatch) {
      return {
        isDocumentation: true,
        isFullScreenViewer: false,
        documentedCommand: builtinHelpMatch[1]
      };
    }

    const fullScreenMatch = trimmed.match(/^(less|more|vim|vi|nano)\s+(\S+)/i);
    if (fullScreenMatch) {
      return {
        isDocumentation: false,
        isFullScreenViewer: true,
        documentedCommand: fullScreenMatch[1]
      };
    }

    return { isDocumentation: false, isFullScreenViewer: false, documentedCommand: '' };
  }

  /**
   * Redacts flags, hidden filenames, tokens, and prohibited answer strings from any context or export string.
   */
  public static redactSecretsAndHiddenAnswers(text: string, task?: Partial<Level>): string {
    if (!text) return '';
    let cleaned = text;
    for (const pat of SECRET_AND_HIDDEN_PATTERNS) {
      cleaned = cleaned.replace(pat, '[REDACTED]');
    }
    const serverTask = SERVER_TASKS.find(t => t.id === Number(task?.id || 1));
    const prohibitedList = [
      task?.flag,
      serverTask?.flag,
      ...(task?.prohibitedDisclosures || []),
      ...(serverTask?.prohibitedDisclosures || []),
      ...(task?.acceptableAlternativePaths || []),
      ...(serverTask?.acceptableAlternativePaths || [])
    ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0);

    for (const item of prohibitedList) {
      cleaned = cleaned.split(item).join('[REDACTED]');
    }
    return cleaned;
  }

  /**
   * Classifies whether a student query contains a reflection (observation, documentation interpretation,
   * hypothesis, or prediction).
   */
  public static classifyStudentReflection(query: string): {
    isReflection: boolean;
    reflectionType?: 'observation' | 'documentation_interpretation' | 'hypothesis' | 'prediction';
  } {
    const q = (query || '').trim().toLowerCase();
    if (!q) return { isReflection: false };

    if (
      /\b(i think|maybe|because|it means|refers to|includes hidden|entries starting with|dotfile|decode|option\s+-[a-zA-Z])\b/i.test(
        q
      )
    ) {
      if (/\b(-[a-zA-Z]|option|flag|manual|man page|includes|ignore)\b/i.test(q)) {
        return { isReflection: true, reflectionType: 'documentation_interpretation' };
      }
      return { isReflection: true, reflectionType: 'hypothesis' };
    }

    if (/\b(i predict|will show|should output|expect to see|if i run)\b/i.test(q)) {
      return { isReflection: true, reflectionType: 'prediction' };
    }

    if (/\b(i noticed|i saw|the output showed|it returned|permission denied)\b/i.test(q)) {
      return { isReflection: true, reflectionType: 'observation' };
    }

    return { isReflection: false };
  }

  /**
   * Determines whether a data classification belongs to formal capability collection vs development test.
   */
  public static isFormalClassification(classification?: DataClassification | string): boolean {
    return (
      classification === 'FORMAL_CAPABILITY' ||
      classification === 'formal' ||
      classification === 'formal_round_1' ||
      classification === 'regression' ||
      classification === 'sequestered'
    );
  }

  /**
   * Builds a session-isolated, bounded CuratedContextSnapshot (Part III).
   * Enforces strict isolation by (runId, executionId, taskId, sessionId) and classification.
   */
  public static buildCuratedContextSnapshot(params: {
    task: Level;
    runId: string;
    executionId: string;
    sessionId: string;
    studentQuestion?: string;
    dataClassification?: DataClassification | string;
    verifiedState?: 'not_started' | 'in_progress' | 'partial' | 'completed';
    commands: Array<{
      commandId: string;
      sessionId: string;
      runId?: string;
      executionId?: string;
      taskId: number;
      sequenceNumber?: number;
      command?: string;
      commandText?: string;
      cwd: string;
      exitStatus?: number | null;
      timestamp: string;
      data_classification?: DataClassification;
    }>;
    outputs: Array<{
      outputId: string;
      commandId?: string;
      sessionId: string;
      runId?: string;
      executionId?: string;
      taskId: number;
      sequenceNumber?: number;
      rawBytesLen?: number;
      ansiStrippedStream?: string;
      strippedOutput?: string;
      truncated?: boolean;
      timestamp: string;
      data_classification?: DataClassification;
    }>;
    priorInteractions?: Array<{
      interactionId: string;
      sessionId: string;
      runId?: string;
      executionId?: string;
      taskId: number;
      learnerPrompt: string;
      releasedResponse?: string;
      guidanceState?: SocraticGuidanceState;
      data_classification?: DataClassification;
    }>;
    interactions?: Array<{
      interactionId: string;
      sessionId: string;
      runId?: string;
      executionId?: string;
      taskId: number;
      learnerPrompt: string;
      releasedResponse?: string;
      guidanceState?: SocraticGuidanceState;
      data_classification?: DataClassification;
    }>;
    telemetryEvents?: any[];
    isFormalCollection?: boolean;
    limits?: Partial<ContextRetrievalLimits>;
  }): CuratedContextSnapshot {
    const limits: ContextRetrievalLimits = {
      ...DEFAULT_CONTEXT_LIMITS,
      ...(params.limits || {})
    };
    const taskIdNum = Number(params.task?.id || 1);
    const isFormal =
      params.isFormalCollection ?? this.isFormalClassification(params.dataClassification);

    // Filter strictly to current sessionId AND taskId (and exclude development records in formal mode)
    const sessionCommands = (params.commands || []).filter(c => {
      if (c.sessionId !== params.sessionId) return false;
      if (Number(c.taskId) !== taskIdNum) return false;
      if (params.runId && c.runId && c.runId !== 'unassigned_run' && c.runId !== params.runId) return false;
      if (params.executionId && c.executionId && c.executionId !== params.executionId) return false;
      if (
        isFormal &&
        (c.data_classification === 'DEVELOPMENT_TEST' ||
          c.data_classification === 'dev_smoke' ||
          c.data_classification === 'synthetic')
      ) {
        return false;
      }
      const cmdText = c.command || c.commandText || '';
      // Never include reserved ask-ai commands as shell commands
      if (this.parseReservedTutorCommand(cmdText).isTutorCommand) return false;
      return true;
    });

    const sessionOutputs = (params.outputs || []).filter(o => {
      if (o.sessionId !== params.sessionId) return false;
      if (Number(o.taskId) !== taskIdNum) return false;
      if (params.runId && o.runId && o.runId !== 'unassigned_run' && o.runId !== params.runId) return false;
      if (params.executionId && o.executionId && o.executionId !== params.executionId) return false;
      if (
        isFormal &&
        (o.data_classification === 'DEVELOPMENT_TEST' ||
          o.data_classification === 'dev_smoke' ||
          o.data_classification === 'synthetic')
      ) {
        return false;
      }
      return true;
    });

    const rawInteractions = params.priorInteractions || params.interactions || [];
    const sessionInteractions = rawInteractions.filter(ix => {
      if (ix.sessionId !== params.sessionId) return false;
      if (Number(ix.taskId) !== taskIdNum) return false;
      if (params.runId && ix.runId && ix.runId !== params.runId) return false;
      if (params.executionId && ix.executionId && ix.executionId !== params.executionId) return false;
      if (
        isFormal &&
        (ix.data_classification === 'DEVELOPMENT_TEST' ||
          ix.data_classification === 'dev_smoke' ||
          ix.data_classification === 'synthetic')
      ) {
        return false;
      }
      return true;
    });

    const totalCommandCount = sessionCommands.length;
    const recentCommandsSlice = sessionCommands.slice(-limits.maxRecentCommands);
    const omittedCommands = sessionCommands.slice(0, Math.max(0, totalCommandCount - limits.maxRecentCommands));
    let eventsOmitted = omittedCommands.length;

    const documentationActions: CuratedContextSnapshot['documentationActions'] = [];
    const recentAttempts: CuratedContextSnapshot['recentAttempts'] = [];
    const selectedSourceEventIds: string[] = [];

    let usedOutputBytes = 0;
    let outputTruncated = false;

    for (let i = 0; i < recentCommandsSlice.length; i++) {
      const cmd = recentCommandsSlice[i];
      const cmdStr = cmd.command || cmd.commandText || '';
      const docCheck = this.detectDocumentationCommand(cmdStr);
      const matchedOut =
        sessionOutputs.find(o => o.commandId && o.commandId === cmd.commandId) ||
        sessionOutputs[sessionCommands.indexOf(cmd)];

      selectedSourceEventIds.push(cmd.commandId);
      if (matchedOut?.outputId) {
        selectedSourceEventIds.push(matchedOut.outputId);
      }

      if (docCheck.isDocumentation) {
        documentationActions.push({
          eventType: 'documentation_view',
          command: cmdStr,
          documentedCommand: docCheck.documentedCommand,
          exitCode: cmd.exitStatus ?? 0,
          durationSeconds: 15
        });
      }

      const rawOutText = matchedOut?.ansiStrippedStream || matchedOut?.strippedOutput || '';
      // For full-screen commands (man, less, vim, nano), do NOT dump screen redraws into recentAttempts outputExcerpt
      let rawExcerpt = docCheck.isFullScreenViewer
        ? `[Opened ${docCheck.documentedCommand || cmdStr} interactive viewer]`
        : SandboxProvider.stripAnsi(rawOutText).trim();

      rawExcerpt = this.redactSecretsAndHiddenAnswers(rawExcerpt, params.task);

      const remainingBytes = Math.max(0, limits.maxRelevantOutputBytes - usedOutputBytes);
      let excerpt = rawExcerpt;
      if (Buffer.byteLength(excerpt, 'utf8') > Math.min(600, remainingBytes)) {
        outputTruncated = true;
        excerpt = excerpt.slice(0, Math.max(0, Math.min(600, remainingBytes)));
      }
      usedOutputBytes += Buffer.byteLength(excerpt, 'utf8');

      recentAttempts.push({
        eventId: cmd.commandId,
        command: this.redactSecretsAndHiddenAnswers(cmdStr, params.task),
        exitCode: cmd.exitStatus ?? 0,
        outputExcerpt: excerpt
      });
    }

    // Fallback: if no structured command records exist yet, check if there is a recent output record
    if (recentAttempts.length === 0 && sessionOutputs.length > 0) {
      const lastOut = sessionOutputs[sessionOutputs.length - 1];
      selectedSourceEventIds.push(lastOut.outputId);
      const rawOutText = lastOut.ansiStrippedStream || lastOut.strippedOutput || '';
      let cleaned = this.redactSecretsAndHiddenAnswers(
        SandboxProvider.stripAnsi(rawOutText).trim(),
        params.task
      );
      if (Buffer.byteLength(cleaned, 'utf8') > limits.maxRelevantOutputBytes) {
        outputTruncated = true;
        cleaned = cleaned.slice(-limits.maxRelevantOutputBytes);
      }
      recentAttempts.push({
        eventId: lastOut.outputId,
        command: '(terminal output)',
        exitCode: 0,
        outputExcerpt: cleaned
      });
    }

    // Build bounded earlierAttemptsSummary (<= 2 KiB) if older commands were omitted
    let earlierAttemptsSummary: string | undefined;
    if (omittedCommands.length > 0) {
      const summaryLines = omittedCommands.map(
        c => `${this.redactSecretsAndHiddenAnswers(c.command || c.commandText || '', params.task)} [exit=${c.exitStatus ?? 0}]`
      );
      const rawSummary = `${omittedCommands.length} earlier commands: ` + summaryLines.join('; ');
      if (Buffer.byteLength(rawSummary, 'utf8') > limits.maxEarlierSummaryBytes) {
        outputTruncated = true;
        earlierAttemptsSummary = rawSummary.slice(0, limits.maxEarlierSummaryBytes);
      } else {
        earlierAttemptsSummary = rawSummary;
      }
    }

    // Prior tutor exchanges (bounded to maxPriorTutorExchanges = 5)
    const recentGuidanceSlice = sessionInteractions.slice(-limits.maxPriorTutorExchanges);
    if (sessionInteractions.length > limits.maxPriorTutorExchanges) {
      eventsOmitted += sessionInteractions.length - limits.maxPriorTutorExchanges;
    }

    const previousGuidance: CuratedContextSnapshot['previousGuidance'] = recentGuidanceSlice.map(ix => {
      selectedSourceEventIds.push(ix.interactionId);
      return {
        interactionId: ix.interactionId,
        studentQuestion: this.redactSecretsAndHiddenAnswers(ix.learnerPrompt, params.task),
        releasedResponse: this.redactSecretsAndHiddenAnswers(ix.releasedResponse || '', params.task),
        guidanceState: ix.guidanceState
      };
    });

    const currentDirectory =
      sessionCommands.length > 0
        ? sessionCommands[sessionCommands.length - 1].cwd || '/home/cadet'
        : '/home/cadet';

    const verifiedState: CuratedContextSnapshot['session']['verifiedState'] =
      params.verifiedState || (recentAttempts.length > 0 ? 'in_progress' : 'not_started');

    const normalizedConstraints = Array.isArray(params.task.constraints)
      ? params.task.constraints
      : params.task.constraints
      ? [params.task.constraints]
      : ['offline sandbox', 'Working directory: /home/cadet'];

    const recentCommands = recentAttempts.map((a, idx) => ({
      commandId: a.eventId,
      command: a.command,
      cwd: recentCommandsSlice[idx]?.cwd || currentDirectory,
      exitCode: a.exitCode
    }));

    const recentOutputs = recentAttempts.map(a => ({
      outputId: `out-${a.eventId}`,
      commandId: a.eventId,
      outputExcerpt: a.outputExcerpt
    }));

    const documentationViews = documentationActions.map(d => ({
      topic: d.documentedCommand,
      command: d.command,
      exitCode: d.exitCode
    }));

    const snapshotWithoutHash: Omit<CuratedContextSnapshot, 'contextHash'> = {
      sessionId: params.sessionId,
      taskId: taskIdNum,
      task: {
        taskId: `task-${taskIdNum}`,
        studentInstruction:
          params.task.studentTask ||
          params.task.objective ||
          'Investigate the environment and complete the task objective.',
        goal: params.task.goal || params.task.objective || 'Verify the target system state.',
        constraints: normalizedConstraints,
        // Abstract policy boundaries ONLY — never include actual secret values or hidden filenames
        prohibitedDisclosures: ['hidden filename', 'flag', 'complete solution']
      },
      session: {
        runId: params.runId,
        executionId: params.executionId,
        sessionId: params.sessionId,
        currentDirectory,
        verifiedState
      },
      recentAttempts,
      recentCommands,
      recentOutputs,
      documentationActions,
      documentationViews,
      previousGuidance,
      ...(earlierAttemptsSummary ? { earlierAttemptsSummary } : {}),
      earlierSessionSummary: earlierAttemptsSummary || '',
      studentQuestion: this.redactSecretsAndHiddenAnswers(params.studentQuestion || '', params.task),
      eventsOmitted: eventsOmitted > 0,
      outputTruncated,
      truncation: {
        outputTruncated,
        eventsOmitted
      },
      selectedSourceEventIds: Array.from(new Set(selectedSourceEventIds))
    };

    const contextHash =
      'sha256:' +
      crypto.createHash('sha256').update(JSON.stringify(snapshotWithoutHash)).digest('hex');

    return {
      ...snapshotWithoutHash,
      contextHash
    };
  }

  /**
   * Determines the internal Socratic guidance state and escalation reason from the curated context snapshot.
   * Escalation depends strictly on terminal evidence, repeated help requests, and documented errors—never time passed.
   */
  public static determineGuidanceDecision(
    input:
      | CuratedContextSnapshot
      | { task?: Partial<Level>; userQuery?: string; snapshot: CuratedContextSnapshot }
  ): GuidanceDecisionResult {
    const snapshot = 'snapshot' in input ? input.snapshot : input;
    const rawQuery =
      ('snapshot' in input && input.userQuery ? input.userQuery : snapshot.studentQuestion) || '';
    const q = rawQuery.toLowerCase();
    const observedCommands = snapshot.recentAttempts.map(a => a.command.trim()).filter(Boolean);
    const openedDocumentation = snapshot.documentationActions.map(d => d.command.trim());
    const failedAttemptCount = snapshot.recentAttempts.filter(a => a.exitCode !== 0).length;
    const priorHelpCount = snapshot.previousGuidance.length;
    const reflection = this.classifyStudentReflection(rawQuery);

    // 1. If the student offers a plausible interpretation / hypothesis (e.g., "I think -a includes hidden entries")
    if (reflection.isReflection && (reflection.reflectionType === 'documentation_interpretation' || reflection.reflectionType === 'hypothesis')) {
      return {
        guidanceState: 'prediction_probe',
        escalationReason: 'Student offered a plausible interpretation of documentation or command behavior; prompting for outcome prediction and terminal test.',
        isStudentReflection: true,
        reflectionType: reflection.reflectionType,
        observedCommands,
        openedDocumentation,
        failedAttemptCount,
        priorHelpCount
      };
    }

    // 2. If the student already opened documentation (e.g., `man ls`, `grep --help`, `man find`)
    if (snapshot.documentationActions.length > 0) {
      const lastDoc = snapshot.documentationActions[snapshot.documentationActions.length - 1];
      if (priorHelpCount >= 2 || failedAttemptCount >= 2) {
        return {
          guidanceState: 'procedural_probe',
          escalationReason: `Student opened documentation (${lastDoc.command}) and made multiple attempts; providing bounded procedural probe.`,
          isStudentReflection: reflection.isReflection,
          reflectionType: reflection.reflectionType,
          observedCommands,
          openedDocumentation,
          failedAttemptCount,
          priorHelpCount
        };
      }
      return {
        guidanceState: 'reflection_probe',
        escalationReason: `Terminal evidence shows documentation (${lastDoc.command}) was opened; asking student to interpret the relevant option in their own words.`,
        isStudentReflection: reflection.isReflection,
        reflectionType: reflection.reflectionType,
        observedCommands,
        openedDocumentation,
        failedAttemptCount,
        priorHelpCount
      };
    }

    // 3. Controlled escalation after repeated unsuccessful attempts or repeated help requests
    if (failedAttemptCount >= 3 || priorHelpCount >= 3) {
      return {
        guidanceState: 'bounded_next_step',
        escalationReason: `Controlled escalation triggered by ${failedAttemptCount} unsuccessful command attempts and ${priorHelpCount} prior tutor exchanges.`,
        isStudentReflection: reflection.isReflection,
        reflectionType: reflection.reflectionType,
        observedCommands,
        openedDocumentation,
        failedAttemptCount,
        priorHelpCount
      };
    }

    if (failedAttemptCount >= 2 || priorHelpCount >= 2) {
      return {
        guidanceState: 'procedural_probe',
        escalationReason: `Escalated to procedural_probe after ${failedAttemptCount} command errors and ${priorHelpCount} prior tutor queries.`,
        isStudentReflection: reflection.isReflection,
        reflectionType: reflection.reflectionType,
        observedCommands,
        openedDocumentation,
        failedAttemptCount,
        priorHelpCount
      };
    }

    // 4. If student ran an initial command (e.g. plain `ls`, `cat`, `env`, `find`) and asks why something is missing or failed
    if (snapshot.recentAttempts.length > 0) {
      const lastAttempt = snapshot.recentAttempts[snapshot.recentAttempts.length - 1];
      if (
        /^ls(\s+-l)?$/i.test(lastAttempt.command) ||
        q.includes('cannot find') ||
        q.includes("can't find") ||
        q.includes('option') ||
        q.includes('manual') ||
        q.includes('flag')
      ) {
        return {
          guidanceState: 'documentation_probe',
          escalationReason: `Student executed \`${lastAttempt.command}\` and needs to discover relevant command options via local documentation.`,
          isStudentReflection: reflection.isReflection,
          reflectionType: reflection.reflectionType,
          observedCommands,
          openedDocumentation,
          failedAttemptCount,
          priorHelpCount
        };
      }
      return {
        guidanceState: 'conceptual_probe',
        escalationReason: `Student executed \`${lastAttempt.command}\`; prompting interpretation of observed terminal output.`,
        isStudentReflection: reflection.isReflection,
        reflectionType: reflection.reflectionType,
        observedCommands,
        openedDocumentation,
        failedAttemptCount,
        priorHelpCount
      };
    }

    // 5. Default when no terminal commands have been executed yet
    return {
      guidanceState: 'orientation_probe',
      escalationReason: 'No terminal attempts recorded yet in this session; orienting student to inspect current environment.',
      isStudentReflection: reflection.isReflection,
      reflectionType: reflection.reflectionType,
      observedCommands,
      openedDocumentation,
      failedAttemptCount,
      priorHelpCount
    };
  }

  /**
   * Generates an evidence-grounded Socratic response following Part II rules:
   * - One acknowledgement tied to observed terminal evidence
   * - One focused Socratic question
   * - At most one optional bounded next action
   * - Never discloses flags, hidden filenames, or complete copy-paste command sequences.
   */
  public static generateEvidenceGroundedSocraticReply(
    snapshotOrParams:
      | CuratedContextSnapshot
      | {
          task?: Partial<Level>;
          userQuery?: string;
          snapshot: CuratedContextSnapshot;
          decision: GuidanceDecisionResult;
        },
    decisionArg?: GuidanceDecisionResult,
    taskArg?: Partial<Level>
  ): string {
    const snapshot = 'snapshot' in snapshotOrParams ? snapshotOrParams.snapshot : snapshotOrParams;
    const decision = ('decision' in snapshotOrParams ? snapshotOrParams.decision : decisionArg)!;
    const task = 'task' in snapshotOrParams && !('sessionId' in snapshotOrParams) ? snapshotOrParams.task : taskArg;
    const taskId = Number(task?.id || snapshot.task.taskId.replace('task-', '') || 1);
    const lastAttempt =
      snapshot.recentAttempts.length > 0
        ? snapshot.recentAttempts[snapshot.recentAttempts.length - 1]
        : null;
    const lastDoc =
      snapshot.documentationActions.length > 0
        ? snapshot.documentationActions[snapshot.documentationActions.length - 1]
        : null;

    // State 5: prediction_probe (Student gave a plausible interpretation of an option/concept)
    if (decision.guidanceState === 'prediction_probe') {
      if (lastAttempt && /^ls\b/i.test(lastAttempt.command)) {
        return 'What difference do you predict you will see if you test that interpretation against your earlier listing?';
      }
      return 'You formed a clear hypothesis about how that option works. What difference do you predict you will observe in the terminal output when you test it?';
    }

    // State 4: reflection_probe (Student opened `man <cmd>` or `<cmd> --help`)
    if (decision.guidanceState === 'reflection_probe' && lastDoc) {
      const docCmd = lastDoc.documentedCommand || 'the utility';
      if (docCmd === 'ls') {
        return 'You opened `man ls`. Which option description refers to entries whose names begin with a dot, and what does that description mean in your own words?';
      }
      if (docCmd === 'grep') {
        return 'You opened the documentation for `grep`. Which pattern-matching option or syntax description applies to filtering your target log file, and how would you explain it in your own words?';
      }
      if (docCmd === 'find') {
        return 'You opened the documentation for `find`. Which expression description matches files by name across subdirectories, and what does it require as arguments?';
      }
      if (docCmd === 'base64') {
        return 'You opened the documentation for `base64`. Which option description reverses encoding back into original data, and what does it mean in your own words?';
      }
      if (docCmd === 'sudo') {
        return 'You opened the documentation for `sudo`. Which option lists the privileges delegated to your user account, and what does that description mean in your own words?';
      }
      return `You opened \`${lastDoc.command}\`. Which option description appears relevant to your goal, and what does that description mean in your own words?`;
    }

    // State 3: documentation_probe (e.g. after plain `ls` or initial command)
    if (decision.guidanceState === 'documentation_probe') {
      if (lastAttempt && /^ls(\s+-l)?$/i.test(lastAttempt.command.trim())) {
        return 'The default listing showed only ordinary entries. What kinds of entries might it omit, and which local documentation command could help you inspect the available `ls` options?';
      }
      if (taskId === 2) {
        return 'Standard directory listings omit certain configuration entries by default. What naming convention hides files in Linux, and how can you inspect `man ls` to see the available options?';
      }
      if (taskId === 4) {
        return 'Reading an entire log file line by line makes it hard to isolate one event. Which text-filtering utility searches for matching lines, and how can you inspect its options with `man` or `--help`?';
      }
      if (taskId === 6) {
        return 'Your terminal output shows ASCII-encoded text ending with padding characters. Which local manual page (`man base64`) can you check to see how to reverse that encoding?';
      }
      if (taskId === 7) {
        return 'Your attempt returned a permission error because the resource is restricted. How can you use `man sudo` or `ls -l` to inspect ownership and delegated privileges?';
      }
      if (taskId === 8) {
        return 'Checking one directory at a time has not revealed the misplaced file. Which recursive search utility can traverse `/var`, and what does its `man` page say about matching filenames?';
      }
    }

    // State 7: bounded_next_step (Controlled escalation after repeated difficulty)
    if (decision.guidanceState === 'bounded_next_step') {
      const cmdNote = lastAttempt
        ? `Your recent command \`${lastAttempt.command}\` exited with status ${lastAttempt.exitCode}.`
        : 'You have made several attempts on this task.';
      if (taskId === 2) {
        return `${cmdNote} In Linux, hidden entries begin with a dot (\`.\`). Open \`man ls\` to identify the single-letter option that includes entries starting with \`.\`, and explain what you expect it to display.`;
      }
      if (taskId === 3) {
        return `${cmdNote} Because the secret is stored in shell memory rather than on disk, what do you observe if you inspect your active environment variables using \`env\` or \`printenv\`?`;
      }
      if (taskId === 4) {
        return `${cmdNote} Check the log directory contents first, then use \`grep\` with the severity keyword mentioned in the task instructions. What matching line do you expect to see?`;
      }
      if (taskId === 5) {
        return `${cmdNote} The internal service listens on loopback port 8080. Inspect \`man curl\` to see how to request an HTTP URL on \`localhost\`, and state what output you expect.`;
      }
      if (taskId === 6) {
        return `${cmdNote} The artifact uses Base64 encoding. Inspect \`base64 --help\` to find the decode option, and predict how the output will change when you apply it.`;
      }
      if (taskId === 7) {
        return `${cmdNote} Standard user privileges cannot read root-owned mode 0600 files. Run \`sudo -l\` to inspect your delegated privileges, and explain which command you are authorized to elevate.`;
      }
      if (taskId === 8) {
        return `${cmdNote} Use the \`find\` utility starting from the target directory and check \`man find\` for the \`-name\` test. What path do you expect \`find\` to return?`;
      }
      return `${cmdNote} Inspect the files in \`${snapshot.session.currentDirectory}\` with \`ls\` and check local documentation with \`man\`. What entry in the output looks relevant to the task goal?`;
    }

    // State 6: procedural_probe
    if (decision.guidanceState === 'procedural_probe') {
      if (lastAttempt) {
        return `You ran \`${lastAttempt.command}\` and observed \`${(lastAttempt.outputExcerpt || 'no output').slice(0, 80)}\`. Based on that result, which local manual page (\`man <utility>\`) or command option would help you refine your next test?`;
      }
      return `You have explored the task problem space across multiple turns. Which specific command utility matches the task goal, and what option in its \`--help\` output looks most relevant?`;
    }

    // State 2: conceptual_probe (Student ran a command and has output to interpret)
    if (decision.guidanceState === 'conceptual_probe' && lastAttempt) {
      return `You executed \`${lastAttempt.command}\` in \`${snapshot.session.currentDirectory}\` (exit code ${lastAttempt.exitCode}). How do you interpret the output it produced relative to your task goal, and what should you inspect next?`;
    }

    // State 1: orientation_probe (No commands run yet)
    return `You are currently in \`${snapshot.session.currentDirectory}\` and have not run a diagnostic command yet. Which command would help you inspect the current environment or directory state first?`;
  }

  /**
   * Post-processes any tutor response (from live Ollama or offline engine) to guarantee:
   * - No secret flags or hidden filenames leak
   * - No unsupported task completion confirmation
   * - Concise Socratic form (acknowledgement + 1 focused question + optional bounded next step)
   */
  public static enforceSocraticResponseConstraints(
    rawReply: string,
    snapshot: CuratedContextSnapshot,
    decision: GuidanceDecisionResult,
    task?: Partial<Level>
  ): string {
    let cleaned = (rawReply || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    cleaned = this.redactSecretsAndHiddenAnswers(cleaned, task);

    // Strip any unsupported completion confirmation claims
    cleaned = cleaned.replace(
      /\b(you have completed the task|task is complete|congratulations on solving|you found the flag)\b/gi,
      'you can verify your finding with the submission verifier'
    );

    // If the response leaked [REDACTED] or lacks a Socratic question mark, replace with the deterministic Socratic reply
    if (!cleaned || cleaned.includes('[REDACTED]') || !cleaned.includes('?')) {
      return this.generateEvidenceGroundedSocraticReply(snapshot, decision, task);
    }

    return cleaned;
  }
}
