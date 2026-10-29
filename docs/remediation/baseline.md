# Phase 0 — Baseline Preservation & Runtime Evidence

**Recorded Timestamp:** `2026-10-27T16:13:41Z`  
**Branch:** `remediation/v5-protocol`  

## 1. Environment & System Metadata
- **Node.js Version:** `v22.23.4`
- **npm Version:** `10.9.9`
- **Operating System / Kernel:** `Linux localhost 4.19.0-gvisor #1 SMP Sun Jan 10 15:06:54 PST 2016 x86_64 GNU/Linux` (Cloud Run gVisor sandbox)
- **`package-lock.json` SHA-256:** `b29d4a891946b3c57a8fe76d2a9980586807d5d378447b0c2da7d2c845f7a597`
- **Docker Daemon Availability in Current Runtime:** `DOCKER_AVAILABLE=false` (`docker info` exits non-zero inside gVisor Cloud Run container; confirms `cloud_demo` profile in hosted AI Studio and requirement for `local_research` profile on a Docker-capable host for formal data collection).
- **Environment Variable Names Present (Values Redacted):**
  `APPLET_DIR`, `APPLET_ID`, `APP_URL`, `AUTHORIZED_SERVICE_ACCOUNT_EMAIL`, `CLOUD_RUN_TIMEOUT_SECONDS`, `CNB_GROUP_ID`, `CNB_STACK_ID`, `CNB_USER_ID`, `CONTROL_PLANE_API_DIR`, `CONTROL_PLANE_PORT`, `CSP_HEADER_VALUE`, `DEFAULT_APP_PORT`, `GEMINI_API_KEY`, `GOMEMLIMIT`, `GOOGLE_RUNTIME`, `HOME`, `K_CONFIGURATION`, `K_REVISION`, `K_SERVICE`, `LANG`, `LANGUAGE`, `LC_ALL`, `NEXT_TELEMETRY_DISABLED`, `NG_ALLOWED_HOSTS`, `NGINX_PORT`, `NODE_ENV`, `NODE_OPTIONS`, `NODE_VERSION`, `NO_UPDATE_NOTIFIER`, `PATH`, `PLAYWRIGHT_BROWSERS_PATH`, `PLAYWRIGHT_CLI_VERSION`, `PORT`, `PWD`, `SHLVL`, `YARN_VERSION`, `_APP_DIR`

## 2. Configured Model & Guardrail Baseline
- **Tutor Model Default:** `gemini-2.5-flash` (cloud) / `qwen2.5-coder:7b` (local Ollama)
- **Generation Settings:** `temperature: 0.1`, `topP: 0.95`, `maxTokens: 512`, `seed: 42`
- **Semantic Guardrail Model:** `llama-guard3:1b` (`temperature: 0`, `seed: 42`)
- **Deterministic Guardrail Policy Version:** `2.1.0`

## 3. Baseline Command Transcripts & Exit Codes

### 3.1 Typecheck / Lint (`npm run lint`)
```text
> linux-ctf-academy@1.0.0 lint
> tsc --noEmit
LINT_EXIT=0
```

### 3.2 Unit & Integration Tests (`npm test`)
```text
> linux-ctf-academy@1.0.0 test
> tsx --test tests/**/*.test.ts

ok 1 - Research Protocol Validation & Production Suite (v1.0.0 Baseline Freeze)
  # tests 31
  # suites 1
  # pass 31
  # fail 0
  # duration_ms 6338.029584
NPM_TEST_EXIT=0
```

### 3.3 Production Build (`npm run build`)
```text
> linux-ctf-academy@1.0.0 build
> vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs

vite v5.4.21 building for production...
✓ 1439 modules transformed.
dist/index.html                     1.87 kB │ gzip:   0.84 kB
dist/assets/index-6GBZ9nXN.css      5.24 kB │ gzip:   1.92 kB
dist/assets/index-w9oDjrJT.js   1,466.08 kB │ gzip: 340.92 kB
✓ built in 8.01s
  dist/server.cjs      254.4kb
  dist/server.cjs.map  420.6kb
⚡ Done in 43ms
BUILD_EXIT=0
```
