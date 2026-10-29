# Patch Notes — Guided AI Linux Tutor Research Harness (Protocol V5.0.0)

## Summary of Changes

1. **Tutor Prompt Secret & Solution Isolation (`server/tutorOrchestrator.ts`)**
   - Removed `task.flag`, `task.prohibitedDisclosures`, `task.acceptableAlternativePaths` (solution-command lists), and `task.expectedEvidence` from `TutorOrchestrator.buildSystemPrompt`.
   - Added deterministic scrubbing so that neither the secret flag nor any prohibited solution command is ever interpolated into the model prompt.
   - Exact flag and complete-solution checks remain enforced in `GuardrailEngine.checkOutput` and `GuardrailEngine.checkOutputSemantic`.

2. **Container Task Provisioning & Exit Code Verification (`server.ts`, `server/sandboxProvider.ts`)**
   - Added `set -e` to `SandboxProvider.buildRootProvisioningScript(taskId)` so any provisioning failure returns a non-zero exit code immediately.
   - Updated the `/pty` WebSocket handler in `server.ts` to await full completion of the root provisioning `exec` stream and inspect `exec.inspect().ExitCode === 0` **before** attaching the learner's interactive shell.
   - Removed the `/home/cadet` `tmpfs` mount override in `server.ts` so files and permissions provisioned in `/home/cadet` persist cleanly for the learner session.

3. **Sandbox Docker Image (`Dockerfile.sandbox`, `.env.example`, `server.ts`, `server/sandboxProvider.ts`)**
   - Added `Dockerfile.sandbox` based on `ubuntu:24.04` with `sudo` installed and the default UID 1000 user renamed to `cadet` (`/home/cadet`).
   - Configured `/home/cadet` permissions (`0:1000`, mode `0775`) so root provisioning (`0:0`) and learner execution (`cadet`, `1000:1000`) both work cleanly under capability restrictions.
   - Updated the default sandbox image to `linux-tutor-sandbox:latest` across `server.ts`, `server/sandboxProvider.ts`, `server/runtimeDigests.ts`, and `.env.example`.

4. **Task 7 (`sudo`) Container Permissions (`server/sandboxProvider.ts`, `server.ts`)**
   - Added `SandboxProvider.getContainerSecurityConfig(taskId)` to grant Task 7 (`taskId === 7`) the capabilities required for `sudo` (`SETUID`, `SETGID`, `AUDIT_WRITE`, `DAC_OVERRIDE`, `CHOWN`) and omit `no-new-privileges:true` while allowing `/run` sudo timestamp files.
   - All other tasks (Tasks 1–6 and 8) retain strict `CapDrop: ['ALL']` and `SecurityOpt: ['no-new-privileges:true']`.

5. **Ollama Default Port 2004 (`server/protocolV5.ts`, `server/db.ts`, `server/tutorOrchestrator.ts`, `.env.example`, `App.tsx`, `services/aiService.ts`)**
   - Standardized `DEFAULT_OLLAMA_URL` to `http://localhost:2004` across `server/protocolV5.ts`, `server/db.ts`, `server/tutorOrchestrator.ts`, `server/runtimeDigests.ts`, `services/aiService.ts`, `App.tsx`, and `.env.example` (while `callOllamaChat` continues to support fallback probing between ports `2004` and `11434`).
   - Verified default provider is strictly `ollama` (`qwen2.5-coder:7b` with `llama-guard3:1b`).

6. **Workspace & Database Cleanup (`data/research_lab.json`, `data/telemetry_events_append_only.jsonl`)**
   - Removed stray run artifacts, temporary files, and old export ZIPs from the repository root.
   - Reset `data/research_lab.json` and `data/telemetry_events_append_only.jsonl` to a clean baseline with default accounts (`admin`, `faculty_reviewer`, `demo_cadet` with salted `scrypt` password hashes), the 8 canonical tasks, and the 24 Protocol V5 test cases.
   - Added post-test cleanup in `tests/research.test.ts` so running `npm test` does not leave synthetic test runs or telemetry pollution in `data/research_lab.json`.

---

## Pre-Research Verification Commands

Run the following before starting any formal or pilot research session:

```bash
npm install
npm run lint && npm run build && npm test
docker build -t linux-tutor-sandbox:latest -f Dockerfile.sandbox .
```

Then start the application with `LLM_PROVIDER=ollama`, open each of the 8 tasks, and check `/api/health` to confirm `deploymentProfile: "local_research"` and `dockerAvailable: true`.
