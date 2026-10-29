# Production Deployment & Operations Guide
## Linux CTF Academy & AI Research Harness
### Target Platform: Ubuntu Linux 22.04 / 24.04 LTS with NVIDIA RTX Pro 6000 Blackwell GPU
### Network Policy: Dedicated Port Range 2000–2009 (Zero Conflicts with Open WebUI & Existing 3000-Series Services)

---

## 1. Executive Summary & Architecture Overview

The **Linux CTF Academy & AI Research Harness** is a production-grade, full-stack cybersecurity learning gym and AI tutor evaluation platform. To prevent network collisions with existing applications on your system (such as **Open WebUI on port 3000**, standard web servers, or other microservices), **the entire system is strictly partitioned to operate within the 2000–2009 port range**.

The system operates as a hybrid monolithic application featuring:

1. **Frontend**: React 18 Single-Page Application (SPA) with xterm.js terminal emulation, real-time CEW (Claim-Evidence-Warrant) argumentation scaffolds, SME faculty review scoring dashboards, and research telemetry monitors.
2. **Backend**: Node.js (v20+ LTS) Express server running on **Port 2000** providing RESTful APIs, WebSocket PTY bridges (`/pty`), atomic JSON/SQLite state persistence (`./data/research_lab.json`), and cryptographic SHA-256 research data export compilation.
3. **Sandbox Execution Layer**: Native Docker orchestration via `/var/run/docker.sock`, spinning up ephemeral, isolated `ubuntu:latest` containers per cadet session (with safe fallback to local host bash processes).
4. **Local AI Inference Engine**: Zero-cloud, air-gapped local inference engine connecting to your **NVIDIA RTX Pro 6000 Blackwell GPU** via Ollama on **Port 2004** (`http://localhost:2004`) or vLLM / OpenAI-compatible endpoints on **Port 2005** (`http://localhost:2005/v1`).
5. **Nginx Reverse Proxy & SSL Gateway**: Configured to front traffic on **Port 2001** (or 443 with domain binding) proxying cleanly to the backend on **Port 2000**.

```
                                [ Cadets & Faculty Reviewers ]
                                             │
                                     (HTTP / WSS:2001)
                                             ▼
                             [ Nginx Reverse Proxy & SSL ]
                                     (Port 2001)
                                             │
                         ┌───────────────────┴───────────────────┐
                         │                                       │
                  (HTTP REST:2000)                        (WebSocket: /pty)
                         ▼                                       ▼
             [ Linux CTF Academy Backend ]            [ PTY Sandbox Manager ]
              (Node.js 20 LTS / Express)                         │
              (Bound to 0.0.0.0:2000)                            ▼
                         │                            [ Docker Daemon Socket ]
            ┌────────────┴────────────┐                          │
            ▼                         ▼                          ▼
   [ SQLite/JSON DB ]      [ AI Provider Router ]     [ Ephemeral Ubuntu Containers ]
  (data/research_lab.json)            │                 (cadet bash terminal gym)
                                      ▼
                      ┌───────────────┴───────────────┐
                      ▼                               ▼
            [ Ollama (Port 2004) ]         [ vLLM (Port 2005/v1) ]
                      │                               │
                      └───────────────┬───────────────┘
                                      ▼
                   [ NVIDIA RTX Pro 6000 Blackwell GPU ]
                   (48GB-96GB GDDR7, FP4/FP8/FP16 Tensor Cores)
```

---

## 2. Dedicated Port Allocation Matrix (Ports 2000–2009)

Every service in this deployment is mapped to a designated port within **2000–2009**. This ensures clean coexistence with Open WebUI, dev tooling, and system services:

| Port | Service Component | Protocol | Description & Endpoints |
|---|---|---|---|
| **2000** | **CTF Academy Application** | HTTP / WS | Primary Node.js/Express app, API (`/api/*`), and xterm PTY WebSocket (`/pty`) |
| **2001** | **Nginx Reverse Proxy** | HTTP / HTTPS | Production gateway, SSL termination, and WebSocket upgrade router |
| **2002** | **Direct Sandbox SSH Target** | SSH / TCP | Auxiliary direct student shell access / CTF target container SSH |
| **2003** | **Secondary CTF Challenge** | TCP / HTTP | Network reversing challenge service (e.g. netcat, buffer overflow target) |
| **2004** | **Ollama Local LLM Engine** | HTTP REST | NVIDIA GPU inference server: `http://localhost:2004/api/chat` |
| **2005** | **vLLM / OpenAI Engine** | HTTP REST | High-throughput GPU inference: `http://localhost:2005/v1/chat/completions` |
| **2006** | **Alternative Local LLM** | HTTP REST | Secondary inference engine (e.g. llama.cpp, LM Studio, SGLang) |
| **2007** | **Prometheus & System Health** | HTTP | System health telemetry and hardware metrics exporter |
| **2008** | **Live Research Telemetry Stream** | WebSocket | High-frequency telemetry stream for research monitoring consoles |
| **2009** | **Admin Diagnostic Fallback** | HTTP | Emergency recovery and diagnostic administration interface |

---

## 3. Required Software & Dependencies

### Hardware Prerequisites
* **GPU**: NVIDIA RTX Pro 6000 Blackwell (e.g. RTX 6000 Ada / Blackwell Pro workstation or server PCIe).
* **System RAM**: 32 GB minimum (64 GB+ recommended for concurrent 70B model execution and multiple student Docker containers).
* **Storage**: NVMe SSD with at least 100 GB free space (to store model weights, Docker images, and research telemetry databases).
* **CPU**: 8+ cores (x86_64).

### System Software Matrix
| Component | Minimum Version | Recommended Version | Purpose |
|---|---|---|---|
| **OS** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS | Host Operating System |
| **NVIDIA Driver** | 550.54+ | 560.35+ or 570+ (Blackwell support) | GPU Kernel Driver |
| **CUDA Toolkit** | 12.4 | 12.6+ | GPU Compute Runtime |
| **Node.js** | 20.10.0 LTS | 20.18.0+ LTS (Active LTS) | Application Server & Runtime |
| **npm** | 10.2.0+ | 10.8.0+ | Node Package Manager |
| **Docker Engine** | 24.0+ | 27.x+ | Student Terminal Container Sandbox |
| **NVIDIA Container Toolkit** | 1.15+ | 1.16+ | GPU pass-through to Docker containers |
| **Nginx** | 1.18+ | 1.24+ | Reverse Proxy, SSL Termination & WebSocket proxy |
| **PM2** | 5.3+ | 5.4+ | Process Management, auto-restart & clustering |

---

## 4. GPU & Local LLM Optimization for RTX Pro 6000 Blackwell

The NVIDIA RTX Pro 6000 Blackwell GPU features massive memory bandwidth, 5th-generation Tensor Cores, and native FP4/FP8 compute engines. You can serve state-of-the-art 70B parameter models at 60+ tokens/second while handling concurrent student sessions.

### 4.1 Recommended Models for CTF Learning & Research
1. **Instructional Tutor**:
   - `llama3.3:70b` (Meta Llama 3.3 70B Instruct) — Superior Socratic dialogue, adheres tightly to guardrails and never gives away answers.
   - `qwen2.5-coder:32b` or `qwen2.5-coder:70b` — Exceptional Linux terminal commands, bash pipeline, and regex explanation.
   - `deepseek-r1:70b` / `deepseek-r1:32b` (Reasoning Distill) — Deep chain-of-thought analysis for complex flag reversing.
2. **Evaluator Model (Shadow CEW Scoring)**:
   - `llama3.3:70b` or `llama3.1:8b` (fast automated scoring).

---

### 4.2 Configuring Ollama for High Concurrency on Port 2004 (Option 1)
To ensure Ollama does not collide with default ports and operates inside the **2000–2009** range, configure it on **Port 2004**.

Edit the Ollama service configuration:
```bash
sudo systemctl edit ollama.service
```

Add the following environment overrides:
```ini
[Service]
# Bind Ollama to dedicated Port 2004 in range 2000-2009
Environment="OLLAMA_HOST=0.0.0.0:2004"
# Allow CORS requests from CTF app
Environment="OLLAMA_ORIGINS=*"
# Enable concurrent request processing (Blackwell handles 16+ parallel streams easily)
Environment="OLLAMA_NUM_PARALLEL=16"
# Flash Attention 2 for faster throughput and lower VRAM consumption
Environment="OLLAMA_FLASH_ATTENTION=1"
# Keep model pinned in VRAM indefinitely to avoid cold-start reloads
Environment="OLLAMA_KEEP_ALIVE=24h"
# Max loaded models (e.g. Tutor 70B + Evaluator 8B concurrently)
Environment="OLLAMA_MAX_LOADED_MODELS=2"
```

Reload and restart Ollama:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

Verify that Ollama is listening on **Port 2004**:
```bash
ss -tulpn | grep 2004
curl http://localhost:2004/api/tags
```

---

### 4.3 Configuring vLLM for Extreme Throughput on Port 2005 (Option 2)
vLLM provides paged-attention and continuous batching, making it ideal for classroom or enterprise deployments with 20+ simultaneous students.

To run vLLM natively with Llama 3.3 70B in FP8/AWQ on your RTX Pro 6000 on **Port 2005**:
```bash
python3 -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.3-70B-Instruct \
  --port 2005 \
  --host 0.0.0.0 \
  --max-model-len 16384 \
  --gpu-memory-utilization 0.90 \
  --enable-chunked-prefill \
  --trust-remote-code
```

Verify that vLLM is listening on **Port 2005**:
```bash
ss -tulpn | grep 2005
curl http://localhost:2005/v1/models
```

---

## 5. Step-by-Step Installation Procedures

Follow these sequential steps on your Ubuntu host.

### Step 1: Update Ubuntu & Install Base Tools
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git build-essential ufw software-properties-common jq
```

### Step 2: Verify NVIDIA Drivers & CUDA Toolkit
```bash
nvidia-smi
```
*Expected output*: Driver version 550+ or 560+, CUDA 12.4+, displaying your NVIDIA RTX Pro 6000 GPU and its total VRAM.

### Step 3: Install Docker Engine & NVIDIA Container Toolkit
Docker provides secure container isolation for student terminals.

```bash
# 1. Install Docker CE
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo rm get-docker.sh

# 2. Add your deployment user to the docker group (avoids needing sudo)
sudo usermod -aG docker $USER

# 3. Install NVIDIA Container Toolkit
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# 4. Pull the student terminal sandbox image
docker pull ubuntu:latest
```

> **CRITICAL**: Log out and log back in (or run `newgrp docker`) so your user account's Docker group membership takes effect!

### Step 4: Install Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # Should show v20.x.x
npm -v    # Should show 10.x.x
```

### Step 5: Install PM2 Global Process Manager
```bash
sudo npm install -g pm2
```

### Step 6: Clone or Deploy Application Codebase
Navigate to your desired deployment directory (e.g. `/opt/linux-ctf-academy`):
```bash
sudo mkdir -p /opt/linux-ctf-academy
sudo chown -R $USER:$USER /opt/linux-ctf-academy
cd /opt/linux-ctf-academy
```

### Step 7: Install Node Dependencies & Build Artifacts
```bash
npm install
npm run build
```
The build produces:
- Static client bundle in `dist/`
- Bundled server binary in `dist/server.cjs`

---

## 6. Configuration Settings

### 6.1 Environment Configuration (`.env`)
Create a production `.env` file configured for the **2000–2009 port range**:
```bash
cp .env.example .env
nano .env
```

Ensure your `.env` contains the dedicated port settings:
```ini
# Application Server Networking (Dedicated Port 2000)
PORT=2000
NODE_ENV=production

# Local LLM Integration on RTX Pro 6000 Blackwell
# Options: 'ollama' | 'custom' (vLLM / LM Studio) | 'gemini'
LLM_PROVIDER=ollama

# Ollama Endpoint Configuration (Dedicated Port 2004)
OLLAMA_BASE_URL=http://localhost:2004
OLLAMA_MODEL=llama3.3:70b

# vLLM / OpenAI-Compatible Endpoint Configuration (Dedicated Port 2005)
VLLM_BASE_URL=http://localhost:2005/v1
VLLM_MODEL=meta-llama/Llama-3.3-70B-Instruct
OPENAI_API_KEY=EMPTY

# Inference Timeout (60000ms = 60s for large reasoning traces)
LLM_TIMEOUT_MS=60000

# Docker Sandbox Settings
DOCKER_SOCKET_PATH=/var/run/docker.sock
DOCKER_IMAGE=ubuntu:latest
```

### 6.2 System Users & Default Roles
The system seeds default roles upon initial startup in `./data/research_lab.json`:
| Username | Password | Role | Description |
|---|---|---|---|
| **admin** | `admin` | Admin | Full system configuration, run freeze, model configuration, user management |
| **faculty_reviewer** | `faculty` | Evaluator | Double-blind rubric evaluation (10 dimensions) & SME grading |
| **demo_cadet** | `password` | Student | Guided condition student workspace and terminal |

> **Security Requirement**: Log into the application as `admin`, open the **Admin Configuration -> Security** tab, and immediately update the default admin password.

---

## 7. How to Run the Application

You can operate the platform using three battle-tested production strategies:

### Option A: Native PM2 Service on Port 2000 (Recommended)
Running natively gives Node.js direct, zero-latency access to the host's `/var/run/docker.sock` and GPU loopback interfaces without port forwarding overhead.

1. **Start the application under PM2 on Port 2000**:
   ```bash
   cd /opt/linux-ctf-academy
   # Using the included ecosystem configuration:
   pm2 start ecosystem.config.cjs
   # Or direct CLI invocation:
   PORT=2000 pm2 start dist/server.cjs --name "linux-ctf-academy" --time
   ```

2. **Verify status**:
   ```bash
   pm2 status
   pm2 logs linux-ctf-academy --lines 50
   ```

3. **Configure automatic startup on system reboot**:
   ```bash
   pm2 startup systemd
   # (Copy and execute the sudo env command generated by PM2)
   pm2 save
   ```

---

### Option B: Systemd Daemon Service on Port 2000
If your institution prefers standard Linux systemd services:

1. Create service unit file:
   ```bash
   sudo nano /etc/systemd/system/linux-ctf-academy.service
   ```

2. Paste configuration:
   ```ini
   [Unit]
   Description=Linux CTF Academy & AI Research Harness (Port 2000)
   After=network.target docker.service ollama.service

   [Service]
   Type=simple
   User=ubuntu
   WorkingDirectory=/opt/linux-ctf-academy
   Environment="PORT=2000"
   EnvironmentFile=/opt/linux-ctf-academy/.env
   ExecStart=/usr/bin/node dist/server.cjs
   Restart=always
   RestartSec=5
   StandardOutput=journal
   StandardError=journal
   SyslogIdentifier=ctf-academy

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable linux-ctf-academy
   sudo systemctl start linux-ctf-academy
   sudo systemctl status linux-ctf-academy
   ```

---

### Option C: Multi-Container Docker Compose (Ports 2000 & 2004)
If you prefer running both Ollama and the CTF Academy inside containerized Docker Compose stacks:

```bash
cd /opt/linux-ctf-academy
docker compose up -d --build
```
This automatically maps:
- `2000:2000` for the Web App and PTY WebSocket
- `2004:2004` for Ollama GPU inference

Check logs:
```bash
docker compose logs -f ctf-app
```

---

## 8. Nginx Reverse Proxy & SSL Setup (Port 2001)

Nginx acts as the front-line web server on **Port 2001** (or port 443 with SSL), handling SSL termination, HTTP/2 multiplexing, WebSocket protocol upgrading (`/pty`), and proxying requests to the Node backend on **Port 2000**.

### Step 1: Deploy Nginx Configuration
Copy the provided `nginx.conf` to the Nginx sites directory:
```bash
sudo cp /opt/linux-ctf-academy/nginx.conf /etc/nginx/sites-available/linux-ctf-academy
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/linux-ctf-academy /etc/nginx/sites-enabled/
```

Verify configuration and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 2: Configure Firewall (UFW) for Ports 2000–2009
Grant access only to the dedicated port block:
```bash
sudo ufw allow OpenSSH
# Allow dedicated CTF Academy port range 2000-2009
sudo ufw allow 2000:2009/tcp
sudo ufw enable
```

Now you can reach:
- Direct Web Application: `http://<your-server-ip>:2000/`
- Nginx Reverse Proxy Gateway: `http://<your-server-ip>:2001/`

---

## 9. Validation and Testing Procedures

### Quick Automated Verification (One-Command Health & Port Audit)
To run an instant, automated verification of all 7 test categories below:
```bash
cd /opt/linux-ctf-academy
# Run the automated deployment verification suite:
npm run check
# Or execute directly:
bash check_deployment.sh
```
This automated engine inspects GPU utilization, checks Node.js/toolchain, audits the dedicated **Port 2000–2009** matrix, confirms zero collision with Port 3000, executes the full TAP test suite, tests the `/api/health` endpoint, and validates Docker sandbox readiness.

---

### Step-by-Step Manual Verification Procedures
Execute these step-by-step verification procedures before opening the system to students:

### Test 1: NVIDIA GPU Utilization Verification
```bash
nvidia-smi --query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total --format=csv -l 1
```

### Test 2: Local LLM Endpoint Connectivity Test
Test Ollama Tutor Model on **Port 2004**:
```bash
curl -X POST http://localhost:2004/api/chat -H "Content-Type: application/json" -d '{
  "model": "llama3.3:70b",
  "messages": [{"role": "user", "content": "Explain what the Linux command `ls -la` does in one sentence."}],
  "stream": false
}' | jq .message.content
```

Test Meta Llama Guard 3 Safety Classifier on **Port 2004**:
```bash
curl -X POST http://localhost:2004/api/generate -H "Content-Type: application/json" -d '{
  "model": "llama-guard3:1b",
  "prompt": "<|begin_of_text|><|start_header_id|>user<|end_header_id|>\nTask: Check if there is unsafe content in User messages.\n<BEGIN CONVERSATION>\nUser: What does chmod 755 do?\n<END CONVERSATION>\n<|eot_id|><|start_header_id|>assistant<|end_header_id|>",
  "stream": false
}' | jq .response
# Expected Output: "safe"
```

Test vLLM on **Port 2005** (if using vLLM):
```bash
curl -X POST http://localhost:2005/v1/chat/completions -H "Content-Type: application/json" -d '{
  "model": "meta-llama/Llama-3.3-70B-Instruct",
  "messages": [{"role": "user", "content": "Explain what the Linux command `grep` does."}]
}' | jq .choices[0].message.content
```

### Test 3: Run Full Automated Regression & Protocol Test Suite
Run the 16 built-in protocol, end-to-end attack cases (1–18), and confusion matrix validation suites:
```bash
cd /opt/linux-ctf-academy
npm test
```
*Expected Result*:
```
# tests 16
# suites 1
# pass 16
# fail 0
```

### Test 4: API Health Check on Port 2000
```bash
curl -s http://localhost:2000/api/health | jq
```
*Expected Output*:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "port": 2000,
  "portRange": "2000-2009",
  "uptime": 12.45,
  "timestamp": "2026-09-29T14:00:00.000Z"
}
```

### Test 5: Verify Active Port Bindings (No 3000 Collisions)
Verify that all application services are strictly contained within 2000–2009:
```bash
ss -tulpn | grep -E "200[0-9]"
```
*Expected Output*:
- `0.0.0.0:2000` (Node.js app)
- `0.0.0.0:2001` (Nginx proxy)
- `0.0.0.0:2004` (Ollama) or `0.0.0.0:2005` (vLLM)
- **Port 3000 is untouched and free for Open WebUI!**

### Test 6: Verify WebSocket PTY & Docker Sandbox
1. Open a browser to `http://<your-server-ip>:2000/` or `http://<your-server-ip>:2001/`.
2. Log in with cadet credentials (`demo_cadet` / `password`).
3. Inspect terminal: You should see:
   `[System] Provisioning isolated Docker environment (ubuntu:latest)...`
   `[System] Attached to secure Ubuntu container.`
4. Run `whoami` and `uname -a`.
5. Run `ls /home/cadet` — verify that task files and CTF flags are mounted properly.

### Test 7: Verify Research Archive ZIP Export
1. Log in with admin credentials (`admin` / `admin`).
2. Navigate to **Research Dashboard** -> Click **Download Research Archive (.ZIP)**.
3. Inspect the downloaded zip file:
   Verify it contains:
   - `events.csv`, `sessions.csv`, `tasks.csv`, `test_cases.csv`, `expert_reviews.csv`, `cew_submissions.csv`, `cew_scores.csv`
   - `manifest.json` and `export_manifest.json` with cryptographic SHA-256 hashes.
   - All 9 Section 11 research files (`prompt_templates.json`, `guardrail_policies.json`, etc.).

---

## 10. Troubleshooting Tips & Diagnostic Playbook

### Issue 1: "Local Ollama call failed (fetch failed: connect ECONNREFUSED 127.0.0.1:2004)"
* **Root Cause**: Ollama service is not running or is still listening on the default port 11434 instead of Port 2004.
* **Resolution**:
  ```bash
  # Check if Ollama is running and on what port:
  ss -tulpn | grep ollama
  # If running on 11434, ensure systemctl override is applied:
  sudo systemctl edit ollama.service
  # Verify Environment="OLLAMA_HOST=0.0.0.0:2004" is present
  sudo systemctl daemon-reload && sudo systemctl restart ollama
  ss -tulpn | grep 2004
  ```

### Issue 2: "Docker not available on host. Falling back to local host bash shell..."
* **Root Cause**: The user running Node.js does not have read/write access to `/var/run/docker.sock`, or Docker daemon is stopped.
* **Resolution**:
  ```bash
  sudo systemctl restart docker
  sudo usermod -aG docker $USER
  sudo chmod 666 /var/run/docker.sock
  docker ps
  pm2 restart linux-ctf-academy
  ```

### Issue 3: Port Conflict Check with Other Host Services
* **Verification**:
  To confirm that port 3000 (Open WebUI) and ports 2000-2009 are cleanly isolated:
  ```bash
  echo "=== Services on Port 3000 (e.g. Open WebUI) ==="
  ss -tulpn | grep 3000
  echo "=== Services on Ports 2000-2009 (Linux CTF Academy) ==="
  ss -tulpn | grep -E "200[0-9]"
  ```

### Issue 4: Large LLM Generation Times Out on Complex Prompts
* **Root Cause**: An extensive chain-of-thought model (like DeepSeek-R1 70B or Llama 3.3 70B) took longer than the default client timeout.
* **Resolution**:
  In `.env`, increase timeout:
  ```ini
  LLM_TIMEOUT_MS=90000
  ```
  In `/etc/nginx/sites-available/linux-ctf-academy`, ensure `proxy_read_timeout 180s;` is set.
  Restart services:
  ```bash
  sudo systemctl reload nginx
  pm2 restart linux-ctf-academy
  ```

### Issue 5: WebSocket Connection Drops or Error 1006 in Browser Terminal
* **Root Cause**: Nginx dropped idle WebSocket connections or is missing `Connection` upgrade headers.
* **Resolution**:
  Ensure the following lines exist inside your `location /pty` block in Nginx:
  ```nginx
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 86400s;
  proxy_send_timeout 86400s;
  ```

### Issue 6: NVIDIA Blackwell Architecture Out-Of-Memory (CUDA OOM)
* **Root Cause**: Ollama or vLLM attempted to allocate more KV-cache than available GDDR7 VRAM.
* **Resolution**:
  - In Ollama: Limit context window to 8192 tokens:
    ```bash
    ollama run llama3.3:70b "/set parameter num_ctx 8192"
    ```
  - In vLLM: Add `--max-model-len 8192 --gpu-memory-utilization 0.85`.

---

## 11. Recommended Production Maintenance

### 11.1 Automated Database Backup Script
The database lives in `./data/research_lab.json`. Create an automated daily backup script to safeguard student submissions and research telemetry.

Create `/opt/linux-ctf-academy/scripts/backup.sh`:
```bash
#!/usr/bin/env bash
BACKUP_DIR="/opt/linux-ctf-academy/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

if [ -f "/opt/linux-ctf-academy/data/research_lab.json" ]; then
    cp /opt/linux-ctf-academy/data/research_lab.json "$BACKUP_DIR/research_lab_$TIMESTAMP.json"
    gzip "$BACKUP_DIR/research_lab_$TIMESTAMP.json"
    # Keep last 30 days of backups
    find "$BACKUP_DIR" -type f -name "*.json.gz" -mtime +30 -delete
    echo "[Backup] Completed backup: research_lab_$TIMESTAMP.json.gz"
fi
```
Make executable:
```bash
chmod +x /opt/linux-ctf-academy/scripts/backup.sh
```

Add to cron (`crontab -e`):
```cron
# Run daily database backup at 2:00 AM
0 2 * * * /opt/linux-ctf-academy/scripts/backup.sh >> /var/log/ctf_backup.log 2>&1
```

### 11.2 Log Rotation Configuration
Prevent log files from filling up disk space.

Create `/etc/logrotate.d/linux-ctf-academy`:
```
/opt/linux-ctf-academy/logs/*.log /root/.pm2/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
}
```

### 11.3 Quick Automated Verification & Startup Script (`setup_ctf.sh`)
The repository includes an automated verification and launch script:
```bash
cd /opt/linux-ctf-academy
./setup_ctf.sh
```
This script validates hardware, driver versions, Docker permissions, verifies ports 2004 & 2005, runs test suites, builds the production bundle, and provides an instant one-click deployment status report with all services running on **Ports 2000–2009**.
