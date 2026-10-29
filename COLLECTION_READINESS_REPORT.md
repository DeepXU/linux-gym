# Collection Readiness Report (Protocol V5.0.0)

- **Generated At**: `2026-10-29T13:41:09.945Z`
- **Final Readiness Decision**: **`NOT READY`**
- **Deployment Profile Detected**: `cloud_demo`

## Verification Matrix

| ID | Check Name | Category | Status | Details |
| :--- | :--- | :--- | :--- | :--- |
| `CHK-01` | All 8 Tasks Have Non-Disclosing Student Task Instructions | `automated_offline` | **PASS** | All 8 tasks define studentTask, goal, context, successEvidence, howToWork, and constraints with 0 leaked flags or hidden filenames. |
| `CHK-02` | Evidence-Grounded Socratic Probing & Non-Disclosure | `automated_offline` | **PASS** | Plain 'ls' triggers documentation_probe without revealing 'ls -a' or '.hidden_flag'. |
| `CHK-03` | Reserved ask-ai Command Parser & Shell Interception | `automated_offline` | **PASS** | ask-ai commands are intercepted before Bash execution and routed exclusively to TutorOrchestrator. |
| `CHK-04` | Model Role Validation (Embedding Blocked & Classifier Labeled) | `automated_offline` | **PASS** | nomic-embed-text is rejected as tutor/guard; llama3.1:8b is accurately labeled as prompted_classifier. |
| `CHK-05` | Docker Daemon & linux-tutor-sandbox:latest Image | `live_infrastructure` | **NOT VERIFIED** | Docker daemon or linux-tutor-sandbox:latest not running in current host environment (profile: cloud_demo). Must be verified on target Ubuntu VM before formal collection. |
| `CHK-06` | Live Local Ollama Reachability (http://127.0.0.1:11434) | `live_infrastructure` | **NOT VERIFIED** | Ollama service at http://127.0.0.1:11434 is not reachable in this container. Must be verified on target Ubuntu VM before formal collection. |
| `CHK-07` | Dataset Cleanliness & Classification Separation | `automated_offline` | **PASS** | Database contains 0 development test executions. |

## Required Commands on Target Ubuntu VM to Reach `READY TO BEGIN FORMAL CAPABILITY DATA COLLECTION`

```bash
# 1. Build the isolated Ubuntu 24.04 sandbox image
docker build -t linux-tutor-sandbox:latest -f Dockerfile.sandbox .

# 2. Ensure Ollama is running on 127.0.0.1:11434 and models are pulled
ollama list
# Optional: pull dedicated safety classifier if using Llama Guard 3
ollama pull llama-guard3:1b

# 3. Archive and reset development records before starting formal collection
npm run study:reset -- --confirm "START NEW COLLECTION"

# 4. Re-run collection readiness verification
npm run verify:collection-ready
```
