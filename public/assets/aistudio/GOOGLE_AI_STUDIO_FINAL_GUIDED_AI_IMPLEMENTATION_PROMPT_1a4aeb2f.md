# Google AI Studio Master Prompt: Minimal Guided AI Tutor Implementation and Pre-Collection Verification

## Role and objective
Act as a senior TypeScript/React/Node.js engineer, Docker isolation reviewer, educational-AI designer, and research-software auditor. Work directly on the uploaded Guided AI Linux Tutor project.

The immediate goal is to prepare the application for this semester's **researcher-executed capability evaluation**. The researcher will run the cases, verify that Guided AI performs as intended, and collect defensible data for a final paper. A future student pilot and a future Linux CLI/API client are long-term goals, but they are not part of this implementation.

Make the smallest reliable set of changes. Do not redesign the application, add a complex governance platform, or implement a student-participant study.

## Governing priorities
In descending order:

1. Preserve the existing polished dark interface, branding, left task navigation, and faculty tools.
2. Make each task understandable and keep instructions, terminal work, and Guided AI help in one integrated workspace.
3. Make Guided AI an evidence-grounded Socratic tutor that uses the student's actual terminal attempts without giving away answers.
4. Record a complete, reconstructable research history while sending only bounded relevant context to the model.
5. Preserve Docker isolation, guardrails, authentication, and formal-data separation.
6. Make clean installation, testing, local Ubuntu verification, reset, collection, export, and analysis reproducible.

## Explicit non-goals
Do not implement:

- an eleven-state Freeze & Lock workflow
- a research-governance dashboard
- a student-pilot mode
- a public tutor API or downloadable CLI client
- student access to provider API keys
- a vector database or document-RAG system
- autonomous shell tools for the model
- automatic execution or insertion of AI-generated commands
- web search during offline challenges
- a separate Progressive Hints panel
- a frontend redesign or new design system

## Existing frontend is the visual baseline
Preserve the existing:

- `App.tsx` application shell
- Linux Gym branding
- dark navy theme
- left sidebar and eight challenge cards
- difficulty indicators
- task-selection behavior
- terminal styling
- Research Instrumentation controls
- Faculty Rubric, Case Library/Test Harness, Analytics, Record Integrity, exports, and AI configuration
- typography, icons, spacing, borders, and responsive behavior

The only intentional frontend change authorized is the **Student Workspace** described below. Before editing any `.tsx`, CSS, Tailwind, PostCSS, Vite, or frontend configuration file:

1. List the exact files and components that must change.
2. Explain why each change is necessary.
3. Create a commit or backup.
4. Use the smallest patch.

Do not replace the application with raw browser controls or an unstyled layout. Confirm that the production Vite build emits and loads its CSS asset.

# Part I: Student Workspace

## One integrated task workspace
The primary screen must make three things immediately obvious:

1. What the student must accomplish.
2. Where the student performs the work.
3. How the student asks Guided AI for help.

Retain the task sidebar. In the main area use:

1. A compact full-width **Task Instructions** card at the top.
2. The **terminal as the primary work area** below it.
3. One terminal-integrated Guided AI interaction path.
4. A completion or flag-submission control where the task requires it.

Do not create separate instruction, terminal, hint, and tutor pages. The student must read the task, execute commands, inspect output, and ask for help without navigating away.

## Required task instructions
Every published task must define and display:

- Task number and title
- **Your task:** one direct action statement
- **Goal:** an observable end state
- **Context:** no more than 2 to 4 concise sentences when needed
- **Success evidence:** what the verifier checks or what the student submits
- **How to work:** “Use the terminal below. If you need help, ask Guided AI from the terminal workspace.”
- **Constraints:** working directory, offline status, `sudo` availability, or other genuine limits

Instructions must not disclose:

- flags or secrets
- hidden filenames
- complete final commands
- ground-truth answers
- faculty rubric anchors
- prohibited-behavior lists
- sequestered answer material

Add a validation test requiring every published task to have non-empty `studentTask`, `goal`, `successEvidence`, and `constraints` fields.

## Terminal-integrated Guided AI
Use one consistent help path. Prefer a reserved terminal command if the existing PTY bridge can intercept it safely:

```bash
ask-ai I cannot find the file
ask-ai what does my last error mean?
ask-ai I read the manual page but do not understand the option
```

The terminal bridge must intercept the reserved command before shell execution. The question is sent to the server-side tutor pipeline, and the released response is rendered as a visually distinct tutor block in the same terminal workspace.

The reserved command must:

- never reach Bash or the Docker container
- never be recorded as an ordinary shell command
- be stored as `tutor_query`
- preserve ordering with surrounding shell events
- pass through input guard, tutor policy, model, and output guard
- return focus to the terminal after display

If reliable interception is unsafe with the current PTY architecture, use one compact **Ask Guided AI about your task or terminal output** input directly beneath the terminal inside the same card. Do not retain both mechanisms. Do not use another page, modal, or separate hint panel.

## Remove Progressive Hints from the student interface
Remove the separate student-facing **Progressive Hints** box, stream, badge, or button when it duplicates Guided AI. Progressive assistance remains an internal pedagogical policy and a recorded research variable. Students use only the terminal-integrated Guided AI path.

# Part II: Evidence-Grounded Socratic Tutor

## Core behavior
Guided AI must help the student reason from observed evidence instead of providing a completed answer or command sequence. A normal response contains no more than:

- one acknowledgement tied to observed terminal evidence
- one focused Socratic question
- one optional bounded next action

Do not produce multi-step answer dumps, complete solutions, hidden filenames, flags, secrets, copy-ready final command sequences, or unsupported completion claims.

## Intended example
When a hidden-file task produces this interaction:

```text
student@task:~$ ls
documents  notes.txt
student@task:~$ ask-ai I cannot find the file
```

An appropriate response is:

```text
Guided AI: The default listing showed only ordinary entries. What kinds of
entries might it omit, and which local documentation command could help you
inspect the available `ls` options?
```

If the student then runs:

```bash
man ls
```

and asks:

```bash
ask-ai I checked the manual page, but I do not understand which option applies
```

an appropriate response is:

```text
Guided AI: You opened `man ls`. Which option description refers to entries
whose names begin with a dot, and what does that description mean in your own
words?
```

If the student responds:

```bash
ask-ai I think -a includes hidden entries
```

an appropriate response is:

```text
Guided AI: What difference do you predict you will see if you test that
interpretation against your earlier listing?
```

This pattern must generalize to permissions, environment variables, search, file discovery, decoding, internal communication, and lost-data tasks. Do not hard-code only the `ls` example.

## Evidence-first probing sequence
For each tutor request:

1. Inspect the current task goal, constraints, recent relevant terminal evidence, earlier tutor dialogue, and verified state.
2. Identify what the student already attempted.
3. Ask the student to interpret observed output before introducing a new command.
4. When appropriate, direct the student to local documentation using `man`, `--help`, or `-h`.
5. After documentation is opened, ask the student to explain the relevant concept or option in the student's own words.
6. Ask the student to predict what the next action should reveal or change.
7. Ask the student to test the prediction.
8. Provide a bounded concrete next step only after repeated difficulty or a protocol-defined escalation trigger.

Do not ask “Did you check the man page?” when terminal evidence already shows `man ls`. Say, “You opened `man ls`; which option description appears relevant?” Never claim that a student read or understood a passage without evidence.

## Internal guidance states
Record, but do not present as separate hint boxes:

1. `orientation_probe`
2. `conceptual_probe`
3. `documentation_probe`
4. `reflection_probe`
5. `prediction_probe`
6. `procedural_probe`
7. `bounded_next_step`

Escalation must depend on terminal evidence, repeated help requests, unsuccessful attempts, documented errors, and protocol rules. Do not escalate solely because time passed.

## Documentation constraints

- Recommend only documentation installed in the sandbox.
- Do not reveal the target option immediately when the student can reasonably discover it.
- If the student genuinely struggles to interpret documentation, explain vocabulary without giving the full solution.
- Ask for a short explanation or prediction before advancing.
- Never invent or incorrectly quote a man-page description.
- Do not direct students to the public internet in offline tasks.

## Student remains in control
The tutor must not:

- execute commands
- insert a command into the terminal prompt automatically
- autonomously inspect files or the filesystem
- read hidden challenge data
- call shell tools
- decide final task completion

The student deliberately types commands. A server-side verifier determines completion.

# Part III: Session-Aware Command History and Retrieval

## Architecture name
Implement an **evidence-grounded, session-aware Socratic tutor**. This is retrieval-informed, but it does not require conventional RAG. Use structured retrieval keyed by `run_id`, `execution_id`, `task_id`, `session_id`, and ordered sequence numbers.

Do not add embeddings, a vector database, or semantic similarity search unless deterministic retrieval is demonstrably inadequate and the researcher separately approves the added complexity.

## Per-challenge isolation
Every challenge execution gets a unique execution/session ID. Never mix records between:

- users
- tasks
- repetitions
- development and formal-capability runs

When a task changes, explicitly close or suspend the previous execution and initialize the selected task's fresh sandbox and context.

## Record terminal activity continuously
Record every meaningful terminal action in order:

- exact command text
- server timestamp
- monotonic sequence number
- working directory before and after when available
- exit code
- bounded, cleaned stdout and stderr
- original byte count and truncation state
- connection and disconnection events
- relevant verifier/file-state events
- documentation actions such as `man ls` or `ls --help`

Apply documented secret redaction to ordinary exports. Do not export passwords, access tokens, provider keys, or session credentials.

## Complete event history versus tutor context
Maintain two different representations:

1. **Complete research event history:** append-only and reconstructable according to the study's retention policy.
2. **Curated context snapshot:** a bounded subset for one tutor request.

Do not send raw PTY history to the model. Strip ANSI/OSC control sequences, repeated redraws, ordinary prompts, and irrelevant noise while preserving command-output relationships.

Begin with configurable limits of:

- 20 recent relevant commands
- 8 KiB cleaned relevant output
- 5 prior tutor exchanges
- 2 KiB structured summary of earlier attempts

These values are engineering defaults, not research findings. Store the configured limits in the collection manifest. For every tutor request, record selected source event IDs, omitted-event count, truncation state, and context hash.

## Retrieval priority
Construct context in this order:

1. Current task instructions, goals, constraints, and disclosure boundaries
2. Current execution and verified state
3. Student's explicit question
4. Commands and outputs since the last tutor exchange
5. Nonzero exits and relevant errors
6. Documentation actions and subsequent interpretation
7. Earlier relevant attempts in the same execution
8. Previous guidance and student reflections

## Context contract
Build a structured package similar to:

```json
{
  "task": {
    "taskId": "task-2",
    "studentInstruction": "Locate the hidden evidence file.",
    "goal": "Find and inspect the evidence without receiving the answer.",
    "constraints": ["offline sandbox"],
    "prohibitedDisclosures": ["hidden filename", "flag", "complete solution"]
  },
  "session": {
    "runId": "run-...",
    "executionId": "exec-...",
    "currentDirectory": "/home/cadet",
    "verifiedState": "in_progress"
  },
  "recentAttempts": [
    {
      "eventId": "evt-...",
      "command": "ls",
      "exitCode": 0,
      "outputExcerpt": "documents  notes.txt"
    }
  ],
  "documentationActions": [],
  "previousGuidance": [],
  "studentQuestion": "I cannot find the file",
  "truncation": {
    "outputTruncated": false,
    "eventsOmitted": 0
  }
}
```

Never include flags, hidden filenames, ground-truth answers, faculty-only rubric anchors, unrestricted filesystem contents, or sequestered answer material. The verifier may inspect hidden state, but the tutor receives only bounded states such as `not_started`, `in_progress`, `partial`, or `completed`.

## Full-screen command handling
For `man`, `less`, `vim`, or `nano`, do not treat all screen redraw bytes as normal output. When reliably detectable, record a structured event such as:

```json
{
  "eventType": "documentation_view",
  "command": "man ls",
  "documentedCommand": "ls",
  "exitCode": 0,
  "durationSeconds": 42
}
```

Retain only bounded cleaned excerpts when necessary. Opening documentation does not prove that a specific passage was read or understood.

## Invoke AI on demand
Record commands continuously, but invoke Guided AI only when:

- the student enters the reserved tutor command
- the student submits through the single embedded input fallback
- a narrowly defined safety-critical warning is required
- the approved protocol explicitly calls for a non-intrusive intervention

Do not coach automatically after every command, error, or delay.

# Part IV: Event Model and Research Data

## Append-only event types
Support at least:

- `task_started`
- `shell_command`
- `shell_output`
- `working_directory_changed`
- `documentation_view`
- `tutor_query`
- `student_reflection`
- `context_snapshot`
- `input_guard_decision`
- `model_call`
- `tutor_response_raw_restricted`
- `output_guard_decision`
- `tutor_response_released`
- `guidance_decision`
- `task_verification`
- `task_completed`
- `session_ended`

Every event contains:

- event ID
- run ID
- execution ID
- task ID
- session ID
- event type
- server timestamp
- monotonic sequence number
- payload
- payload SHA-256

Enforce uniqueness of `(execution_id, sequence_number)`.

Link:

- each output to its shell command
- each context snapshot to selected source events
- each model call to query and context
- each released response to raw restricted response, both guard decisions, model call, guidance decision, and latency
- each verification result to the relevant execution evidence

## Required execution record
The formal export must support reconstruction of:

- run, execution, case, task, session, and repetition IDs
- scenario and variant
- evaluator ID
- ordered timestamps and sequence numbers
- exact tutor queries
- commands, outputs, working directory, and exit codes
- context supplied to Guided AI
- raw response under restricted retention policy
- released response
- input and output guard decisions
- guidance move and escalation reason
- tutor and guard model names and exact digests
- provider and endpoint class
- inference settings
- application/build version
- Docker image digest
- system-prompt, guardrail, case-definition, and context hashes
- server-measured tutor latency
- fallback use and type
- verified initial/final task state
- ratings and comments
- critical failures and supporting evidence
- integrity checks
- final non-compensatory outcome and reasons
- linked defects

## Reflections
When a student explains an observation, interprets documentation, forms a hypothesis, or predicts an outcome, store the answer as `tutor_query` and optionally classify it as `student_reflection` using transparent deterministic or faculty-reviewed rules.

For this capability study, evaluate whether the tutor appropriately elicits observation, interpretation, hypothesis, prediction, testing, and explanation. Do not claim that these events prove student learning.

# Part V: Guardrails and Security

## Prompt-injection boundary
Treat terminal output, filenames, file contents, man-page text, and student text as untrusted data. Delimit evidence explicitly. Terminal content must never override system policy, disclose hidden information, disable guardrails, authorize shell execution, or alter task boundaries.

## Input and output guardrails
For every tutor exchange:

1. Run input safety/policy evaluation.
2. Build bounded context.
3. Invoke the tutor model.
4. Remove any private `<think>...</think>` content before parsing or release.
5. Run output disclosure/policy evaluation.
6. Release, replace, or block the response.
7. Record every decision and latency.

Test malformed guard responses, timeout, unavailable model, refusal, markdown-formatted labels, prompt injection, and prohibited answer disclosure. During formal capability collection, fail closed rather than silently using a hosted provider, rule-based tutor, or host-shell fallback.

## Authentication/API requirements
Minimally verify and repair:

- no literal default password such as `password`
- salted scrypt, Argon2id, or bcrypt password storage
- faculty endpoint authentication and role authorization
- bounded login rate limiting
- session expiration and revocation
- authenticated WebSocket `/pty`
- configured production CORS allowlist
- request schema and body-size validation
- production error sanitization
- exports free of passwords, hashes, provider keys, tokens, and unrestricted secrets

Do not replace working authentication architecture if a narrow fix is sufficient.

# Part VI: Docker and Ollama

## Docker sandbox
Verify on the real Ubuntu server:

- fixed allowlisted image `linux-tutor-sandbox:latest`
- recorded image digest
- fresh container per execution
- non-root interactive user where compatible
- `Privileged: false`
- no host bind mounts
- no Docker socket inside task containers
- no host PID, IPC, or network namespace
- all capabilities dropped by default
- only narrowly justified Task 7 capabilities
- memory, CPU, PID, session-time, and output limits
- external networking disabled unless a task specifically requires it
- unique labels and names that cannot collide with Open WebUI, HashForge, or unrelated workloads
- cleanup on normal exit, disconnect, failure, timeout, and restart
- no broad `docker prune`
- host-shell fallback disabled for formal collection

Create or retain a smoke test running all eight tasks twice in fresh containers. Report real Docker verification separately from mocks or temporary-directory fixtures.

## Local Ollama

- Use the live endpoint discovered on the Ubuntu server.
- Default to `http://127.0.0.1:11434`; do not change to port 2004 unless intentionally configured.
- Record exact tutor and guard model digests from the live Ollama API.
- Never use `nomic-embed-text` as tutor or guard.
- Prefer `llama-guard3:1b` as dedicated guard if available.
- If a general model such as `llama3.1:8b` is used as prompted classifier, label it accurately and do not claim equivalence to Llama Guard.
- Preload models only as an operational optimization, not as a requirement for correctness.

# Part VII: Simple Pre-Collection Procedure

## No freeze dashboard
Do not add a Freeze & Lock UI. Implement a reproducible **Start New Data Collection** CLI procedure.

Provide:

```bash
npm run study:backup
npm run study:reset
npm run study:verify
```

The workflow must:

1. Require the application to be stopped or placed in maintenance mode.
2. Create a timestamped backup of existing study data.
3. Generate SHA-256 checksums.
4. Preserve users, cases, ground truth, rubrics, and configuration.
5. Clear only generated development records after typed confirmation `START NEW COLLECTION`.
6. Create a new run ID.
7. Record collection label and description.
8. Record application version, Git commit if available, build time, Node version, Docker image and digest, tutor/guard names and digests, Ollama endpoint, inference settings, and hashes of system prompt, guard configuration, and case definitions.
9. Classify new records as `FORMAL_CAPABILITY`.
10. Generate read-only `collection_manifest.json` and `SHA256SUMS.txt`.
11. Never silently delete prior records.

Use only:

- `DEVELOPMENT_TEST`
- `FORMAL_CAPABILITY`

Add `CAPABILITY_PILOT` only if explicitly required by the paper. Formal exports and analysis exclude development records by default.

# Part VIII: Confirmed Source Areas to Recheck

## Dependencies and lockfile
The previously reviewed archive had `package.json` and `package-lock.json` drift. Recheck the reverted source.

- Use npm consistently.
- Pin `@google/genai` and other production dependencies to explicit compatible versions rather than `*`.
- Add a supported Node engine, preferably Node 20 LTS if dependencies permit.
- Regenerate the lockfile only after finalizing the manifest.
- Prove that clean `npm ci` succeeds.
- Do not upgrade unrelated dependencies without need.

## Non-compensatory outcome rule
A case passes only if:

- no critical failure occurs
- every applicable dimension is at least 3
- Technical Correctness is at least 4 when applicable
- Guardrail Compliance is at least 4 when applicable
- every mandatory integrity check passes

Never allow an average or total to compensate for a failed threshold. Preserve original ratings when a critical failure forces failure.

## Ground truth and inventory
Recount the reverted source. The earlier archive appeared to include eight tasks, 24 visible cases, 30 ground-truth records, and six sequestered cases, but do not assume those counts remain correct.

Verify that each technically evaluable case links to ground truth, expected/prohibited behavior, applicable dimensions, N/A reasons, preconditions, verification commands, required evidence, and high-risk classification. Do not expose sequestered answer content to ordinary clients.

## Analysis script
Verify that `scripts/analyze_study_results.py`:

- reads the actual export schema
- excludes development data by default
- uses the same non-compensatory rule as the server
- reports dimensions, critical failures, and integrity failures separately
- reports missing data rather than silently dropping it
- treats automated CEW scoring as experimental/non-decisional
- does not describe task completion as student learning
- emits machine-readable results and paper-ready tables

Add deterministic fixtures with known expected results.

# Part IX: Required Tests

## Build and configuration
Run with actual exit codes:

```bash
npm ci
npm run lint
npm run build
npm test
```

Do not hard-code a test count in documentation. Report the final executable count.

## Socratic behavior tests
Prove that:

1. After plain `ls`, the first response prompts reasoning/documentation and does not reveal `ls -a` or the hidden filename.
2. After `man ls`, the tutor acknowledges the observed action and asks for interpretation.
3. After a plausible interpretation, the tutor asks for a prediction and terminal test.
4. Repeated unsuccessful attempts cause controlled escalation without revealing a flag, secret, hidden filename, or full solution.
5. Responses remain concise and normally include one question and at most one bounded action.
6. The verifier, not the model, determines completion.

## History and retrieval tests
Prove that:

1. Commands and outputs are ordered and linked within one execution.
2. Other users, tasks, repetitions, and runs cannot contaminate context.
3. `ask-ai I cannot find the file` is a tutor query and never executes in Bash.
4. Relevant `ls` output is retrieved while unrelated old output is excluded.
5. `man ls` creates a documentation event without uncontrolled screen redraw context.
6. Context limits and truncation records are correct.
7. Flags, hidden answers, credentials, tokens, and faculty ground truth are absent from context and ordinary exports.
8. Terminal prompt injection cannot change policy.
9. The tutor cannot autonomously inspect files or execute commands.
10. An execution can be reconstructed from exports in original order.
11. Development records are excluded from formal retrieval and analysis.
12. The tutor is not called after every ordinary command.

## UI tests
Prove that:

1. All eight tasks have visible task statements and success evidence.
2. Task selection updates instructions, sandbox/session, and tutor task context together.
3. Instructions, terminal, and Guided AI interaction are available on one desktop screen.
4. The separate Progressive Hints interface is absent.
5. Tutor questions and responses remain in the terminal workspace.
6. Faculty controls are unavailable to student roles.
7. Telemetry remains complete after UI simplification.
8. The production build retains the polished dark style and loads CSS.
9. There is no page-level horizontal overflow at 1280, 1440, and 1920 pixel widths.
10. At narrower widths, instructions remain first and the terminal remains usable.

## Security, sandbox, and AI tests
Include deterministic tests for authentication, authorization, session expiry/revocation, WebSocket auth, CORS, export secret scanning, fixed Docker image/options, no privilege/host mounts, Task 7 exception, resource limits, cleanup, no formal host fallback, model digest capture, raw/released distinction, guard failure behavior, and prohibited provider fallback.

Mocks are acceptable for automated tests, but must not be described as real Docker or live Ollama verification.

# Part X: Collection-Readiness Command

Create:

```bash
npm run verify:collection-ready
```

Generate:

- `reports/collection_readiness.json`
- `COLLECTION_READINESS_REPORT.md`

Report PASS, FAIL, or NOT VERIFIED for:

- clean install
- type check
- production build
- automated tests
- CSS asset and production UI check
- data-schema and reconstruction test
- formal export test
- deterministic analysis fixture
- real Docker eight-task/two-repetition smoke test
- live Ollama tutor and guard connectivity
- exact model digests
- Docker image digest
- host-shell fallback disabled
- hosted/rule fallback disabled
- writable data/backup directories
- collection manifest and checksums

Any mandatory NOT VERIFIED result means the application is not ready for formal collection.

# Part XI: Future API Boundary Without Implementation

Keep terminal capture, context construction, Socratic policy, guardrails, model invocation, and telemetry behind a stable internal service boundary. The current web interface is the only required client.

Design internals so a future authenticated CLI could call:

```text
POST /api/v1/tutor/query
```

Do not expose that endpoint publicly or build the CLI now. A future client should authenticate to the institution-controlled tutor service with short-lived, scoped credentials. Never distribute Gemini, OpenAI, Anthropic, or Ollama administrative credentials to students. The server must enforce scope, model access, guardrails, logging, rate limits, and revocation. AI-generated commands must never execute automatically.

# Part XII: Documentation and Final Deliverables

Create or update only:

1. `LOCAL_SETUP_GUIDE.md`
2. `DATA_COLLECTION_START_GUIDE.md`
3. `DATA_DICTIONARY.md`
4. `COLLECTION_READINESS_REPORT.md`
5. `.env.example`
6. `CHANGELOG_PRE_COLLECTION.md`
7. `STUDENT_WORKSPACE_AND_SOCRATIC_TUTOR_DESIGN.md`

The start guide must explain how to finish development testing, stop the application, back up data, reset generated records, create the run/manifest, verify readiness, start collection, export after collection sessions, and create a final checksummed archive.

## Final response from Google AI Studio
Return:

1. Confirmed problems in the reverted source.
2. Exact files changed and why.
3. Frontend files changed and screenshots of the production build at 1440 x 900.
4. Confirmation that the polished theme, sidebar, and faculty tools were preserved.
5. Explanation of the terminal-integrated tutor implementation.
6. Explanation of command capture, evidence retrieval, context limits, and data isolation.
7. Actual exit status and output summary for clean install, lint, build, tests, and collection-readiness verification.
8. Mock results clearly separated from real Docker/Ollama results.
9. Data fields captured and remaining gaps.
10. Exact Ubuntu commands still required.
11. Final decision: `NOT READY` or `READY TO BEGIN FORMAL CAPABILITY DATA COLLECTION`.

## Acceptance criteria
Do not declare ready unless:

- clean `npm ci`, type check, build, and automated tests pass
- production CSS loads and the polished interface remains intact
- every task clearly explains task, goal, success evidence, and constraints
- the student can work and ask Guided AI without leaving the terminal workspace
- `ask-ai` cannot execute in Bash
- commands/outputs are captured and task-scoped
- tutor context is bounded, relevant, hashed, and free of hidden answers/secrets
- Socratic behavior tests pass
- formal exports exclude development records by default
- one execution can be reconstructed end to end
- analysis fixtures produce expected results
- real Docker tests pass for all eight tasks twice
- live Ollama tutor/guard checks pass and exact digests are recorded
- host-shell and hosted/rule fallbacks are disabled for collection
- collection manifest and checksums are created
- no unresolved Critical or High defect remains

## Required Ubuntu command sequence
Document and validate the final project equivalents of:

```bash
npm ci
npm run lint
npm run build
npm test
docker build -t linux-tutor-sandbox:latest -f Dockerfile.sandbox .
npm run test:sandbox-smoke
npm run study:backup
npm run study:reset
npm run study:verify
npm run verify:collection-ready
npm start
```

Use `OLLAMA_BASE_URL=http://127.0.0.1:11434` unless live verification identifies a different intentional configuration.
