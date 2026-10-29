
export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard'
}

export type TaskType = 'training' | 'post-test' | 'retention' | 'transfer';
export type TaskDomain = 'navigation' | 'permissions' | 'search' | 'processes' | 'users/groups' | 'logs' | 'network' | 'scheduled execution' | 'troubleshooting';

export interface Level {
  id: number;
  taskId?: string;
  taskDefinitionVersion?: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  objective: string;
  flag?: string; // Stored securely on server, stripped for client
  systemContext?: string; // Stored on server, stripped for client in learner mode
  hints: string[];
  isPostTest?: boolean; // Retention Mode Flag
  // Extended Research Fields
  clo?: string; // Course Learning Objective
  taskDomain?: TaskDomain;
  expectedEvidence?: string;
  expectedWarrant?: string;
  acceptableAlternativePaths?: string[];
  solutionCommands?: string[];
  prohibitedCommands?: string[];
  commonMisconceptions?: string[];
  approvedHintProgression?: ProgressiveHintItem[];
  prohibitedDisclosures?: string[];
  taskType?: TaskType;
  aiDisabled?: boolean;
  safeResetProcedure?: string;
  initialSignature?: Record<string, any>;
  inclusionStatus?: boolean;
}

export interface ProgressiveHintItem {
  level: number; // 0-4
  title: string;
  text: string;
  prerequisiteRule?: string;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system' | 'hint' | 'success';
  content: string;
  directory?: string;
  isHintAccepted?: boolean | null; // For Trust Telemetry
  suggestionId?: string;
}

export interface GameState {
  currentLevelId: number;
  completedLevelIds: number[];
  flagsFound: Record<number, boolean>;
}

export type AIProvider = 'gemini' | 'ollama' | 'openai' | 'anthropic' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  
  // Gemini specific
  apiKey?: string;
  
  // Ollama specific
  ollamaUrl: string;
  ollamaModel: string;

  // OpenAI / Custom / Perplexity / Groq / vLLM
  openaiKey?: string;
  openaiModel?: string;
  openaiUrl?: string; // For custom local servers (LM Studio/vLLM) or other providers

  // Anthropic
  anthropicKey?: string;
  anthropicModel?: string;

  // Multi-role model configuration
  tutorProvider?: AIProvider;
  tutorModel?: string;
  evaluatorProvider?: AIProvider;
  evaluatorModel?: string;
  sameModelAsTutor?: boolean;

  // Generation settings
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  seed?: number;

  deploymentMode?: 'local_llm' | 'hosted_model';
  executionEnvironment?: 'ai_simulated' | 'native_pty' | 'rule_based';
  environmentDescription?: string;
  flagSameModel?: boolean;

  // Meta Llama Guard 3 & Semantic Safety Settings
  enableLlamaGuard?: boolean;
  llamaGuardModel?: string;
  llamaGuardProvider?: 'ollama' | 'openai' | 'gemini' | 'auto';
}

// --- AUTH TYPES ---

export type UserRole = 'student' | 'admin' | 'evaluator';
export type ExperimentalCondition = 'guided' | 'unguided' | 'none';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  condition?: ExperimentalCondition;
}

// --- FORMAL EVALUATION RUN TYPES ---

export type RunType =
  | 'formal'
  | 'formal_round_1'
  | 'pilot'
  | 'refinement'
  | 'regression'
  | 'sequestered'
  | 'demonstration'
  | 'dev_smoke';

export type DataClassification =
  | 'formal'
  | 'formal_round_1'
  | 'pilot'
  | 'refinement'
  | 'regression'
  | 'sequestered'
  | 'demonstration'
  | 'synthetic'
  | 'dev_smoke';

export interface ResearchRunManifest {
  runId: string;
  runType?: RunType;
  protocolVersion?: string;
  provider: string;
  ollamaBaseUrl?: string;
  tutorModel: string;
  tutorModelDigest: string;
  guardModel?: string;
  guardModelDigest?: string;
  sandboxImageTag?: string;
  sandboxImageDigest: string;
  promptTemplateVersion: string;
  guardrailRuleSetVersion?: string;
  guardrailPolicyVersion?: string;
  rubricVersion: string;
  taskSpecVersion?: string;
  applicationCommit?: string;
  gitCommitSha?: string;
  isFrozen?: boolean;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  seed?: number | null;
  createdAt?: string;
  lockedAt?: string;
  frozenAt?: string;
  data_classification?: DataClassification;
}

export interface ResearchConfiguration {
  applicationVersion: string;
  releaseStage?: string;
  sourceCommit?: string;
  commitHash?: string;
  ollamaVersion?: string;
  promptTemplateVersion: string;
  guardrailPolicyVersion: string;
  cewRubricVersion: string;
  smeRubricVersion: string;
  taskDefinitionVersion: string;
  telemetrySchemaVersion: string;
  formalCaseMatrixVersion?: string;
  criticalFailureCriteriaVersion?: string;
  evalEnvironmentId?: string;
  tutorProvider: string;
  tutorModel: string;
  tutorModelVersion?: string;
  tutorModelTag?: string;
  tutorModelDigest?: string;
  guardModelName?: string;
  guardModelTag?: string;
  guardModelDigest?: string;
  dockerImageName?: string;
  dockerImageDigest?: string;
  systemPromptHash?: string;
  guardrailConfigHash?: string;
  officialLlamaGuardCategories?: string[];
  customTutorPolicyCategories?: string[];
  evaluatorProvider: string;
  evaluatorModel: string;
  evaluatorModelVersion?: string;
  sameModelAsTutor: boolean;
  processEvaluatorVersion: string;
  generationSettings: {
    temperature: number;
    topP?: number;
    maxTokens?: number;
    seed?: number;
  };
  deploymentMode: 'local_llm' | 'hosted_model';
  executionEnvironment: 'ai_simulated' | 'native_pty' | 'rule_based';
  environmentDescription?: string;
  idleThresholdMs: number;
}

export interface FormalRun {
  runId: string;
  runName: string;
  runType: RunType;
  isLocked: boolean;
  frozenConfig: ResearchConfiguration;
  manifest?: ResearchRunManifest;
  data_classification?: DataClassification;
  createdAt: string;
  lockedAt?: string;
  endedAt?: string;
  notes?: string;
  activeTaskIds: number[];
}

// --- TELEMETRY EVENT TYPES ---

export type TelemetryEventType =
  | 'run_created'
  | 'run_locked'
  | 'run_started'
  | 'run_ended'
  | 'case_started'
  | 'case_completed'
  | 'task_started'
  | 'task_reset'
  | 'session_started'
  | 'session_ended'
  | 'level_start'
  | 'command'
  | 'command_exec'
  | 'terminal_output'
  | 'ai_query'
  | 'ai_response'
  | 'ai_response_released'
  | 'guardrail_block'
  | 'ai_error'
  | 'hint_requested'
  | 'hint_delivered'
  | 'hint_denied'
  | 'suggestion_presented'
  | 'suggestion_accepted'
  | 'suggestion_rejected'
  | 'suggestion_modified'
  | 'suggestion_ignored'
  | 'flag_submit'
  | 'confidence_submit'
  | 'cew_submit'
  | 'cew_submitted'
  | 'cew_auto_score'
  | 'cew_expert_score'
  | 'condition_override'
  | 'guardrail_event'
  | 'expert_review'
  | 'rubric_reviewed'
  | 'critical_failure_recorded'
  | 'defect_created'
  | 'corrective_action_recorded'
  | 'regression_linked'
  | 'reconstruction_validated'
  | 'ground_truth_verified'
  | 'sequestered_access_blocked'
  | 'sequestered_released'
  | 'error_event'
  | 'state_reset';

export type ActorType = 'student' | 'evaluator' | 'synthetic_test' | 'admin' | 'system';

export interface TelemetryEvent {
  eventId: string;
  timestamp: string; // ISO 8601 UTC
  runId: string;
  sessionId: string;
  interactionId: string;
  executionId?: string;
  userId: string;
  actorType: ActorType;
  assignedCondition: ExperimentalCondition;
  effectiveCondition: ExperimentalCondition;
  taskId: number;
  taskDefinitionVersion: string;
  testCaseId?: string;
  scenarioType?: string;
  repetitionNumber?: number;
  eventType: TelemetryEventType;
  input?: string;
  output?: string;
  modelAndPromptVersions?: {
    modelProvider?: string;
    modelName?: string;
    promptVersion?: string;
    guardrailVersion?: string;
  };
  sequenceNumber: number;
  clientTimestamp?: string;
  serverTimestamp: string;
  dataClassification: DataClassification;
  data_classification?: DataClassification;
  applicationVersion: string;
  telemetrySchemaVersion: string;
  idempotencyKey?: string;
  details?: Record<string, any>;
}

// --- STANDARDIZED TEST CASES ---

export type ScenarioType =
  | 'appropriate_help'
  | 'direct_answer_seeking'
  | 'direct_answer_request'
  | 'plausible_misconception'
  | 'incorrect_hypothesis'
  | 'unsupported_claim'
  | 'partial_evidence'
  | 'repeated_bypass_attempt'
  | 'repeated_guardrail_bypass'
  | 'correct_reasoning'
  | 'ambiguous_request'
  | 'irrelevant_request'
  | 'prompt_injection'
  | 'restricted_information'
  | 'unsafe_command';

export type TestingStage = 'pilot' | 'round_1' | 'consistency_repeat' | 'regression' | 'regression_verification' | 'sequestered';

export interface ScriptedTurn {
  role: 'user' | 'assistant';
  text: string;
  expectedBehaviorNotes?: string;
}

export interface TestCase {
  id?: string;
  testCaseId: string;
  taskId: number;
  taskTitle?: string;
  scenarioType: ScenarioType;
  condition: ExperimentalCondition;
  assignedCondition?: ExperimentalCondition;
  testingStage?: TestingStage;
  scriptedInteraction: ScriptedTurn[];
  expectedTutorBehavior: string;
  expectedBehavior?: string;
  prohibitedBehavior: string;
  prohibitedTutorBehaviors?: string;
  applicableRubricDimensions?: Array<keyof ExpertReviewRatings>;
  requiredRecordTypes?: TelemetryEventType[];
  expectedLogEvents: TelemetryEventType[];
  repetitionCount: number;
  repetitionRequirement?: number;
  highRiskIndicator?: boolean;
  CEWInstructionalIndicator?: boolean;
  isCewCase?: boolean;
  isSequestered?: boolean;
  sealedHash?: string;
  applicationVersion?: string;
  configurationReference?: string;
  evaluationRound?: number;
  notes?: string;
  active: boolean;
}

export interface CaseExecutionRecord {
  executionId: string;
  testCaseId?: string;
  caseId?: string;
  taskId: number;
  taskTitle?: string;
  scenarioType: ScenarioType;
  stage?: TestingStage;
  repetitionIndex?: number; // 1, 2, or 3
  repetitionNumber?: number;
  parentExecutionId?: string;
  runId: string;
  runType?: RunType;
  sessionId: string;
  startedAt?: string;
  completedAt?: string;
  timestamp?: string;
  promptText?: string;
  terminalContext?: string;
  rawModelResponse?: string;
  releasedResponse?: string;
  providerUsed?: string;
  modelUsed?: string;
  modelName?: string;
  modelDigest?: string;
  sandboxImageDigest?: string;
  promptVersion?: string;
  promptTemplateHash?: string;
  guardrailVersion?: string;
  guardrailConfigVersion?: string;
  deterministicInputDecision?: string;
  llamaGuardInputDecision?: string;
  deterministicOutputDecision?: string;
  llamaGuardOutputDecision?: string;
  finalDecision?: GuardrailDecisionOutcome | string;
  guardrailIntervened?: boolean;
  originalResponseReleased?: boolean;
  latencyMs?: number;
  preGuardLatencyMs?: number;
  modelLatencyMs?: number;
  postGuardLatencyMs?: number;
  totalLatencyMs?: number;
  telemetryComplete?: boolean;
  recordIntegrityPassed?: boolean;
  recordIntegrityPass?: boolean;
  reconstructable?: boolean;
  initialPass?: boolean;
  casePassed?: boolean;
  applicableRatingsMean?: number;
  applicableRatingsCount?: number;
  hasCriticalFailure?: boolean;
  criticalFailures?: Record<string, boolean>;
  tutorResponseSnippet?: string;
  interactionIds?: string[];
  terminalCommandIds?: string[];
  terminalOutputIds?: string[];
  data_classification: DataClassification;
}

// --- 3.2 RECORD INTEGRITY EVALUATOR (RQ4) ---

export type RecordIntegrityCheckName =
  | 'identifiers_present'
  | 'linkage_correct'
  | 'configuration_captured'
  | 'prompts_and_responses_present'
  | 'terminal_records_present'
  | 'ordering_valid'
  | 'ratings_and_outcome_present'
  | 'conditional_records_present'
  | 'reconstruction_test';

export interface RecordIntegrityCheckResult {
  name?: RecordIntegrityCheckName;
  checkName?: RecordIntegrityCheckName;
  passed: boolean;
  details?: string;
  reason?: string;
}

export interface ExecutionIntegrityReport {
  integrityId: string;
  executionId: string;
  caseId: string;
  runId: string;
  sessionId: string;
  taskId: number;
  data_classification: DataClassification;
  allChecksPassed: boolean;
  recordIntegrityPassed: boolean;
  overallPassed?: boolean;
  reconstructable: boolean;
  checks: RecordIntegrityCheckResult[] & Record<RecordIntegrityCheckName, RecordIntegrityCheckResult>;
  checkList?: RecordIntegrityCheckResult[];
  narrative?: string;
  reconstructedNarrative?: string;
  missingLinks?: string[];
  failingChecks: RecordIntegrityCheckName[];
  failedChecks: RecordIntegrityCheckName[];
  autoCreatedDefectId?: string;
  evaluatedAt: string;
}

// --- 3.3 PER-CASE GROUND-TRUTH RECORDS ---

export interface GroundTruthInitialState {
  imageDigest?: string;
  user?: string;
  cwd?: string;
  files: { path: string; permissions: string; owner?: string; expectedSha256?: string }[];
  processes: string[];
  directories: string[];
  envVars?: Record<string, string>;
  expectedExitCodes?: Record<string, number>;
  permissions?: Record<string, string>;
  services?: string[];
}

export interface GroundTruthRecord {
  caseId: string;
  taskId: number;
  initialTerminalState: GroundTruthInitialState;
  validVerifyCommands: string[];
  expectedObservableEvidence: string[];
  validTutorDirection: string[];
  prohibitedDisclosures: string[];
  verifiedFacts?: string[];
  validVerificationCommands?: string[];
  expectedCriticalOutputs?: string[];
  allowedNextStepGuidance?: string[];
  verificationCommand: string;
  verifiedInSandbox: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  lastVerificationOutput?: string;
  initial_state?: any;
  verification_procedure?: string;
  expected_output_or_error?: string;
  expected_exit_status_or_state_change?: string;
  documentation_used?: string;
  executed_by?: string;
  executed_at?: string;
  evidence_file?: string;
  last_verification_transcript?: string;
  last_verification_passed?: boolean;
  executionBackend?: 'docker_container' | 'host_tempdir_fixture';
  data_classification: DataClassification;
}

// --- 3.4 SEQUESTERED CASES ---

export interface SequesteredCaseRecord {
  caseId: 'SQ-01' | 'SQ-02' | 'SQ-03' | 'SQ-04' | 'SQ-05' | 'SQ-06' | string;
  testCaseId?: string;
  taskId: number;
  scenarioType: ScenarioType;
  promptText: string;
  terminalContext: string;
  expectedBehavior: string;
  expectedSafetyOutcome: string;
  isHighRisk: boolean;
  isCewCase: boolean;
  cewClaim?: string;
  cewEvidence?: string;
  cewWarrant?: string;
  promptHash: string;
  groundTruthHash?: string;
  sealed: boolean;
  releasedAt?: string;
  releasedBy?: string;
  isSequestered?: boolean;
  sealedHash?: string;
  scriptedInteraction?: ScriptedTurn[];
  data_classification: DataClassification;
}

export interface PublicSequesteredCaseView {
  caseId: string;
  testCaseId?: string;
  taskId: number;
  promptHash: string;
  groundTruthHash?: string;
  sealed: boolean;
  releasedAt?: string;
  releasedBy?: string;
  scenarioType?: ScenarioType;
  promptText?: string;
  terminalContext?: string;
  expectedBehavior?: string;
  expectedSafetyOutcome?: string;
  scriptedInteraction?: ScriptedTurn[];
  data_classification: DataClassification;
}

// --- 3.5 TUTOR-LEVEL LATENCY AND PROVENANCE ---

export interface TutorInteractionRecord {
  interactionId: string;
  executionId: string;
  runId: string;
  runType?: RunType;
  sessionId: string;
  caseId?: string;
  taskId: number;
  turnIndex?: number;
  sequenceNumber?: number;
  data_classification: DataClassification;
  provider: string;
  modelName: string;
  modelDigest: string;
  promptTemplateVersion?: string;
  guardrailPolicyVersion?: string;
  containerImageDigest?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  seed?: number | null;
  learnerPrompt: string;
  attachedTerminalContext?: string;
  attachedTerminalSliceIds?: string[];
  rawModelResponse: string;
  preCheckDecision?: GuardrailDecisionOutcome | string;
  postCheckDecision?: GuardrailDecisionOutcome | string;
  finalGuardrailDecision?: GuardrailDecisionOutcome | string;
  releasedResponse?: string;
  guardrailIntervened: boolean;
  originalResponseReleased: boolean;
  detectedCategory?: string;
  preGuardLatencyMs: number;
  modelLatencyMs: number;
  postGuardLatencyMs: number;
  totalLatencyMs: number;
  timestamp: string;
  // Optional aliases
  inferenceSettings?: {
    temperature: number;
    topP?: number;
    maxTokens?: number;
    seed?: number;
  };
  systemPromptHash?: string;
  guardrailConfigHash?: string;
  tutorVersion?: string;
  applicationCommit?: string;
  userPrompt?: string;
  rawModelOutput?: string;
  postGuardReleasedOutput?: string;
  preGuardDecision?: GuardrailDecisionOutcome | string;
  postGuardDecision?: GuardrailDecisionOutcome | string;
  finalDecision?: GuardrailDecisionOutcome | string;
  finalTutorResponse?: string;
  deterministicInputResult?: any;
  llamaGuardInputResult?: any;
  deterministicOutputResult?: any;
  llamaGuardOutputResult?: any;
  hintLevel?: number;
  fallbackUsed?: boolean;
}

// --- 3.7 & 3.8 TERMINAL & CONTAINER EVIDENCE ---

export interface ContainerSessionRecord {
  containerSessionId?: string;
  sessionId: string;
  executionId?: string;
  caseId?: string;
  taskId: number;
  runId: string;
  containerId: string;
  containerImage?: string;
  imageName?: string;
  imageDigest: string;
  user: string;
  startedAt: string;
  stoppedAt?: string;
  status?: string;
  mode?: string;
  executionBackend?: 'docker_container' | 'host_shell_workspace' | 'unavailable';
  data_classification: DataClassification;
}

export interface TerminalCommandRecord {
  commandId: string;
  sessionId: string;
  executionId?: string;
  runId: string;
  caseId?: string;
  taskId: number;
  command?: string;
  commandText?: string;
  cwd: string;
  exitStatus: number | null;
  sequenceNumber: number;
  timestamp: string;
  source?: 'shell_hook' | 'pty_line' | 'test_harness';
  data_classification: DataClassification;
}

export interface TerminalOutputRecord {
  outputId: string;
  commandId?: string;
  sessionId: string;
  executionId?: string;
  runId: string;
  caseId?: string;
  taskId: number;
  ansiStrippedStream?: string;
  ansiStrippedText?: string;
  content?: string;
  byteLength: number;
  truncated: boolean;
  fullOutputFileRef?: string;
  sequenceNumber: number;
  timestamp: string;
  data_classification: DataClassification;
}

// --- PROGRESSIVE HINTS ---

export interface HintState {
  hintLevelRequested: number; // 0-4
  hintLevelDelivered: number;
  reason: string;
  prerequisitesMet: boolean;
}

// --- CEW & RUBRICS ---

export interface CEWMetric {
  claim_score: number; // 1-3
  evidence_score: number; // 1-3
  warrant_score: number; // 1-3
  feedback_category: string; // text
  claim_rationale?: string;
  evidence_rationale?: string;
  warrant_rationale?: string;
}

export interface CEWSubmission {
  submissionId: string;
  runId: string;
  sessionId: string;
  taskId: number;
  testCaseId?: string;
  userId: string;
  attemptNumber: number;
  flagAttempted: string;
  flagHash?: string;
  confidenceRaw: number; // 1-5
  confidenceNormalized: number; // 0-1
  claim: string;
  evidence: string;
  warrant: string;
  isCorrect: boolean;
  timeToSolveMs: number;
  activeInteractionTimeMs: number;
  idleTimeMs: number;
  timestamp: string;
  version: number;
  isLocked: boolean;
  data_classification?: DataClassification;
}

export interface CEWScore {
  scoreId: string;
  submissionId: string;
  testCaseId?: string;
  scoreType: 'automated' | 'expert';
  evaluatorId: string;
  provider: string;
  model: string;
  rubricVersion: string;
  claimScore: number; // 1-3
  evidenceScore: number; // 1-3
  warrantScore: number; // 1-3
  claimRationale: string;
  evidenceRationale: string;
  warrantRationale: string;
  feedbackCategory: string;
  confidence?: number;
  timestamp: string;
  isSameModelAsTutor?: boolean;
  diagnosticOnly?: boolean;
}

export interface KappaResult {
  kappa: number; // Cohen's Quadratic Weighted Kappa
  observedWeightedAgreement: number; // Po
  chanceExpectedAgreement: number; // Pe
  interpretation: 'Poor' | 'Slight' | 'Fair' | 'Moderate' | 'Substantial' | 'Almost Perfect';
}

export interface CEWAgreementReport {
  sampleSize: number;
  exactAgreementPercentage: number;
  withinOnePointPercentage: number;
  meanAbsoluteDifference: number;
  claimAgreementPct: number;
  evidenceAgreementPct: number;
  warrantAgreementPct: number;
  componentDisagreements: {
    claim: number;
    evidence: number;
    warrant: number;
  };
  confusionMatrix: {
    // [systemScore - 1][expertScore - 1]
    claim: number[][];
    evidence: number[][];
    warrant: number[][];
  };
  confusionMatrixClaim?: number[][];
  confusionMatrixEvidence?: number[][];
  confusionMatrixWarrant?: number[][];
  quadraticWeightedKappa: {
    claim: KappaResult;
    evidence: KappaResult;
    warrant: KappaResult;
    overall: KappaResult;
  };
  largestDisagreements: {
    submissionId: string;
    taskId: number;
    systemScore: { claim: number; evidence: number; warrant: number };
    expertScore: { claim: number; evidence: number; warrant: number };
    difference: number;
  }[];
  disclaimer: string;
}

export interface CriticalFailureChecklist {
  // Version 5 Canonical 10 Categories
  flag_or_complete_solution_disclosure?: boolean;
  prohibited_copy_paste_solution_command?: boolean;
  unsafe_or_unauthorized_recommendation?: boolean;
  fabricated_command_output_file_service_or_state?: boolean;
  materially_false_conclusion_affirmed?: boolean;
  system_prompt_credential_secret_or_restricted_disclosure?: boolean;
  repeated_bypass_guardrail_failure?: boolean;
  incorrect_task_completion_confirmation?: boolean;
  application_crash_or_task_state_corruption?: boolean;
  unreconstructable_missing_or_mislinked_records?: boolean;
  // Backward compatibility / legacy aliases
  flag_disclosure?: boolean;
  prohibited_full_solution?: boolean;
  major_linux_error?: boolean;
  unsupported_false_affirmation?: boolean;
  fabricated_observation?: boolean;
  destructive_command_recommendation?: boolean;
  restricted_information_exposure?: boolean;
  guardrail_bypass_failure?: boolean;
  incorrect_completion_confirmation?: boolean;
  application_crash_or_data_loss?: boolean;
  missing_required_log?: boolean;
  prohibited_dialogue_in_unassisted_condition?: boolean;
  safety_boundary_failure?: boolean;
  unjustifiable_cew_score?: boolean;
  condition_behavior_failure?: boolean;
  task_state_corruption?: boolean;
}

export interface ExpertReviewRatings {
  technicalCorrectness: number | null; // 1-5 or null (N/A)
  contextualRelevance: number | null; // 1-5 or null (N/A)
  socraticScaffolding: number | null; // 1-5 or null (N/A)
  evidencePrompting: number | null; // 1-5 or null (N/A)
  guardrailCompliance: number | null; // 1-5 or null (N/A)
  pedagogicalAppropriateness: number | null; // 1-5 or null (N/A)
  cewAlignment: number | null; // 1-5 or null (N/A)
  actionability: number | null; // 1-5 or null (N/A)
  overallUsefulness: number | null; // 1-5 or null (N/A)
  safetyAndResponsibility?: number | null; // Legacy V1
}

export interface ExpertReview {
  reviewId: string;
  linkedInteractionId?: string;
  linkedResponseId?: string;
  executionId?: string;
  runId: string;
  testCaseId?: string;
  taskId: number;
  evaluatorId: string;
  reviewerId?: string;
  rubricVersion: string;
  smeRubricVersion: string;
  reviewTimestamp: string;
  timestamp?: string;
  ratings: ExpertReviewRatings;
  naReasons?: Record<string, string>;
  nonApplicableReasons?: Record<string, string>; // Stored reason when dimension is null / N/A
  dimensionJustifications?: Record<string, string>; // Short justification per dimension
  comments: Record<string, string>;
  evaluatorComment?: string;
  failureExplanation?: string;
  criticalFailures: CriticalFailureChecklist;
  criticalFailureQuotes?: Record<string, string>; // Evidence quote per triggered critical failure
  criticalFailureEvidenceQuotes?: Record<string, string>;
  recordIntegrityPassed?: boolean;
  coreDimensionsAtLeast4?: boolean;
  overallPass: boolean;
  initialCasePass?: boolean;
  latestExecutionMeetsRatingFloor?: boolean;
  applicableMean?: number;
  applicableCount?: number;
  revisionRecommendation: string;
  uncertaintyFlag: boolean;
  reviewStatus: 'draft' | 'submitted' | 'final';
  data_classification?: DataClassification;
  version?: number;
  editedBy?: string;
  editedAt?: string;
  previousVersionId?: string;
  readOnlyAfterExport?: boolean;
}

// --- DEFECT TRACKING & REGRESSION COMPARISONS ---

export type DefectStatus = 'Open' | 'Confirmed' | 'In Progress' | 'Fixed' | 'Retest Required' | 'Closed' | 'Deferred' | 'open' | 'closed' | 'fixed' | 'in_progress' | 'verified' | 'pending';
export type DefectSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface DefectRecord {
  defectId: string;
  runId?: string;
  testCaseId?: string;
  taskId?: number;
  category?: string;
  rootCauseCategory?: string;
  title?: string;
  affectedComponent?: string;
  detectedInRunId?: string;
  linkedRunId?: string;
  linkedTestCaseId?: string;
  linkedTestCaseIds?: string[];
  linkedExecutionId?: string;
  linkedInteractionId?: string;
  defectCategory?: string;
  severity: DefectSeverity;
  description: string;
  reproductionSteps?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  correctiveAction?: string;
  filesModified?: string[];
  regressionRunId?: string;
  regressionStatus?: string;
  ActionStatus?: string;
  applicationVersion?: string;
  evaluatorComments?: string;
  status?: DefectStatus;
  codeChangeRef?: string;
  retestResult?: string;
  regressionTestId?: string;
  data_classification?: DataClassification;
  createdAt: string;
  updatedAt: string;
}

export interface RegressionComparisonRecord {
  comparisonId: string;
  caseId: string;
  taskId: number;
  scenarioType?: string;
  round1ExecutionId: string;
  round1RunId: string;
  round1Pass?: boolean;
  round1Passed?: boolean;
  round1ApplicableMean?: number;
  round1CriticalFailures?: number;
  regressionExecutionId: string;
  regressionRunId: string;
  regressionPass?: boolean;
  regressionPassed?: boolean;
  regressionApplicableMean?: number;
  regressionCriticalFailures?: number;
  statusChange?: string;
  defectResolved?: boolean;
  newlyIntroducedFailure?: boolean;
  linkedDefectIds: string[];
  data_classification: DataClassification;
  comparedAt: string;
}

// --- GUARDRAILS & TELEMETRY VALIDATION ---

export type GuardrailDecisionOutcome =
  | 'ALLOW'
  | 'ALLOW_WITH_MONITORING'
  | 'SAFE_REDIRECT'
  | 'BLOCK'
  | 'CONFIGURATION_ERROR';

export interface GuardrailDecisionRecord {
  decisionId: string;
  caseId?: string;
  executionId?: string;
  sessionId: string;
  taskId: number;
  testingStage?: TestingStage;
  tutorModelName: string;
  tutorModelTag?: string;
  tutorModelDigest: string;
  guardModelName: string;
  guardModelTag?: string;
  guardModelDigest: string;
  systemPromptVersion: string;
  guardrailPolicyVersion: string;
  officialLlamaGuardCategories: string[];
  customTutorPolicyCategories: string[];
  layerEvidence?: {
    deterministicInput: { executed: boolean; violated: boolean; category?: string; reason?: string };
    llamaGuardInput: { executed: boolean; safe: boolean; officialCategories: string[]; customCategories: string[]; rawAssessment?: string };
    deterministicOutput: { executed: boolean; violated: boolean; category?: string; reason?: string };
    llamaGuardOutput: { executed: boolean; safe: boolean; officialCategories: string[]; customCategories: string[]; rawAssessment?: string };
    finalDecision: GuardrailDecisionOutcome;
  };
  inputAssessment?: {
    safe: boolean;
    violatedOfficialCategories: string[];
    violatedCustomCategories: string[];
    rawAssessment?: string;
  };
  outputAssessment?: {
    safe: boolean;
    violatedOfficialCategories: string[];
    violatedCustomCategories: string[];
    rawAssessment?: string;
  };
  finalDecision: GuardrailDecisionOutcome;
  decisionReason: string;
  timestamp: string;
  latencyMs: number;
  fallbackUsed: boolean;
  fallbackType?: 'none' | 'heuristic_development' | 'restricted_rule_based';
  data_classification?: DataClassification;
}

export interface GuardrailEventRecord {
  guardrailEventId: string;
  runId: string;
  sessionId: string;
  taskId: number;
  policyVersion: string;
  detectedCategory: string;
  actionTaken: 'blocked' | 'redirected' | 'flagged';
  safeSummary: string;
  timestamp: string;
  data_classification?: DataClassification;
}

export interface TelemetryValidationReport {
  validationId: string;
  runId: string;
  testCaseId: string;
  expectedCount: number;
  observedCount: number;
  missingEvents: string[];
  duplicateEvents: string[];
  sequenceErrors: string[];
  timestampAnomalies: string[];
  conditionMismatches: string[];
  completenessPercentage: number;
  passed: boolean;
  timestamp: string;
}

// --- LEGACY RESEARCH LOG FOR COMPATIBILITY ---

export type ResearchLogType = 'command' | 'flag_attempt' | 'level_start' | 'override_event';

export interface ResearchLog {
  timestamp: string;
  userId: string;
  username: string;
  levelId: number;
  type: ResearchLogType;
  input: string;
  output: string;
  metrics?: CEWMetric;
  isCorrect?: boolean;
  confidence?: number;
  claim?: string;
  evidence?: string;
  warrant?: string;
  timeToSolveMs?: number;
  condition?: ExperimentalCondition;
  // Backward compatibility forward references
  runId?: string;
  sessionId?: string;
  sequenceNumber?: number;
  eventId?: string;
}

// --- RESEARCH STUDY SPECIFICATIONS & FEATURE FLAGS ---

export const FEATURE_FLAGS = {
  futureCEWScoringEvaluation: false
};

export const RESEARCH_QUESTIONS = {
  RQ1: {
    id: 'RQ1',
    title: 'Tutor Quality',
    question: 'To what extent does the Guided AI Linux tutor provide technically accurate, contextually relevant, pedagogically appropriate, and actionable assistance across selected introductory Linux tasks?'
  },
  RQ2: {
    id: 'RQ2',
    title: 'Guardrail Performance',
    question: 'To what extent does the tutor comply with its defined Socratic-scaffolding, evidence-prompting, direct-answer restriction, guardrail, and safety requirements?'
  },
  RQ3: {
    id: 'RQ3',
    title: 'Behavioral Consistency',
    question: 'How consistently does the tutor maintain required instructional and guardrail behaviors across repeated high-risk test cases?'
  },
  RQ4: {
    id: 'RQ4',
    title: 'Record Integrity',
    question: 'To what extent does the application generate complete, correctly linked, logically ordered, and reconstructable evaluation records?'
  },
  RQ5: {
    id: 'RQ5',
    title: 'Formative Application Correction',
    question: 'To what extent do application refinements resolve problems identified during the initial evaluation without introducing new failures during regression testing?'
  }
};
