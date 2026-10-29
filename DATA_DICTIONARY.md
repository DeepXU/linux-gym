# Research Data Dictionary (Protocol V5.0.0)

This dictionary defines the append-only event model, curated context snapshot schema, Socratic guidance states, and the 15 exported relational tables.

---

## 1. Data Classifications (`data_classification`)

| Classification | Description | Included in Formal Analysis by Default? |
| :--- | :--- | :--- |
| `FORMAL_CAPABILITY` / `formal_round_1` | Locked Round 1 formal evaluation executions | **Yes** |
| `regression` | Post-refinement regression re-tests | **Yes** |
| `sequestered` | Sequestered 6-case final acceptance executions | **Yes** |
| `CAPABILITY_PILOT` / `pilot` | Small-scale student pilot sessions | Optional filter |
| `DEVELOPMENT_TEST` / `dev_smoke` | Development, smoke test, and offline unit test runs | **Excluded by default** |

---

## 2. Append-Only Event Model (17 Canonical Event Types)

Every event in `telemetry_events` contains:
- `eventId`: Unique event identifier
- `runId`: Active study run identifier
- `executionId`: Case or session execution identifier (`(executionId, sequenceNumber)` is strictly monotonic and unique)
- `sessionId`: Terminal/tutor session identifier
- `taskId`: Canonical task number (`1`–`8`)
- `sequenceNumber`: Strictly increasing integer per session/execution
- `eventType`: One of the 17 canonical event types below
- `payload`: Structured JSON object for the event
- `payloadSha256`: Cryptographic digest (`sha256:<hex>`) of `JSON.stringify(payload)`

### The 17 Event Types
1. `task_started` — Sandbox session initialized for `taskId`
2. `shell_command` — Real Linux command executed in the shell (`ask-ai` is never recorded here)
3. `shell_output` — Stripped terminal output linked via `commandId`
4. `working_directory_changed` — Shell working directory transition (`previousCwd -> newCwd`)
5. `documentation_view` — Student opened `man <topic>`, `<cmd> --help`, `info`, or `less`
6. `tutor_query` — Student question submitted via `ask-ai <question>`
7. `student_reflection` — Student interpretation or hypothesis extracted from query
8. `context_snapshot` — Bounded `CuratedContextSnapshot` (`contextHash`, `selectedSourceEventIds`, `eventsOmitted`, `outputTruncated`)
9. `input_guard_decision` — Pre-inference guardrail decision (`ALLOW`, `BLOCK`, `ESCALATE`)
10. `guidance_decision` — Socratic state machine decision (`guidanceState`, `escalationReason`)
11. `model_call` — Local LLM call metadata (`provider`, `modelName`, `modelDigest`, `latencyMs`)
12. `tutor_response_raw_restricted` — Restricted raw model response prior to output guard
13. `output_guard_decision` — Post-inference guardrail check (`ALLOW`, `REDACT`, `BLOCK`)
14. `tutor_response_released` — Final Socratic response released to the student terminal
15. `task_verification` — Server-side flag verification attempt (`redactedFlagPreview`, `submittedFlagHash`, `isCorrect`)
16. `task_completed` — Verified task completion event
17. `session_ended` — Terminal WebSocket/container session closed

---

## 3. Internal Recorded Socratic Guidance States (`SocraticGuidanceState`)

| State | Pedagogical Purpose |
| :--- | :--- |
| `orientation_probe` | Student has not yet gathered relevant terminal evidence; prompts initial observation. |
| `conceptual_probe` | Clarifies a Linux concept (e.g., hidden files, permissions, processes) tied to the task goal. |
| `documentation_probe` | Student ran a base command (e.g. `ls`); prompts inspecting `man <cmd>` or `--help`. |
| `reflection_probe` | Student opened `man <cmd>` or observed output; acknowledges the action and asks what option/pattern they noticed. |
| `prediction_probe` | Student stated a plausible hypothesis; asks what output they predict if they test that option in the terminal. |
| `procedural_probe` | Guides multi-step command composition without giving copy-paste answers. |
| `bounded_next_step` | Controlled escalation after repeated unsuccessful attempts; provides one bounded diagnostic step without leaking flags or answers. |

---

## 4. Curated Context Snapshot (`CuratedContextSnapshot`)

Constructed before every tutor turn with strict `(runId, executionId, taskId, sessionId)` isolation:
- `recentCommands`: Up to `20` recent shell commands (`commandId`, `command`, `cwd`, `exitStatus`)
- `recentOutputs`: Up to `8 KiB` (`8192` bytes) of secret-scrubbed terminal output excerpts
- `recentTutorExchanges`: Up to `5` prior tutor exchanges in the same session
- `earlierSessionSummary`: Compact summary (`<= 2 KiB`) when older commands/exchanges are omitted
- `eventsOmitted`: Boolean flag indicating whether older commands/turns were truncated
- `outputTruncated`: Boolean flag indicating whether terminal output exceeded the 8 KiB budget
- `contextHash`: `sha256:<hex>` digest of the serialized snapshot
