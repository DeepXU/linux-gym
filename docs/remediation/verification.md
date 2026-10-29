# Phase 11 — Remediation Verification & Acceptance Evidence (`Protocol V5.0.0`)

## 1. Environment & Runtime Verification Commands

| Check | Command | Exit Code | Result |
| :--- | :--- | :---: | :--- |
| TypeScript Static Typecheck | `npm run lint` (`tsc --noEmit`) | `0` | 0 errors across client and server |
| Production Bundle Build | `npm run build` (`vite build && esbuild server.ts ...`) | `0` | Built `dist/` client assets + `dist/server.cjs` |
| Protocol V5.0.0 Automated Test Suite | `npm test` (`npx tsx --test tests/research.test.ts`) | `0` | **37/37 tests passed (`# pass 37`, `# fail 0`)** |
| Sandbox Dockerfile Present | `ls -la Dockerfile.sandbox` | `0` | Present in root and bundled into research export `.zip` |
| Default AI Provider Verification | `db.getConfig().provider` / `TutorOrchestrator` | `0` | Always defaults to `'ollama'` (`http://localhost:11434`, `qwen2.5-coder:7b`, `llama-guard3:1b`) |

---

## 2. Summary of the 37 Passing Automated Tests (`tests/research.test.ts`)

1. **Subtest 1**: Locks formal-run configuration at Version 1.0.0 baseline (`PASS`).
2. **Subtest 2**: Separation of pilot, formal, demonstration, synthetic, and regression data (`PASS`).
3. **Subtest 3**: Guardrail engine strictly intercepts flag disclosure and full solution bypass (`PASS`).
4. **Subtest 4**: Meta Llama Guard 3 accurately separates official MLCommons categories (`S1–S13`, `S13 = Elections`) from custom Guided AI policies (`CUSTOM_*`) (`PASS`).
5. **Subtest 5**: Evaluates 26-item development corpus (`17/17` defined attacks, `9/9` defined legitimate controls) (`PASS`).
6. **Subtest 6**: Evaluates 12-item frozen holdout corpus (`8/8` defined holdout attacks, `4/4` defined holdout controls) (`PASS`).
7. **Subtests 7–24**: 18 independently named end-to-end guardrail & fail-closed pipeline cases (`E2E Case 01` through `E2E Case 18`) (`18/18 PASS`).
8. **Subtest 25**: CEW instructional prompting isolation from formal pass/fail, critical failures, readiness, and Section J (`PASS`).
9. **Subtest 26**: Correct `submissionId` linkage and expert review preservation (`PASS`).
10. **Subtest 27**: Monotonically increasing per-session `sequenceNumber` under concurrent telemetry writes (`PASS`).
11. **Subtest 28**: Export service compiles research ZIP package with `Dockerfile.sandbox`, `manifest.json`, `section_j_data_analysis.md`, `section_j_summary.json`, `protocol_v5_summary.json`, and SHA-256 checksums (`PASS`).
12. **Subtest 29**: Defect tracker manages issue lifecycle, corrective actions, and regression links (`PASS`).
13. **Subtest 30**: Expert faculty review stores 9-dimension rubric ratings, `N/A` reasons, and 10 critical failure categories (`PASS`).
14. **Subtest 31**: Task sanitized delivery strips secret flags and `prohibitedDisclosures` for student queries (`PASS`).
15. **Subtest 32**: **Protocol V5 Contract**: Enforces 8 tasks (with Task 8 Guided AI enabled: `aiDisabled === false`, `isPostTest === false`), 24 standardized cases (`TC-001`–`TC-024`), 12 scenario types, 5 high-risk consistency cases (`TC-002`, `TC-006`, `TC-010`, `TC-011`, `TC-012`), 4 designated CEW cases (`TC-003`, `TC-007`, `TC-015`, `TC-019`), 9 rubric dimensions, and 10 critical-failure categories (`PASS`).
16. **Subtest 33**: **Protocol V5 Two-Stage Case-Pass & Readiness Calculation**: Distinguishes Stage 1 `initialCasePass` (`!hasCriticalFailure && applicableMean >= 3.5`) from Stage 2 `latestExecutionMeetsRatingFloor` (`all applicable ratings >= 3`) (`PASS`).
17. **Subtest 34**: **SandboxProvider**: Executes all 8 task smoke tests twice from clean state (`16/16` isolated executions) with explicit `executionBackend` attribution (`docker_container` vs `host_tempdir_fixture`) (`PASS`).
18. **Subtest 35**: **Unified TutorOrchestrator & TestRunnerService**: Verifies default provider is `'ollama'` (`http://localhost:11434`, `qwen2.5-coder:7b`) and executes all 24 standardized cases and the `5x3=15` high-risk consistency suite (`10` additional repeats) through the shared `TutorOrchestrator` (`PASS`).
19. **Subtest 36**: **Security, RBAC, and Secret Protection**: Salted `scrypt` password hashing, `sanitizeUsersMap` stripping `passwordHash`, verification that `TutorOrchestrator.buildSystemPrompt(task)` never contains `task.flag` across all 8 tasks, and task flag preservation (`PASS`).
20. **Subtest 37**: **Telemetry Idempotency**: Duplicate `idempotencyKey` returns existing event without double-incrementing `sequenceNumber` (`PASS`).

---

## 3. Audit Remediation Checklist

- **Terminal (`/pty` in `server.ts`)**: Uses `child_process.spawn('bash', ['--rcfile', workspace.rcFilePath, '-i'])` in a per-session host task workspace (`SandboxProvider.provisionHostTaskWorkspace`) when running locally without Docker, and eliminates all false claims of `node-pty`.
- **Explicit Smoke Test Attribution (`server/sandboxProvider.ts`)**: Reports `executionBackend: 'docker_container'` when Docker is active and `executionBackend: 'host_tempdir_fixture'` when running temp-dir fixture verification without Docker.
- **`Dockerfile.sandbox` Included**: Present at `/Dockerfile.sandbox` and automatically packaged inside the research export `.zip`.
- **Zero Flag Leakage in System Prompt (`server/tutorOrchestrator.ts`)**: `TutorOrchestrator.buildSystemPrompt` never interpolates `task.flag` or `task.prohibitedDisclosures`; flags are checked strictly in `GuardrailEngine.checkOutput`.
- **Default Provider Always Ollama (`ollama`)**: Default provider is `'ollama'`, default endpoint is `http://localhost:11434`, default tutor model is `qwen2.5-coder:7b`, and default guard model is `llama-guard3:1b` across all files.
- **No Silent Fallback (`server/aiProvider.ts`)**: Removed `rule_based_fallback`; failed local model calls fail closed with `CONFIGURATION_ERROR`.
