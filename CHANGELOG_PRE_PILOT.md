# Pre-Pilot Remediation Changelog (Protocol V5.0.0)

## Verification Status Legend
- **`[IMPLEMENTED_IN_SOURCE]`**: Implemented in production TypeScript/React codebase.
- **`[AUTOMATED_TEST_VERIFIED]`**: Covered by automated test suite (`tests/research.test.ts`).
- **`[VERIFIED_WITH_MOCK_SERVICES]`**: Verified in automated tests using deterministic mock adapters or temporary filesystem fixtures.
- **`[NOT_YET_VERIFIED_REAL_INFRA]`**: Requires execution on the local Ubuntu research VM (`student@llm`) with live Docker daemon (`/var/run/docker.sock`) and local Ollama GPU service (`http://localhost:2004`).

---

## Summary of Remediations

### 1. Build, Dependency & Lockfile Integrity (`REQ-BUILD-01`, `REQ-BUILD-02`)
- **Status**: `[IMPLEMENTED_IN_SOURCE]`, `[AUTOMATED_TEST_VERIFIED]`
- **Changes**:
  - Replaced wildcard `"*"` version on `@google/genai` with exact pinned version `"1.50.1"` and pinned all dependencies/devDependencies in `package.json`.
  - Added `"engines": { "node": ">=20.0.0" }` to `package.json`.
  - Regenerated `package-lock.json` so `npm ci --dry-run` passes with zero missing or mismatched packages.
  - Added practitioner verification scripts: `verify:clean-install`, `test:unit`, `test:integration`, `test:research-protocol`, `test:security`, `test:sandbox-smoke`, and `verify:prepilot`.

### 2. Research Freeze & Lock State Machine (`REQ-FREEZE-01` .. `REQ-FREEZE-04`)
- **Status**: `[IMPLEMENTED_IN_SOURCE]`, `[AUTOMATED_TEST_VERIFIED]`
- **Changes**:
  - Created `server/researchGovernance.ts` implementing the 11-state freeze workflow (`DRAFT` -> `PILOT_READY` -> `PILOT_ACTIVE` -> `PILOT_CLOSED` -> `FORMAL_READY` -> `FORMAL_LOCKED` -> `FORMAL_CLOSED` -> `REFINEMENT_ACTIVE` -> `REGRESSION_LOCKED` -> `SEQUESTERED_LOCKED` -> `ARCHIVED`).
  - Implemented the 23-point preflight checker (`runFreezePreflight`) covering study config, Docker/sandbox readiness, Ollama model config, prompt guardrail audits, and git/lockfile SHA-256 digests.
  - Implemented deterministic canonical JSON freeze manifests (`buildCanonicalFreezeManifest`) and `SHA256SUMS.txt` generation (`generateSha256SumsTxt`) over 15 frozen study artifacts.
  - Enforced server-side immutability (`FROZEN_PHASE_IMMUTABLE`, HTTP `409`) in `server/db.ts` and `server.ts` on `/api/config`, `/api/test-cases`, and `/api/ground-truth/:taskId` whenever a locked state is active.
  - Implemented mandatory Protocol Deviation logging (`POST /api/governance/unlock`) requiring investigator role, reason, affected artifacts, and version bump.
  - Added the **Research Freeze & Lock Workflow** control panel and 23-point preflight modal to `components/ResearchDashboard.tsx`.

### 3. Two-Stage Research Lifecycle & Terminology Separation (`REQ-MODE-01` .. `REQ-MODE-03`, `REQ-TELEM-01`)
- **Status**: `[IMPLEMENTED_IN_SOURCE]`, `[AUTOMATED_TEST_VERIFIED]`
- **Changes**:
  - Enforced explicit separation between `capability_evaluation` (`unitOfAnalysis: 'test_case_run'`) and `student_pilot` (`unitOfAnalysis: 'participant_task_session'`).
  - Standardized the 7 canonical `data_classification` tags (`DEVELOPMENT_TEST`, `CAPABILITY_PILOT`, `FORMAL_CAPABILITY_ROUND_1`, `CAPABILITY_REFINEMENT`, `CAPABILITY_REGRESSION`, `CAPABILITY_SEQUESTERED`, `STUDENT_PILOT`) and explicit pilot exclusion policy (`PILOT_DATA_EXCLUSION_POLICY_TEXT`).
  - Separated `verified_task_state` (`verified_complete` | `not_yet_verified` | `verification_failed`) from `participant_task_outcome` (`completed_verified` | `in_progress_unverified` | `abandoned` | `not_applicable_scripted_case`) in `types.ts`, `server.ts`, and `server/exportService.ts`.
  - Renamed experimental composite score to `automated_cew_score_experimental` and verified it has zero influence on `casePass` or `applicableMean`.

### 4. Security, Authentication & Docker Sandbox Isolation (`REQ-SEC-01` .. `REQ-SEC-03`, `REQ-SANDBOX-01`)
- **Status**: `[IMPLEMENTED_IN_SOURCE]`, `[AUTOMATED_TEST_VERIFIED]`, `[VERIFIED_WITH_MOCK_SERVICES]`, `[NOT_YET_VERIFIED_REAL_INFRA]` (real Docker daemon smoke test pending Ubuntu VM run)
- **Changes**:
  - Removed default `'password'` fallback from `POST /api/users`; passwords `< 8` characters are rejected with HTTP `400`.
  - Added server-side session token revocation (`POST /api/auth/logout`).
  - Added `ALLOWED_ORIGINS` CORS enforcement, HTTP security headers (`securityHeadersMiddleware`), `512kb` JSON body limit, schema validation (`validatePayloadSchema`), and production error sanitization (`sanitizeProductionError`).
  - Added WebSocket `/pty` bearer token validation (`verifyWebSocketAuthorization`), 30-minute idle timeout, and 64KB chunk bounds.
  - Added `buildSafeContainerCreateOptions` in `server/sandboxProvider.ts` enforcing allowlisted image (`linux-tutor-sandbox:latest`), non-root user (`1000:1000`), `Privileged: false`, `Binds: []`, `NetworkMode: 'none'`, `CapDrop: ['ALL']` (with minimal `SETUID`/`SETGID`/`AUDIT_WRITE` for Task 7 sudo), and `org.guidedai.*` container labels.
  - Explicitly separated `verifiedWithRealDocker: true` from `host_tempdir_fixture` in `runTaskSmokeTest` so host tempdir tests never claim real Docker verification.
