import { GoogleGenAI } from '@google/genai';
import { db } from './db';
import { Level, ExperimentalCondition } from '../types';
import {
  DEFAULT_AI_PROVIDER,
  DEFAULT_OLLAMA_URL,
  DEFAULT_TUTOR_MODEL,
  validateOllamaModelRole
} from './protocolV5';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIGenerationOptions {
  systemPrompt: string;
  userQuery: string;
  conversationHistory?: Array<{ sender: string; text: string }>;
  task?: Level;
  condition?: ExperimentalCondition;
  isFormalRun?: boolean;
}

/**
 * Normalizes an Ollama base URL or /api/chat endpoint into a clean /api/chat URL.
 */
function buildOllamaChatUrl(baseUrl: string): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  if (cleanBase.endsWith('/api/chat')) return cleanBase;
  if (cleanBase.endsWith('/api/generate')) return cleanBase.replace(/\/api\/generate$/, '/api/chat');
  return `${cleanBase}/api/chat`;
}

export function verifyFrozenModelDigest(
  frozenDigest: string | undefined,
  liveDigest: string | undefined,
  isLockedRun: boolean
): void {
  if (!isLockedRun || !frozenDigest) return;
  const cleanFrozen = frozenDigest.trim();
  const cleanLive = (liveDigest || '').trim();
  if (!cleanLive || cleanFrozen !== cleanLive) {
    throw new Error(
      `CONFIGURATION_ERROR: Live model digest (${cleanLive || 'unavailable'}) does not match frozen run manifest digest (${cleanFrozen}). Execution rejected.`
    );
  }
}

/**
 * Call local Ollama chat API (runs locally with zero cloud API keys on GPU/CPU)
 * Uses the single configured OLLAMA_BASE_URL (default http://localhost:2004).
 */
export async function callOllamaChat({
  baseUrl,
  model,
  systemPrompt,
  messages,
  temperature = 0.2
}: {
  baseUrl: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<string> {
  const url = buildOllamaChatUrl(baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL);

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const timeoutMs = process.env.LLM_TIMEOUT_MS ? parseInt(process.env.LLM_TIMEOUT_MS, 10) : 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        stream: false,
        options: { temperature }
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Ollama error HTTP ${res.status} (${url}): ${res.statusText}`);
    }

    const data: any = await res.json();
    const rawContent = (data.message?.content || '').trim();
    const strippedContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const content = strippedContent || rawContent;
    if (!content) {
      throw new Error(`Ollama returned empty message content from ${url}`);
    }
    return content;
  } catch (err: any) {
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call local OpenAI-compatible endpoint (e.g. vLLM, LM Studio, llama.cpp server, LocalAI)
 */
export async function callOpenAICompatibleChat({
  baseUrl,
  apiKey,
  model,
  systemPrompt,
  messages,
  temperature = 0.2
}: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<string> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = cleanBase.endsWith('/v1/chat/completions')
    ? cleanBase
    : cleanBase.endsWith('/v1')
    ? `${cleanBase}/chat/completions`
    : `${cleanBase}/v1/chat/completions`;

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const timeoutMs = process.env.LLM_TIMEOUT_MS ? parseInt(process.env.LLM_TIMEOUT_MS, 10) : 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey || 'EMPTY'}`
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Local OpenAI/vLLM error HTTP ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    if (!content) {
      throw new Error('Local OpenAI/vLLM endpoint returned empty response content');
    }
    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Google Gemini using the official @google/genai SDK (Optional secondary cloud provider; never default)
 */
export async function callGeminiChat({
  apiKey,
  model = 'gemini-2.5-flash',
  systemPrompt,
  userQuery,
  conversationHistory = [],
  temperature = 0.2
}: {
  apiKey: string;
  model?: string;
  systemPrompt: string;
  userQuery: string;
  conversationHistory?: Array<{ sender: string; text: string }>;
  temperature?: number;
}): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const contents: any[] = [];
  for (const h of conversationHistory) {
    contents.push({
      role: h.sender === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    });
  }
  contents.push({
    role: 'user',
    parts: [{ text: userQuery }]
  });

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: 1024
    }
  });

  const text = (response.text || '').trim();
  if (!text) {
    throw new Error('Gemini API returned an empty response');
  }
  return text;
}

/**
 * Unified AI Generation router
 * - Defaults strictly to local Ollama (DEFAULT_AI_PROVIDER = 'ollama', DEFAULT_TUTOR_MODEL = 'qwen2.5-coder:7b').
 * - Never silently falls back to a canned rule-based response or cloud provider on failure.
 */
export async function generateAITutorResponse(options: AIGenerationOptions): Promise<{
  reply: string;
  providerUsed: 'ollama' | 'custom' | 'gemini';
}> {
  const config = (db.getConfig() || {}) as any;
  const { systemPrompt, userQuery, conversationHistory = [] } = options;

  const activeRun = db.getActiveRun();
  const isFormalOrPilot =
    options.isFormalRun ??
    Boolean(
      activeRun &&
        activeRun.isLocked &&
        (activeRun.runType === 'formal' || activeRun.runType === 'pilot' || activeRun.runType === 'regression')
    );

  const messages: ChatMessage[] = conversationHistory.map(h => ({
    role: (h.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: h.text
  }));
  messages.push({ role: 'user', content: userQuery });

  // Provider selection precedence: process.env.LLM_PROVIDER -> DB config -> DEFAULT_AI_PROVIDER ('ollama')
  const explicitProvider = (
    process.env.LLM_PROVIDER ||
    config.provider ||
    config.tutorProvider ||
    DEFAULT_AI_PROVIDER
  ).toLowerCase();

  // 1. OpenAI-Compatible / Custom vLLM / LM Studio Provider
  const isCustomOrVllm =
    explicitProvider === 'custom' || explicitProvider === 'vllm' || explicitProvider === 'openai';
  if (isCustomOrVllm) {
    const baseUrl =
      config.openaiUrl || process.env.VLLM_BASE_URL || process.env.OPENAI_BASE_URL || 'http://localhost:2005/v1';
    const model =
      config.openaiModel || process.env.VLLM_MODEL || process.env.OPENAI_MODEL || DEFAULT_TUTOR_MODEL;
    const apiKey = config.openaiKey || process.env.OPENAI_API_KEY || 'EMPTY';
    try {
      const reply = await callOpenAICompatibleChat({
        baseUrl,
        apiKey,
        model,
        systemPrompt,
        messages,
        temperature: config.temperature ?? 0.2
      });
      return { reply, providerUsed: 'custom' };
    } catch (err: any) {
      throw new Error(
        `CONFIGURATION_ERROR: Configured OpenAI/vLLM provider (${model} at ${baseUrl}) failed without fallback: ${err.message}`
      );
    }
  }

  // 2. Google Gemini Provider (Only if explicitly selected AND not in a locked formal/pilot/regression run)
  if (explicitProvider === 'gemini') {
    if (isFormalOrPilot) {
      throw new Error(
        'CONFIGURATION_ERROR: Cloud Gemini provider is prohibited during formal evaluation, pilot, or regression runs. Use local Ollama.'
      );
    }
    const apiKey = process.env.GEMINI_API_KEY || config.apiKey;
    if (!apiKey) {
      throw new Error(
        'CONFIGURATION_ERROR: Gemini provider selected, but GEMINI_API_KEY is not configured. Switch provider to ollama.'
      );
    }
    try {
      const model =
        config.tutorModel && config.tutorModel.startsWith('gemini')
          ? config.tutorModel
          : 'gemini-2.5-flash';
      const reply = await callGeminiChat({
        apiKey,
        model,
        systemPrompt,
        userQuery,
        conversationHistory,
        temperature: config.temperature ?? 0.2
      });
      return { reply, providerUsed: 'gemini' };
    } catch (err: any) {
      throw new Error(
        `CONFIGURATION_ERROR: Gemini API call failed without silent fallback: ${err.message}`
      );
    }
  }

  // 3. Default Authoritative Provider: Local Ollama ('ollama')
  const ollamaUrl =
    config.ollamaUrl ||
    config.ollamaBaseUrl ||
    process.env.OLLAMA_BASE_URL ||
    process.env.OLLAMA_URL ||
    DEFAULT_OLLAMA_URL;
  const rawModel =
    config.ollamaModel ||
    process.env.OLLAMA_MODEL ||
    config.tutorModel ||
    DEFAULT_TUTOR_MODEL;
  // Ensure legacy 'gemini-*' or 'llama3' placeholder strings in tutorModel don't override the canonical Ollama model
  const ollamaModel =
    rawModel.startsWith('gemini') || rawModel === 'llama3'
      ? process.env.OLLAMA_MODEL || DEFAULT_TUTOR_MODEL
      : rawModel;

  validateOllamaModelRole(ollamaModel, 'tutor');

  try {
    const reply = await callOllamaChat({
      baseUrl: ollamaUrl,
      model: ollamaModel,
      systemPrompt,
      messages,
      temperature: config.temperature ?? 0.2
    });
    return { reply, providerUsed: 'ollama' };
  } catch (err: any) {
    throw new Error(
      `CONFIGURATION_ERROR: Pinned local Ollama tutor model (${ollamaModel} at ${ollamaUrl}) is unavailable: ${err.message}`
    );
  }
}
