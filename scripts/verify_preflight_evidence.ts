import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { writePreflightVerificationEvidence } from '../server/verificationEvidence';

const evidencePath = path.join(process.cwd(), 'data', 'preflight-verification.json');
const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('Run this command through npm so build/test evidence can be verified.');
}

fs.rmSync(evidencePath, { force: true });

for (const script of ['build', 'test']) {
  const result = spawnSync(process.execPath, [npmCli, 'run', script], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`The ${script} command failed; no preflight evidence was recorded.`);
  }
}

const evidence = writePreflightVerificationEvidence();
console.log(`Verified build and tests for ${evidence.sourceFingerprint} at ${evidence.verifiedAt}.`);
