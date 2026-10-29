# Security & Isolation Model (Protocol V5.0.0)

## 1. Authentication & Session Management (`server/authMiddleware.ts`)

1. **Password Hashing**: Passwords are hashed using Node's native `crypto.scryptSync` with a 16-byte cryptographic random salt (`64`-byte derived key) and verified via timing-safe comparison (`crypto.timingSafeEqual`).
2. **No Default Password Fallbacks**: User creation (`POST /api/users`) strictly requires an explicit password of at least 8 characters (`REQ-SEC-01`). Fallback defaults such as `'password'` are prohibited and rejected with HTTP `400`.
3. **Token Lifecycle & Revocation**:
   - Sessions use 32-byte random hex bearer tokens stored in `data/research_lab.json` (`sessions[]`) with a 24-hour TTL (`expiresAt`).
   - Explicit logout (`POST /api/auth/logout`) immediately deletes the session token from persistent storage (`revokeAuthSession`), invalidating subsequent HTTP and WebSocket requests.
4. **Role-Based Access Control (RBAC)**:
   - `student`: Can access assigned challenge terminals, submit flags, request Guided AI hints, and submit post-task surveys.
   - `reviewer`: Can access the Research Dashboard, inspect blinded/unblinded transcripts, submit 7-dimension rubric evaluations, and export anonymized datasets.
   - `investigator`: Full administrative access including `/api/config`, `/api/users`, `/api/governance/*` (freeze transitions, preflight checks, protocol deviation unlocks), and `/api/audit/*`.

---

## 2. Web & API Hardening (`server.ts`, `server/authMiddleware.ts`)

1. **CORS Origin Allowlist**:
   - Configured via `ALLOWED_ORIGINS` (comma-separated list, defaulting to `http://localhost:3000,http://127.0.0.1:3000`).
   - Wildcard `*` origins are never emitted alongside credentials; unauthorized cross-origin requests are denied.
2. **HTTP Security Headers (`securityHeadersMiddleware`)**:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Cross-Origin-Resource-Policy: same-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
3. **Request Size Limits & Schema Validation**:
   - Express JSON and URL-encoded body parsers are capped at `512kb`.
   - Critical mutation routes (`/api/users`, `/api/governance/transition`, `/api/governance/unlock`, `/api/tasks/submit-flag`) validate payload field types, string lengths, and required keys via `validatePayloadSchema`.
4. **Production Error Sanitization (`sanitizeProductionError`)**:
   - In production mode, internal stack traces and filesystem paths are stripped from HTTP 500 responses.
5. **Secret-Free Research Exports (`server/exportService.ts`)**:
   - Exported `participants.csv` and JSON archives strip `passwordHash`, session tokens, and API keys. Automated tests verify zero occurrences of `passwordHash` or `AIza` in exported packages.

---

## 3. WebSocket `/pty` Terminal Security

1. **Handshake Authentication**:
   - WebSocket connections to `/pty` must present a valid bearer token via `?token=<hex>` query parameter or `Authorization: Bearer <hex>` header (`verifyWebSocketAuthorization`).
   - Unauthenticated connections are immediately closed with WebSocket code `4401` (`Unauthorized`).
2. **Idle Timeout & Output Bounds**:
   - Terminal WebSocket sessions enforce a 30-minute idle timeout (`PTY_IDLE_TIMEOUT_MS = 30 * 60 * 1000`) and cap per-chunk stdout/stderr buffers (`MAX_PTY_CHUNK_BYTES = 65536`) to prevent memory exhaustion from runaway commands (e.g., `yes` or `/dev/zero`).

---

## 4. Docker Sandbox Isolation (`server/sandboxProvider.ts`, `Dockerfile.sandbox`)

When running in `local_research` mode with Docker enabled:

1. **Allowlisted Sandbox Image**:
   - Only `linux-tutor-sandbox:latest` and `ubuntu:24.04` (`ALLOWED_SANDBOX_IMAGES`) are permitted. Unapproved images throw an immediate security error in `buildSafeContainerCreateOptions`.
2. **Container Hardening Controls (`buildSafeContainerCreateOptions`)**:
   - **Non-privileged execution**: `Privileged: false`, `User: '1000:1000'` (`cadet`).
   - **Zero Host Bind Mounts**: `Binds: []` (prevents host filesystem exposure).
   - **Network Isolation**: `NetworkMode: 'none'` (disables outbound internet/LAN access from learner containers).
   - **Resource Quotas**: `Memory: 256 * 1024 * 1024` (256 MB), `NanoCPUs: 500000000` (0.5 CPU), `PidsLimit: 64` (prevents fork bombs).
   - **Linux Capabilities**: `CapDrop: ['ALL']` for Tasks 1–6 and 8; Task 7 (`sudo` permission audit) drops `ALL` and adds only minimal `CapAdd: ['SETUID', 'SETGID', 'AUDIT_WRITE']` with `no-new-privileges:false` so `/usr/bin/sudo` can function inside the isolated container.
   - **Audit Labels**: Every container is tagged with `org.guidedai.Managed=true`, `org.guidedai.SessionId`, `org.guidedai.UserId`, and `org.guidedai.TaskId` for deterministic cleanup and orphan reaping.

---

## 5. Prompt & Output Guardrails (`server/tutorOrchestrator.ts`)

1. **Prompt Secret Exclusion**: Neither plaintext CTF flags (`CTF{...}`) nor `TASK_SOLUTIONS` arrays are ever injected into the LLM system prompt or user context.
2. **Deterministic Output Redaction (`redactSecretsFromResponse`)**: Every LLM response passes through a post-generation verifier that strips any accidental flag pattern (`CTF\{[^}]+\}`), known flag hashes, or direct solution strings, replacing them with `[REDACTED_FLAG_BY_GUARDRAIL]` and setting `guardrail_triggered = true`.
