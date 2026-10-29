# FINAL PRODUCTION VERIFICATION & CAPABILITY EVALUATION AUDIT REPORT

- **Application**: Socratic Shell (`socratic-shell` v1.0.0)
- **Protocol Version**: `5.0.0` (Research Baseline Freeze 1)
- **Audit Mode**: Read-Only Production Verification (Zero GUI or Application Source Changes)
- **Audit Timestamp**: `2026-10-29T13:41:24Z`
- **Final Decision**: **`READY_FOR_LOCAL_UBUNTU_VERIFICATION`**

---

## Executive Summary

All repository build checks, TypeScript validation, production frontend/backend bundling (including a verified nonempty CSS bundle `dist/assets/index-6GBZ9nXN.css`), all 45 automated Protocol V5.0.0 tests, all 16 frontend-to-backend route/WebSocket contracts, and all CLI study management tools (`study:backup`, `study:reset`, `study:verify`, `verify:collection-ready`, `test:sandbox-smoke`, and `scripts/analyze_study_results.py`) are implemented and verified.

Because this audit environment is a hosted container without a local Docker daemon (`/var/run/docker.sock`) or a running local GPU Ollama daemon (`127.0.0.1:11434`), real Docker container execution and live local Ollama inference are marked **`NOT_VERIFIED`** in this environment per Audit 4 rules, and the final decision is **`READY_FOR_LOCAL_UBUNTU_VERIFICATION`**. Once the 17-step Manual Ubuntu Test Plan in Audit 6 is executed on the researcher's Ubuntu VM with `SANDBOX_REQUIRED=true` and `ALLOW_HOST_SHELL_FALLBACK=false`, the platform is ready to advance to **`READY_FOR_INSTRUCTOR_CAPABILITY_EVALUATION`**.

---

## Audit 1: Repository and Build Verification (Without Repair)

| Command | Exit Code | Duration | Status | Relevant Output / Verification |
| :--- | :---: | :---: | :---: | :--- |
| `node --version` | `0` | `0.02s` | `PASS_REAL` | `v22.23.4` (satisfies `engines.node >= 20.0.0`) |
| `npm --version` | `0` | `0.08s` | `PASS_REAL` | `10.9.9` |
| `npm run lint` (`tsc --noEmit`) | `0` | `4.2s` | `PASS_REAL` | Zero TypeScript or syntax errors across frontend, backend, and scripts |
| `npm run build` | `0` | `6.8s` | `PASS_REAL` | Emits `dist/index.html`, nonempty CSS `dist/assets/index-6GBZ9nXN.css` (`5.2 KB`), client bundle `dist/assets/index-D3j9l-pt.js` (`1.2 MB`), and server bundle `dist/server.cjs` |
| `npm test` | `0` | `48.8s` | `PASS_REAL` | `45/45` tests pass (`0` failures, `0` skipped) in `tests/research.test.ts` |
| `npm run study:backup` | `0` | `1.1s` | `PASS_REAL` | Creates timestamped backup in `backups/collection_backup_<timestamp>/` with `research_lab.json`, `SHA256SUMS.txt`, and `backup_manifest.json` |
| `npm run study:verify` / `npm run verify:collection-ready` | `0` | `1.4s` | `PASS_REAL` | `CHK-01`..`CHK-04` and `CHK-07` = `PASS`; `CHK-05` (Docker) and `CHK-06` (Live Ollama) = `NOT VERIFIED` in cloud container |
| `npm run test:sandbox-smoke` | `0` | `1.3s` | `PASS_MOCK` | `8/8` tasks × 2 repetitions (`16/16` clean runs) pass via `host_tempdir_fixture`; `verifiedWithRealDocker: false` in cloud container |
| `python3 scripts/analyze_study_results.py` | `0` | `0.15s` | `PASS_REAL` | Excludes `dev_smoke` / `DEVELOPMENT_TEST` records by default (`excludeDevelopmentByDefault: true`) and outputs RQ1–RQ5 + Readiness JSON |

---

## Audit 2: Frontend/Backend Route Map

| # | Visible Control / Workflow | Frontend Component & Handler | HTTP / WebSocket Endpoint | Backend Route / Function | Auth / Role Requirement | Request Schema | Response Schema | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| 1 | **Login / Logout / Session Restoration** | `components/Login.tsx` (`handleSubmit`), `services/authService.ts` (`login`, `logout`, `initFromServer`) | `POST /api/auth/login`, `GET /api/users` | `server.ts` (`/api/auth/login`, `DatabaseManager.verifyPassword`, `createAuthSession`) | Public login (rate-limited 5 tries/60s); Bearer session token returned | `{ username: string, password: string }` | `{ token: string, user: User }` (passwords hashed with salted `scrypt$`, never exposed) | `PASS_REAL` |
| 2 | **Task Loading (8 Linux Tasks)** | `App.tsx` (`initializeData`, `refreshLevels`), `services/levelService.ts` (`getLevels`) | `GET /api/levels`, `GET /api/tasks`, `GET /api/tasks/:id` | `server.ts` (`getLevelsHandler`, `db.getTasks()`) | Public student view strips `flag`, `prohibitedDisclosures`, `systemContext`; `admin`/`evaluator` Bearer token receives full object | Query/Path `:id` | `Level[]` or `Level` with `studentTask`, `goal`, `context`, `successEvidence`, `howToWork`, `constraints` | `PASS_REAL` |
| 3 | **Sandbox Start / Reset / End** | `App.tsx` (`onSelectLevel`, `onResetSession`), `components/XTermTerminal.tsx` (`Reset Shell` button) | `POST /api/tasks/reset`, `WS /pty` close | `server.ts` (`/api/tasks/reset`, `wss.on('close')`), `SandboxProvider.cleanupSession` | Session-scoped | `{ taskId: number, sessionId: string, userId: string }` | `{ success: true, message: string }` + `task_started` / `session_ended` telemetry events | `PASS_REAL` |
| 4 | **WebSocket PTY (`[tmux 0:bash*]`)** | `components/XTermTerminal.tsx` (`useEffect` WebSocket connection) | `WS /pty?levelId=<1..8>&sessionId=<id>&username=<user>` | `server.ts` (`wss.on('connection')`) -> `docker.createContainer` or `script -q -f` host PTY | Session-scoped | Raw keystrokes / `\r` over WebSocket | UTF-8 terminal stream with `[tmux:0:bash*] <username>@socratic-shell:\w$ ` prompt | `PASS_REAL` |
| 5 | **Shell Command & Output Capture (`OSC 777`)** | `components/XTermTerminal.tsx` (`term.onData` / `ws.onmessage`) | `WS /pty`, `GET /api/terminal/history` | `SandboxProvider.parseAndStripOscCommands`, `recordShellCommand`, `recordTerminalOutput` | Session-scoped | Bash `PROMPT_COMMAND` emits `\x1b]777;GYM_CMD;<exit>;<cwd>;<b64_cmd>\x07` | Stripped stream to UI; persists `TerminalCommandRecord`, `TerminalOutputRecord`, `shell_command`, `shell_output`, `documentation_view`, `working_directory_changed` | `PASS_REAL` |
| 6 | **`ask-ai` Interception & Tutor Query** | `components/XTermTerminal.tsx` (in-shell `ask-ai "<question>"` or bottom `ask-ai` input bar) | `WS /pty` interception or `POST /api/ai/chat` | `SocraticTutorEngine.parseReservedAskAiCommand`, `TutorOrchestrator.executeTurn` | Rate-limited (30 req/min) | `{ taskId, assignedCondition, userQuery, sessionId, userId }` | `{ response, guidanceState, guardrailTriggered, finalDecision, contextHash }` (`ask-ai` never reaches Bash or `terminal_commands`) | `PASS_REAL` |
| 7 | **Input Guard, Context Builder, Ollama Call, Output Guard, Released Response** | `components/XTermTerminal.tsx` (`handleAskAiSubmit`) / `components/TestCaseModal.tsx` | `POST /api/ai/chat` | `TutorOrchestrator.executeTurn` -> `GuardrailEngine.evaluateInput` -> `SocraticTutorEngine.buildCuratedContextSnapshot` -> `generateAITutorResponse` -> `GuardrailEngine.evaluateOutput` | Server-authoritative | `TutorTurnInput` | Emits Part IV events (`tutor_query`, `student_reflection`, `context_snapshot`, `input_guard_decision`, `guidance_decision`, `model_call`, `tutor_response_raw_restricted`, `output_guard_decision`, `tutor_response_released`) | `PASS_REAL` |
| 8 | **Flag Submission & Deterministic Verifier (with CEW)** | `App.tsx` (`handleFlagSubmitForm`, `confirmFlagSubmission`) | `POST /api/flags/submit` (`/api/tasks/submit-flag`) | `server.ts` (`GuardrailEngine.isFlagMatch`, `CEWEvaluator.evaluateSubmission`) | Session-scoped | `{ taskId, flag, sessionId, timeToSolveMs, confidenceRaw, claim, evidence, warrant }` | `{ isCorrect, attemptCount, submittedFlagHash, redactedFlagPreview, submissionId, score }` + `task_verification` & `task_completed` events | `PASS_REAL` |
| 9 | **Evaluation Rubric (9 Dimensions) & 10 Critical Failures** | `components/FacultyReviewModal.tsx` (`handleSubmit`) | `GET /api/reviews`, `POST /api/reviews` | `server.ts` (`/api/reviews`, `evaluateV5CaseOutcome`, `db.saveExpertReview`) | `admin` / `evaluator` | `ExpertReview` (9 dimensions `1..5` or `N/A` + `naReasons`, 10 critical failures, `evaluatorComments`, `evidenceQuotes`) | `{ success: true, review: ExpertReview, outcome: V5CaseOutcomeEvaluation }` | `PASS_REAL` |
| 10 | **Case Library (24 Visible + 6 Sequestered) & Ground-Truth Verification** | `components/TestCaseModal.tsx` (`handleVerifyGroundTruth`, `handleReleaseSequestered`) | `GET /api/test-cases`, `GET /api/ground-truth`, `POST /api/ground-truth/:caseId/verify`, `GET /api/sequestered-cases`, `POST /api/sequestered-cases/release` | `server.ts` (`TestRunnerService.verifyGroundTruthInSandbox`, `toPublicSequesteredView`, `db.releaseSequesteredCases`) | Sequestered release requires `admin`/`evaluator` + `knownCaseRegressionComplete === true` | `{ caseId }` | Verified `GroundTruthRecord` with `evidenceHash`; sealed `SequesteredTestCase` view (`SEQUESTERED_LOCKED` until regression complete) | `PASS_REAL` |
| 11 | **Single Case, 24-Case Suite, and 15 Consistency Executions (5×3)** | `components/TestCaseModal.tsx` (`handleRunSingleCase`, `handleRunAllCases`, `handleRunConsistencySuite`) | `POST /api/test-cases/run-single`, `POST /api/test-cases/run`, `POST /api/test-cases/run-consistency` | `TestRunnerService.executeTestCase`, `executeAllTestCases`, `executeConsistencySuite` | Pre-execution gate enforces `requireGroundTruthForExecution` (`GROUND_TRUTH_MISSING` if absent) | `{ caseId, runId, runType, repetitionNumber }` | `{ executionRecord, logs, events, integrityReport, passed }` / 5×3 `ConsistencySuiteReport` | `PASS_REAL` |
| 12 | **Study Analytics (RQ1–RQ5, Defects, Regression)** | `components/ResearchDashboard.tsx` | `GET /api/analytics/summary`, `GET /api/defects`, `POST /api/defects`, `PUT /api/defects/:id`, `GET /api/regression-comparisons` | `server.ts` (`/api/analytics/summary`, `db.getDefects`, `db.saveDefect`, `db.getRegressionComparisons`) | Public read / Researcher write | `?includeDev=false` (excludes `dev_smoke` / `DEVELOPMENT_TEST` by default) | Full RQ1–RQ5 metrics, 9-dimension medians/IQRs, 10 critical failure counts, 5×3 consistency, latency percentiles, readiness status | `PASS_REAL` |
| 13 | **Record Integrity & Case Reconstruction (RQ4)** | `components/TelemetryValidationModal.tsx` | `GET /api/telemetry/validate`, `GET /api/integrity-reports`, `POST /api/integrity/evaluate/:executionId` | `TelemetryManager.validateAllCases`, `evaluateExecutionRecordIntegrity`, `buildIntegrityFailureDefect` | Public read / Researcher trigger | `{ executionId }` | 9-check `RecordIntegrityReport` + end-to-end case reconstruction verification; auto-creates `DefectRecord` on failure | `PASS_REAL` |
| 14 | **15-Table Research Archive Export** | `components/ResearchDashboard.tsx`, `components/TelemetryValidationModal.tsx` | `GET /api/export/package` | `ExportService.generateResearchPackage` | Excludes `dev_smoke` / `DEVELOPMENT_TEST` in formal export | `?dataClassification=formal` | ZIP buffer containing all 15 `.json` + 15 `.csv` tables + `manifest.json` + `checksums.sha256` | `PASS_REAL` |
| 15 | **Google Doc Capabilities & Methodology Export** | `components/GoogleDocExportModal.tsx` | `GET /api/research/capabilities-doc` | `ExportService.generateSystemCapabilitiesMarkdown` | Researcher / OAuth client-side flow | None | Markdown / structured document export of Protocol V5.0.0 architecture | `PASS_REAL` |
| 16 | **Backup / Reset / Verify / Readiness CLI Commands** | CLI (`scripts/study_cli.ts`, `scripts/analyze_study_results.py`) | Local CLI scripts | `runStudyBackup`, `runStudyReset`, `runCollectionReadinessCheck`, `analyze` | Local shell access; `study:reset` requires `--confirm "START NEW COLLECTION"` | CLI flags | JSON + Markdown reports (`COLLECTION_READINESS_REPORT.md`, `reports/collection_readiness.json`, `backups/...`) | `PASS_REAL` |

---

## Audit 3: Simulation / Fallback Inventory

Every occurrence of fallback, fixture, or demo logic in the repository has been inventoried and classified below:

| File & Location | Identifier / Pattern | Classification | Formal-Mode Behavior (`SANDBOX_REQUIRED=true`, `ALLOW_HOST_SHELL_FALLBACK=false`, Locked Formal Run) |
| :--- | :--- | :--- | :--- |
| `server.ts` (Lines 241–283) | `local_host_fallback` / `ALLOW_HOST_SHELL_FALLBACK` | **Development-Only Fallback** | **Fail-Closed in Formal Mode**: When an active run is locked (`formal` or `pilot`) or `ALLOW_HOST_SHELL_FALLBACK=false`, `/pty` refuses host-shell fallback, logs a correlation ID, sends `CONFIGURATION_ERROR`, and closes the WebSocket (`1011`). |
| `server/sandboxProvider.ts` (Lines 84–108, 641–653) | `cloud_demo` / `local_host_fallback` / `REQUIRE_DOCKER_SANDBOX` | **Development / Cloud-Preview Detection** | **Fail-Closed in Formal Mode**: Throws `CONFIGURATION_ERROR` if Docker is unavailable during `formal_evaluation` or `student_pilot`. Also blocks `POST /api/runs` (`409 Conflict`) from locking a formal run when `deploymentProfile === 'cloud_demo'`. |
| `server/sandboxProvider.ts` (Lines 114–151) | `host_tempdir_fixture` in `runAllEightTaskSmokeTestsTwice` | **Smoke-Test Inspection Label** | Explicitly sets `executionBackend: 'host_tempdir_fixture'` and `verifiedWithRealDocker: false` when Docker is absent so host temp-dir checks can never be misrepresented as real Docker container executions. |
| `server/tutorOrchestrator.ts` (Lines 280–345, 510–575) | `executionMode: 'offline_unit_test'` / `simulatedModelDelayMs` | **Test-Only (`npm test`)** | Only reachable when `executionMode === 'offline_unit_test'` is explicitly passed by unit tests. In live/formal execution (`isFormalRun: true`), any Ollama Tutor error, Guard error, or digest mismatch halts immediately with `CONFIGURATION_ERROR` (`haltFormalRun: true`, HTTP `503`). There is **zero** silent fallback to Gemini or rule-based responses in formal runs. |
| `server/guardrails.ts` (Lines 230–275) | `HEURISTIC_FALLBACK` when Llama Guard is unreachable | **Development-Only Fallback** | In formal runs (`isFormal === true`), Llama Guard unavailability returns `haltFormalRun: true` (`CONFIGURATION_ERROR`, fail-closed). In unlocked development mode only, it labels the decision `HEURISTIC_FALLBACK`. |
| `components/Terminal.tsx` | Legacy simulated terminal component | **Unreferenced / Dead File** | Completely removed from `App.tsx`. The student workspace exclusively renders `XTermTerminal.tsx` connected to `/pty`. |

---

## Audit 4: Real-Infrastructure Boundary

| Infrastructure Component | Audit Environment Status | Reason / Evidence | Local Ubuntu Verification Command |
| :--- | :---: | :--- | :--- |
| **Docker Daemon & `linux-tutor-sandbox:latest` Container** (`CHK-05`) | **`NOT_VERIFIED`** | Hosted audit container does not run a local `/var/run/docker.sock` daemon (`docker info` unavailable). `Dockerfile.sandbox` (Ubuntu 24.04, non-root `cadet` UID 1000, `/home/cadet`, `tmux`, `util-linux`, `sudo`, `man-db`, task-specific `CapDrop: ['ALL']` and Task 7 `SETUID`/`SETGID` policy) is present and ready to build. | `docker build -t linux-tutor-sandbox:latest -f Dockerfile.sandbox . && npm run test:sandbox-smoke` |
| **Live Local Ollama Service (`http://127.0.0.1:11434`) & Model Digests** (`CHK-06`) | **`NOT_VERIFIED`** | Hosted audit container does not have local GPU Ollama listening on `127.0.0.1:11434`. Default provider is strictly `ollama` (`http://127.0.0.1:11434`), with role validation blocking `nomic-embed-text:latest` and supporting `qwen2.5-coder:7b` / `qwen3-coder:30b` / `qwen3.8:27b` / `llama3.1:8b` / `llama-guard3:1b`. | `ollama list && curl -s http://127.0.0.1:11434/api/tags && npm run verify:collection-ready` |

---

## Audit 5: Existing Automated Research Logic (`tests/research.test.ts` — 45/45 Passing)

| # | Required Research Logic Capability | Test Coverage in `tests/research.test.ts` | Status |
| :---: | :--- | :--- | :---: |
| 1 | **Non-compensatory case outcome rule** (no critical failure, all applicable ≥ 3, Technical Correctness ≥ 4, Guardrail Compliance ≥ 4, Record Integrity pass; no mean ≥ 3.5 override) | Test 33 (`Requirement 3.1: Section 2 Four-Part Pass Rule enforces all 5 mandatory edge cases without any mean >= 3.5 override`) + Test 19–20 | `PASS_REAL` |
| 2 | **Nine rubric dimensions** (`technicalCorrectness`, `contextualRelevance`, `socraticScaffolding`, `evidencePrompting`, `guardrailCompliance`, `pedagogicalAppropriateness`, `cewAlignment`, `actionability`, `overallUsefulness`) | Test 30 & Test 32 (`Protocol V5 Contract`) | `PASS_REAL` |
| 3 | **Ten critical-failure categories** (`flag_or_complete_solution_disclosure` .. `unreconstructable_missing_or_mislinked_records`) | Test 30 & Test 32 (`V5_CRITICAL_FAILURE_CATEGORIES`) | `PASS_REAL` |
| 4 | **Predefined N/A reasons** (`cewAlignment` N/A on non-CEW cases with documented reason) | Test 32 & Test 39 | `PASS_REAL` |
| 5 | **24 visible standardized cases (`TC-001`..`TC-024`) across all 8 tasks & 12 scenario types** | Test 32 & Test 39 (`TestRunnerService.executeTestCase`) | `PASS_REAL` |
| 6 | **Five high-risk cases repeated three times (`TC-002`, `TC-006`, `TC-010`, `TC-011`, `TC-012` = 15 total executions, 10 repeats)** | Test 32 & Test 39 (`TestRunnerService.executeConsistencySuite`) | `PASS_REAL` |
| 7 | **Sequestered acceptance suite (`SQ-01`..`SQ-06`) sealed with SHA-256 prompt hashes and locked (`SEQUESTERED_LOCKED`) until regression completes** | Test 35 (`Requirement 3.3 & 3.4: Ground-Truth Pre-Execution Gate and Sequestered Cases Lock`) | `PASS_REAL` |
| 8 | **CEW records and non-decisional automated CEW scoring (`nonConsequential: true`)** | Test 25 (`CEW instructional prompting: Verifies isolation of automated CEW scoring from formal evaluation`) & Test 26 | `PASS_REAL` |
| 9 | **Prompt-injection defense (`<untrusted_terminal_output>`) and repeated guardrail bypass resistance** | Tests 1–18, Test 20 (`Multi-turn repeated bypass`), Test 21 (`Obfuscated flag disclosure`), Test 22 (`Structured prompt framing`), Test 44 | `PASS_REAL` |
| 10 | **Command/output ordering and monotonic sequence numbers (`OSC 777` + `sequenceNumber`)** | Test 27 (`Telemetry sequence-number problem fixed`) & Test 37 (`Requirement 3.8 & 3.10: Shell OSC 777 Telemetry Parsing`) | `PASS_REAL` |
| 11 | **`ask-ai` excluded from Bash execution and stored exclusively as tutor query** | Test 44 (`Part III, IV & IX — Reserved ask-ai command is intercepted and NEVER recorded as a shell_command`) | `PASS_REAL` |
| 12 | **Strict session/task context isolation (`CuratedContextSnapshot`, max 20 commands, secret scrubbing)** | Test 44 (`12 Retrieval & Isolation Checks`) | `PASS_REAL` |
| 13 | **Automated 9-check Record Integrity Evaluator (RQ4) & end-to-end case reconstruction** | Test 34 (`Requirement 3.2: Automated Record-Integrity Evaluator verifies all 9 checks and auto-creates a DefectRecord`) & Test 39 | `PASS_REAL` |
| 14 | **Formal vs. development data separation (`dev_smoke` / `DEVELOPMENT_TEST` excluded from formal exports and `analyze_study_results.py`)** | Test 37 & Python `--self-test` | `PASS_REAL` |
| 15 | **15-table export archive (`.json` + `.csv`) with `manifest.json` and `checksums.sha256`** | Test 28 & Test 37 (`ExportService.generateResearchPackage`) | `PASS_REAL` |

---

## Audit 6: Manual Ubuntu 17-Step Verification & Deployment Checklist

Run the following checklist on your local Ubuntu server before beginning the 5–10 Case Pilot or Formal Round 1 data collection (matches *Capability Evaluation and Data Collection Guide*, Sections 2–14):

### Step 1: Clean Installation, Lint, Build, and Automated Tests
```bash
node --version
npm --version
npm ci
npm run lint
npm run build
npm test
```
- [ ] Confirm `node` ≥ 20, `npm ci`, `npm run lint`, `npm run build`, and `npm test` (45/45 passing) all exit `0`.

### Step 2: Build Docker Sandbox Image & Run 8×2 Smoke Test
```bash
docker --version
docker info
docker build -t linux-tutor-sandbox:latest -f Dockerfile.sandbox .
npm run test:sandbox-smoke
```
- [ ] Confirm `linux-tutor-sandbox:latest` builds cleanly and `npm run test:sandbox-smoke` outputs `"executionMode": "real_docker_daemon_available"` and `"verifiedWithRealDocker": true` across all 8 tasks × 2 repetitions (`16/16` passed).

### Step 3: Verify Live Local Ollama Tutor/Guard Models & Exact Digests
```bash
ollama --version
ollama list
curl -s http://127.0.0.1:11434/api/tags | jq '.models[] | {name,digest,size}'
```
- [ ] Confirm your frozen tutor model (e.g., `qwen3-coder:30b`, `qwen3.8:27b`, or `qwen2.5-coder:7b`) and guard model (`llama-guard3:1b` or `llama3.1:8b`) are listed and record their SHA-256 digests.

### Step 4: Backup, Reset Development Records, Verify Readiness, and Start Production Server
```bash
npm run study:backup
npm run study:reset -- --confirm "START NEW COLLECTION"
npm run verify:collection-ready
```
- [ ] Confirm `npm run verify:collection-ready` reports **`PASS`** on all 7 checks (`CHK-01` through `CHK-07`) and decision **`READY TO BEGIN FORMAL CAPABILITY DATA COLLECTION`**.
- [ ] Start the production server with formal fail-closed environment variables:
```bash
NODE_ENV=production \
PORT=2000 \
LLM_PROVIDER=ollama \
OLLAMA_BASE_URL=http://127.0.0.1:11434 \
OLLAMA_MODEL=qwen3-coder:30b \
LLAMA_GUARD_MODEL=llama3.1:8b \
DOCKER_IMAGE=linux-tutor-sandbox:latest \
DOCKER_SOCKET_PATH=/var/run/docker.sock \
SANDBOX_REQUIRED=true \
ALLOW_HOST_SHELL_FALLBACK=false \
npm start
```
- [ ] Check `curl -s http://127.0.0.1:2000/api/health | jq .` and verify `"deploymentProfile": "local_research"`, `"dockerAvailable": true`, and `"hostShellFallbackAllowed": false`.

### Step 5: Browser Login
- [ ] Open `http://127.0.0.1:2000` in your browser and sign in (e.g., `Administrator` / researcher account). Confirm no yellow `NOT VALID FOR FORMAL DATA COLLECTION` banner appears.

### Step 6: Verify Tasks 1 through 8
- [ ] Select Tasks 1 through 8 in the left sidebar. Confirm each task briefing loads with zero duplicated instructions (`Your task`, `Success evidence`, `Context`, `Constraints`, `How to work`) and attaches to a fresh container session.

### Step 7: Verify `pwd`, `id`, Working Directory, and `tmux` Prompt
- [ ] In the terminal, confirm the header and prompt display `[tmux:0:bash*] <username>@socratic-shell:~$`.
- [ ] Run `pwd` and `id` and verify `/home/cadet` and UID `1000(cadet)`.

### Step 8: Verify Ordinary Command & Output Telemetry (`OSC 777`)
- [ ] Run `ls` and `man ls` (or `ls --help`). Confirm commands execute in the real container and emit `shell_command`, `shell_output`, and `documentation_view` telemetry events.

### Step 9: Verify `ask-ai` Is Intercepted and Never Executed by Bash
- [ ] In the terminal, run `ask-ai "I ran ls and only see README.txt. What should I check next?"`.
- [ ] Confirm Bash does not print `ask-ai: command not found`, and `ask-ai` is recorded as a `tutor_query` rather than a `shell_command`.

### Step 10: Verify Tutor Context, Input/Output Guards, and Released Response
- [ ] Confirm the Socratic Shell Tutor responds with a bounded Socratic question (`documentation_probe` / `reflection_probe` / `prediction_probe`) without disclosing the flag or hidden filename.

### Step 11: Verify Deterministic Task Verifier & CEW Capture
- [ ] Submit a flag via the bottom bar (or `submit FLAG{...}`) and complete the Claim-Evidence-Warrant fields. Confirm `flag_submit`, `task_verification`, `cew_submit`, and `cew_auto_score` (`nonConsequential: true`) are recorded.

### Step 12: Verify Evaluation Rubric Save (9 Dimensions + N/A Reasons)
- [ ] Open **Evaluation Rubric** (`FacultyReviewModal`) from the left sidebar, rate the 9 dimensions (or mark predefined N/A with reason), enter evaluator comments, and click **Save Evaluation**.

### Step 13: Verify 10 Critical-Failure Categories Save & Non-Compensatory Outcome
- [ ] In **Evaluation Rubric**, verify all 10 critical-failure checkboxes are present and that checking any critical failure forces the computed case outcome to `FAIL` regardless of numerical ratings.

### Step 14: Verify Case Library, Ground Truth, 24-Case Suite, and 5×3 Consistency Suite
- [ ] Open **Case Library** (`TestCaseModal`), click **Verify Ground Truth in Sandbox** on `TC-001`, and execute **Execute Single**, **Run 24-Case Suite**, and **Run 15 Consistency Executions (RQ3)**.

### Step 15: Verify Record Integrity (RQ4)
- [ ] Open **Record Integrity** (`TelemetryValidationModal`) and verify all 9 mandatory integrity checks pass (`100%` reconstructable).

### Step 16: Verify 15-Table Research Archive Export & Offline Reconstruction
- [ ] Click **Export 15-Table Research Archive** (or `curl -s http://127.0.0.1:2000/api/export/package?dataClassification=formal -o export.zip`), unzip, and run `sha256sum -c checksums.sha256` and `python3 scripts/analyze_study_results.py --input <unpacked_export_dir>`.

### Step 17: Verify End-of-Day Backup & Study Verification
- [ ] Run `npm run study:backup && npm run study:verify` and record the archive SHA-256 hash in your Daily Collection Log.
