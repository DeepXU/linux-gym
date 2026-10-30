# Local Setup and Verification Guide

## Current status

This build is **not ready for participant or formal research data collection**. Ground-truth verification, sequestered-case release/execution, governance state transitions, and execution-integrity retrieval are not implemented end to end. The collection-readiness command fails closed while these blockers remain.

## Requirements

- Ubuntu 22.04/24.04 or another supported Node.js host.
- Node.js 20 or newer and npm.
- Docker Engine with access to the Docker daemon.
- The configured tutor and guard model services, if using a local-model configuration.

The server reads process environment variables; copying `.env.example` to `.env` does not itself load the file when running `npm run dev` or `npm start`. Export the needed values in the shell or configure them through the process manager.

## Install

From the repository root:

```bash
cp .env.example .env
npm ci
```

Set a unique initial administrator password before the first server start:

```bash
export ADMIN_INITIAL_PASSWORD="$(openssl rand -hex 24)"
```

For Docker Compose, put the generated value in `.env` as `ADMIN_INITIAL_PASSWORD=...` before starting the app. If no value is configured, first-run provisioning generates a random password and prints it to the server log. Protect that log.

The configured defaults are Ollama on port `2004`, tutor model `qwen2.5-coder:7b`, and guard model `llama-guard3:1b`. Ensure both models are installed. For a Compose deployment:

```bash
docker compose up -d ollama
docker compose exec ollama ollama pull qwen2.5-coder:7b
docker compose exec ollama ollama pull llama-guard3:1b
```

Compose connects the app to `http://ollama:2004`; host-run development uses `OLLAMA_BASE_URL` from `.env.example`. Existing `data/research_lab.json` settings are preserved rather than silently overwritten, so verify the selected providers and models in administrator settings on an existing installation.

Build the same sandbox image used by both the PTY and smoke checks:

```bash
docker build --pull -t linux-tutor-sandbox:latest -f Dockerfile.sandbox .
docker image inspect linux-tutor-sandbox:latest
docker info
```

The application account needs Docker socket access. On Linux, add the account to the `docker` group and start a new login session; do not make `/var/run/docker.sock` world-writable. Access to the Docker socket is effectively host-administrator access, so run the application only on a trusted host.

## Validate

Run each command and inspect its actual exit code/output:

```bash
npm run lint
npm test
npm run build
npm run verify:preflight-evidence
npm run test:sandbox-smoke
npm run study:verify
npm run verify:collection-ready
```

`npm run verify:preflight-evidence` reruns the build and tests and records source-fingerprinted evidence for the freeze preflight; any source or lockfile change makes that evidence stale. The Docker smoke suite uses disposable containers and checks all eight tasks twice. Any failed task, missing image, Docker error, or reported container leak is a stop condition. The current readiness result is expected to be **NOT READY** because the ground-truth and sequestered workflows are missing. Do not treat older reports or example output in historical files as evidence that these commands passed.

## Run locally for development

```bash
export PORT=2000
npm run dev
```

Open `http://localhost:2000`, authenticate with the server-provisioned account, and verify that the real terminal reports `whoami` as `cadet` and `pwd` as `/home/cadet`. Stop Docker and confirm that PTY creation fails rather than falling back to simulated or host-shell execution.

For a production bundle:

```bash
npm run build
PORT=2000 npm start
```

Do not enroll participants, lock a research run, or describe this build as research-ready until every readiness blocker is implemented and independently validated on the deployment host.
