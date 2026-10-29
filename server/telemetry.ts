import {
  TelemetryEvent,
  TelemetryEventType,
  TelemetryValidationReport,
  ActorType,
  DataClassification,
  ExperimentalCondition
} from '../types';

export const TELEMETRY_SCHEMA_VERSION = '2.0.0';

export interface TaskSessionTiming {
  sessionId: string;
  taskId: number;
  startTime: number;
  lastActionTime: number;
  totalElapsedMs: number;
  activeInteractionMs: number;
  idleMs: number;
  firstCommandTimeMs?: number;
  firstFlagTimeMs?: number;
  firstCorrectFlagTimeMs?: number;
  flagAttempts: number;
  commandCount: number;
  uniqueCommands: Set<string>;
  exactRepeatedCount: number;
  lastCommand?: string;
}

export class TelemetryManager {
  public static readonly SCHEMA_VERSION = TELEMETRY_SCHEMA_VERSION;
  private static sessionTimers = new Map<string, TaskSessionTiming>();

  public static getOrCreateTiming(sessionId: string, taskId: number, idleThresholdMs: number = 60000): TaskSessionTiming {
    const key = `${sessionId}-${taskId}`;
    let timing = this.sessionTimers.get(key);
    if (!timing) {
      const now = Date.now();
      timing = {
        sessionId,
        taskId,
        startTime: now,
        lastActionTime: now,
        totalElapsedMs: 0,
        activeInteractionMs: 0,
        idleMs: 0,
        flagAttempts: 0,
        commandCount: 0,
        uniqueCommands: new Set<string>(),
        exactRepeatedCount: 0
      };
      this.sessionTimers.set(key, timing);
    }
    return timing;
  }

  public static recordAction(sessionId: string, taskId: number, idleThresholdMs: number = 60000): void {
    const timing = this.getOrCreateTiming(sessionId, taskId, idleThresholdMs);
    const now = Date.now();
    const diff = now - timing.lastActionTime;

    if (diff > idleThresholdMs) {
      timing.idleMs += diff;
    } else {
      timing.activeInteractionMs += diff;
    }

    timing.totalElapsedMs = now - timing.startTime;
    timing.lastActionTime = now;
  }

  public static recordCommand(sessionId: string, taskId: number, command: string): void {
    const timing = this.getOrCreateTiming(sessionId, taskId);
    this.recordAction(sessionId, taskId);
    const now = Date.now();

    if (timing.firstCommandTimeMs === undefined) {
      timing.firstCommandTimeMs = now - timing.startTime;
    }

    timing.commandCount++;
    const trimmed = command.trim();
    if (timing.lastCommand === trimmed) {
      timing.exactRepeatedCount++;
    }
    timing.lastCommand = trimmed;
    timing.uniqueCommands.add(trimmed);
  }

  public static recordFlagAttempt(sessionId: string, taskId: number, isCorrect: boolean): void {
    const timing = this.getOrCreateTiming(sessionId, taskId);
    this.recordAction(sessionId, taskId);
    const now = Date.now();

    timing.flagAttempts++;
    if (timing.firstFlagTimeMs === undefined) {
      timing.firstFlagTimeMs = now - timing.startTime;
    }
    if (isCorrect && timing.firstCorrectFlagTimeMs === undefined) {
      timing.firstCorrectFlagTimeMs = now - timing.startTime;
    }
  }

  /**
   * Validate observed telemetry against expected event sequence.
   */
  public static validateEvents(
    runId: string,
    testCaseId: string,
    expectedEvents: TelemetryEventType[],
    observedEvents: TelemetryEvent[]
  ): TelemetryValidationReport {
    const missingEvents: string[] = [];
    const duplicateEvents: string[] = [];
    const sequenceErrors: string[] = [];
    const timestampAnomalies: string[] = [];
    const conditionMismatches: string[] = [];

    const observedTypes = observedEvents.map(e => e.eventType);

    // 1. Check for expected event coverage
    for (const exp of expectedEvents) {
      if (!observedTypes.includes(exp)) {
        missingEvents.push(exp);
      }
    }

    // 2. Check for unexpected duplicates on singleton events
    const singletons: TelemetryEventType[] = ['run_created', 'run_started', 'session_started', 'level_start'];
    for (const s of singletons) {
      const count = observedTypes.filter(t => t === s).length;
      if (count > 1) {
        duplicateEvents.push(`${s} occurred ${count} times`);
      }
    }

    // 3. Sequence numbers and timestamp ordering check
    let lastSeq = 0;
    let lastTimestamp = 0;
    for (const evt of observedEvents) {
      if (evt.sequenceNumber <= lastSeq) {
        sequenceErrors.push(`Event ${evt.eventId} sequenceNumber ${evt.sequenceNumber} <= previous ${lastSeq}`);
      }
      lastSeq = evt.sequenceNumber;

      const curTime = new Date(evt.timestamp).getTime();
      if (curTime < lastTimestamp) {
        timestampAnomalies.push(`Event ${evt.eventId} timestamp is earlier than previous event`);
      }
      lastTimestamp = curTime;

      // Condition match verification
      if (evt.assignedCondition !== evt.effectiveCondition && evt.eventType !== 'condition_override') {
        // If task disabled AI, condition_override is expected
        const hasOverride = observedEvents.some(o => o.eventType === 'condition_override');
        if (!hasOverride) {
          conditionMismatches.push(`Condition mismatch without logged condition_override on event ${evt.eventId}`);
        }
      }
    }

    const expectedCount = expectedEvents.length;
    const observedCount = observedEvents.length;
    const coveredExpected = expectedEvents.filter(e => observedTypes.includes(e)).length;
    const completenessPercentage = expectedCount > 0
      ? Math.round((coveredExpected / expectedCount) * 100)
      : 100;

    const passed = missingEvents.length === 0 && sequenceErrors.length === 0 && timestampAnomalies.length === 0;

    return {
      validationId: `val-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      runId,
      testCaseId,
      expectedCount,
      observedCount,
      missingEvents,
      duplicateEvents,
      sequenceErrors,
      timestampAnomalies,
      conditionMismatches,
      completenessPercentage,
      passed,
      timestamp: new Date().toISOString()
    };
  }

  public static validateRunCompleteness(
    runId: string,
    testCaseId: string,
    expectedEvents: TelemetryEventType[],
    observedEvents: TelemetryEvent[]
  ): TelemetryValidationReport {
    return this.validateEvents(runId, testCaseId, expectedEvents, observedEvents);
  }

  /**
   * Version 5 Case Reconstruction Validator:
   * A case is reconstructable only when the case script, actual prompt sequence,
   * released tutor output, relevant terminal evidence, ratings, critical-failure decision,
   * outcome, evaluator comment, and applicable CEW/guardrail/defect/regression records
   * can be recovered without missing, mislinked, duplicate, or out-of-order records.
   */
  public static validateCaseReconstruction(params: {
    caseId: string;
    taskId: number;
    events: TelemetryEvent[];
    review?: any | null;
    requireReviewForFullReconstruction?: boolean;
  }): {
    caseId: string;
    taskId: number;
    reconstructable: boolean;
    executionReconstructable: boolean;
    reviewAttached: boolean;
    promptSequenceRecovered: boolean;
    tutorOutputRecovered: boolean;
    sequenceOrdered: boolean;
    noDuplicateEventIds: boolean;
    noCrossSessionContamination: boolean;
    explanations: string[];
    reconstructedTranscript: {
      sequenceNumber: number;
      eventType: string;
      input?: string;
      output?: string;
      timestamp: string;
    }[];
  } {
    const { caseId, taskId, events, review, requireReviewForFullReconstruction = false } = params;
    const explanations: string[] = [];

    const caseEvents = events.filter(
      e => e.testCaseId === caseId || e.details?.caseId === caseId
    );

    const promptSequenceRecovered = caseEvents.some(e => e.eventType === 'ai_query' && Boolean(e.input));
    if (!promptSequenceRecovered) {
      explanations.push(`Missing ai_query prompt record for case ${caseId}`);
    }

    const tutorOutputRecovered = caseEvents.some(
      e => (e.eventType === 'ai_response_released' || e.eventType === 'ai_response' || e.eventType === 'guardrail_block') && Boolean(e.output)
    );
    if (!tutorOutputRecovered) {
      explanations.push(`Missing released or blocked tutor output record for case ${caseId}`);
    }

    // Check duplicate eventIds
    const seenIds = new Set<string>();
    let noDuplicateEventIds = true;
    for (const ev of caseEvents) {
      if (seenIds.has(ev.eventId)) {
        noDuplicateEventIds = false;
        explanations.push(`Duplicate eventId detected: ${ev.eventId}`);
      }
      seenIds.add(ev.eventId);
    }

    // Check cross-session task mismatch
    let noCrossSessionContamination = true;
    for (const ev of caseEvents) {
      if (ev.taskId !== taskId) {
        noCrossSessionContamination = false;
        explanations.push(`Cross-task linkage mismatch on event ${ev.eventId}: expected taskId=${taskId}, found ${ev.taskId}`);
      }
    }

    // Check per-session monotonic sequence ordering
    const bySession = new Map<string, TelemetryEvent[]>();
    for (const ev of caseEvents) {
      const list = bySession.get(ev.sessionId) || [];
      list.push(ev);
      bySession.set(ev.sessionId, list);
    }

    let sequenceOrdered = true;
    for (const [sessId, sessEvents] of bySession.entries()) {
      let prev = 0;
      for (const ev of sessEvents) {
        if (ev.sequenceNumber <= prev) {
          sequenceOrdered = false;
          explanations.push(`Out-of-order sequenceNumber ${ev.sequenceNumber} (prev ${prev}) in session ${sessId}`);
        }
        prev = ev.sequenceNumber;
      }
    }

    const reviewAttached = Boolean(
      review &&
      review.ratings &&
      review.criticalFailures &&
      typeof review.overallPass === 'boolean' &&
      Boolean(review.evaluatorComment || review.revisionRecommendation || Object.keys(review.comments || {}).length > 0)
    );

    if (requireReviewForFullReconstruction && !reviewAttached) {
      explanations.push(`Missing complete evaluator rubric review or evaluator comment for case ${caseId}`);
    }

    const executionReconstructable =
      promptSequenceRecovered &&
      tutorOutputRecovered &&
      sequenceOrdered &&
      noDuplicateEventIds &&
      noCrossSessionContamination;

    const reconstructable = requireReviewForFullReconstruction
      ? executionReconstructable && reviewAttached
      : executionReconstructable;

    return {
      caseId,
      taskId,
      reconstructable,
      executionReconstructable,
      reviewAttached,
      promptSequenceRecovered,
      tutorOutputRecovered,
      sequenceOrdered,
      noDuplicateEventIds,
      noCrossSessionContamination,
      explanations,
      reconstructedTranscript: caseEvents.map(e => ({
        sequenceNumber: e.sequenceNumber,
        eventType: e.eventType,
        input: e.input,
        output: e.output,
        timestamp: e.serverTimestamp || e.timestamp
      }))
    };
  }
}
