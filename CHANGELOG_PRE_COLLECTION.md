# Pre-Collection Remediation Changelog (Protocol V5.0.0)

## Summary of Pre-Collection Changes

1. **Student Workspace Redesign (`App.tsx`, `components/XTermTerminal.tsx`, `components/Terminal.tsx`)**
   - Preserved the existing dark navy/slate theme, left navigation sidebar, faculty evaluation modals, and bottom flag/CEW submission bar.
   - Added a compact full-width **Task Instructions** card (`data-testid="task-instructions-card"`) above the terminal displaying:
     - **Your task** (`studentTask`)
     - **Goal** (`goal`)
     - **Context** (`context`)
     - **Success evidence** (`successEvidence`)
     - **How to work** (`howToWork`)
     - **Constraints** (`constraints`)
   - Made the terminal the full-width primary work area below the Task Instructions card.
   - Removed the separate right-hand `GuidedTutorSidebar` and student-facing `Progressive Hint (L1)` button from the student workspace while keeping progressive scaffolding as an internal recorded tutor policy.
   - Added one unified terminal-integrated Guided AI interaction path supporting `ask-ai "<question>"` directly in the shell (intercepted before Bash execution) and via a compact single-line `ask-ai` bar embedded in the terminal footer.
   - Enforced session and context reset when switching tasks (`sessionNonce` increment + `/api/tasks/reset`).

2. **Non-Disclosing Canonical Task Instructions (`constants.ts`, `server/serverTasks.ts`)**
   - Populated `studentTask`, `goal`, `context`, `successEvidence`, `howToWork`, and `constraints` across all 8 tasks.
   - Verified zero disclosure of flags, hidden filenames (`.hidden_flag`, `.secret_config`), or complete copy-paste solution commands.

3. **Evidence-Grounded Socratic Tutor Engine (`server/socraticTutorEngine.ts`, `server/tutorOrchestrator.ts`)**
   - Implemented the 7 internal recorded Socratic guidance states (`orientation_probe`, `conceptual_probe`, `documentation_probe`, `reflection_probe`, `prediction_probe`, `procedural_probe`, `bounded_next_step`).
   - Enforced concise response structure (1 evidence-grounded acknowledgement, 1 focused Socratic question, and at most 1 optional bounded next action).
   - Generalized evidence-first probing across all 8 tasks (`ls` -> `documentation_probe`; `man ls` -> `reflection_probe` acknowledging `man ls`; student hypothesis -> `prediction_probe`; repeated errors -> `bounded_next_step`).

4. **Session-Aware Command History & Curated Context Snapshot (`server/socraticTutorEngine.ts`, `server/sandboxProvider.ts`, `server.ts`)**
   - Implemented `buildCuratedContextSnapshot` with strict `(runId, executionId, taskId, sessionId)` isolation and bounded budgets (20 commands, 8 KiB output, 5 tutor exchanges, 2 KiB earlier summary).
   - Added full-screen documentation command detection (`man`, `less`, `info`, `--help`) emitting `documentation_view` events without polluting tutor context with raw terminal redraw control sequences.
   - Intercepted `ask-ai` in both WebSocket `/pty` and `recordShellCommand` so `ask-ai` never executes in Bash or records as `shell_command`.

5. **17-Event Append-Only Research Model (`server/db.ts`, `types.ts`)**
   - Added automatic `payload` and `payloadSha256` computation and monotonic `(executionId, sequenceNumber)` numbering across all 17 canonical event types.

6. **Local Ollama Defaults, Model Role Validation & Study CLI (`server/protocolV5.ts`, `scripts/study_cli.ts`, `package.json`)**
   - Standardized `DEFAULT_OLLAMA_URL` to `http://127.0.0.1:11434`.
   - Added `validateOllamaModelRole` to block `nomic-embed-text` from being used as a tutor or guard model and accurately label `llama3.1:8b` as `prompted_classifier`.
   - Added `npm run study:backup`, `npm run study:reset`, `npm run study:verify`, `npm run test:sandbox-smoke`, and `npm run verify:collection-ready`.
   - Pinned `@google/genai` to `^1.50.1` and added `"engines": { "node": ">=20.0.0" }`.
