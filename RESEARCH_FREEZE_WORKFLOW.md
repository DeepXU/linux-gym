# Research Freeze & Lock Workflow (Protocol V5.0.0)

## 1. Overview & Purpose

To prevent instrument drift, unlogged prompt modifications, or accidental mixing of pilot calibration data with formal capability evaluation records, the Guided AI Linux Tutor enforces a server-authoritative **11-State Research Freeze & Lock State Machine** (`server/researchGovernance.ts` and `server/db.ts`).

---

## 2. The 11 Canonical Freeze States

| Freeze State | Locked / Immutable? | Allowed Next States | Purpose |
| :--- | :--- | :--- | :--- |
| `DRAFT` | No | `PILOT_READY` | Initial configuration, prompt drafting, and task fixture verification. |
| `PILOT_READY` | No | `PILOT_ACTIVE`, `DRAFT` | 23-point preflight passed; ready to begin pilot calibration. |
| `PILOT_ACTIVE` | No | `PILOT_CLOSED` | Active pilot run (`CAPABILITY_PILOT`). Excluded from formal analysis by default. |
| `PILOT_CLOSED` | No | `FORMAL_READY`, `DRAFT` | Pilot completed; investigator reviews telemetry and finalizes prompts/rubric. |
| `FORMAL_READY` | No | `FORMAL_LOCKED`, `DRAFT` | 23-point preflight passed for formal study; ready to freeze instrument. |
| `FORMAL_LOCKED` | **Yes (Immutable)** | `FORMAL_CLOSED` (or unlock via Protocol Deviation) | Formal Capability Round 1 (`FORMAL_CAPABILITY_ROUND_1`). All 15 freeze manifest artifacts are cryptographically hashed and locked. |
| `FORMAL_CLOSED` | No | `REFINEMENT_ACTIVE`, `SEQUESTERED_LOCKED`, `ARCHIVED` | Formal Round 1 data collection complete. |
| `REFINEMENT_ACTIVE` | No | `REGRESSION_LOCKED` | Controlled prompt/orchestrator refinement phase (`CAPABILITY_REFINEMENT`) if formal targets were missed. |
| `REGRESSION_LOCKED` | **Yes (Immutable)** | `SEQUESTERED_LOCKED`, `FORMAL_CLOSED` | Locked regression evaluation (`CAPABILITY_REGRESSION`) on the 24-case matrix. |
| `SEQUESTERED_LOCKED` | **Yes (Immutable)** | `ARCHIVED` | Locked 16-case sequestered replication (`CAPABILITY_SEQUESTERED`, `SEQ-TC01`..`SEQ-TC16`). |
| `ARCHIVED` | **Yes (Immutable)** | *(Terminal State)* | Study completed and permanently archived. |

---

## 3. 23-Point Freeze Preflight Gate (`runFreezePreflight`)

Before transitioning to `PILOT_READY`, `FORMAL_READY`, `FORMAL_LOCKED`, `REGRESSION_LOCKED`, or `SEQUESTERED_LOCKED`, the server executes 23 automated verification checks (`GET /api/governance/preflight`):

1. **`PF-01` (`study_mode_selected`)**: Valid research mode (`capability_evaluation` or `student_pilot`) is configured.
2. **`PF-02` (`phase_tag_set`)**: Valid canonical `data_classification` tag is active.
3. **`PF-03` (`task_bank_version_present`)**: All 8 canonical tasks (`1`..`8`) have version, title, and verification command defined.
4. **`PF-04` (`prompt_template_version_present`)**: `promptTemplateVersion` and `systemPromptChecksum` are present.
5. **`PF-05` (`rubric_version_present`)**: 7-dimension rubric (`D1`..`D7`) and 6 critical failure flags (`CF1`..`CF6`) match V5.0.0.
6. **`PF-06` (`verifier_version_present`)**: Private task verification hash table (`TASK_FLAG_HASHES`) covers all 8 tasks.
7. **`PF-07` (`docker_daemon_reachable`)**: Checks `/var/run/docker.sock` reachability (informational in `DRAFT`, strict when `REQUIRE_REAL_INFRA=true`).
8. **`PF-08` (`sandbox_image_present`)**: Verifies `linux-tutor-sandbox:latest` is allowlisted and `Dockerfile.sandbox` exists on disk.
9. **`PF-09` (`all_eight_tasks_provision_pass`)**: Confirms all 8 task fixtures (`TASK_PROVISIONING_SCRIPTS[1..8]`) are defined and non-empty.
10. **`PF-10` (`ollama_endpoint_reachable`)**: Checks local Ollama endpoint config (`http://localhost:2004` or `http://localhost:11434`).
11. **`PF-11` (`selected_model_installed`)**: Verifies configured `ollamaModel` is in the validated local model list (`qwen3-coder:30b`, `qwen3.8:27b`, `llama3.1:8b`, `deepseek-r1:latest`).
12. **`PF-12` (`model_digest_recorded`)**: Verifies `modelDigest` is recorded (required when entering locked formal states).
13. **`PF-13` (`decoding_parameters_recorded`)**: Verifies `temperature`, `topP`, `numCtx`, and `seed` are explicitly set.
14. **`PF-14` (`no_flag_in_prompt_audit_pass`)**: Audits `server/tutorOrchestrator.ts` to guarantee no plaintext flags or `TASK_SOLUTIONS` are interpolated into the LLM prompt.
15. **`PF-15` (`output_redaction_active`)**: Verifies `redactSecretsFromResponse` and `[REDACTED_FLAG_BY_GUARDRAIL]` are active.
16. **`PF-16` (`no_silent_fallback_in_formal_mode`)**: Confirms `formalModeStrict` is enabled when `dataClassification !== 'DEVELOPMENT_TEST'`.
17. **`PF-17` (`database_writable`)**: Confirms `data/research_lab.json` parent directory is writable.
18. **`PF-18` (`migration_state_current`)**: Confirms Protocol Version `5.0.0-V5-PROPOSAL-ALIGNED`.
19. **`PF-19` (`export_directory_writable`)**: Confirms export generation path is writable.
20. **`PF-20` (`secret_leak_check_pass`)**: Audits `server/exportService.ts` to ensure `passwordHash` and raw secrets are stripped from exports.
21. **`PF-21` (`git_commit_recorded`)**: Verifies `gitCommitHash` is recorded.
22. **`PF-22` (`package_lock_hash_recorded`)**: Computes and verifies SHA-256 digest of `package-lock.json`.
23. **`PF-23` (`test_suite_status_recorded`)**: Confirms `tests/research.test.ts` exists and is tracked.

---

## 4. Canonical Freeze Manifest & `SHA256SUMS.txt`

When entering `FORMAL_LOCKED`, `REGRESSION_LOCKED`, or `SEQUESTERED_LOCKED`, the server generates a canonical JSON manifest (`buildCanonicalFreezeManifest`) with recursively sorted keys and computes a master `manifestSha256` over 15 research artifacts:

1. `studyId` & `protocolVersion`
2. `researchMode` & `dataClassification`
3. `freezeState` & `lockedAt` / `lockedBy`
4. `gitCommitHash`
5. `packageLockSha256` (`package-lock.json` file digest)
6. `taskBankSha256` (`constants.tsx` file digest)
7. `promptOrchestratorSha256` (`server/tutorOrchestrator.ts` file digest)
8. `rubricProtocolSha256` (`server/v5Protocol.ts` file digest)
9. `verifierSha256` (`server/sandboxProvider.ts` file digest)
10. `dockerfileSandboxSha256` (`Dockerfile.sandbox` file digest)
11. `promptTemplateVersion` & `systemPromptChecksum`
12. `llmProvider` & `ollamaModel`
13. `modelDigest`
14. `decodingParams` (`temperature`, `topP`, `numCtx`, `seed`)
15. `sandboxImage` & `sandboxImageDigest`

Researchers can download the signed `SHA256SUMS.txt` directly via `GET /api/governance/manifest/sha256sums` or inside the exported `research_export_v5.zip` archive.

---

## 5. Frozen-Phase Immutability & Protocol Deviation Unlocks

While `freezeState` is in `FORMAL_LOCKED`, `REGRESSION_LOCKED`, `SEQUESTERED_LOCKED`, or `ARCHIVED`:
- Any attempt to mutate system configuration (`PUT /api/config`), test case definitions (`POST /api/test-cases`), or ground-truth records (`PUT /api/ground-truth/:taskId`) is rejected by `db.ts` and `server.ts` with HTTP `409 Conflict` (`FROZEN_PHASE_IMMUTABLE`).
- **Emergency Unlock (`POST /api/governance/unlock`)**: Only an authenticated `investigator` may unlock a frozen state by submitting:
  - `reason` (mandatory explanation, >= 10 chars)
  - `affectedArtifacts` (array of modified files/components)
  - `newVersionBump` (new semantic version tag, e.g., `5.0.1-DEV-01`)
  - `targetState` (`DRAFT` or `REFINEMENT_ACTIVE`)
- Every unlock creates an immutable `ProtocolDeviationRecord` in `governance.protocolDeviations` and is exported in `governance_state.json`.
