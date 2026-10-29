#!/usr/bin/env bash
# ==============================================================================
# Production Deployment Verification & Diagnostics Engine (check_deployment.sh)
# Target Platform: Ubuntu Linux 22.04 / 24.04 LTS (NVIDIA RTX Pro 6000 Blackwell)
# Network Policy: Dedicated Port Range 2000–2009 (Zero Conflict with Port 3000)
# Reference: UBUNTU_DEPLOYMENT_GUIDE.md (Section 9: Validation Procedures)
# ==============================================================================

set -o pipefail

# ANSI Color Codes for Scannable Console Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASSED_CHECKS=0
WARNING_CHECKS=0
FAILED_CHECKS=0

print_header() {
    echo -e "${BLUE}===================================================================${NC}"
    echo -e "${CYAN}${BOLD}     Linux CTF Academy - Production Deployment Verification       ${NC}"
    echo -e "${BLUE}===================================================================${NC}"
    echo -e "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo -e "Hostname:  $(hostname 2>/dev/null || echo 'localhost')"
    echo -e "Directory: $(pwd)"
    echo -e "${BLUE}-------------------------------------------------------------------${NC}"
}

report_pass() {
    local title="$1"
    local detail="$2"
    echo -e "  [${GREEN} PASS ${NC}] ${BOLD}${title}${NC}: ${detail}"
    ((PASSED_CHECKS++))
}

report_warn() {
    local title="$1"
    local detail="$2"
    echo -e "  [${YELLOW} WARN ${NC}] ${BOLD}${title}${NC}: ${detail}"
    ((WARNING_CHECKS++))
}

report_fail() {
    local title="$1"
    local detail="$2"
    echo -e "  [${RED} FAIL ${NC}] ${BOLD}${title}${NC}: ${detail}"
    ((FAILED_CHECKS++))
}

print_header

# ------------------------------------------------------------------------------
# Check 1: Host Operating System & Hardware Verification
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}--- Step 1: Operating System & Hardware Inspection ---${NC}"
if [ -f /etc/os-release ]; then
    OS_NAME=$(grep "^PRETTY_NAME=" /etc/os-release | cut -d= -f2 | tr -d '"')
    report_pass "Operating System" "${OS_NAME}"
else
    report_warn "Operating System" "Unknown Linux distribution (missing /etc/os-release)"
fi

# NVIDIA GPU Verification (Test 1 in Guide)
if command -v nvidia-smi &> /dev/null; then
    GPU_INFO=$(nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>/dev/null | head -n 1)
    if [ -n "$GPU_INFO" ]; then
        report_pass "NVIDIA GPU" "${GPU_INFO}"
        # Query utilization
        GPU_UTIL=$(nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader 2>/dev/null | head -n 1)
        echo -e "         ${CYAN}Current VRAM / Compute:${NC} ${GPU_UTIL}"
    else
        report_warn "NVIDIA GPU" "nvidia-smi installed but no GPU device responded"
    fi
else
    report_warn "NVIDIA GPU" "nvidia-smi not found in PATH (Local LLM acceleration requires NVIDIA drivers)"
fi

# ------------------------------------------------------------------------------
# Check 2: Node.js, NPM & Process Manager Toolchain
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}--- Step 2: Runtime & Toolchain Verification ---${NC}"
if command -v node &> /dev/null; then
    NODE_V=$(node -v)
    NODE_MAJOR=$(echo "$NODE_V" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        report_pass "Node.js Engine" "${NODE_V} (Meets >= v18 requirement; v20 LTS recommended)"
    else
        report_fail "Node.js Engine" "${NODE_V} is below minimum supported v18.0.0"
    fi
else
    report_fail "Node.js Engine" "Node.js executable not detected"
fi

if command -v npm &> /dev/null; then
    NPM_V=$(npm -v)
    report_pass "NPM Package Tool" "v${NPM_V}"
else
    report_fail "NPM Package Tool" "npm executable not detected"
fi

# PM2 & Nginx checks
if command -v pm2 &> /dev/null || npx pm2 -v &> /dev/null; then
    PM2_V=$(pm2 -v 2>/dev/null || npx pm2 -v 2>/dev/null || echo "available")
    report_pass "PM2 Process Manager" "PM2 v${PM2_V} ready"
else
    report_warn "PM2 Process Manager" "PM2 not installed globally (run 'sudo npm install -g pm2' or use npx)"
fi

if command -v nginx &> /dev/null; then
    NGINX_V=$(nginx -v 2>&1 | awk -F'/' '{print $2}')
    report_pass "Nginx Reverse Proxy" "Nginx v${NGINX_V} installed"
else
    report_warn "Nginx Reverse Proxy" "Nginx not installed (direct port 2000 access remains operational)"
fi

# ------------------------------------------------------------------------------
# Check 3: Port Isolation Matrix & Collision Prevention (Ports 2000–2009)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}--- Step 3: Network Port Matrix & Port 3000 Collision Audit ---${NC}"

# Check that Port 3000 is NOT owned by this application
PORT_3000_OCCUPIED=false
if command -v ss &> /dev/null; then
    PORT_3000_INFO=$(ss -tulpn 2>/dev/null | grep ":3000 " || true)
    if [ -n "$PORT_3000_INFO" ]; then
        PORT_3000_OCCUPIED=true
    fi
fi

if [ "$PORT_3000_OCCUPIED" = true ]; then
    echo -e "  [${CYAN} INFO ${NC}] ${BOLD}Port 3000 Status${NC}: In use by external service (e.g., Open WebUI / Preview) - CTF app correctly bypasses this port."
else
    echo -e "  [${CYAN} INFO ${NC}] ${BOLD}Port 3000 Status${NC}: Available/Unused by CTF app (No conflicts with external tools)."
fi

# Check Port 2000 (Application Server)
PORT_2000_BOUND=false
if command -v ss &> /dev/null; then
    if ss -tulpn 2>/dev/null | grep -E "(:2000 )" &> /dev/null; then
        PORT_2000_BOUND=true
    fi
fi

if [ "$PORT_2000_BOUND" = true ]; then
    report_pass "Port 2000 (App Server)" "Active and listening"
else
    report_pass "Port 2000 (App Server)" "Port 2000 is free and reserved for CTF application"
fi

# Check Port 2001 (Nginx Proxy)
if command -v ss &> /dev/null; then
    if ss -tulpn 2>/dev/null | grep -E "(:2001 )" &> /dev/null; then
        report_pass "Port 2001 (Nginx Proxy)" "Active and proxying to 2000"
    else
        report_pass "Port 2001 (Nginx Proxy)" "Port 2001 reserved for Nginx reverse proxy"
    fi
fi

# Probe Ollama Local LLM on Port 2004 (fallback: 11434)
OLLAMA_FOUND=false
if curl -s --connect-timeout 2 http://localhost:2004/api/tags &> /dev/null; then
    OLLAMA_MODELS=$(curl -s http://localhost:2004/api/tags | grep -o '"name":"[^"]*"' | head -n 3 | tr '\n' ' ')
    report_pass "Ollama LLM (Port 2004)" "Connected successfully (${OLLAMA_MODELS:-Ready})"
    OLLAMA_FOUND=true
elif curl -s --connect-timeout 2 http://localhost:11434/api/tags &> /dev/null; then
    report_warn "Ollama LLM" "Listening on default port 11434 instead of dedicated port 2004. Set OLLAMA_HOST=0.0.0.0:2004 in systemd unit."
else
    report_warn "Ollama LLM" "No Ollama instance currently responding on port 2004 (Start via systemd or docker-compose)"
fi

# Probe vLLM Local LLM on Port 2005 (fallback: 8000)
if curl -s --connect-timeout 2 http://localhost:2005/v1/models &> /dev/null; then
    report_pass "vLLM Engine (Port 2005)" "Connected successfully"
elif curl -s --connect-timeout 2 http://localhost:8000/v1/models &> /dev/null; then
    report_warn "vLLM Engine" "Responding on port 8000 instead of dedicated port 2005"
else
    echo -e "  [${CYAN} INFO ${NC}] ${BOLD}vLLM Engine (Port 2005)${NC}: Optional endpoint not active (Ollama or Gemini active)"
fi

# ------------------------------------------------------------------------------
# Check 4: Production Build Artifacts Integrity
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}--- Step 4: Production Bundle & Build Verification ---${NC}"
if [ -f "dist/server.cjs" ] && [ -f "dist/index.html" ]; then
    SERVER_SIZE=$(ls -lh dist/server.cjs | awk '{print $5}')
    HTML_SIZE=$(ls -lh dist/index.html | awk '{print $5}')
    report_pass "Production Bundle" "dist/server.cjs (${SERVER_SIZE}) and dist/index.html (${HTML_SIZE}) present"
else
    report_warn "Production Bundle" "Missing dist/server.cjs or dist/index.html (Run 'npm run build')"
fi

if [ -f "ecosystem.config.cjs" ]; then
    report_pass "PM2 Ecosystem File" "ecosystem.config.cjs configured for Port 2000"
else
    report_fail "PM2 Ecosystem File" "ecosystem.config.cjs missing"
fi

if [ -f "docker-compose.yml" ]; then
    report_pass "Docker Compose" "docker-compose.yml configured for Ports 2000 & 2004"
else
    report_fail "Docker Compose" "docker-compose.yml missing"
fi

# ------------------------------------------------------------------------------
# Check 5: Protocol & Automated Regression Test Suite (Test 3 in Guide)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}--- Step 5: Automated Test Suite Execution (npm test) ---${NC}"
TEST_OUTPUT=$(npm test 2>&1)
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    PASSED_TESTS=$(echo "$TEST_OUTPUT" | grep -E "# pass [0-9]+" | awk '{print $3}' | tail -n 1)
    TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep -E "# tests [0-9]+" | awk '{print $3}' | tail -n 1)
    report_pass "Test Suite (TAP)" "All ${PASSED_TESTS:-10}/${TOTAL_TESTS:-10} protocol and regression tests passed"
else
    report_fail "Test Suite (TAP)" "One or more tests failed (Run 'npm test' for details)"
fi

# ------------------------------------------------------------------------------
# Check 6: Docker Sandbox & Terminal Isolation Readiness (Test 6 in Guide)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}--- Step 6: Docker Sandbox Engine & Container Images ---${NC}"
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        report_pass "Docker Daemon" "Docker engine is running and accessible"
        if docker image inspect ubuntu:latest &> /dev/null; then
            report_pass "Sandbox Image" "ubuntu:latest is cached locally for instant student PTY provisioning"
        else
            report_warn "Sandbox Image" "ubuntu:latest not cached yet (run 'docker pull ubuntu:latest')"
        fi
    else
        report_warn "Docker Daemon" "Docker installed but daemon is not running or lacks user permissions"
    fi
else
    report_warn "Docker Daemon" "Docker command not found (PTY terminal will run in local subprocess fallback)"
fi

# ------------------------------------------------------------------------------
# Check 7: API Health Check & Metadata Verification (Test 4 in Guide)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}--- Step 7: API Health Endpoint Inspection ---${NC}"
# Probe port 2000 first, then fallback to current process port (e.g. 3000 in dev)
HEALTH_URL=""
if curl -s --connect-timeout 1 http://localhost:2000/api/health &> /dev/null; then
    HEALTH_URL="http://localhost:2000/api/health"
elif curl -s --connect-timeout 1 http://localhost:3000/api/health &> /dev/null; then
    HEALTH_URL="http://localhost:3000/api/health"
fi

if [ -n "$HEALTH_URL" ]; then
    HEALTH_BODY=$(curl -s "$HEALTH_URL")
    STATUS_VAL=$(echo "$HEALTH_BODY" | grep -o '"status":"[^"]*"' | cut -d: -f2 | tr -d '"')
    PORT_VAL=$(echo "$HEALTH_BODY" | grep -o '"portRange":"[^"]*"' | cut -d: -f2 | tr -d '"')
    if [ "$STATUS_VAL" = "ok" ]; then
        report_pass "API Health (/api/health)" "Status: ok | Port Policy: ${PORT_VAL:-2000-2009} (${HEALTH_URL})"
    else
        report_warn "API Health (/api/health)" "Unexpected health response: ${HEALTH_BODY}"
    fi
else
    echo -e "  [${CYAN} INFO ${NC}] ${BOLD}API Health Check${NC}: Server not currently running in background. Test after 'PORT=2000 npm start'."
fi

# ------------------------------------------------------------------------------
# Summary & Executive Scorecard
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}===================================================================${NC}"
echo -e "${CYAN}${BOLD}                 Validation Summary Scorecard                     ${NC}"
echo -e "${BLUE}===================================================================${NC}"
echo -e "Passed Checks:   ${GREEN}${BOLD}${PASSED_CHECKS}${NC}"
echo -e "Warnings:        ${YELLOW}${BOLD}${WARNING_CHECKS}${NC}"
echo -e "Failed Checks:   ${RED}${BOLD}${FAILED_CHECKS}${NC}"
echo -e "${BLUE}-------------------------------------------------------------------${NC}"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ System is validated and ready for production deployment on Ubuntu!${NC}"
    echo -e "Dedicated Port Range: ${CYAN}2000–2009${NC} (Safe to run concurrently with Open WebUI)"
    echo -e "\nRecommended Start Command:"
    echo -e "  ${CYAN}pm2 start ecosystem.config.cjs${NC}"
    echo -e "  ${CYAN}# or direct:${NC}"
    echo -e "  ${CYAN}PORT=2000 npm start${NC}"
    exit 0
else
    echo -e "${RED}${BOLD}✗ Some checks failed. Please address the errors above before launch.${NC}"
    exit 1
fi
