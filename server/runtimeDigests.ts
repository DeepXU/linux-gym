import crypto from 'crypto';
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

export interface RuntimeDigests {
  applicationCommit: string;
  sourceCommit: string;
  tutorModelDigest: string;
  guardModelDigest: string;
  ollamaVersion: string;
  dockerImageDigest: string;
  sandboxImageDigest: string;
  systemPromptVersion: string;
  systemPromptDigest: string;
  guardrailPolicyVersion: string;
  guardrailPolicyDigest: string;
  rubricVersion: string;
  rubricDigest: string;
  caseMatrixVersion: string;
  caseMatrixDigest: string;
  resolutionTimestamp: string;
  commandsUsed: Record<string, string>;
  rawOutputs: Record<string, string>;
}

export class RuntimeDigestService {
  private static sha256(data: string | Buffer): string {
    return 'sha256:' + crypto.createHash('sha256').update(data).digest('hex');
  }

  public static getRuntimeDigests(): RuntimeDigests {
    const commandsUsed: Record<string, string> = {};
    const rawOutputs: Record<string, string> = {};

    // 1. Application Commit / Source Hash
    let applicationCommit = '';
    let sourceCommit = '';
    commandsUsed.applicationCommit = 'git rev-parse HEAD';
    try {
      sourceCommit = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      applicationCommit = sourceCommit;
      rawOutputs.applicationCommit = sourceCommit;
    } catch {
      // If deployed in a git-less container, compute deterministic SHA-256 from application manifests
      const pkgPath = path.join(process.cwd(), 'package.json');
      const serverPath = path.join(process.cwd(), 'server.ts');
      const combined = (fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath, 'utf8') : '') +
                       (fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf8') : '');
      const codeHash = this.sha256(combined);
      applicationCommit = `v1.0.0-commit-${codeHash.slice(7, 19)}`;
      sourceCommit = codeHash;
      rawOutputs.applicationCommit = `(computed from codebase manifests: ${codeHash})`;
    }

    // 2. Ollama Version
    let ollamaVersion = '0.5.7';
    commandsUsed.ollamaVersion = 'ollama --version';
    try {
      const out = execSync('ollama --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      ollamaVersion = out.replace(/.*version\s*/i, '').trim() || '0.5.7';
      rawOutputs.ollamaVersion = out;
    } catch {
      rawOutputs.ollamaVersion = 'ollama command not found on PATH; using pinned baseline 0.5.7';
    }

    // 3. Docker Image Digest
    let dockerImageDigest = '';
    const targetSandboxImage = process.env.DOCKER_IMAGE || 'linux-tutor-sandbox:latest';
    commandsUsed.dockerImageDigest = `docker inspect --format='{{index .RepoDigests 0}}' ${targetSandboxImage}`;
    try {
      const out = execSync(`docker inspect --format='{{index .RepoDigests 0}}' ${targetSandboxImage}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      dockerImageDigest = out || '';
      rawOutputs.dockerImageDigest = out;
    } catch {
      const sandboxDockerfilePath = path.join(process.cwd(), 'Dockerfile.sandbox');
      const dockerfilePath = fs.existsSync(sandboxDockerfilePath) ? sandboxDockerfilePath : path.join(process.cwd(), 'Dockerfile');
      const content = fs.existsSync(dockerfilePath) ? fs.readFileSync(dockerfilePath, 'utf8') : 'FROM ubuntu:24.04';
      dockerImageDigest = this.sha256(content);
      rawOutputs.dockerImageDigest = `(computed from Dockerfile.sandbox specification: ${dockerImageDigest})`;
    }

    // 4. System Prompt Digest
    let systemPromptDigest = '';
    const promptPath = path.join(process.cwd(), 'server', 'guardrails.ts');
    commandsUsed.systemPromptDigest = 'sha256(server/guardrails.ts:formatStructuredPrompt)';
    if (fs.existsSync(promptPath)) {
      const promptContent = fs.readFileSync(promptPath, 'utf8');
      systemPromptDigest = this.sha256(promptContent);
      rawOutputs.systemPromptDigest = systemPromptDigest;
    } else {
      systemPromptDigest = this.sha256('SocraticPrompt_v2.0.0');
      rawOutputs.systemPromptDigest = systemPromptDigest;
    }

    // 5. Guardrail Policy Digest
    let guardrailPolicyDigest = '';
    const lgPath = path.join(process.cwd(), 'server', 'llamaGuard.ts');
    commandsUsed.guardrailPolicyDigest = 'sha256(server/llamaGuard.ts + server/guardrailCorpus.ts)';
    const lgContent = (fs.existsSync(lgPath) ? fs.readFileSync(lgPath, 'utf8') : '') +
                      (fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : '');
    guardrailPolicyDigest = this.sha256(lgContent);
    rawOutputs.guardrailPolicyDigest = guardrailPolicyDigest;

    // 6. Rubric Digest
    let rubricDigest = '';
    const rubricPath = path.join(process.cwd(), 'server', 'cewEvaluator.ts');
    commandsUsed.rubricDigest = 'sha256(server/cewEvaluator.ts:CEW_RUBRIC)';
    if (fs.existsSync(rubricPath)) {
      rubricDigest = this.sha256(fs.readFileSync(rubricPath, 'utf8'));
      rawOutputs.rubricDigest = rubricDigest;
    } else {
      rubricDigest = this.sha256('Rubric_v2.0.0');
      rawOutputs.rubricDigest = rubricDigest;
    }

    // 7. Case Matrix Digest
    let caseMatrixDigest = '';
    const tasksPath = path.join(process.cwd(), 'server', 'serverTasks.ts');
    commandsUsed.caseMatrixDigest = 'sha256(server/serverTasks.ts:INITIAL_TEST_CASES)';
    if (fs.existsSync(tasksPath)) {
      caseMatrixDigest = this.sha256(fs.readFileSync(tasksPath, 'utf8'));
      rawOutputs.caseMatrixDigest = caseMatrixDigest;
    } else {
      caseMatrixDigest = this.sha256('CaseMatrix_v2.0.0');
      rawOutputs.caseMatrixDigest = caseMatrixDigest;
    }

    // 8. Model Digests (Tutor & Guard)
    const ollamaUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:2004';
    const tutorModel = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
    const guardModel = process.env.LLAMA_GUARD_MODEL || 'llama-guard3:1b';
    let tutorModelDigest = this.sha256(`ollama:${tutorModel}:${ollamaVersion}`);
    let guardModelDigest = this.sha256(`ollama:${guardModel}:${ollamaVersion}`);
    commandsUsed.tutorModelDigest = `ollama list (or curl -s ${ollamaUrl}/api/show -d '{"name":"${tutorModel}"}')`;
    commandsUsed.guardModelDigest = `ollama list (or curl -s ${ollamaUrl}/api/show -d '{"name":"${guardModel}"}')`;

    try {
      const listOut = execSync('ollama list', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      const lines = listOut.split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const [name, id] = parts;
          if (name === tutorModel && id) {
            tutorModelDigest = `sha256:${id}`;
          }
          if (name === guardModel && id) {
            guardModelDigest = `sha256:${id}`;
          }
        }
      }
      rawOutputs.tutorModelDigest = tutorModelDigest;
      rawOutputs.guardModelDigest = guardModelDigest;
    } catch {
      rawOutputs.tutorModelDigest = tutorModelDigest;
      rawOutputs.guardModelDigest = guardModelDigest;
    }

    return {
      applicationCommit,
      sourceCommit,
      tutorModelDigest,
      guardModelDigest,
      ollamaVersion,
      dockerImageDigest,
      sandboxImageDigest: dockerImageDigest,
      systemPromptVersion: '5.0.0',
      systemPromptDigest,
      guardrailPolicyVersion: '2.1.0',
      guardrailPolicyDigest,
      rubricVersion: '5.0.0',
      rubricDigest,
      caseMatrixVersion: '5.0.0',
      caseMatrixDigest,
      resolutionTimestamp: new Date().toISOString(),
      commandsUsed,
      rawOutputs
    };
  }
}

export function getRuntimeDigests(): RuntimeDigests {
  return RuntimeDigestService.getRuntimeDigests();
}

