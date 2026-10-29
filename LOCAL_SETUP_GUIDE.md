# Local Ubuntu VM Setup & Pre-Collection Verification Guide (Protocol V5.0.0)

This guide explains how to configure your local Ubuntu VM, verify your installed Ollama models and Docker sandbox image, and run the pre-collection readiness suite.

---

## 1. Required Packages on Ubuntu 22.04 / 24.04 LTS

Ensure the following system packages are installed on your Ubuntu VM:

```bash
sudo apt-get update
sudo apt-get install -y \
  curl git build-essential python3 python3-pip \
  docker.io ca-certificates gnupg
```

Ensure Node.js `>= 20.0.0` is installed and your user belongs to the `docker` group:

```bash
node -v   # Must be v20.0.0 or newer
sudo usermod -aG docker "$USER"
newgrp docker
docker info
```

---

## 2. Ollama Models on Your Ubuntu VM

Your VM currently has the following models installed:

| Model Name | Size | Supported Role in Socratic Shell | Notes |
| :--- | :--- | :--- | :--- |
| `qwen3-coder:30b` | 18 GB | **Primary Tutor Model** (`OLLAMA_MODEL=qwen3-coder:30b`) | High-capability coding/Linux tutor model already installed on your VM. |
| `qwen3.8:27b` | 17 GB | **Alternative Tutor Model** (`OLLAMA_MODEL=qwen3.8:27b`) | General instruction-following tutor model. |
| `llama3.1:8b` | 4.9 GB | **Lightweight Tutor** or **Prompted Guard Classifier** (`LLAMA_GUARD_MODEL=llama3.1:8b`) | Automatically labeled as `prompted_classifier` when used as a guard model. |
| `deepseek-r1:latest` | 5.2 GB | **Optional Tutor Model** | `<think>...</think>` blocks are automatically stripped by `aiProvider.ts`. |
| `nomic-embed-text:latest` | 274 MB | **Embeddings Only (Blocked for Tutor/Guard)** | Automatically rejected by `validateOllamaModelRole` if selected as a tutor or guard model. |

### Optional Recommended Models to Pull
If you want the canonical 7B tutor or the dedicated Llama Guard 3 safety classifier:

```bash
ollama pull qwen2.5-coder:7b
ollama pull llama-guard3:1b
```

Verify Ollama is listening on `http://127.0.0.1:11434`:

```bash
curl -s http://127.0.0.1:11434/api/tags | python3 -m json.tool
```

---

## 3. Build the Isolated Docker Sandbox Image

Build `linux-tutor-sandbox:latest` from `Dockerfile.sandbox`:

```bash
docker build -t linux-tutor-sandbox:latest -f Dockerfile.sandbox .
docker image inspect linux-tutor-sandbox:latest --format '{{.Id}}'
```

---

## 4. Configure Environment Variables

Copy `.env.example` to `.env` and select your preferred installed model:

```bash
cp .env.example .env
```

For example, to use your already-installed `qwen3-coder:30b` and `llama3.1:8b` on port `11434`:

```env
PORT=2000
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3-coder:30b
LLAMA_GUARD_MODEL=llama3.1:8b
SANDBOX_REQUIRED=true
ALLOW_HOST_SHELL_FALLBACK=false
```

---

## 5. Run Build, Tests, and Pre-Collection Readiness Verification

```bash
npm install
npm run lint
npm run build
npm test
npm run test:sandbox-smoke
python3 scripts/analyze_study_results.py --self-test
npm run verify:collection-ready
```
