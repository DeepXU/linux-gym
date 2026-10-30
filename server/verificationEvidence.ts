import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const EVIDENCE_PATH = path.join('data', 'preflight-verification.json');
const SOURCE_DIRECTORIES = ['components', 'public', 'scripts', 'server', 'services', 'tests'];
const SOURCE_ROOT_FILE_PATTERN = /\.(?:cjs|css|html|js|jsx|json|mjs|ts|tsx)$/i;
const SOURCE_ROOT_CONFIG_FILES = [
  '.env.example',
  '.gitignore',
  'Dockerfile',
  'Dockerfile.sandbox',
  'docker-compose.yml'
];

export interface PreflightVerificationEvidence {
  schemaVersion: 1;
  sourceFingerprint: string;
  nodeVersion: string;
  buildPassed: true;
  testsPassed: true;
  verifiedAt: string;
}

function collectSourceFiles(root: string, directory: string): string[] {
  const absoluteDirectory = path.join(root, directory);
  if (!fs.existsSync(absoluteDirectory)) return [];

  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(root, relativePath);
    return directory.split(path.sep)[0] === 'public' || SOURCE_ROOT_FILE_PATTERN.test(entry.name)
      ? [relativePath]
      : [];
  });
}

export function getSourceFingerprint(root = process.cwd()): string {
  const rootFiles = fs.readdirSync(root)
    .filter(file => SOURCE_ROOT_FILE_PATTERN.test(file))
    .filter(file => fs.statSync(path.join(root, file)).isFile());
  const files = [
    ...SOURCE_ROOT_CONFIG_FILES.filter(file => fs.existsSync(path.join(root, file))),
    ...rootFiles,
    ...SOURCE_DIRECTORIES.flatMap(directory => collectSourceFiles(root, directory))
  ].sort();
  const hash = crypto.createHash('sha256');

  for (const relativePath of files) {
    hash.update(relativePath.replace(/\\/g, '/'));
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(root, relativePath)));
    hash.update('\0');
  }

  return `sha256:${hash.digest('hex')}`;
}

export function writePreflightVerificationEvidence(root = process.cwd()): PreflightVerificationEvidence {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  const evidence: PreflightVerificationEvidence = {
    schemaVersion: 1,
    sourceFingerprint: getSourceFingerprint(root),
    nodeVersion: process.version,
    buildPassed: true,
    testsPassed: true,
    verifiedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(root, EVIDENCE_PATH), JSON.stringify(evidence, null, 2), 'utf8');
  return evidence;
}

export function inspectPreflightVerificationEvidence(root = process.cwd()): {
  valid: boolean;
  detail: string;
} {
  const evidencePath = path.join(root, EVIDENCE_PATH);
  if (!fs.existsSync(evidencePath)) {
    return { valid: false, detail: 'No verified build/test evidence exists for this source tree.' };
  }

  let evidence: Partial<PreflightVerificationEvidence>;
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  } catch {
    return { valid: false, detail: 'The build/test evidence file is invalid JSON.' };
  }

  if (
    evidence.schemaVersion !== 1 ||
    evidence.buildPassed !== true ||
    evidence.testsPassed !== true ||
    evidence.nodeVersion !== process.version ||
    typeof evidence.verifiedAt !== 'string' ||
    evidence.sourceFingerprint !== getSourceFingerprint(root)
  ) {
    return { valid: false, detail: 'Build/test evidence is missing, stale, or from a different Node.js version.' };
  }

  return { valid: true, detail: `Current build and test suite verified at ${evidence.verifiedAt}.` };
}
