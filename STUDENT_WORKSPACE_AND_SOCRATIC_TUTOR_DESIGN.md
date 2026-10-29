# Student Workspace & Evidence-Grounded Socratic Tutor Design (Protocol V5.0.0)

## 1. Student Workspace Architecture

The student workspace is designed around a single terminal-centered workflow that preserves the Socratic Shell dark slate visual identity while eliminating split-attention UI elements:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header: Task # & Title | Protocol V5.0.0 Profile | CLO Badge                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Task Instructions Card (Full Width, Always Visible)                          │
│  ┌────────────────────────┬────────────────────────┬──────────────────────┐  │
│  │ Your task              │ Goal                   │ Context              │  │
│  ├────────────────────────┼────────────────────────┼──────────────────────┤  │
│  │ Success evidence       │ How to work            │ Constraints          │  │
│  └────────────────────────┴────────────────────────┴──────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Real Linux Sandbox PTY Terminal (Full Width Primary Work Area)               │
│  $ ls                                                                        │
│  notes.txt                                                                   │
│  $ ask-ai "Why did ls only show notes.txt?"                                  │
│  ┌─ Guided AI Tutor (documentation_probe) ─────────────────────────────────  │
│  │ You ran `ls` in `/home/cadet` and observed `notes.txt`.                   │
│  │ Why might a standard `ls` command omit certain files in Linux, and what   │
│  │ could you check in `man ls` or `ls --help` to see how hidden entries      │
│  │ are controlled?                                                           │
│  └─────────────────────────────────────────────────────────────────────────  │
│  [ask-ai] [ Ask Guided AI about your task or terminal output... ] [Ask Tutor]│
├──────────────────────────────────────────────────────────────────────────────┤
│ Flag & Claim-Evidence-Warrant (CEW) Submission Bar                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Invariants
1. **No Separate Right-Hand Chat Sidebar or Hint Button**: Students do not click a separate "Progressive Hint (L1)" button or switch to a side chat panel. All assistance happens inside the terminal workflow via `ask-ai "<question>"` or the embedded terminal `ask-ai` input bar.
2. **Reserved `ask-ai` Interception**: When a student types `ask-ai <question>` in the PTY terminal, the backend WebSocket bridge intercepts the line before sending a newline to Bash, clears the shell input buffer with `Ctrl+U` (`\x15`), records a `tutor_query` event (never a `shell_command`), and renders the `[Guided AI Tutor]` block directly in the terminal.
3. **Strict Task Switching Isolation**: Selecting a different task in the left sidebar calls `/api/tasks/reset` for the prior session and increments `sessionNonce` so each task session starts with a clean container workspace and isolated tutor context.

---

## 2. Evidence-Grounded Socratic State Machine

Every tutor turn executes a deterministic 4-stage pipeline in `TutorOrchestrator`:

1. **Curated Context Snapshot Construction (`buildCuratedContextSnapshot`)**:
   - Filters commands, outputs, documentation views, and prior tutor turns strictly by `(runId, executionId, taskId, sessionId)`.
   - Caps context at **20 recent commands**, **8 KiB output**, **5 prior exchanges**, and **2 KiB earlier session summary**.
   - Scrubs any secret flag tokens or prohibited disclosures from terminal excerpts and wraps untrusted text in `<untrusted_terminal_output>` and `<untrusted_student_input>` tags.
2. **Pre-Inference Input Guardrail (`GuardrailEngine.preCheck` + `LlamaGuardService`)**:
   - Blocks direct flag requests, guardrail bypass attempts, prompt injection, restricted system prompt requests, and destructive commands (`rm -rf /`, fork bombs, privilege escalation outside Task 7).
3. **Socratic State Selection (`determineGuidanceDecision`)**:
   - Selects one of 7 recorded states (`orientation_probe`, `conceptual_probe`, `documentation_probe`, `reflection_probe`, `prediction_probe`, `procedural_probe`, `bounded_next_step`) and records an explicit `escalationReason`.
4. **Post-Inference Output Guardrail & Response Shaping (`enforceSocraticResponseConstraints`)**:
   - Verifies zero flag/secret/solution leakage and enforces a concise response ending with at most **one** focused Socratic question (`?`).
