import {
  DEFAULT_GUARD_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_TUTOR_MODEL
} from './protocolV5';

export interface OllamaModelVerification {
  reachable: boolean;
  tutorModel: string;
  guardModel: string;
  tutorDigest?: string;
  guardDigest?: string;
  detail: string;
}

function normalizeOllamaBaseUrl(value: string): string {
  return value
    .replace(/\/api\/(?:chat|generate)\/?$/i, '')
    .replace(/\/api\/?$/i, '')
    .replace(/\/+$/, '');
}

function findModelDigest(models: unknown[], targetName: string): string | undefined {
  const model = models.find((entry): entry is { name: string; digest: string } => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as { name?: unknown; digest?: unknown };
    return typeof candidate.name === 'string' &&
      typeof candidate.digest === 'string' &&
      candidate.name.toLowerCase() === targetName.toLowerCase();
  }) as { name: string; digest: string } | undefined;
  if (!model) return undefined;
  const digest = model.digest.replace(/^sha256:/i, '');
  return /^[a-f0-9]{64}$/i.test(digest) ? `sha256:${digest.toLowerCase()}` : undefined;
}

export async function verifyOllamaModels(config: {
  baseUrl?: string;
  tutorModel?: string;
  guardModel?: string;
  timeoutMs?: number;
} = {}): Promise<OllamaModelVerification> {
  const tutorModel = config.tutorModel || process.env.OLLAMA_MODEL || DEFAULT_TUTOR_MODEL;
  const guardModel = config.guardModel || process.env.LLAMA_GUARD_MODEL || DEFAULT_GUARD_MODEL;
  const baseUrl = normalizeOllamaBaseUrl(
    config.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 3000);

  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    if (!response.ok) {
      return {
        reachable: false,
        tutorModel,
        guardModel,
        detail: `Ollama returned HTTP ${response.status}.`
      };
    }

    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('models' in payload) ||
      !Array.isArray(payload.models)
    ) {
      return { reachable: false, tutorModel, guardModel, detail: 'Ollama returned an invalid model list.' };
    }

    const tutorDigest = findModelDigest(payload.models, tutorModel);
    const guardDigest = findModelDigest(payload.models, guardModel);
    return {
      reachable: true,
      tutorModel,
      guardModel,
      tutorDigest,
      guardDigest,
      detail: `Ollama is reachable; tutor digest ${tutorDigest ? 'resolved' : 'missing'}, guard digest ${guardDigest ? 'resolved' : 'missing'}.`
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { reachable: false, tutorModel, guardModel, detail: `Ollama verification failed: ${detail}` };
  } finally {
    clearTimeout(timeout);
  }
}
