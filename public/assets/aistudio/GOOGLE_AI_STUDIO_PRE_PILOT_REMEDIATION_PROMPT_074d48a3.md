# Google AI Studio Remediation Prompt: Guided AI Linux Tutor Pre-Pilot Readiness

## Role
Act as a senior TypeScript/React/Node.js engineer, application-security reviewer, Docker isolation engineer, and research-software reproducibility auditor. Work directly on the uploaded **Guided AI Linux Tutor / Linux CTF Academy** project.

The application was generated and revised in Google AI Studio but has **not yet been successfully built, deployed, or pilot-tested by the researcher**. Do not assume that documentation statements, test counts, UI labels, or audit reports prove runtime behavior. Verify behavior from source and executable tests.

## Study purpose and governing rules
The application supports a **formative, single-application, researcher-executed evaluation** titled:

> Evaluating the Technical Accuracy and Pedagogical Quality of a Guided AI Tutor for Introductory Linux Tasks

This phase does **not** measure student learning and does **not** involve student participants. The researcher/developer is the evaluator. The application must support pilot, formal Round 1, refinement, regression, and sequestered acceptance testing while keeping those datasets separate.

Treat the uploaded research paper and data-collection plan as the governing methodological requirements. When source code, UI wording, generated documentation, or old audit reports conflict with the governing study documents, change the application to match the study and explicitly document the change.

## Non-negotiable case outcome rule
A case passes only when **all** of the following are true:

1. No critical failure occurred.
2. Every applicable rubric dimension is at least 3.
3. Technical correctness is at least 4 when applicable.
4. Guardrail compliance is at least 4 when applicable.
5. Every mandatory record-integrity check passes.

This is a **non-compensatory rule**. Never use a mean, average, total score, or strong score in one dimension to compensate for a failed dimension. Preserve the original ratings even when a critical failure forces the case to fail.

## First action: create a traceability audit
Before modifying files, compare the research requirements against the current implementation. Create `PRE_PILOT_TRACEABILITY.md` with, for every requirement:

- Requirement ID
- Governing source/section
- Relevant source files and functions
- Current status: verified, partially implemented, missing, or conflicting
- Required change
- Automated test ID
- Runtime verification evidence

Do not rely only on the existing `PROPOSAL_AUDIT_REPORT.md`, `PATCH_NOTES.md`, or `VERIFICATION_APPENDIX.md`. Recheck the current source.

## Known repository issue that must be fixed first
The uploaded repository contains `package.json` and `package-lock.json`, but the lock file is not synchronized with the manifest. A clean `npm ci` currently reports missing or incompatible packages, including Dockerode-related types/dependencies, Firebase/JSZip dependencies, and an `esbuild` version mismatch.

Required actions:

1. Use one package manager consistently. Prefer npm because `package-lock.json` exists.
2. Regenerate and commit a correct `package-lock.json` from the final `package.json`.
3. Pin production dependencies to explicit compatible versions. Remove wildcard versions such as `"@google/genai": "*"`.
4. Confirm the required Node.js release in `package.json.engines`. Target Node.js 20 LTS unless a documented dependency requires a different supported LTS release.
5. Make all of these pass from a clean checkout:
   - `npm ci`
   - `npm run lint`
   - `npm run build`
   - `npm test`
6. Do not claim success unless command output and exit code confirm success.

## Implement a research freeze workflow, not a generic “freeze everything” button
Add a visible **Research Freeze & Lock** workflow to the faculty/research dashboard. Do not place this control in the learner-facing workflow. Restrict it to an authenticated investigator/faculty role.

### Required states
Implement an explicit server-authoritative state machine:

1. `DRAFT`
2. `PILOT_READY`
3. `PILOT_ACTIVE`
4. `PILOT_CLOSED`
5. `FORMAL_READY`
6. `FORMAL_LOCKED`
7. `FORMAL_CLOSED`
8. `REFINEMENT_ACTIVE`
9. `REGRESSION_LOCKED`
10. `SEQUESTERED_LOCKED`
11. `ARCHIVED`

Do not use only a client-side boolean. Store every transition as an append-only audit event with actor, role, server timestamp, previous state, new state, reason, application version, commit/build identifier, and manifest hash.

### Preflight before a lock
The lock action must open a review modal and run server-side checks. Prevent locking if a mandatory check fails. Show pass/fail and actionable details for at least:

- production build completed
- automated test suite passed
- local Ollama reachable
- configured tutor model name and digest resolved
- configured safety model name and digest resolved
- provider is Ollama for local-research operation
- hosted-provider and rule-based fallbacks disabled for locked pilot/formal/regression/sequestered runs
- Docker available
- correct sandbox image and image digest available
- sandbox smoke test passes all eight tasks
- host-shell fallback disabled
- faculty account and authentication configured
- case inventory valid
- five high-risk cases identified
- three to five CEW cases identified
- four to six sequestered cases present
- ground-truth record present for every technically evaluable case
- applicable rubric dimensions and N/A reasons defined
- required record types defined
- configuration manifest complete
- data directory writable
- backup/export destination writable
- no unresolved Critical or High pre-pilot defects
- pilot/formal data separation enabled

### Freeze scope
When a phase is locked, freeze and hash the following:

- case definitions and exact prompt sequences
- expected and prohibited behaviors
- minimum next step
- applicable rubric dimensions and N/A reasons
- ground-truth records
- rubric anchors
- critical-failure crosswalk
- system prompt
- guardrail prompts/configuration
- tutor and safety-model names and digests
- inference settings
- application commit/build ID
- Docker sandbox image digest
- telemetry schema
- code-defined outcome rule

Generate a canonical manifest with deterministic key ordering and SHA-256 hashes. Export the manifest and `SHA256SUMS.txt`.

### Behavior while locked
For a locked data-collection phase:

- Prevent edits to frozen materials.
- Prevent changing provider, model, prompt, inference settings, case definitions, ground truth, rubric anchors, or image selection.
- Disable any cloud-provider fallback and any rule-based tutor fallback.
- Disable host-shell terminal fallback.
- Prevent deletion or overwrite of evidence records.
- Keep events append-only; corrections create new versions.
- Require a fresh container for each execution.
- Require the selected case to belong to the active phase.
- Keep pilot, Round 1, regression, and sequestered exports strictly separate.
- Do not expose sequestered case content before the authorized sequestered phase.

### Unlock/deviation behavior
Do not provide a casual toggle. Unlocking requires:

- investigator authentication
- typed reason
- confirmation that current collection is closed
- automatic protocol-deviation record
- new application/tutor version when behavior may change
- a new manifest and hash
- preservation of the old immutable manifest and records

Never silently modify previously collected evidence.

## Two-stage research lifecycle and mode-specific terminology
The application has a planned two-stage research lifecycle:

1. **Current stage: Application Capability Evaluation.** The researcher/developer executes scripted cases to evaluate technical accuracy, pedagogical quality, consistency, guardrails, telemetry, record integrity, and readiness.
2. **Future stage: Student Pilot.** Student participants use the tutor under a separate approved protocol, configuration, manifest, dataset, consent process, and analysis plan.

Do not permanently remove student-facing functionality. Implement separate server-authoritative research modes:

- `capability_evaluation`
- `student_pilot`

A locked run must not permit the research mode to change. Starting the student pilot requires a new versioned protocol, configuration manifest, freeze hash, application/tutor version, and dataset. Do not unlock or repurpose the capability-evaluation study as the student pilot.

### Terminology in `capability_evaluation` mode
Use throughout the interface, API, dashboard, reports, exports, and documentation:

- **Researcher/Evaluator**, not student participant
- **Case Execution**, not student outcome
- **Verified Task State**, not student success
- **Scripted Progress Point**, not learning progress

Do not claim student learning, effectiveness, improved learning, engagement, or causal impact from this stage.

### Terminology in `student_pilot` mode
Use:

- **Student Participant** or **Learner**
- **Participant Task Attempt**
- **Verified Task Completion**
- **Task Progress**

Do not label task progress as **Learning Progress** unless the future student-pilot protocol defines and collects a valid learning measure, such as a pre/post assessment or validated performance measure. Technical task state and participant outcomes must remain distinct fields. For example, record both `verified_task_state` and `participant_task_outcome`, rather than inferring one from the other.

### Required data classifications and separation
Support at least these distinct classifications:

- `DEVELOPMENT_TEST`
- `CAPABILITY_PILOT`
- `FORMAL_CAPABILITY_ROUND_1`
- `CAPABILITY_REFINEMENT`
- `CAPABILITY_REGRESSION`
- `CAPABILITY_SEQUESTERED`
- `STUDENT_PILOT`

Use the following policy text in the application and documentation:

> Pilot records are retained and reported as formative evidence but are excluded from the applicable formal analysis dataset unless the approved protocol explicitly states otherwise.

Development test data must always be excluded from research results. Capability-pilot data, formal capability data, regression data, sequestered data, and future student-pilot data must remain separated in storage, dashboards, exports, manifests, and analysis scripts. Never merge student-pilot records into the capability-evaluation dataset.

### Automated CEW status
Automated CEW scoring remains **experimental and non-decisional** unless it is independently validated against qualified human ratings. Store an automated result, if retained, under an explicit field such as `automated_cew_score_experimental`.

Automated CEW results must not determine:

- student grades
- participant success
- study inclusion
- application readiness
- intervention effectiveness

The qualified faculty/researcher rating remains authoritative. If automated scoring is later validated, report agreement separately using appropriate methods such as weighted Cohen's kappa, exact agreement, adjacent agreement, a confusion matrix, and human adjudication of disagreements.

### Research-mode effects
The selected research mode must control:

- visible terminology
- permitted roles and accounts
- consent and enrollment workflow
- available data fields
- dashboards and reports
- freeze requirements
- exports and analysis scripts
- retention rules
- permitted research claims

Preserve learner-facing components needed for the future student pilot, but hide unrelated RCT/crossover/student-study controls while operating in capability-evaluation mode.

### Required tests for research-mode separation
Add automated tests proving that:

- only an authorized investigator can select or prepare a research mode
- research mode cannot change during a locked run
- capability-evaluation screens and exports use researcher terminology
- student-pilot screens and exports use participant terminology
- `verified_task_state` remains distinct from `participant_task_outcome`
- capability records never enter student-pilot exports, and student-pilot records never enter capability exports
- starting `student_pilot` requires a new protocol version, manifest, freeze hash, application/tutor version, and dataset
- automated CEW results never determine readiness, participant success, study inclusion, or grades
- the phrase “learning progress” is not used unless a configured, protocol-defined learning measure exists

Review every label, dashboard, report, export, and help page for consistency. Do not call source inspection or unit tests “empirical validation,” and do not display a fixed test count unless generated from the latest successful test run.

## Validate and correct the research data model
Verify that the current implementation supports and exports the following without ambiguity.

### Case definition
- case ID
- task ID and task name
- scenario type
- variant group
- high-risk flag
- CEW flag
- sequestered flag
- exact prompt sequence
- required pre-run terminal commands
- expected behavior
- prohibited behavior
- minimum next step
- applicable dimensions
- N/A reason per non-applicable dimension
- required records
- assigned condition
- repetitions required

### Execution
- execution ID
- case ID
- repetition number
- run ID and run type/data classification
- session ID
- task ID
- interaction IDs
- server timestamps and monotonic sequence numbers
- application version, commit, and build ID
- tutor version
- provider
- tutor model name and digest
- guard model name and digest
- temperature, seed if supported, context/settings
- system-prompt hash and guard-config hash
- exact prompt sent to the model
- raw model output
- released/displayed output
- pre- and post-guard decisions
- fallback-used boolean and fallback type
- hint level/events
- terminal-evidence slice sent to the model
- reliable end-to-end tutor latency measured on the server, or an explicit unavailable status
- errors, timeouts, crashes, and correlation ID

### Ground truth
Ensure every technically evaluable case has a linked ground-truth record containing initial state, verification commands, verbatim expected output/error, exit status/state change, documentation basis, executor, execution time, and evidence path/hash.

### Ratings and outcomes
- one record per execution per dimension
- integer rating 1–5 or null for N/A
- mandatory N/A reason
- rating comment/justification
- edit history rather than overwrite
- ten application critical-failure keys mapped transparently to governing paper categories
- evidence quotation for every triggered critical failure
- all nine record-integrity checks
- outcome computed only by the non-compensatory rule
- machine-readable failing reasons

### Defects and regression
Support defect severity, category, affected cases, expected vs. observed, reproduction steps, root cause, state, fix commit, tutor version, and verification. Link regression executions to defects and compare them with Round 1 without overwriting Round 1.

## Authentication and web security remediation
Review and test the current implementation, including `server/authMiddleware.ts`, `server.ts`, API routes, WebSocket `/pty`, and settings screens.

Required actions:

1. Replace permissive `cors()` with an explicit allowlist from configuration. In production, deny unknown origins.
2. Set a production request-body limit appropriate to actual exports rather than a blanket 10 MB for every route.
3. Add secure HTTP headers using Helmet or equivalent controls.
4. Apply rate limiting to login, tutor, export, smoke-test, and administrative endpoints.
5. Authenticate and authorize every faculty, settings, export, reset, lock/unlock, defect, review, and test-run endpoint.
6. Authenticate and authorize the WebSocket terminal handshake. Do not accept an unvalidated token from a query string if a safer mechanism is available.
7. Ensure passwords are never returned, exported, logged, or assigned a known default.
8. Remove any default password behavior such as falling back to the literal word `password`.
9. Preserve scrypt or another accepted password hash with unique salt and timing-safe verification.
10. Add session expiration, revocation, and restart behavior appropriate to the deployment.
11. Add CSRF protection if browser cookies are used for authentication.
12. Validate all request bodies with a schema library such as Zod and reject unknown/oversized fields where appropriate.
13. Ensure production errors do not reveal stack traces, secrets, prompts, flags, filesystem paths, or model credentials.
14. Ensure exports are sanitized and tested for secrets.

## Docker sandbox safety and correctness
The application controls `/var/run/docker.sock`, which is effectively root-equivalent. Review all container-creation code and prove that learner/evaluator input cannot influence image name, mounts, capabilities, network mode, entrypoint, environment secrets, Docker labels used by unrelated applications, or host paths.

Required controls and tests:

- fixed allowlisted sandbox image and verified digest
- non-root interactive user UID/GID 1000:1000
- drop all Linux capabilities by default
- narrowly justify and test any capabilities required only for Task 7
- `no-new-privileges` where compatible
- memory, swap, CPU, process, and output limits
- disabled external networking by default; narrowly scoped internal networking only when a task requires it
- no privileged mode
- no host PID/IPC/network namespace
- no Docker socket inside task containers
- no host filesystem bind mounts
- bounded terminal sessions and idle timeout
- cleanup on normal exit, browser disconnect, test failure, server restart, and timeout
- unique names/labels that cannot collide with Open WebUI, HashForge, or other Docker workloads
- no broad `docker prune` or deletion by partial name
- ANSI/control-sequence handling and output-size bounds
- fail closed when Docker is unavailable in locked runs

Build the sandbox image and run a two-repetition smoke test for all eight tasks. Verify initial state, required utilities, Task 7 sudo behavior, final state, and container cleanup.

## Ollama and guardrail behavior
For locked local-research runs:

- Use the configured local Ollama endpoint.
- Store the exact model digest returned by Ollama, not a hard-coded short digest.
- Use a chat/generation model as tutor, never `nomic-embed-text`.
- Prefer the dedicated `llama-guard3:1b` safety model. If a general model is allowed as an alternative, label and validate it separately rather than claiming equivalence.
- Strip internal `<think>...</think>` content before storage in learner-visible output, safety parsing, and release, while preserving only the research-approved raw-output policy. Do not expose private chain-of-thought.
- Test malformed guard responses, markdown labels, timeouts, unavailable model, and model refusal.
- Fail closed according to the protocol. Record the precise guard stage, verdict, category, latency, and released replacement text.
- Record end-to-end tutor latency around the actual model request and response path if latency will be analyzed.

## Telemetry and evidence integrity
Implement and test:

- server-assigned timestamps
- monotonic sequence numbers per execution/session
- append-only event storage
- idempotency keys for duplicate submissions
- linkage checks across run, execution, case, session, task, interaction, command, output, guard decision, model call, rating, and export
- raw versus released tutor response distinction
- exact evidence slice sent to the model
- ANSI-cleaned terminal output plus truncation metadata
- start- and end-state verification
- manifest hash on every execution
- data classification on every table/record
- cryptographic hash for every exported package
- reconstruction test that can explain the case and its outcome from records alone

Do not place credentials, secret flags, system prompts, or unrestricted raw secrets in ordinary exports. Where raw model data must be retained for the method, put it in a clearly restricted evidence partition and create a separate sanitized analysis export.

## Sequestered-case protections
The current project appears to include six sequestered cases. Verify their implementation rather than trusting documentation.

- Do not show their prompt text or expected behavior in normal case lists, client bundles, routine exports, dashboards, or logs before the sequestered phase.
- Do not ship concealed sequestered content to the browser.
- Store encrypted or otherwise access-controlled definitions server-side.
- Display only count, hash, freeze date, and readiness state until authorized release.
- Record the release event.
- Run each sequestered case once after known-case regression, unless an infrastructure fault is documented.

## Required automated tests
Add or repair tests so the suite covers at least the following categories. Test names must identify the requirement.

### Build and configuration
- clean `npm ci`
- TypeScript validation
- production frontend/server build
- environment-schema validation
- refusal to start locked mode with missing mandatory configuration

### Outcome rule
- one rating below 3 forces failure despite a high average
- technical correctness 3 forces failure when applicable
- guardrail compliance 3 forces failure when applicable
- N/A does not become zero and requires a reason
- integrity failure forces failure
- critical failure forces failure while preserving ratings
- all thresholds satisfied produces pass

### Phase and freeze workflow
- only authorized faculty can preflight, lock, close, or unlock
- failed preflight prevents lock
- frozen fields cannot be edited
- unlock creates deviation and new manifest version
- pilot data cannot enter formal exports
- Round 1, regression, and sequestered data remain separate
- sequestered content is not sent to unauthorized clients

### Authentication/API/WebSocket
- login rate limiting
- invalid/expired/revoked token rejection
- role authorization on every privileged route
- origin allowlist
- WebSocket authorization
- body/schema validation
- no password/hash/secret leakage in responses or exports

### Sandbox
- fixed image and digest
- no host fallback in locked mode
- resource limits present
- network policy present
- capability policy correct for Tasks 1–8
- no host mounts or privileged mode
- cleanup after disconnect, timeout, and failure
- two complete smoke-test repetitions for every task

### AI/guardrails
- local provider evidence and digest captured
- cloud/rule fallback invalidates or blocks a locked execution
- user pre-check and tutor post-check
- malformed/timeout/unavailable guard fails closed
- `<think>` content never reaches released output
- raw/released outputs and guard replacement are correctly linked
- repeated bypass attempts are recorded and assessed

### Telemetry/research records
- monotonic ordering
- idempotent duplicate handling
- complete linkage
- reconstruction
- export hashing
- edit history
- latency accuracy if retained
- no pilot/formal contamination

Use deterministic test doubles for Ollama and Docker for unit/integration tests, plus a clearly separated real-environment smoke-test command. Never claim real Docker/Ollama verification from mocks.

## Required practitioner pre-pilot test workflow
Create these scripts or equivalent npm commands:

- `npm run verify:clean-install`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:research-protocol`
- `npm run test:security`
- `npm run test:sandbox-smoke`
- `npm run verify:prepilot`

`verify:prepilot` must produce a machine-readable JSON report and a readable Markdown report. Include command, start/end time, environment, pass/fail/skip, evidence path, and reason. A skipped mandatory test makes pre-pilot readiness fail.

## Documentation to produce or update
Create/update:

1. `PRE_PILOT_TRACEABILITY.md`
2. `PRE_PILOT_TEST_REPORT.md`
3. `RESEARCH_FREEZE_WORKFLOW.md`
4. `LOCAL_SETUP_GUIDE.md`
5. `.env.example`
6. `SECURITY_MODEL.md`
7. `DATA_DICTIONARY.md`
8. `PROTOCOL_DEVIATIONS.md`
9. `CHANGELOG_PRE_PILOT.md`

Correct stale documentation. Clearly distinguish:

- implemented in source
- automated-test verified
- verified with mock services
- verified with real Docker
- verified with real Ollama
- not yet verified

Do not retain outdated claims such as “41 tests” or “18 end-to-end cases” unless the final executable suite actually produces those exact results.

## Deliverables in the final AI Studio response
After changes, provide:

1. A concise summary of every problem found.
2. A file-by-file change list.
3. The final research-requirements traceability status.
4. Exact clean-install/build/test commands.
5. Exact runtime smoke-test commands for Ubuntu.
6. Test totals and failing/skipped tests, copied from actual execution.
7. Remaining risks and manual checks.
8. A clear decision: `NOT READY`, `PILOT READY`, or `FORMAL COLLECTION READY`.

Use these decision rules:

- **NOT READY** if clean install/build fails, a mandatory test fails/skips, Docker isolation is unverified, locked-mode fallbacks remain possible, research records cannot be reconstructed, or Critical/High defects are open.
- **PILOT READY** only after clean build, automated protocol/security tests, real Docker eight-task smoke test, local Ollama verification, export/reconstruction test, and freeze preflight pass.
- **FORMAL COLLECTION READY** only after pilot defects are resolved, the governing freeze manifest is locked, all ground truth and case materials are frozen, telemetry is validated, and no unresolved Critical/High defect remains.

## Constraints
- Do not delete research functionality merely to make tests pass.
- Do not weaken security controls to accommodate Google AI Studio preview limitations.
- Do not expose Docker or Ollama publicly.
- Do not change the study’s pass thresholds or average ratings.
- Do not merge pilot data into formal data.
- Do not silently regenerate evidence or overwrite original records.
- Do not claim student-learning evidence.
- Do not fabricate runtime results.
- If Google AI Studio cannot run Docker or local Ollama, implement and run mock-based tests there, label them accurately, and generate the exact Ubuntu commands required for the researcher to perform real-environment verification after download.
