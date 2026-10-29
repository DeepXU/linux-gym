# Protocol Deviations Log & Governance Policy (Protocol V5.0.0)

## 1. Policy Overview

Under the **Guided AI Linux Tutor V5.0.0 Research Protocol**, once the study instrument enters a locked state (`FORMAL_LOCKED`, `REGRESSION_LOCKED`, or `SEQUESTERED_LOCKED`), the task bank, system prompt, orchestrator guardrails, rubric definitions, and model parameters are immutable.

If an emergency defect (e.g., container provisioning bug, critical security vulnerability, or broken verifier check) requires modifying a locked study instrument:
1. The Principal Investigator must execute an authenticated **Protocol Deviation Unlock** (`POST /api/governance/unlock` or via the **Research Freeze & Lock Workflow** panel in the Research Dashboard).
2. The unlock action requires:
   - **`reason`**: Detailed explanation of why the lock had to be broken (minimum 10 characters).
   - **`affectedArtifacts`**: Explicit list of files, prompts, or tasks impacted.
   - **`newVersionBump`**: New version identifier (e.g., `5.0.1-DEV-01`).
   - **`targetState`**: Either `DRAFT` or `REFINEMENT_ACTIVE`.
3. The server appends an immutable `ProtocolDeviationRecord` to `governance.protocolDeviations` and transitions the state out of the locked phase.
4. Any records collected prior to the deviation retain their original `freeze_manifest_sha256` and `prompt_version` for transparent auditability in the exported `governance_state.json`.

---

## 2. Recorded Protocol Deviations

| Deviation ID | Timestamp (UTC) | Unlocked By | Previous State | Target State | Version Bump | Affected Artifacts | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *(None recorded in production study)* | — | — | — | — | — | — | Pre-pilot baseline (`DRAFT`). Automated test coverage for deviation logging verified in `TEST-FREEZE-03`. |
