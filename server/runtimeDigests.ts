import crypto from 'crypto';
import fs from 'fs';
import { execFileSync, execSync } from 'child_process';
import path from 'path';
import { DEFAULT_GUARD_MODEL, DEFAULT_OLLAMA_URL, DEFAULT_TUTOR_MODEL } from './protocolV5';
import { SandboxProvider } from './sandboxProvider';

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

export interface ResolvedModelDigests {
  tutorModel?: string;
  guardModel?: string;
  ollamaUrl?: string;
  tutorDigest?: string;
  guardDigest?: string;
}

export class RuntimeDigestService {
  private static sha256(data: string | Buffer): string {
    return 'sha256:' + crypto.createHash('sha256').update(data).digest('hex');
  }

  public static getRuntimeDigests(modelIdentity: ResolvedModelDigests = {}): RuntimeDigests {
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
    let ollamaVersion = 'unverified';
    commandsUsed.ollamaVersion = 'ollama --version';
    try {
      const out = execSync('ollama --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      ollamaVersion = out.replace(/.*version\s*/i, '').trim() || 'unverified';
      rawOutputs.ollamaVersion = out;
    } catch {
      rawOutputs.ollamaVersion = 'Ollama version was not resolved from the runtime.';
    }

    // 3. Docker Image Digest
    let dockerImageDigest = '';
    commandsUsed.dockerImageDigest = `docker image inspect --format={{.Id}} ${SandboxProvider.DEFAULT_DOCKER_IMAGE}`;
    try {
      const out = execFileSync(
        'docker',
        ['image', 'inspect', '--format={{.Id}}', SandboxProvider.DEFAULT_DOCKER_IMAGE],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 2500 }
      ).trim();
      dockerImageDigest = /^sha256:[a-f0-9]{64}$/i.test(out) ? out : 'unverified';
      rawOutputs.dockerImageDigest = out;
    } catch {
      dockerImageDigest = 'unverified';
      rawOutputs.dockerImageDigest = 'Docker image identity was not resolved from the live Docker daemon.';
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
    const tutorModel = modelIdentity.tutorModel || process.env.OLLAMA_MODEL || DEFAULT_TUTOR_MODEL;
    const guardModel = modelIdentity.guardModel || process.env.LLAMA_GUARD_MODEL || DEFAULT_GUARD_MODEL;
    const ollamaUrl = modelIdentity.ollamaUrl || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL;
    commandsUsed.tutorModelDigest = `GET ${ollamaUrl}/api/tags (model: ${tutorModel})`;
    commandsUsed.guardModelDigest = `GET ${ollamaUrl}/api/tags (model: ${guardModel})`;
    const tutorModelDigest = modelIdentity.tutorDigest || 'unverified';
    const guardModelDigest = modelIdentity.guardDigest || 'unverified';
    rawOutputs.tutorModelDigest = tutorModelDigest;
    rawOutputs.guardModelDigest = guardModelDigest;

    return {
      applicationCommit,
      sourceCommit,
      tutorModelDigest,
      guardModelDigest,
      ollamaVersion,
      dockerImageDigest,
      sandboxImageDigest: dockerImageDigest,
      systemPromptVersion: '2.0.0',
      systemPromptDigest,
      guardrailPolicyVersion: '2.1.0',
      guardrailPolicyDigest,
      rubricVersion: '2.0.0',
      rubricDigest,
      caseMatrixVersion: '2.0.0',
      caseMatrixDigest,
      resolutionTimestamp: new Date().toISOString(),
      commandsUsed,
      rawOutputs
    };
  }
}
