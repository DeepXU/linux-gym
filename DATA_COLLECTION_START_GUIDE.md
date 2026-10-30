# Data Collection Start Guide (Protocol V5.0.0)

Follow this step-by-step checklist before beginning **Formal Capability Data Collection** (`FORMAL_CAPABILITY`) or **Student Pilot** sessions.

> **Current status: NOT READY FOR DATA COLLECTION.** This source build does not implement persistent ground-truth verification or the sequestered-case release/run APIs described below. Those UI actions now return explicit `501 Not Implemented` responses. Do not lock a formal run or collect participant data until those workflows are implemented and independently validated. A passing infrastructure check alone does not clear this blocker.

---

## Step 1 — Pre-Flight Infrastructure Check

1. Verify Docker is running and `linux-tutor-sandbox:latest` is built:
   ```bash
   docker image inspect linux-tutor-sandbox:latest
   ```
2. Verify Ollama is running on `http://127.0.0.1:2004`:
   ```bash
   curl -s http://127.0.0.1:2004/api/tags
   ```

---

## Step 2 — Backup Current Database State

Create a timestamped backup with SHA-256 checksums in `backups/`:

```bash
npm run study:backup
```

---

## Step 3 — Do Not Reset or Start a Collection

The current build does not provide persistent ground-truth verification or the sequestered-case release/run workflow. Do not use `study:reset` to create a formal run until the readiness gate passes and those features are implemented. The reset command now checks readiness and should refuse while any required check fails.

---

## Step 4 — Verify Collection Readiness

Run the automated readiness gate:

```bash
npm run verify:preflight-evidence
npm run verify:collection-ready
```

Inspect the command output and any generated readiness report. This build deliberately fails `CHK-08` until ground-truth and sequestered-case workflows are implemented. A previous report file is not evidence for the current source.

The decision must remain **`NOT READY`** until every current check passes and the unresolved workflows are independently validated.

---

## Step 5 — Development Only

```bash
npm run dev
```

Use this only for local development and repair verification. Do not recruit participants, lock a research run, or describe this build as research-ready.
