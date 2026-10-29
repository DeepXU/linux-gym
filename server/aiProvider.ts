import { GoogleGenAI } from '@google/genai';
import { db } from './db';
import { Level, ExperimentalCondition } from '../types';

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
 * Call local Ollama chat API (runs locally with zero cloud API keys on NVIDIA GPU)
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
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = cleanBase.endsWith('/api/chat') ? cleanBase : `${cleanBase}/api/chat`;

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const timeoutMs = process.env.LLM_TIMEOUT_MS ? parseInt(process.env.LLM_TIMEOUT_MS, 10) : 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs); // 60s timeout for large local models on GPU

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
      throw new Error(`Ollama error HTTP ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    return data.message?.content || '';
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
        'Authorization': `Bearer ${apiKey || 'EMPTY'}`
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
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Google Gemini using the official @google/genai SDK
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
  
  // Format past turns if available
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

  return response.text || '';
}

/**
 * Unified AI Generation router
 * Automatically delegates to Ollama (GPU local), OpenAI/vLLM (GPU local), or Gemini (Cloud)
 */
export async function generateAITutorResponse(options: AIGenerationOptions): Promise<{
  reply: string;
  providerUsed: 'ollama' | 'custom' | 'gemini' | 'rule_based_fallback';
}> {
  const config = db.getConfig() as any;
  const { systemPrompt, userQuery, conversationHistory = [] } = options;

  // Format messages for standard chat APIs
  const messages: ChatMessage[] = conversationHistory.map(h => ({
    role: (h.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: h.text
  }));
  messages.push({ role: 'user', content: userQuery });

  // Provider selection precedence: process.env.LLM_PROVIDER -> DB config -> auto-detection
  const explicitProvider = (process.env.LLM_PROVIDER || config.provider || '').toLowerCase();

  // 1. OpenAI-Compatible / Custom vLLM / LM Studio Provider (Default Port 2005 in 2000-2009 range)
  const isCustomOrVllm = explicitProvider === 'custom' || explicitProvider === 'vllm' || explicitProvider === 'openai';
  if (isCustomOrVllm) {
    const baseUrl = config.openaiUrl || process.env.VLLM_BASE_URL || process.env.OPENAI_BASE_URL || 'http://localhost:2005/v1';
    const model = config.openaiModel || process.env.VLLM_MODEL || process.env.OPENAI_MODEL || 'local-model';
    const apiKey = config.openaiKey || process.env.OPENAI_API_KEY || 'EMPTY';
    try {
      const reply = await callOpenAICompatibleChat({
        baseUrl,
        apiKey,
        model,
        systemPrompt,
        messages,
        temperature: config.temperature || 0.2
      });
      if (reply && reply.trim().length > 0) {
        return { reply, providerUsed: 'custom' };
      }
    } catch (err: any) {
      console.warn(`[AITutor] Local vLLM/OpenAI endpoint call failed (${err.message}). Checking secondary providers...`);
    }
  }

  // 2. Ollama Provider (GPU Local Inference - Default Port 2004 in 2000-2009 range)
  const isOllamaConfigured = explicitProvider === 'ollama' || (!process.env.GEMINI_API_KEY && !config.apiKey && explicitProvider !== 'gemini' && !isCustomOrVllm);
  if (isOllamaConfigured) {
    const ollamaUrl = config.ollamaUrl || config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:2004';
    const ollamaModel = config.ollamaModel || process.env.OLLAMA_MODEL || 'llama3.3:70b';
    try {
      const reply = await callOllamaChat({
        baseUrl: ollamaUrl,
        model: ollamaModel,
        systemPrompt,
        messages,
        temperature: config.temperature || 0.2
      });
      if (reply && reply.trim().length > 0) {
        return { reply, providerUsed: 'ollama' };
      }
    } catch (err: any) {
      console.warn(`[AITutor] Local Ollama call failed (${err.message}). Checking secondary providers...`);
    }
  }

  // 3. Google Gemini Provider
  const activeRun = db.getActiveRun();
  const isFormalOrPilot = options.isFormalRun ?? (activeRun?.runType === 'formal' || activeRun?.runType === 'pilot');
  if (isFormalOrPilot) {
    throw new Error('CONFIGURATION_ERROR: Pinned local tutor model is unavailable during formal evaluation or student pilot.');
  }

  const apiKey = process.env.GEMINI_API_KEY || config.apiKey;
  if (apiKey) {
    try {
      const model = config.tutorModel || 'gemini-2.5-flash';
      const reply = await callGeminiChat({
        apiKey,
        model,
        systemPrompt,
        userQuery,
        conversationHistory,
        temperature: config.temperature || 0.2
      });
      if (reply && reply.trim().length > 0) {
        return { reply, providerUsed: 'gemini' };
      }
    } catch (err: any) {
      console.warn(`[AITutor] Gemini Cloud API call failed (${err.message}). Falling back to rule-based tutor...`);
    }
  }

  // 4. Default Pedagogical Rule-Based Fallback
  const isGuided = options.condition !== 'unguided';
  const defaultFallback = isGuided
    ? `What specific output did you observe from your latest command in the terminal? What have you tried so far?`
    : `To inspect current directory contents, use \`ls\`. To view file contents, use \`cat <filename>\`.`;

  return { reply: defaultFallback, providerUsed: 'rule_based_fallback' };
}
