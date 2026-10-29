# Phase 1 — Current vs. Remediated System Architecture

## 1. Pre-Remediation Architecture Issues (Verified from Repository)
1. **Frontend Split-Brain (`App.tsx`, `components/Terminal.tsx`, `components/XTermTerminal.tsx`, `services/aiService.ts`)**:
   - When `useRealShell === false` (default), `App.tsx` rendered `components/Terminal.tsx`, which invoked `services/aiService.ts` in the browser to simulate bash output via an LLM and answer `[AI TUTOR]` questions without calling `/api/ai/chat`.
   - When `useRealShell === true`, `App.tsx` rendered `components/XTermTerminal.tsx` (connected to `/pty`), which unmounted `components/Terminal.tsx` and hid the AI Tutor input and Hint controls.
2. **Test Runner Bypass (`server/testRunner.ts:270-430`)**:
   - `TestRunnerService.executeTestCase` used synchronous `GuardrailEngine.checkInput` and hardcoded `if/else` strings (`lines 335-354`) rather than calling the live model and semantic guardrail pipeline.
3. **Sandbox Provisioning (`server.ts:93-139`)**:
   - `/pty` ran an inline `setupScript` inside `ubuntu:24.04` as UID `1000:1000` (`cadet`) with `CapDrop: ['ALL']` and `no-new-privileges:true`, causing Task 3 (`export` in subshell), Task 4 (`mkdir /var/logs` permission denied), Task 5 (missing local service on port 8080), Task 7 (`/root/flag.txt` permission denied and `sudo` blocked), and Task 8 (path mismatch + `aiDisabled: true`) to fail.
4. **Storage & Security (`server/db.ts`, `server.ts`)**:
   - State was persisted only to a flat JSON file (`data/research_lab.json`) rewritten on every event, and administrative routes lacked centralized `requireAdmin` / `requireResearcher` middleware.

## 2. Remediated Target Architecture (Version 5 Compliant)
1. **Explicit Deployment Profiles (`server/sandboxProvider.ts`)**:
   - `local_research`: Requires verified Docker/sandbox capability, SQLite durable storage, and live model/guardrail connectivity. Supports all 8 tasks with automated smoke tests (`verifyAllTasksSmokeTest()`).
   - `cloud_demo`: Active when running inside a hosted Cloud Run container without Docker daemon access (`DOCKER_AVAILABLE=false`). Displays a persistent **`NOT VALID FOR FORMAL DATA COLLECTION (CLOUD DEMO PROFILE)`** banner in the UI and rejects creation or locking of `pilot`, `formal_round_1`, `refinement`, or `regression` runs (`HTTP 403 CONFIGURATION_ERROR`).
2. **Single Authoritative `TutorOrchestrator` (`server/tutorOrchestrator.ts`)**:
   - Shared by both `POST /api/ai/chat` (interactive UI) and `TestRunnerService` (24 standardized cases + 5×3 consistency suite).
   - Enforces:
     1. Deterministic Input Policy (`GuardrailEngine.checkInput`)
     2. Semantic Input Policy (`GuardrailEngine.checkInputSemantic` via Llama Guard 3)
     3. Bounded, untrusted terminal evidence injection from the active session's real terminal buffer
     4. Live Tutor Generation (`generateAITutorResponse` on server using `GEMINI_API_KEY` or configured local Ollama model)
     5. Deterministic Output Policy (`GuardrailEngine.checkOutput`)
     6. Semantic Output Policy (`GuardrailEngine.checkOutputSemantic`)
     7. Append-only telemetry & protected raw/released output persistence.
3. **Unified Real Terminal + Guided AI Sidebar (`App.tsx`, `components/XTermTerminal.tsx`, `components/GuidedTutorSidebar.tsx`)**:
   - The main workspace always displays the real terminal (`XTermTerminal.tsx`) alongside `GuidedTutorSidebar.tsx`.
   - Tutor questions go exclusively to `POST /api/ai/chat`.
   - Hint requests go exclusively to `POST /api/hints/request`.
   - Browser-side `GoogleGenAI` / `OpenAI` calls and LLM shell simulation are completely removed from `services/aiService.ts`.
4. **Durable SQLite + Append-Only Event Stream (`server/db.ts`)**:
   - Uses `sqlite3` (`data/research_lab.sqlite`) with transactional append-only `telemetry_events` storage alongside synchronized state tables, preserving Round 1 records immutably and linking regression runs via `regressionLinkId`.
