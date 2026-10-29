# Data Collection Start Guide (Protocol V5.0.0)

Follow this step-by-step checklist before beginning **Formal Capability Data Collection** (`FORMAL_CAPABILITY`) or **Student Pilot** sessions.

---

## Step 1 — Pre-Flight Infrastructure Check

1. Verify Docker is running and `linux-tutor-sandbox:latest` is built:
   ```bash
   docker image inspect linux-tutor-sandbox:latest
   ```
2. Verify Ollama is running on `http://127.0.0.1:11434`:
   ```bash
   curl -s http://127.0.0.1:11434/api/tags
   ```

---

## Step 2 — Backup Current Database State

Create a timestamped backup with SHA-256 checksums in `backups/`:

```bash
npm run study:backup
```

---

## Step 3 — Archive Development Records & Initialize a Clean Formal Collection Run

Clear all prior `DEVELOPMENT_TEST` / `dev_smoke` records while preserving users, the 8 canonical tasks, the 24 standardized test cases, the 6 sequestered cases, ground-truth records, and system configuration:

```bash
npm run study:reset -- --confirm "START NEW COLLECTION"
```

What this command produces:
- A verified pre-reset backup in `backups/collection_backup_<timestamp>/` with `SHA256SUMS.txt` and `backup_manifest.json`
- A fresh formal capability run folder in `data/runs/<runId>/` containing:
  - `collection_manifest.json` (freezing Git commit SHA, model digests, sandbox image digest, and prompt digest)
  - `SHA256SUMS.txt`

---

## Step 4 — Verify Collection Readiness

Run the automated readiness gate:

```bash
npm run verify:collection-ready
```

Inspect `COLLECTION_READINESS_REPORT.md` and `reports/collection_readiness.json`. Confirm that all checks (`CHK-01` through `CHK-07`) show **`PASS`** and the decision reads:

> **`READY TO BEGIN FORMAL CAPABILITY DATA COLLECTION`**

---

## Step 5 — Start the Production Server & Lock the Run

```bash
npm start
```

1. Open `http://localhost:2000` and log in as `admin`.
2. Check `/api/health` to confirm `deploymentProfile: "local_research"`, `dockerAvailable: true`, and `formalDataCollectionAllowed: true`.
3. Lock the active formal evaluation run in the Research Dashboard before executing the 24 standardized cases + 5×3 high-risk consistency suite.
