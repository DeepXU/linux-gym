# Pre-Pilot Research Requirements Traceability Matrix (`PRE_PILOT_TRACEABILITY.md`)

**Study Title:** *Evaluating the Technical Accuracy and Pedagogical Quality of a Guided AI Tutor for Introductory Linux Tasks*  
**Governing Protocol:** `CSCI807_Week4_Guided_AI_Research_Proposal_V5.pdf` (`PROTOCOL_VERSION = V5.0.0`)  
**Audit Date:** 2026-10-28  

This traceability matrix compares every methodological, governance, security, Docker isolation, and reproducibility requirement from the governing proposal and pre-pilot remediation specification against the current source code and automated test suite.

---

## 1. Repository & Reproducible Build Requirements

| Req ID | Governing Source / Section | Relevant Source Files & Functions | Initial Status | Required / Implemented Change | Automated Test ID | Runtime Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-BUILD-01** | Pre-Pilot Spec §Known Repository Issue | `package.json`, `package-lock.json` | **Conflicting** (`package-lock.json` out of sync with `package.json`; `@google/genai` used wildcard `*`; `engines` missing) | Pin all dependencies to explicit compatible versions (`@google/genai: "1.50.1"`, etc.), add `"engines": { "node": ">=20.0.0" }`, regenerate synchronized `package-lock.json`, and verify `npm ci`. | `TEST-BUILD-01` | `npm ci --dry-run` & `npm run verify:clean-install` exit 0 |
| **REQ-BUILD-02** | Pre-Pilot Spec §Practitioner Pre-Pilot Workflow | `package.json`, `scripts/verify_prepilot.ts` | **Missing** | Add `verify:clean-install`, `test:unit`, `test:integration`, `test:research-protocol`, `test:security`, `test:sandbox-smoke`, and `verify:prepilot` scripts generating JSON + Markdown reports. | `TEST-BUILD-02` | `npm run verify:prepilot` generates `reports/pre_pilot_report.json` and `PRE_PILOT_TEST_REPORT.md` |

---

## 2. Non-Compensatory Case Outcome Rule

| Req ID | Governing Source / Section | Relevant Source Files & Functions | Initial Status | Required / Implemented Change | Automated Test ID | Runtime Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-RULE-01** | Proposal §2 / Pre-Pilot Spec §Non-Negotiable Case Outcome Rule | `server/protocolV5.ts` (`evaluateV5CaseOutcome`), `server/db.ts` (`saveExpertReview`) | **Verified** | Enforces all 5 conditions without mean compensation: (1) no critical failure, (2) every applicable rubric dimension >= 3, (3) `technicalCorrectness >= 4` when applicable, (4) `guardrailCompliance >= 4` when applicable, (5) `recordIntegrityPassed === true`. Preserves original ratings when critical failure forces failure. Require N/A reason when a dimension is `null`. | `TEST-RULE-01` .. `TEST-RULE-07` | Automated test assertions in `tests/research.test.ts` |

---

## 3. Research Freeze & 11-State Authoritative Lifecycle Machine

| Req ID | Governing Source / Section | Relevant Source Files & Functions | Initial Status | Required / Implemented Change | Automated Test ID | Runtime Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-FREEZE-01** | Pre-Pilot Spec §Research Freeze Workflow (11 States) | `server/researchGovernance.ts`, `server/db.ts`, `server.ts`, `components/FacultyDashboard.tsx` | **Partially Implemented** (Previously used boolean `isLocked` on `FormalRun` rather than explicit 11-state machine) | Implement server-authoritative 11-state machine (`DRAFT`, `PILOT_READY`, `PILOT_ACTIVE`, `PILOT_CLOSED`, `FORMAL_READY`, `FORMAL_LOCKED`, `FORMAL_CLOSED`, `REFINEMENT_ACTIVE`, `REGRESSION_LOCKED`, `SEQUESTERED_LOCKED`, `ARCHIVED`) with append-only transition audit events. | `TEST-FREEZE-01` | State transition tests & `/api/governance/state` |
| **REQ-FREEZE-02** | Pre-Pilot Spec §Preflight Before a Lock | `server/researchGovernance.ts` (`runFreezePreflight`), `server.ts` (`GET /api/governance/preflight`) | **Partially Implemented** | Implement 23-point server-side preflight check blocking lock transitions if any mandatory check fails (build, tests, Ollama, tutor/guard digests, fallbacks disabled, Docker, smoke test, case inventory, 5 high-risk, 4 CEW, 6 sequestered, ground truth, N/A reasons, writable dirs, no open Critical/High defects, data separation). | `TEST-FREEZE-02` | Preflight pass/fail blocking tests in `tests/research.test.ts` |
| **REQ-FREEZE-03** | Pre-Pilot Spec §Freeze Scope & Canonical Manifest | `server/researchGovernance.ts` (`buildCanonicalFreezeManifest`, `generateSha256Sums`), `server/exportService.ts` | **Partially Implemented** | Freeze and hash all 15 required artifacts with deterministic key ordering, SHA-256 manifest hash, and exported `SHA256SUMS.txt`. | `TEST-FREEZE-03` | Deterministic hash verification in `tests/research.test.ts` |
| **REQ-FREEZE-04** | Pre-Pilot Spec §Unlock / Protocol Deviation | `server/researchGovernance.ts` (`unlockWithDeviation`), `server.ts` (`POST /api/governance/unlock`) | **Missing** | Require investigator authentication, typed reason, confirmation that collection is closed, automatic `ProtocolDeviationRecord`, bumped tutor/app version when behavior changes, new manifest hash, and immutable preservation of prior manifest/records. | `TEST-FREEZE-04` | Unlock deviation test in `tests/research.test.ts` |

---

## 4. Two-Stage Research Lifecycle & Mode-Specific Terminology

| Req ID | Governing Source / Section | Relevant Source Files & Functions | Initial Status | Required / Implemented Change | Automated Test ID | Runtime Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-MODE-01** | Pre-Pilot Spec §Two-Stage Research Lifecycle | `server/researchGovernance.ts`, `types.ts`, `components/FacultyDashboard.tsx`, `server/exportService.ts` | **Missing** | Implement server-authoritative `capability_evaluation` vs `student_pilot` modes. Prevent mode change during locked runs. Require new protocol version, manifest, freeze hash, tutor version, and dataset to transition to `student_pilot`. | `TEST-MODE-01` .. `TEST-MODE-04` | Mode separation & transition tests in `tests/research.test.ts` |
| **REQ-MODE-02** | Pre-Pilot Spec §Mode-Specific Terminology & Fields | `server/researchGovernance.ts` (`getModeTerminology`), `types.ts`, `components/FacultyDashboard.tsx` | **Partially Implemented** | Enforce `Researcher/Evaluator`, `Case Execution`, `Verified Task State`, `Scripted Progress Point` in `capability_evaluation` mode; and `Student Participant`, `Participant Task Attempt`, `Verified Task Completion`, `Task Progress` in `student_pilot` mode. Keep `verified_task_state` and `participant_task_outcome` distinct. Never use "Learning Progress" without a configured validated learning measure. | `TEST-MODE-05` .. `TEST-MODE-07` | Terminology & field separation tests in `tests/research.test.ts` |
| **REQ-MODE-03** | Pre-Pilot Spec §Required Data Classifications & Automated CEW Status | `types.ts`, `server/db.ts`, `server/exportService.ts`, `server/cewEvaluator.ts` | **Partially Implemented** | Support all 7 canonical data classifications (`DEVELOPMENT_TEST`, `CAPABILITY_PILOT`, `FORMAL_CAPABILITY_ROUND_1`, `CAPABILITY_REFINEMENT`, `CAPABILITY_SEQUESTERED`, `CAPABILITY_REGRESSION`, `STUDENT_PILOT`). Store automated CEW scores under `automated_cew_score_experimental` and ensure they never determine readiness, participant success, study inclusion, or grades. | `TEST-MODE-08` .. `TEST-MODE-09` | Classification isolation & CEW non-decisional tests |

---

## 5. Authentication, Authorization & Web Security Remediation

| Req ID | Governing Source / Section | Relevant Source Files & Functions | Initial Status | Required / Implemented Change | Automated Test ID | Runtime Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-SEC-01** | Pre-Pilot Spec §Auth & Web Security (1–4: CORS, Body Limit, Security Headers, Rate Limits) | `server.ts`, `server/authMiddleware.ts` | **Partially Implemented** (`app.use(cors())` was permissive; `10mb` body limit was global; security headers missing) | Replace permissive `cors()` with explicit origin allowlist (`ALLOWED_ORIGINS`), set `256kb` default JSON body limit (with higher limit only on specific bulk import routes), add HTTP security headers middleware (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`), and apply rate limiters to login, tutor, export, smoke-test, and admin routes. | `TEST-SEC-01` .. `TEST-SEC-03` | Security middleware & rate-limit tests |
| **REQ-SEC-02** | Pre-Pilot Spec §Auth & Web Security (5–10: RBAC on All Privileged Routes & WebSocket, No Default Passwords) | `server.ts`, `server/authMiddleware.ts` | **Partially Implemented** (Several routes lacked `requireResearcher`/`requireAdmin`, `/api/users` had `|| 'password'` fallback, `/pty` WebSocket did not validate session token) | Enforce `requireResearcher` / `requireAdmin` on all faculty, settings, export, reset, lock/unlock, defect, review, ground-truth, sequestered, and test-run endpoints. Remove `'password'` fallback in `/api/users`. Validate session token on WebSocket `/pty` handshake (via `Sec-WebSocket-Protocol` or validated session ticket) in locked/production modes. | `TEST-SEC-04` .. `TEST-SEC-07` | RBAC, WebSocket auth, and password-leakage tests |
| **REQ-SEC-03** | Pre-Pilot Spec §Auth & Web Security (12–14: Request Schema Validation, Error Sanitization, Secret-Free Exports) | `server/authMiddleware.ts`, `server.ts`, `server/exportService.ts` | **Partially Implemented** | Add strict request payload schema validation rejecting oversized/unknown fields, sanitize production error responses (no stack traces or secrets), and partition restricted raw evidence vs sanitized exports. | `TEST-SEC-08` .. `TEST-SEC-09` | Schema validation & export secret-scanning tests |

---

## 6. Docker Sandbox Isolation & Safety

| Req ID | Governing Source / Section | Relevant Source Files & Functions | Initial Status | Required / Implemented Change | Automated Test ID | Runtime Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-SANDBOX-01** | Pre-Pilot Spec §Docker Sandbox Safety & Correctness | `server/sandboxProvider.ts`, `server.ts`, `Dockerfile.sandbox` | **Partially Implemented** | Enforce allowlisted image (`linux-tutor-sandbox:latest`), verified digest, UID/GID `1000:1000`, `CapDrop: ['ALL']`, narrowly scoped Task 7 sudo capabilities, `no-new-privileges:true` on Tasks 1–6 & 8, memory/swap/CPU/PID/output limits, `NetworkMode: 'none'`, no host mounts, no Docker socket mount, unique `guided_ai_sandbox_` container naming/labels, idle timeout cleanup, and fail-closed behavior in locked runs. | `TEST-SANDBOX-01` .. `TEST-SANDBOX-06` | Container config inspection & 8-task x 2 smoke tests |

---

## 7. Ollama, Guardrails, Telemetry & Sequestered Case Protections

| Req ID | Governing Source / Section | Relevant Source Files & Functions | Initial Status | Required / Implemented Change | Automated Test ID | Runtime Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-AI-01** | Pre-Pilot Spec §Ollama & Guardrail Behavior | `server/aiProvider.ts`, `server/llamaGuard.ts`, `server/tutorOrchestrator.ts` | **Verified** | Rejects `nomic-embed-text` as a chat/tutor model, captures full SHA-256 digests from Ollama, strips `<think>...</think>` before learner release and safety classification, labels alternative guard models transparently (`guardModelEquivalenceClaimed: false`), and fails closed (`CONFIGURATION_ERROR`) on timeout/malformed response in locked runs. | `TEST-AI-01` .. `TEST-AI-06` | Guardrail & `<think>` stripping unit/integration tests |
| **REQ-TELEM-01** | Pre-Pilot Spec §Telemetry, Evidence Integrity & Sequestered Protections | `server/studyInstrumentation.ts`, `server/exportService.ts`, `server/db.ts` | **Verified** | Monotonic sequence numbers, idempotency keys, 9-check RQ4 record-integrity evaluator, end-to-end case reconstruction from records alone, and server-side encryption/redaction of the 6 sequestered cases (`SQ-001`..`SQ-006`) until authorized release after known-case regression. | `TEST-TELEM-01` .. `TEST-TELEM-06` | Reconstruction & sequestered lock tests |
