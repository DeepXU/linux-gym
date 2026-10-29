#!/usr/bin/env bash
# ==============================================================================
# Linux CTF Academy & Research Evaluation Platform
# Ubuntu Automated Setup, Verification & Launch Script
# Target Hardware: NVIDIA RTX Pro 6000 Blackwell GPU / Ubuntu 22.04+ LTS
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================================${NC}"
echo -e "${CYAN}    Linux CTF Academy & AI Research Harness - Ubuntu Deployment     ${NC}"
echo -e "${BLUE}===================================================================${NC}"

# 1. System & Architecture Detection
echo -e "\n${YELLOW}[1/7] Inspecting System Environment & Hardware...${NC}"
OS_INFO=$(cat /etc/os-release | grep "PRETTY_NAME" | cut -d= -f2 | tr -d '"')
echo -e "Operating System: ${GREEN}${OS_INFO}${NC}"

# Check NVIDIA GPU
if command -v nvidia-smi &> /dev/null; then
    GPU_NAME=$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | head -n 1)
    CUDA_VER=$(nvidia-smi | grep "CUDA Version" | awk '{print $9}')
    echo -e "NVIDIA GPU Detected: ${GREEN}${GPU_NAME}${NC}"
    echo -e "Driver CUDA Version: ${GREEN}${CUDA_VER}${NC}"
else
    echo -e "${YELLOW}[WARNING] nvidia-smi not detected in PATH. Local LLM GPU acceleration requires NVIDIA drivers.${NC}"
fi

# 2. Node.js & Toolchain Verification
echo -e "\n${YELLOW}[2/7] Checking Node.js and Build Toolchain...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed. Please install Node.js v20 LTS:${NC}"
    echo -e "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo -e "  sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "Node.js Version: ${GREEN}${NODE_VERSION}${NC} (Minimum required: v18.0.0, Recommended: v20.x LTS)"
echo -e "NPM Version:     ${GREEN}${NPM_VERSION}${NC}"

# 3. Docker Sandbox Verification
echo -e "\n${YELLOW}[3/7] Checking Docker & Terminal Sandbox Engine...${NC}"
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        echo -e "Docker Engine:    ${GREEN}Running & Authorized${NC}"
        
        # Check / pull ubuntu:latest for student container sandboxes
        if docker image inspect ubuntu:latest &> /dev/null; then
            echo -e "Sandbox Image:    ${GREEN}ubuntu:latest is already cached${NC}"
        else
            echo -e "Sandbox Image:    ${CYAN}Pulling ubuntu:latest for isolated student sandboxes...${NC}"
            docker pull ubuntu:latest || echo -e "${YELLOW}Warning: Could not pull ubuntu:latest automatically. Run 'docker pull ubuntu:latest' manually.${NC}"
        fi
    else
        echo -e "${YELLOW}[NOTICE] Docker is installed but current user cannot communicate with /var/run/docker.sock.${NC}"
        echo -e "To grant access, run:"
        echo -e "  sudo usermod -aG docker \$USER && newgrp docker"
        echo -e "The application will safely fall back to host bash sandboxes in the meantime."
    fi
else
    echo -e "${YELLOW}[NOTICE] Docker not found. Student terminal sessions will run using native host bash shell.${NC}"
fi

# 4. Local LLM Server Connectivity Check (Ollama & vLLM on Ports 2004/2005)
echo -e "\n${YELLOW}[4/7] Checking Local LLM Inference Engines (Ports 2004 & 2005 on NVIDIA GPU)...${NC}"

OLLAMA_STATUS=false
VLLM_STATUS=false

# Check Ollama on dedicated Port 2004 (or legacy fallback 11434)
OLLAMA_CHECK_PORT=2004
if ! curl -s --connect-timeout 2 http://localhost:2004/api/tags &> /dev/null; then
    if curl -s --connect-timeout 2 http://localhost:11434/api/tags &> /dev/null; then
        OLLAMA_CHECK_PORT=11434
    fi
fi

if curl -s --connect-timeout 2 http://localhost:${OLLAMA_CHECK_PORT}/api/tags &> /dev/null; then
    OLLAMA_STATUS=true
    INSTALLED_MODELS=$(curl -s http://localhost:${OLLAMA_CHECK_PORT}/api/tags | grep -o '"name":"[^"]*"' | head -n 4 | tr '\n' ' ' || true)
    echo -e "Ollama Service:   ${GREEN}ONLINE${NC} on http://localhost:${OLLAMA_CHECK_PORT}"
    echo -e "Available Models: ${CYAN}${INSTALLED_MODELS}${NC}"
else
    echo -e "Ollama Service:   ${YELLOW}Not detected on localhost:2004 (or 11434)${NC}"
fi

# Check vLLM / OpenAI endpoint on dedicated Port 2005 (or legacy fallback 8000)
VLLM_CHECK_PORT=2005
if ! curl -s --connect-timeout 2 http://localhost:2005/v1/models &> /dev/null; then
    if curl -s --connect-timeout 2 http://localhost:8000/v1/models &> /dev/null; then
        VLLM_CHECK_PORT=8000
    fi
fi

if curl -s --connect-timeout 2 http://localhost:${VLLM_CHECK_PORT}/v1/models &> /dev/null; then
    VLLM_STATUS=true
    echo -e "vLLM / OpenAI:    ${GREEN}ONLINE${NC} on http://localhost:${VLLM_CHECK_PORT}/v1"
else
    echo -e "vLLM / OpenAI:    ${YELLOW}Not detected on localhost:2005 (or 8000)${NC}"
fi

if [ "$OLLAMA_STATUS" = false ] && [ "$VLLM_STATUS" = false ]; then
    echo -e "${YELLOW}[INFO] No local LLM server detected on ports 2004 or 2005.${NC}"
    echo -e "To launch Ollama on dedicated port 2004:"
    echo -e "  OLLAMA_HOST=0.0.0.0:2004 ollama serve &"
    echo -e "To launch vLLM on dedicated port 2005:"
    echo -e "  python3 -m vllm.entrypoints.openai.api_server --port 2005 ..."
    echo -e "Or configure the endpoint in the web UI under Admin Settings -> Ollama/Custom."
fi

# 5. Environment File Initialization
echo -e "\n${YELLOW}[5/7] Initializing Environment Settings...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "Created ${GREEN}.env${NC} from ${GREEN}.env.example${NC} (Customize settings as needed)"
    fi
else
    echo -e "Using existing ${GREEN}.env${NC} configuration file."
fi

# 6. Dependencies & Production Build
echo -e "\n${YELLOW}[6/7] Installing Dependencies & Compiling Production Bundle...${NC}"
npm install
echo -e "${CYAN}Building frontend and bundling Node.js production server...${NC}"
npm run build

# 7. Verification Test Suite
echo -e "\n${YELLOW}[7/7] Running Protocol & Regression Verification Test Suite...${NC}"
npm test

echo -e "\n${BLUE}===================================================================${NC}"
echo -e "${GREEN}✓ Production Verification Completed Successfully!${NC}"
echo -e "${BLUE}===================================================================${NC}"
echo -e "You are ready to run the application in production!"
echo -e ""
echo -e "To start the application (Dedicated Port Range: 2000-2009):"
echo -e "  ${CYAN}# Option A: Direct Production Launch (Port 2000)${NC}"
echo -e "  PORT=2000 npm start"
echo -e ""
echo -e "  ${CYAN}# Option B: Background PM2 Process Manager (Port 2000)${NC}"
echo -e "  npx pm2 start ecosystem.config.cjs"
echo -e "  npx pm2 save"
echo -e ""
echo -e "  ${CYAN}# Option C: Docker Compose (GPU-accelerated multi-container, Ports 2000 & 2004)${NC}"
echo -e "  docker compose up -d --build"
echo -e ""
echo -e "Web Interface:      ${GREEN}http://localhost:2000${NC} (Direct) or ${GREEN}http://localhost:2001${NC} (via Nginx)"
echo -e "Local Ollama:       ${GREEN}http://localhost:2004${NC}"
echo -e "Local vLLM:         ${GREEN}http://localhost:2005/v1${NC}"
echo -e "Port Allocation:    ${CYAN}Ports 2000-2009${NC} (Zero conflicts with Open WebUI on port 3000)"
echo -e "Default Admin:      username: ${GREEN}admin${NC} / password: ${GREEN}admin${NC}"
echo -e "Faculty Reviewer:   username: ${GREEN}faculty_reviewer${NC} / password: ${GREEN}faculty${NC}"
echo -e "Student Demo:       username: ${GREEN}demo_cadet${NC} / password: ${GREEN}password${NC}"
echo -e "${BLUE}===================================================================${NC}"
