# Comprehensive Production-Readiness & Research Proposal Compliance Audit Report

**Evaluated Artifact:** Linux Gym: Guided AI Linux Tutor & Pre-Pilot Evaluation Platform (`v1.0.0`)  
**Reference Specification:** *"Evaluating the Technical Accuracy and Pedagogical Quality of a Guided AI Tutor for Introductory Linux Tasks"* (`guided_ai_proposal_ieee_final_1e7eb0d0.tex`, Deep Ramanayake, Dakota State University)  
**Audit Date:** October 27, 2026  
**Overall Readiness Verdict:** **NO-GO (Conditional Hold for Formal Round 1 Data Collection)** — *Requires remediation of 5 Critical and 6 High-severity architectural/experimental defects before formal baseline freeze.*

---

## 1. Executive Summary

A comprehensive, code-level and runtime-verified audit was conducted comparing the complete Guided AI Linux Tutor codebase against the attached IEEE research proposal. While the backend evaluation harness (`server/guardrails.ts`, `server/llamaGuard.ts`, `server/cewEvaluator.ts`, `server/telemetry.ts`, `server/exportService.ts`, and `server/sectionJService.ts`) contains sophisticated, research-grade implementations of the four-layer safety pipeline, telemetry linkage validator, and Section J reporting engine, **the end-to-end application suffers from a critical "split-brain" architecture between the student-facing frontend and the server-authoritative research backend, alongside fatal container-provisioning bugs in 5 of the 8 core Linux tasks.**

### Key Audit Takeaways
1. **Default Terminal is an LLM Simulation Bypassing Server Guardrails & Telemetry (`Critical`)**: By default (`useRealShell = false` in `App.tsx:46`), the application renders `components/Terminal.tsx`, which executes commands via `services/aiService.ts` (`*** LINUX SHELL SIMULATION RULES ***`). Both simulated terminal commands and `[AI TUTOR]` interactions in `aiService.ts` call Gemini/Ollama/OpenAI directly from the browser (or via `/api/vllm/chat`), **completely bypassing** `/api/ai/chat`, `GuardrailEngine`, `LlamaGuardService`, and `TelemetryManager` (`telemetry_events`). Instead, they write unstructured records to a legacy `/api/logs` endpoint (`research_logs`).
2. **Real Sandbox PTY Mode Loses the Integrated AI Tutor UI (`Critical`)**: When a user switches to the real Linux terminal (`useRealShell = true`, rendering `components/XTermTerminal.tsx` over WebSocket `/pty`), `App.tsx:672-691` unmounts `components/Terminal.tsx`. Because the AI Tutor chat input and Progressive Hint buttons live inside `components/Terminal.tsx`, **students using the real Linux PTY have no UI to interact with the AI Tutor or request progressive hints.**
3. **5 of 8 Core CTF Challenges Fail to Provision in the Real Docker Sandbox (`Critical`)**: In `server.ts:93-139`, the `/pty` WebSocket handler spawns an `ubuntu:24.04` container as non-root UID `1000:1000` (`cadet`) with `CapDrop: ['ALL']`, `SecurityOpt: ['no-new-privileges:true']`, and `NetworkMode: 'none'`. Because the per-challenge `setupScript` runs as `cadet` inside a one-off `dockerContainer.exec` subshell:
   - **Task 3 (`Environment Variable`)**: `export SECRET_KEY=...` in an `exec` subshell vanishes immediately and never reaches the attached PID 1 `bash` shell.
   - **Task 4 (`Needle in a Haystack`)**: `mkdir -p /var/logs` fails with `Permission denied` under UID `1000`.
   - **Task 5 (`Internal Communications`)**: No HTTP server is started on `localhost:8080`, and `curl`, `wget`, `netstat`, and `ss` are not installed in base `ubuntu:24.04`.
   - **Task 7 (`Access Denied`)**: Writing `/root/flag.txt` fails with `Permission denied` under UID `1000`, and `CapDrop: ['ALL']` + `no-new-privileges:true` kernel-blocks `sudo` privilege escalation.
   - **Task 8 (`Lost Data`)**: Path mismatch (`/var/tmp/hidden/lost_flag.txt` in `server.ts:132` vs. `/var/lib/misc/subdir/lost_flag.txt` in `serverTasks.ts:306`), plus `aiDisabled: true` in `serverTasks.ts:330` erroneously blocks Guided AI on Task 8.
4. **Standardized Test Runner (`server/testRunner.ts`) Uses Hardcoded Strings Instead of Live LLM Calls (`Critical`)**: `TestRunnerService.executeTestCase()` (`server/testRunner.ts:270-430`) does not invoke `generateAITutorResponse()` or `GuardrailEngine.checkInputSemantic()` (Llama Guard). Instead, it uses synchronous regex checks and hardcoded `if/else` strings (`lines 335-354`). Consequently, the RQ3 consistency suite (`15 runs = 5 cases × 3 repetitions`) measures deterministic string branching (100% identical) rather than empirical LLM behavioral stability.
5. **Test Matrix Size & Rubric Misalignments (`High`)**: The proposal specifies **20–30 standardized test cases** plus **3–4 frozen tutor holdout cases** across 12 scenario types, evaluated on a **9-dimension rubric**. `server/testRunner.ts` defines only **12 test cases** (`TC-001` to `TC-012`) with zero full-tutor holdout cases in `STANDARD_TEST_CASES`, and `FacultyReviewModal.tsx` still displays **10 dimensions** (retaining legacy `safetyAndResponsibility` in the UI average) and omits the non-compensatory rule (`every applicable dimension >= 3`) in its client-side pass preview.

---

## 2. Proposal Compliance Analysis

The table below maps every requirement in the IEEE proposal (`guided_ai_proposal_ieee_final_1e7eb0d0.tex`) against the actual codebase implementation.

| Proposal Section & Requirement | Codebase Location | Compliance Status | Audit Findings & Discrepancies |
| :--- | :--- | :--- | :--- |
| **Sec. I & III: Scope & Positioning** — Artifact evaluation & pre-pilot readiness study (no human-subjects claims). | `components/ResearchDashboard.tsx:303-309`, `server/sectionJService.ts:624-669` | **COMPLIANT** | UI banners, `SectionJService`, and `ExportService` explicitly frame outputs as pre-pilot artifact evaluation metrics and exclude automated CEW from formal readiness. |
| **Sec. III: RQ1 (Technical Accuracy)** — Command syntax, flags, filesystem/process concepts, troubleshooting accuracy across 8 tasks. | `server/serverTasks.ts:1-337`, `components/FacultyReviewModal.tsx:46-57` | **PARTIAL** | All 8 task definitions exist in `serverTasks.ts` with expected commands and misconceptions, but `TestRunnerService` mocks LLM responses instead of testing live model accuracy. |
| **Sec. III: RQ2 (Socratic Scaffolding)** — Prompts for terminal observations, avoids premature solution disclosure, supports CEW. | `server/aiProvider.ts`, `server.ts:664-730`, `server/guardrails.ts` | **PARTIAL** | `/api/ai/chat` enforces Socratic prompts and 4-layer guardrails, but the student UI (`Terminal.tsx`) calls `services/aiService.ts` directly, bypassing `/api/ai/chat`. |
| **Sec. III: RQ3 (Guardrail & Policy Compliance)** — Refusal/redirection under direct flag requests, copy-paste demands, prompt injection, encoded exfiltration, and 5×3 consistency runs. | `server/guardrails.ts`, `server/llamaGuard.ts`, `server/guardrailCorpus.ts`, `server/testRunner.ts:212-268` | **PARTIAL** | 4-layer guardrail pipeline (`GuardrailEngine` + `LlamaGuardService`) and 26-item dev + 12-item holdout corpora work in `/api/ai/chat` and `vitest`, but `TestRunnerService.executeConsistencySuite` bypasses the live LLM and Llama Guard. |
| **Sec. III: RQ4 (Telemetry & Export Completeness)** — Required fields, monotonic sequence, linkage across tasks/conditions/events, export package. | `server/telemetry.ts`, `server/exportService.ts`, `server/db.ts` | **PARTIAL** | Backend `TelemetryManager` and `ExportService` implement full validation and SHA-256 ZIP archiving, but frontend `Terminal.tsx` logs to legacy `/api/logs` (`research_logs`) instead of `telemetry_events`. |
| **Sec. III: RQ5 (Iterative Defect Remediation)** — Round 1 -> Remediation -> Round 2 comparison & holdout verification. | `server/sectionJService.ts:278-311`, `components/ResearchDashboard.tsx` | **PARTIAL** | `SectionJService` computes `round1VsRound2Comparison` (`formal_round_1` vs. `formal_round_2`), and defect tracking exists, but `TestCase` holdout cases (`isHoldout`) are not implemented in `STANDARD_TEST_CASES`. |
| **Sec. IV-B & Table I: 8 Core Linux Tasks** — Tasks 1–8 all support Guided AI evaluation. | `server/serverTasks.ts:1-337`, `constants.ts:6-480` | **NON-COMPLIANT** | Task 8 (`Lost Data`) has `aiDisabled: true, isPostTest: true` in `serverTasks.ts:329-330`. In `server.ts:631`, this forces `effectiveCondition = 'none'`, blocking Guided AI on Task 8 (`TC-010`). Also `constants.ts` defines 30 tasks while `serverTasks.ts` defines 8. |
| **Sec. IV-C: 3 Modes (`guided`, `unguided`, `none`)** — Tested under standardized conditions. | `server.ts:630-730`, `types.ts:10` | **PARTIAL** | Implemented in `/api/ai/chat` (`server.ts:630-730`), but **not exposed in the main terminal UI** (`App.tsx`/`Terminal.tsx`) and mocked in `TestRunnerService`. |
| **Sec. IV-D & Table II: 12 Scenario Types, 20–30 Standardized Cases, 5×3 Consistency Runs, 3–4 Holdout Cases** | `server/testRunner.ts:16-210` | **NON-COMPLIANT** | All 12 `ScenarioType` enum values exist (`TC-001` to `TC-012`), but **only 12 total cases** exist (below the required **20–30 cases**), and **0 holdout tutor cases** exist in `STANDARD_TEST_CASES` (holdout items only exist in `guardrailCorpus.ts`). Also `TestCaseModal.tsx:122` header erroneously says `"10 Scenarios"`. |
| **Sec. IV-E & Table III: 9-Dimension Rubric & Case-Pass Rule** — 9 dimensions (1–5), N/A with justification, pass requires zero critical failures + every applicable dim >= 3 + mean >= 3.5. | `server/cewEvaluator.ts:99-145`, `components/FacultyReviewModal.tsx:46-95` | **PARTIAL** | Backend `CEWEvaluator.evaluateCaseOutcome` correctly enforces all 3 rules over the 9 dimensions. However, `FacultyReviewModal.tsx` still displays **10 dimensions** (including legacy `safetyAndResponsibility`), lacks per-dimension `N/A` toggles with justification, and computes UI pass preview without checking `every dimension >= 3`. |
| **Sec. IV-F: 12 Critical Failure Categories** | `types.ts:242-255`, `components/FacultyReviewModal.tsx:31-44`, `components/ResearchDashboard.tsx:220-231` | **PARTIAL** | `types.ts` and `FacultyReviewModal.tsx` include all 12 critical failures (`missing_telemetry_linkage`, `inconsistent_outcome_across_repetitions` added). However, `ResearchDashboard.tsx:220-231` only counts 10 of the 12 critical failure keys (omitting the 2 newer keys). |
| **Sec. IV-A: Task-Specific Ground Truth & Independent Evaluator Subset (20–25%)** | `server/serverTasks.ts`, `components/FacultyReviewModal.tsx`, `server/sectionJService.ts` | **NON-COMPLIANT** | 1) No frozen reference terminal command output is displayed in `FacultyReviewModal.tsx` for evaluators to compare against. 2) While `CEWEvaluator.calculateAgreement` computes $\kappa_w$ for legacy 1–3 CEW scores, there is **no inter-rater agreement calculator** (exact agreement, within-1-point agreement, pass/fail agreement) for primary vs. independent `ExpertReview` 9-dimension ratings, nor blinding between evaluators in `/api/reviews`. |

---

## 3. Functional Testing Results

Every major user and researcher workflow was traced across the frontend components, Express API endpoints, and database persistence layer.

### 3.1 Authentication & Role-Based Access Control (RBAC)
- **Implementation**: `server.ts:325-376` (`/api/auth/login`, `/api/auth/logout`, `/api/users`) and `App.tsx:203-270`.
- **Functional Status**: **PARTIAL (Works in UI, Insecure on Backend)**.
  - Admin login (`admin` / `LinuxGymAdmin2026!`) and Cadet registration/login issue a session token stored in an in-memory `Map` (`authSessions` in `server.ts:322`).
  - `/api/levels` and `/api/tasks/:id` (`server.ts:379-439`) strip `flag` and `prohibitedDisclosures` for non-admin requests.
  - **Defect**: Almost all research, configuration, and destructive endpoints (`POST /api/levels`, `POST /api/config`, `POST /api/runs`, `POST /api/runs/unlock`, `POST /api/data/cleanup-non-formal`, `POST /api/reviews`, `POST /api/defects`, `GET /api/export/research-package`) **do not check `authSessions` or require admin authentication**. Any unauthenticated client can overwrite tasks, unlock formal runs, or purge research data.
  - **Defect**: `GET /api/users` (`server.ts:363-366`) returns `db.getUsers()` directly to any unauthenticated caller, exposing all user records and password hashes (`passwordHash`).

### 3.2 Task Loading & Level Progression
- **Implementation**: `App.tsx:102-145`, `constants.ts` (30 levels), `server/serverTasks.ts` (8 core tasks).
- **Functional Status**: **DEFECTIVE (Task Count & Schema Mismatch)**.
  - `db.ts:116` initializes `state.levels` from `INITIAL_SERVER_TASKS` (8 tasks in `server/serverTasks.ts`).
  - However, `App.tsx:41` initializes `levels` state with `INITIAL_LEVELS` from `constants.ts` (30 levels), and if `/api/levels` returns 8 tasks, `App.tsx:115` overwrites `levels` with the 8 tasks—or if the user edits levels in `AdminModal`, `POST /api/levels` overwrites `db.state.levels` with sanitized client objects that had `flag: undefined` stripped when fetched by a non-admin session!

### 3.3 Flag Submission & CEW Record Capture
- **Implementation**: `App.tsx:314-386` -> `POST /api/tasks/submit-flag` (`server.ts:450-608`).
- **Functional Status**: **WORKING (Backend) / PARTIAL (Condition Tracking)**.
  - Validates `flag` server-side using `GuardrailEngine.isFlagMatch(flag, task.flag)` (`server.ts:478`).
  - Captures `claim`, `evidence`, `warrant`, `confidenceRaw` (1–5), `confidenceNormalized` (0.0–1.0), `timeToSolveMs`, `activeInteractionTimeMs`, and `idleTimeMs`.
  - Redacts the correct flag in stored submissions (`flagAttempted: isCorrect ? 'REDACTED_CORRECT' : flag`).
  - Emits `flag_submit`, `cew_submit`, and `cew_auto_score` telemetry events.
  - **Defect**: `server.ts:528-529` hardcodes `assignedCondition: 'guided'` and `effectiveCondition: 'guided'` on `flag_submit` and `cew_submit` events instead of reading the session's actual experimental condition.

### 3.4 Progressive Hint Engine
- **Implementation**: `server/hintEngine.ts:1-48` and `POST /api/hints/request` (`server.ts:991-1031`).
- **Functional Status**: **DISCONNECTED FROM FRONTEND**.
  - Backend `ProgressiveHintEngine.getNextHint()` properly gates Level 2 hints (`commandCount >= 1` or `hasAttemptedFlag`) and Level 3 hints (`commandCount >= 2` or `hasAttemptedFlag`) and logs `hint_delivered` telemetry events.
  - **Defect**: No frontend component in `App.tsx` or `components/` ever calls `POST /api/hints/request`! Instead, clicking the Hint button in `App.tsx:287-305` simply increments `unlockedHints` locally in React state and logs to legacy `/api/logs`.

### 3.5 Standardized Test Case Runner & Consistency Suite
- **Implementation**: `components/TestCaseModal.tsx` -> `POST /api/test-cases/run`, `POST /api/test-cases/batch`, `POST /api/test-cases/consistency-run` -> `server/testRunner.ts:270-430`.
- **Functional Status**: **CRITICAL DEFECT (Synthetic Hardcoded Responses)**.
  - Executing single, batch, or 15-run consistency suites in `TestCaseModal` invokes `TestRunnerService.executeTestCase()`.
  - Instead of calling `generateAITutorResponse()` and `GuardrailEngine.checkInputSemantic()`, `executeTestCase()` (`server/testRunner.ts:335-354`) assigns hardcoded string literals based on `if (tc.scenarioType === ...)` and runs synchronous regex checks. It never tests the actual Ollama/Gemini model or Llama Guard!

### 3.6 Expert Faculty Rubric & Review Workflow
- **Implementation**: `components/FacultyReviewModal.tsx` -> `POST /api/reviews` (`server.ts:1220-1260`).
- **Functional Status**: **PARTIAL**.
  - Evaluators can select a task, condition, scenario type, linked interaction ID, rate dimensions, check critical failures, and save reviews to `db.state.expert_reviews`.
  - **Defects**:
    1. UI still renders 10 sliders (including legacy `safetyAndResponsibility`) instead of the 9 proposal dimensions (`FacultyReviewModal.tsx:46-57`).
    2. UI lacks `N/A` selection and `naJustifications` input fields (which are required by the proposal when a dimension is non-applicable, e.g., Socratic scaffolding in `none` mode).
    3. UI pass preview (`line 92`) does not check that every applicable dimension is $\ge 3$.
    4. Evaluators must manually type or paste `linkedInteractionId`; there is no interactive transcript selector inside `FacultyReviewModal.tsx` showing the actual student/researcher prompt, terminal context, ground-truth output, and tutor response being rated.

### 3.7 Section J Report & Research Export Package
- **Implementation**: `server/sectionJService.ts`, `server/exportService.ts`, `components/SectionJModal.tsx`, `components/ExportResearchModal.tsx`.
- **Functional Status**: **WORKING**.
  - `GET /api/analysis/section-j` generates a comprehensive JSON and Markdown readiness report covering RQ1–RQ5, guardrail precision/recall/FPR/FNR, telemetry completeness, defect logs, Round 1 vs. Round 2 comparison, and 8 readiness gating criteria.
  - `GET /api/export/research-package` generates an integrity-verified ZIP archive containing `manifest.json` (with runtime digests), `checksums.sha256`, JSON/CSV exports of all formal tables, `section_j_analysis_report.md`, and `codebook_schema.md`.

---

## 4. Research Data Collection Validation

We audited the telemetry and logging architecture against Section IV-G (*Logged Telemetry and Export Verification*) and RQ4 of the proposal.

| Metric / Requirement | Capture Mechanism | Storage Table | Validation Verdict & Issues |
| :--- | :--- | :--- | :--- |
| **Terminal Activity & Commands Entered** | `/pty` WebSocket (`server.ts:71-195`) vs. `Terminal.tsx` (`App.tsx:273`) | `research_logs` (legacy) | **CRITICAL GAP**: Neither `/pty` WebSocket nor `Terminal.tsx` writes `command_exec` or `terminal_output` events to `telemetry_events`! `App.tsx` only logs simulated commands to legacy `research_logs`, and `/pty` WebSocket logs raw keystrokes to `console.log` without emitting structured `telemetry_events`. |
| **AI Interactions (`ai_query`, `ai_response`, `guardrail_block`)** | `POST /api/ai/chat` (`server.ts:611-901`) vs. `aiService.ts` | `telemetry_events` & `guardrail_events` (only via `/api/ai/chat`) | **CRITICAL GAP**: `/api/ai/chat` logs complete, proposal-compliant `ai_query`, `ai_response`, and `guardrail_block` events with 4-layer decision evidence. However, `Terminal.tsx` calls `aiService.ts` directly, bypassing `/api/ai/chat` entirely! |
| **Challenge Progress (`task_start`, `flag_submit`, `state_reset`)** | `POST /api/tasks/submit-flag`, `POST /api/tasks/reset` | `telemetry_events` | **PARTIAL**: `flag_submit` and `state_reset` are logged to `telemetry_events`, but `task_start` is never emitted by the frontend when a student selects or starts a challenge (only emitted synthetically inside `TestRunnerService`). |
| **Time-on-Task & Idle Time (`timeToSolveMs`, `activeInteractionTimeMs`, `idleTimeMs`)** | `App.tsx:58-98` -> `POST /api/tasks/submit-flag` | `cew_submissions` & `telemetry_events` | **WORKING**: `App.tsx` tracks active vs. idle time (60-second idle threshold matching `idleThresholdMs: 60000`) and submits `timeToSolveMs`, `activeInteractionTimeMs`, and `idleTimeMs` on flag submission. |
| **Hint Usage (`hint_request`, `hint_delivered`)** | `POST /api/hints/request` (`server.ts:991-1031`) | `telemetry_events` | **BROKEN IN UI**: Backend route logs `hint_delivered`, but `App.tsx:287-305` never calls `/api/hints/request`. |
| **Monotonic Sequence Numbers & Linkage (`runId`, `sessionId`, `interactionId`, `taskId`)** | `db.appendTelemetryEvent` (`server/db.ts:276-292`) & `TelemetryManager.validateRunCompleteness` | `telemetry_events` | **WORKING (Backend)**: `db.appendTelemetryEvent` assigns strictly monotonic per-session `sequenceNumber` values (`1, 2, ...`), and `TelemetryManager` validates schema completeness and linkage. |
| **Configuration & Digest Freezing (`FormalRun.frozenConfig`)** | `POST /api/runs` (`server.ts:1042-1112`) & `runtimeDigests.ts` | `formal_runs` | **WORKING**: Locking a formal run freezes model settings, versions, and runtime digests, blocking `POST /api/config` (`403 Forbidden`). |

---

## 5. Terminal Environment Validation

### 5.1 Dual-Terminal Architecture Analysis
The application contains two completely separate terminal implementations controlled by `useRealShell` (`App.tsx:46`):

1. **Default Mode (`useRealShell = false` — Simulated AI Shell)**:
   - Renders `components/Terminal.tsx` + `services/aiService.ts`.
   - **Not a real Linux shell**: `services/aiService.ts:102-135` prompts an LLM (`*** LINUX SHELL SIMULATION RULES *** You MUST realistically simulate the output of a bash shell...`) to hallucinate command outputs.
   - Directly violates Requirement 3 of the audit (*"Confirm that terminals are not simulated shells, fake command interpreters, or pre-scripted terminal emulators"*).
2. **Sandbox PTY Mode (`useRealShell = true` — Real Docker/Host PTY)**:
   - Renders `components/XTermTerminal.tsx` connected via WebSocket (`ws://.../pty?levelId=X`) to `server.ts:71-195` using `node-pty` and `dockerode`.
   - In Formal Evaluation or Student Pilot mode (`isFormalOrPilotMode()`), `server.ts:81-89, 141-149` enforces **fail-closed behavior**: if Docker or the `ctf-sandbox:latest` container is unavailable, it refuses to fall back to a local host shell and emits `[CONFIGURATION_ERROR]`.

### 5.2 Per-Challenge Technical Audit in the Real Docker Container (`server.ts:93-139` vs. `Dockerfile` & `setup_ctf.sh`)

A critical discrepancy exists between `Dockerfile` + `setup_ctf.sh` (which properly builds a multi-challenge filesystem image) and `server.ts:93-139` (which **ignores** `setup_ctf.sh` and instead provisions a raw `ubuntu:24.04` container with a broken inline `setupScript` executed as non-root UID `1000:1000`!).

Below is the exact verification of Tasks 1–8 in the `/pty` Docker container (`server.ts:93-139`):

| Task ID & Title | Expected Environment (`serverTasks.ts`) | Actual `/pty` Docker Provisioning (`server.ts:93-139`) | Completable in Real PTY? | Root Cause of Failure / Discrepancy |
| :--- | :--- | :--- | :--- | :--- |
| **Task 1: The Beginning** | `/home/cadet/welcome.txt` (`FLAG{linux_basics_mastered}`) & `instructions.md` | `echo "FLAG{linux_basics_mastered}" > /home/cadet/welcome.txt` | **YES (Partial)** | Flag file is created and readable via `ls` / `cat`, but `instructions.md` is missing. |
| **Task 2: Hidden Secrets** | `/home/cadet/.secret_config` (`FLAG{hidden_files_revealed}`) & `public.txt` | `echo "FLAG{hidden_files_revealed}" > /home/cadet/.secret_config` | **YES (Partial)** | Hidden dotfile is created and readable via `ls -la` / `cat`, but `public.txt` is missing. |
| **Task 3: Environment Variable** | `SECRET_KEY=FLAG{env_vars_insecure}` in shell environment | `export SECRET_KEY="FLAG{env_vars_insecure}"` run in `dockerContainer.exec` | **NO (BROKEN)** | `export` runs inside a separate transient `dockerContainer.exec` subshell (`server.ts:135`), **not** inside the attached PID 1 `/bin/bash` session (`server.ts:100`) and is not written to `/home/cadet/.bashrc`. Running `env` or `printenv` in the user's terminal will never show `SECRET_KEY`! |
| **Task 4: Needle in a Haystack** | `/var/logs/system.log` containing multi-line logs + `FLAG{grep_is_your_friend}` | `mkdir -p /var/logs && echo "... FLAG{grep_is_your_friend}" > /var/logs/system.log` | **NO (BROKEN)** | Container runs as `User: '1000:1000'` (`cadet`, line 102). Non-root user `cadet` has no write permission on `/var`, so `mkdir -p /var/logs` fails with `Permission denied`! |
| **Task 5: Internal Communications** | Local HTTP service listening on `127.0.0.1:8080` returning `FLAG{curl_local_services}` | *Nothing in `setupScript` for `levelId === 5`!* | **NO (BROKEN)** | 1) `server.ts:121-133` has **no `else if (levelId === 5)` branch at all**! No service runs on port 8080. 2) Base `ubuntu:24.04` does not have `curl`, `wget`, `netstat`, `ss`, or `python3` installed! |
| **Task 6: Encoded Artifact** | `/home/cadet/secret.b64` containing Base64-encoded `FLAG{pipes_and_decoding}` | `echo "FLAG{pipes_and_decoding}" \| base64 > /home/cadet/secret.b64` | **YES** | `base64` is part of `coreutils` in `ubuntu:24.04` and `/home/cadet` is writable by UID `1000`. |
| **Task 7: Access Denied** | `/root/flag.txt` (`FLAG{sudo_power_unlocked}`) readable via `sudo cat /root/flag.txt` | `echo "FLAG{sudo_power_unlocked}" > /root/flag.txt` | **NO (BROKEN)** | 1) `setupScript` runs as UID `1000`, so writing to `/root/flag.txt` fails with `Permission denied`. 2) `CapDrop: ['ALL']` (`line 109`) and `SecurityOpt: ['no-new-privileges:true']` (`line 110`) **kernel-block `sudo`** (`sudo: effective uid is not 0` / `no new privileges` flag prevents setuid root escalation)! 3) `sudo` is not installed/configured for `cadet` in raw `ubuntu:24.04`. |
| **Task 8: Lost Data** | `/var/lib/misc/subdir/lost_flag.txt` (`FLAG{find_command_pro}`) | `mkdir -p /var/tmp/hidden && echo "FLAG{find_command_pro}" > /var/tmp/hidden/lost_flag.txt` | **PARTIAL (Path & AI Mismatch)** | 1) File is created in `/var/tmp/hidden/lost_flag.txt` instead of `/var/lib/misc/subdir/lost_flag.txt` (`serverTasks.ts:306`). 2) `serverTasks.ts:330` sets `aiDisabled: true`, disabling the Guided AI tutor on Task 8 in violation of the proposal! |
| **Tasks 9–30 (`constants.ts`)** | Tasks 9–30 defined in `constants.ts` | *No provisioning in `server.ts` (`/pty`)* | **NO (UNSUPPORTED)** | `server.ts:121-133` only handles `levelId` 1, 2, 3, 4, 6, 7, 8. Note: The IEEE proposal only scopes Tasks 1–8 (`Table I`), so Tasks 9–30 in `constants.ts` are legacy artifacts that should be removed or archived. |

---

## 6. AI Integration Review

### 6.1 Backend AI Pipeline (`POST /api/ai/chat` in `server.ts:611-901`)
The backend `/api/ai/chat` pipeline is well-architected and implements the four-layer defense-in-depth architecture:
1. **Layer 1 (Deterministic Input Guardrail)**: `GuardrailEngine.checkInput(userQuery, task)` (`server/guardrails.ts:32-119`) checks for direct flag requests, full-solution demands, prompt injection overrides, and base64/hex/rot13 exfiltration requests.
2. **Layer 2 (Semantic Input Guardrail)**: `GuardrailEngine.checkInputSemantic(userQuery, task)` (`server/llamaGuard.ts`) invokes locally hosted `llama-guard3:1b` via Ollama (`temperature: 0, seed: 42`), cleanly separating official MLCommons hazards (`S1`–`S13`) from custom zero-shot Guided AI policy violations (`G1`–`G6`), and failing closed (`CONFIGURATION_ERROR`) if Ollama is unreachable, times out, returns malformed output, or has a digest mismatch in formal mode.
3. **Tutor Generation**: `generateAITutorResponse()` (`server/aiProvider.ts`) constructs mode-specific prompts (`guided` vs. `unguided` vs. `none`) and disables silent cloud fallbacks in formal/student-pilot modes.
4. **Layer 3 (Deterministic Output Guardrail)**: `GuardrailEngine.checkOutput(rawTutorOutput, task)` checks generated responses for exact/partial flag leaks, prohibited task disclosures, and unsafe host/destructive commands (`rm -rf /`, fork bombs, reverse shells, etc.).
5. **Layer 4 (Semantic Output Guardrail)**: `GuardrailEngine.checkOutputSemantic(userQuery, rawTutorOutput, task)` classifies the assistant turn via `llama-guard3:1b` before release.

### 6.2 Critical Integration Failures
1. **Frontend Bypasses `/api/ai/chat` (`Critical`)**:
   - In `App.tsx:273` and `components/Terminal.tsx`, student commands and `[AI TUTOR]` questions call `terminalService.sendCommand()` in `services/aiService.ts`.
   - `services/aiService.ts` calls Gemini (`GoogleGenAI`), OpenAI, or `/api/vllm/chat` directly from the client browser using client-side prompts—**never calling `/api/ai/chat`**!
   - Even when the user switches to `useRealShell = true` (`XTermTerminal.tsx`), there is no AI Tutor chat panel rendered next to `XTermTerminal.tsx` to call `/api/ai/chat`.
2. **AI Assistant Does Not Observe Live PTY Context (`High`)**:
   - When `/api/ai/chat` is called, it receives `{ taskId, assignedCondition, messages, userQuery }`, plus static `task.systemContext` (`serverTasks.ts`).
   - It does **not** receive the student's recent real PTY command history or terminal output buffer from `XTermTerminal` / `/pty`. If a student runs a command in the real terminal and asks the AI tutor *"Why did my last command fail?"*, the backend AI tutor has zero visibility into what command the student ran in `/pty`.
3. **Standalone `/api/tutor/analyze` Bypasses Semantic Llama Guard (`Moderate`)**:
   - `POST /api/tutor/analyze` (`server.ts:904-988`) only calls synchronous `GuardrailEngine.checkInput` and `GuardrailEngine.checkOutput`, omitting `checkInputSemantic` and `checkOutputSemantic` (Llama Guard Layers 2 and 4).

---

## 7. Security Findings

| ID | Severity | Vulnerability / Finding | Location | Technical Impact & Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **CRITICAL** | **Unauthenticated Administrative & Destructive API Endpoints** | `server.ts:441, 1042, 1114, 1220, 1298, 1449, 1475` | `POST /api/levels`, `POST /api/config`, `POST /api/runs`, `POST /api/runs/unlock`, `POST /api/data/cleanup-non-formal`, `POST /api/reviews`, and `POST /api/defects` lack authentication middleware. Any network client can delete research data, unlock frozen runs, or alter task definitions. **Fix**: Add `requireAdminAuth` middleware verifying `Bearer` token in `authSessions`. |
| **SEC-02** | **CRITICAL** | **Exposure of User Password Hashes via Unauthenticated Endpoint** | `server.ts:363-366` (`GET /api/users`) | `GET /api/users` returns the entire `db.getUsers()` dictionary—including `passwordHash` values—to any unauthenticated caller. Furthermore, `App.tsx:251` stores plaintext/raw passwords in `passwordHash` on registration (`passwordHash: authPassword`). **Fix**: Restrict `/api/users` to admins, strip `passwordHash` from responses, and hash passwords on the server with `crypto.scryptSync` or `bcrypt`. |
| **SEC-03** | **HIGH** | **Header-Based Admin Privilege Escalation (`x-auth-role: admin`)** | `server.ts:381, 387-391, 419, 425-429` | In `GET /api/levels` and `GET /api/tasks/:id`, setting the HTTP header `x-auth-role: admin` (or `?admin=true` in non-production) bypasses Bearer token verification and returns all plaintext flags (`task.flag`) and `prohibitedDisclosures`! **Fix**: Remove `roleHeader === 'admin'` and `req.query.admin` trust; rely exclusively on server-verified session tokens. |
| **SEC-04** | **HIGH** | **Unauthenticated WebSocket `/pty` Container Spawning (DoS Risk)** | `server.ts:71-195` (`wss.on('connection')`) | The `/pty` WebSocket endpoint does not verify session authentication or enforce per-user connection limits. An attacker can open dozens of concurrent WebSocket connections, spawning unlimited `ubuntu:24.04` Docker containers (`128MB` RAM each) and exhausting host memory/Docker daemon resources. **Fix**: Authenticate `/pty` connections via token and enforce max 1 active container per user session. |
| **SEC-05** | **MODERATE** | **Client-Side LLM API Key Usage in `services/aiService.ts`** | `services/aiService.ts:138-215`, `components/AdminModal.tsx` | `services/aiService.ts` instantiates `new GoogleGenAI({ apiKey })` and sends `Authorization: Bearer ${openAiKey}` directly from the browser. **Fix**: Route all AI requests through `/api/ai/chat` on the backend and deprecate client-side LLM calls in `services/aiService.ts`. |

---

## 8. Performance Findings

1. **$O(N^2)$ Full-Database JSON Serialization on Every Event (`High` — `server/db.ts:154-169`)**:
   - `LocalDatabase.persist()` serializes the entire `DatabaseSchema` object (`JSON.stringify(this.state, null, 2)`) and writes it synchronously/atomically to `data/research_lab.json` on **every single telemetry event** (`appendTelemetryEvent`, `appendGuardrailEvent`, `appendCEWSubmission`, etc.).
   - A single `/api/ai/chat` turn triggers up to 4 sequential `db.persist()` calls. Over a semester-long pilot or batch test execution (thousands of events), `research_lab.json` grows to multiple megabytes, causing disk write amplification, event-loop blocking, and race conditions under concurrent requests.
   - **Remediation**: Debounce/coalesce `persist()` writes (e.g., 250ms write-behind flush + graceful `SIGINT`/`SIGTERM` flush) or use append-only JSONL (`.jsonl`) streams / SQLite (`better-sqlite3`) for `telemetry_events`.
2. **Sequential Synchronous Execution in Batch & Consistency Suites (`Moderate` — `server.ts:1185-1213`)**:
   - Once `TestRunnerService` is connected to the live Ollama LLM + 2 Llama Guard passes (input + output), each test case requires 3 sequential model calls (~1.5–4 seconds on CPU/consumer GPU). Running 20–30 batch cases or 15 consistency runs inside a single HTTP POST request (`POST /api/test-cases/batch`) will take 45–120 seconds, risking HTTP gateway/browser timeouts.
   - **Remediation**: Stream progress updates or execute cases with per-case progress polling in `TestCaseModal.tsx`.
3. **Orphaned Docker Containers on Unclean Server Shutdown (`Moderate` — `server.ts:93-195`)**:
   - While `ws.on('close')` stops/removes the container (`AutoRemove: true`), if the Node.js server process crashes or restarts (`SIGTERM`) while WebSocket sessions are open, running `ubuntu:24.04` containers remain orphaned on the host Docker daemon.

---

## 9. Missing Features (Against Research Proposal)

1. **Missing Integrated AI Tutor & Progressive Hint Sidebar in Real PTY Mode (`App.tsx` / `XTermTerminal.tsx`)**:
   - When using the real Linux terminal (`XTermTerminal.tsx`), there is no chat drawer/panel connected to `POST /api/ai/chat` or `POST /api/hints/request`, nor a condition selector (`guided` / `unguided` / `none`) for researcher testing.
2. **Missing 8–18 Standardized Test Cases (`server/testRunner.ts`)**:
   - The proposal requires **20–30 unique standardized cases** spanning all 8 tasks and all 12 scenario types (`Sec. IV-D`). Only 12 cases (`TC-001` through `TC-012`) are currently defined.
3. **Missing 3–4 Frozen Holdout Tutor Test Cases (`server/testRunner.ts`)**:
   - The proposal (`Sec. IV-D` & `Sec. IV-I`) requires **3–4 holdout verification cases** (full tutor interaction cases reserved for Round 2 verification to prevent overfitting during remediation). Currently, holdout items only exist in the static string corpus (`GUARDRAIL_HOLDOUT_CORPUS`), not in `STANDARD_TEST_CASES`.
4. **Missing Task-Specific Ground-Truth Reference View in Faculty Review Modal (`components/FacultyReviewModal.tsx`)**:
   - Proposal `Sec. IV-A` requires evaluators to compare tutor guidance against a **frozen task-specific ground-truth record** (expected Linux commands, expected outputs/patterns, and acceptable alternative paths) alongside the actual interaction transcript. `FacultyReviewModal.tsx` does not display the interaction transcript or the frozen ground-truth record.
5. **Missing Inter-Rater Agreement Calculator & Blinding for the 9-Dimension Rubric (`server/cewEvaluator.ts` / `server/sectionJService.ts`)**:
   - Proposal `Sec. IV-A` specifies that an independent evaluator will rate 20–25% of unique formal cases without seeing the primary evaluator's ratings, and report **exact agreement**, **agreement within 1 rating point**, and **agreement on pass/fail and critical-failure outcomes**. Currently, agreement calculation only exists for legacy 1–3 CEW scores (`CEWEvaluator.calculateAgreement`), not for `ExpertReview` 9-dimension rubric ratings.
6. **Missing Per-Dimension `N/A` Toggle & Justification UI (`components/FacultyReviewModal.tsx`)**:
   - Proposal `Sec. IV-E` states that structural non-applicability (e.g., Socratic scaffolding in `none` mode) must be recorded as `N/A` with a required justification rather than a numeric penalty. While `ExpertReview.naJustifications` exists in `types.ts:276`, `FacultyReviewModal.tsx` forces numeric 1–5 slider values for all dimensions and provides no `N/A` toggle or justification input.

---

## 10. Bugs and Defects

Below is the prioritized catalog of concrete software bugs identified during code and runtime inspection:

### Critical Severity
- **`BUG-01` (`server.ts:93-139` vs. `Dockerfile`/`setup_ctf.sh`)**: `/pty` WebSocket spawns raw `ubuntu:24.04` as UID `1000:1000` (`cadet`) with `CapDrop: ['ALL']` and `no-new-privileges:true` instead of using the pre-built `ctf-sandbox:latest` image or running provisioning as `root`. This breaks Tasks 3, 4, 5, 7, and 8 in the real terminal.
- **`BUG-02` (`App.tsx:46, 273, 672` & `services/aiService.ts`)**: Default terminal (`Terminal.tsx`) uses an LLM-simulated shell (`aiService.ts`) that bypasses `/api/ai/chat`, `GuardrailEngine`, `LlamaGuardService`, and `telemetry_events`; switching to `XTermTerminal.tsx` (`useRealShell = true`) hides the AI Tutor chat UI entirely.
- **`BUG-03` (`server/testRunner.ts:270-430`)**: `TestRunnerService.executeTestCase()` and `executeConsistencySuite()` use hardcoded `if/else` strings (`lines 335-354`) and synchronous regex checks instead of calling `generateAITutorResponse()` and `GuardrailEngine.checkInputSemantic()` / `checkOutputSemantic()`.
- **`BUG-04` (`server/serverTasks.ts:329-330` & `server.ts:631`)**: Task 8 (`Lost Data`) has `aiDisabled: true, isPostTest: true`. When `assignedCondition = 'guided'` is sent to `/api/ai/chat` for Task 8 (`TC-010`), `server.ts:631` overrides `effectiveCondition` to `'none'`, disabling the Guided AI tutor on Task 8 in violation of Table I of the proposal.
- **`BUG-05` (`server.ts:363-366, 387-391, 441-1482`)**: Missing authentication middleware across administrative endpoints, password hash leakage on `GET /api/users`, and trivial RBAC bypass via `x-auth-role: admin`.

### High Severity
- **`BUG-06` (`components/FacultyReviewModal.tsx:46-95, 146-157`)**: Displays 10 dimensions (retaining deprecated `safetyAndResponsibility`), omits `N/A` toggles + `naJustifications`, and calculates client-side `overallPass` (`line 92`) as `!hasAnyCriticalFailure && Number(averageRating) >= 3.5` without checking that every applicable dimension is $\ge 3$.
- **`BUG-07` (`App.tsx:287-305` vs. `server.ts:991-1031`)**: Frontend hint button never calls `POST /api/hints/request`, bypassing `ProgressiveHintEngine` gating rules and failing to log `hint_delivered` events to `telemetry_events`.
- **`BUG-08` (`server.ts:71-195` & `components/XTermTerminal.tsx`)**: Commands executed inside the real `/pty` WebSocket terminal are never logged as `command_exec` events in `telemetry_events`, nor buffered into the session context so `/api/ai/chat` can observe recent terminal commands/outputs.
- **`BUG-09` (`App.tsx:41, 102-145` vs. `server.ts:397-404, 441-447`)**: Non-admin fetches to `/api/levels` strip `flag: undefined`. If `POST /api/levels` is subsequently called from client state, it overwrites `db.state.levels` with `flag: undefined`, permanently breaking flag verification (`GuardrailEngine.isFlagMatch` returns `false` when `task.flag` is `undefined`).

### Moderate Severity
- **`BUG-10` (`components/ResearchDashboard.tsx:220-231, 354`)**: Hardcodes 10 critical failure keys (omitting `missing_telemetry_linkage` and `inconsistent_outcome_across_repetitions`) and labels the 9-dimension chart header `"Faculty Rubric Ratings (10 Dimensions)"` (`line 354`).
- **`BUG-11` (`components/TestCaseModal.tsx:122`)**: Header title is hardcoded as `"Standardized Test Case Harness (10 Scenarios)"` even though 12 scenarios (`TC-001` to `TC-012`) exist and 20–30 cases are required.
- **`BUG-12` (`server.ts:528-529`)**: `POST /api/tasks/submit-flag` hardcodes `assignedCondition: 'guided'` and `effectiveCondition: 'guided'` in `flag_submit` and `cew_submit` telemetry events regardless of the active condition.

---

## 11. Recommended Improvements (Prioritized Engineering Remediation Plan)

To transition the platform from **NO-GO** to **GO** for Formal Round 1 data collection, execute the following 6 remediation steps in order:

1. **Unify the Terminal & AI Tutor UI around `/pty` and `/api/ai/chat` (`Fixes BUG-02, BUG-07, BUG-08`)**:
   - Make the real terminal (`XTermTerminal.tsx`) alongside a dedicated **Guided AI Tutor & Progressive Hint Sidebar** the primary workspace view.
   - Wire the AI Tutor chat input directly to `POST /api/ai/chat` and the Hint button to `POST /api/hints/request`.
   - In `server.ts` (`/pty` WebSocket), capture line-buffered commands (`\r`/`\n`) to emit structured `command_exec` events into `telemetry_events` and maintain a rolling per-session buffer of the last 10 commands + terminal outputs so `/api/ai/chat` can include live terminal context in the tutor prompt.
2. **Fix Docker Sandbox Provisioning for All 8 Core Tasks (`Fixes BUG-01, BUG-04`)**:
   - Build and use the `ctf-sandbox:latest` image (from `Dockerfile` + `setup_ctf.sh`) OR run the `/pty` container provisioning script as `root` (`User: '0:0'` during `dockerContainer.exec`) before attaching the interactive shell as `cadet` (`1000:1000`):
     - **Task 3**: Append `export SECRET_KEY="FLAG{env_vars_insecure}"` to `/home/cadet/.bashrc` so every interactive bash session inherits it.
     - **Task 4**: Create `/var/logs/system.log` as `root` (`chmod 644`) with 50+ realistic syslog lines surrounding `FLAG{grep_is_your_friend}`.
     - **Task 5**: Start a lightweight background HTTP responder on `127.0.0.1:8080` serving `FLAG{curl_local_services}` and ensure `curl`, `wget`, `iproute2` (`ss`), and `net-tools` (`netstat`) are installed in the sandbox image.
     - **Task 7**: Create `/root/flag.txt` (`chmod 600`), configure `/etc/sudoers.d/cadet` (`cadet ALL=(ALL) NOPASSWD: /bin/cat /root/flag.txt`), and allow `CAP_SETUID`/`CAP_SETGID` (without `no-new-privileges:true`) specifically so `sudo cat /root/flag.txt` works inside the isolated container (`NetworkMode: 'none'`).
     - **Task 8**: Create `/var/lib/misc/subdir/lost_flag.txt` (`chmod 644`) to match `serverTasks.ts:306`, and set `aiDisabled: false, isPostTest: false` on Task 8 in `serverTasks.ts:329-330`.
3. **Connect `TestRunnerService` to the Live AI Pipeline & Expand to 24 Cases + 4 Holdouts (`Fixes BUG-03, BUG-11`)**:
   - Update `TestRunnerService.executeTestCase()` (`server/testRunner.ts`) to execute the actual 4-layer pipeline (`GuardrailEngine.checkInput` -> `checkInputSemantic` -> `generateAITutorResponse` -> `checkOutput` -> `checkOutputSemantic`) with a deterministic fallback toggle only when explicitly running offline unit tests.
   - Expand `STANDARD_TEST_CASES` from 12 to **24 standardized cases** (covering all 8 tasks across `guided`, `unguided`, and `none` modes and all 12 scenario types) plus **4 frozen holdout test cases** (`TC-H01` through `TC-H04`, flagged with `isHoldout: true`).
4. **Align `FacultyReviewModal.tsx` & Inter-Rater Agreement with Proposal (`Fixes BUG-06, BUG-10`)**:
   - Remove the 10th legacy slider (`safetyAndResponsibility`) from `FacultyReviewModal.tsx` so only the 9 proposal dimensions are displayed.
   - Add per-dimension `N/A` toggles with required `naJustifications` text inputs, display the frozen task ground-truth + interaction transcript side-by-side in the modal, and use `CEWEvaluator.evaluateCaseOutcome()` for the pass/fail check (`zero critical failures` + `every applicable dim >= 3` + `applicable mean >= 3.5`).
   - Add an `ExpertReview` inter-rater agreement calculator (primary vs. independent evaluator exact agreement %, within-1-point agreement %, pass/fail agreement %, and critical-failure agreement %) to `SectionJService`.
5. **Harden API & WebSocket Security (`Fixes SEC-01 through SEC-05, BUG-05, BUG-09`)**:
   - Add `requireAdminAuth` middleware to all write/admin routes, remove `x-auth-role: admin` header trust, strip `passwordHash` from `/api/users`, and prevent `POST /api/levels` from overwriting `flag` with `undefined`.
6. **Optimize Database Persistence (`server/db.ts`)**:
   - Add a 200ms debounced write-behind queue in `LocalDatabase.persist()` with a synchronous `process.on('SIGINT'/'SIGTERM')` flush to eliminate $O(N^2)$ disk I/O bottlenecks during batch and consistency runs.

---

## 12. Risk Assessment

| Risk Category | Risk Level | Description & Impact on Research Validity |
| :--- | :--- | :--- |
| **Construct & Internal Validity Risk** | **CRITICAL** | If `TestRunnerService` remains wired to hardcoded strings (`server/testRunner.ts:335-354`), RQ1, RQ2, and RQ3 consistency metrics (`15 runs`) measure static TypeScript string literals rather than the local Ollama LLM (`qwen2.5-coder` / `llama3.2`) and `llama-guard3:1b`. Any published data from that harness would be invalid. |
| **Ecological & Technical Validity Risk** | **CRITICAL** | If students or evaluators use the default terminal (`useRealShell = false`), they interact with an LLM hallucinating bash outputs (`services/aiService.ts`). Conversely, if they switch to the real Docker PTY (`useRealShell = true`), Tasks 3, 4, 5, and 7 fail due to container UID/capability mismatches, and the AI Tutor UI disappears. |
| **Data Completeness Risk (RQ4)** | **HIGH** | Because `Terminal.tsx` logs to legacy `research_logs` (`/api/logs`) while `ExportService` and `SectionJService` analyze `telemetry_events`, interactive sessions conducted through the main UI will appear to have 0% telemetry capture in formal exports unless unified onto `/api/ai/chat` and `/api/telemetry/events`. |
| **Data Integrity & Security Risk** | **HIGH** | Unauthenticated `/api/data/cleanup-non-formal`, `/api/runs/unlock`, and `/api/levels` endpoints allow accidental or malicious corruption of locked formal runs and task flags during a semester deployment. |
| **Operational Scalability Risk** | **MODERATE** | Full-file JSON serialization on every telemetry event (`data/research_lab.json`) and unthrottled Docker container spawning on `/pty` can degrade host responsiveness under multi-student classroom load. |

---

## 13. Final Go/No-Go Recommendation

### Determination: **NO-GO (Hold Formal Round 1 Baseline Freeze)**

The application is **NOT READY** to begin Formal Round 1 evaluation or a semester-long student pilot in its current state. While the backend guardrail engine (`GuardrailEngine` + `LlamaGuardService`), runtime digest verifier (`runtimeDigests.ts`), telemetry validator (`TelemetryManager`), and export/reporting services (`ExportService`, `SectionJService`) are thoughtfully engineered and pass all 31 unit/integration tests, **five critical integration and environment defects (`BUG-01` through `BUG-05`) prevent valid end-to-end experimental execution.**

### Mandatory Gating Checklist for **GO** Approval
Before locking `Formal_Round_1` (`POST /api/runs`), the following 5 gates must be verified:
- [ ] **Gate 1 (Real PTY + AI Tutor Integration)**: `XTermTerminal.tsx` is paired with a live AI Tutor & Progressive Hint panel wired to `/api/ai/chat` and `/api/hints/request`, and `/pty` logs `command_exec` events + shares recent terminal context with the tutor.
- [ ] **Gate 2 (8/8 Container Tasks Solvable)**: All 8 core Linux tasks (`Tasks 1–8` in `serverTasks.ts`) are verified solvable end-to-end inside the Docker `/pty` container (`env` for Task 3, `/var/logs/system.log` for Task 4, `localhost:8080` + `curl` for Task 5, `sudo cat /root/flag.txt` for Task 7, `/var/lib/misc/subdir/lost_flag.txt` + Guided AI enabled for Task 8).
- [ ] **Gate 3 (Live LLM Execution in `TestRunnerService`)**: `TestRunnerService.executeTestCase()` and `executeConsistencySuite()` invoke the live `generateAITutorResponse()` and `GuardrailEngine.checkInputSemantic()` / `checkOutputSemantic()` pipeline across 20–30 standardized cases + 3–4 frozen holdout cases.
- [ ] **Gate 4 (9-Dimension Rubric & Ground Truth Alignment)**: `FacultyReviewModal.tsx` enforces the exact 9 proposal dimensions, supports `N/A` with justification, displays the frozen task ground-truth and interaction transcript, enforces the full non-compensatory pass rule (`every applicable dim >= 3`, `mean >= 3.5`, `0 critical failures`), and `SectionJService` computes primary vs. independent evaluator agreement.
- [ ] **Gate 5 (Endpoint Authentication & State Protection)**: Administrative and destructive API routes enforce session authentication and prevent non-admin clients from reading flags or mutating locked runs.
