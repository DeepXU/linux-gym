# Pre-Pilot Verification & Readiness Report (`PRE_PILOT_TEST_REPORT.md`)

- **Generated At:** `2026-10-28T18:28:10.827Z`
- **Overall Readiness Decision:** **`NOT READY`**
- **Decision Rationale:** Per governing pre-pilot rules, any skipped or unverified real-environment check (real Docker daemon or live local Ollama daemon unavailable in the AI Studio container) forces overall readiness to NOT READY until executed on the target Ubuntu VM.

## Step-by-Step Verification Matrix

| Step ID | Check Name | Command | Status | Verification Scope | Duration (ms) | Evidence Path | Details |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `STEP-01-CLEAN-INSTALL` | Clean Lockfile & Manifest Synchronization (npm ci --dry-run) | `npm ci --dry-run` | **PASS** | `automated_test_verified` | 2592 | `package-lock.json` | remove string_decoder 1.3.0 / remove safe-buffer 5.2.1 /  / added 108 packages, removed 22 packages, and changed 8 packages in 2s /  / 64 packages are looking for funding /   run `npm fund` for details |
| `STEP-02-TYPECHECK` | TypeScript Strict Validation (npm run lint) | `npm run lint` | **PASS** | `automated_test_verified` | 14100 | `tsconfig.json` | > linux-ctf-academy@1.0.0 lint / > tsc --noEmit |
| `STEP-03-BUILD` | Production Frontend & Server Bundle Build (npm run build) | `npm run build` | **PASS** | `automated_test_verified` | 7509 | `dist/server.cjs` | ✓ 1429 modules transformed. / rendering chunks... / computing gzip size... / dist/index.html                     1.87 kB │ gzip:   0.84 kB / dist/assets/index-6GBZ9nXN.css      5.24 kB │ gzip:   1.92 kB / dist/assets/index-DNCwMMIv.js   1,189.56 kB │ gzip: 284.23 kB / ✓ built in 6.37s |
| `STEP-04-AUTOMATED-TESTS` | Executable Test Suite: Outcome Rule, Freeze Workflow, Mode Separation, RBAC & Telemetry (npm test) | `npm test` | **PASS** | `verified_with_mock_services` | 22528 | `tests/research.test.ts` | # suites 1 / # pass 44 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0 / # duration_ms 21950.186092 |
| `STEP-05-REAL-DOCKER-SANDBOX` | Real Docker Daemon & 8-Task x 2 Isolated Container Smoke Test | `npm run test:sandbox-smoke` | **SKIP** | `not_yet_verified` | 393 | `Dockerfile.sandbox` | 16/16 task provisioning scripts passed in host tempdir fixture mock, but real Docker daemon (/var/run/docker.sock) is not available in this environment. Must be executed on the Ubuntu VM. |
| `STEP-06-REAL-OLLAMA-MODELS` | Real Local Ollama Endpoint & Pinned Tutor/Guard Model Digest Verification | `curl -s http://localhost:2004/api/tags || ollama list` | **PASS** | `verified_with_real_ollama` | 28 | `server/runtimeDigests.ts` | Resolved live Ollama digests: tutor=sha256:b46d3062d347d54cd6a5d42b58fd07e6be384ffd88fb736c48db4d0dc42871b4, guard=sha256:33056b47340f773e165c30be38e066c19d122146bcb4f5246463dde02a11f782 |
| `STEP-07-FREEZE-PREFLIGHT` | Server-Authoritative 23-Point Freeze Preflight Gate | `POST /api/governance/preflight` | **SKIP** | `not_yet_verified` | 350 | `server/researchGovernance.ts` | 21/23 checks passed; remaining checks require live Docker & Ollama on the Ubuntu host (docker_available, sandbox_smoke_test_all_eight_tasks). |

## Verification Classification Legend
- **`automated_test_verified`**: Verified by deterministic compiler, lockfile, or code-level executable test.
- **`verified_with_mock_services`**: Verified using deterministic test doubles for Ollama/Docker in `tests/research.test.ts`.
- **`verified_with_real_docker`**: Verified against a live Docker daemon (`/var/run/docker.sock`) and `linux-tutor-sandbox:latest`.
- **`verified_with_real_ollama`**: Verified against a live local Ollama server with resolved SHA-256 model digests.
- **`not_yet_verified`**: Requires execution on the researcher's Ubuntu VM (`student@llm`) where Docker and Ollama run.
