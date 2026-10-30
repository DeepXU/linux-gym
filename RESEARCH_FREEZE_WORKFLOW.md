# Research Freeze Workflow (Protocol V5.0.0)

## Current implementation status

**This build is not ready for participant or formal research data collection.** The server-authoritative preflight can report its checks, but the persistence and execution workflows needed to pass it are incomplete. Do not treat this document, an earlier report, or a displayed UI status as approval to collect data.

| Capability | Current behavior |
|---|---|
| Freeze preflight | `POST /api/governance/preflight` runs the 24-check preflight for an authenticated admin/evaluator. |
| Build/test evidence | `npm run verify:preflight-evidence` reruns the production build and test suite, then writes evidence tied to the current source fingerprint and Node.js version. Any source or lockfile change invalidates it. |
| Governance state | `GET /api/governance/state` returns HTTP 501; lifecycle state is not persisted. |
| State transitions / deviation unlock | `POST /api/governance/transition` and `/api/governance/unlock` return HTTP 501. |
| Run create / unlock | `POST /api/runs` and `/api/runs/unlock` return HTTP 501. The UI disables these actions. |
| Ground truth | Storage and Docker-backed verification are not implemented; related routes return HTTP 501. |
| Sequestered cases | Storage, regression completion, release gating, and execution are not implemented; related routes return HTTP 501. |
| Integrity / terminal history | Retrieval APIs return HTTP 501. Integrity-dependent review therefore fails closed. |

The missing ground-truth and sequestered-case workflows are mandatory blockers. The collection-readiness command reports **NOT READY** until they are implemented and independently validated.

## Preflight procedure

On the deployment host, run:

```bash
npm run verify:preflight-evidence
npm run study:verify
npm run verify:collection-ready
```

The first command performs a fresh production build and test run and records source-bound evidence. The readiness check also requires the configured Ollama tutor and guard models, the real Docker daemon and sandbox image, passing real-Docker smoke tests, canonical case inventory, clean data classification, and implemented research workflows.

Any failed, missing, stale, simulated, or unverified requirement is a stop condition. Do not override failures or start a run through direct database/API manipulation.

## Lifecycle utilities and artifacts

`server/researchGovernance.ts` contains the 11-state transition definitions and canonical manifest utilities. Their presence does **not** mean the transitions, manifest persistence, protocol-deviation workflow, or run locking are wired into the application. Do not use the generated utility output as a signed or frozen study manifest.

Historical reports and backups are preserved as records of earlier checks. They are not current verification evidence; always generate new evidence from the exact source tree and deployment environment being assessed.
