import { AIConfig, Level } from '../types';
import { authService } from './authService';

/**
 * Server-Authoritative AI & Hint Client Service (Protocol V5.0.0)
 * All LLM calls, guardrail checks, and secret API keys execute strictly on the server
 * via POST /api/ai/chat (TutorOrchestrator) and POST /api/hints/request.
 * Browser-side model keys and LLM-simulated shell calls have been removed.
 */
export class TerminalService {
  private currentLevel: Level | null = null;
  private history: { role: 'user' | 'assistant'; content: string }[] = [];
  private config: AIConfig = {
    provider: 'ollama',
    ollamaUrl: 'http://localhost:2004',
    ollamaModel: 'qwen2.5-coder:7b'
  };

  public updateConfig(newConfig: AIConfig) {
    // Strip any client-side API keys before storing in memory
    const safeConfig: AIConfig = { ...newConfig };
    delete safeConfig.apiKey;
    delete safeConfig.openaiKey;
    delete safeConfig.anthropicKey;
    this.config = safeConfig;
  }

  public getConfig(): AIConfig {
    return this.config;
  }

  public async testConnection(testConfig: AIConfig): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        return { success: false, message: `Backend health check returned HTTP ${res.status}` };
      }
      const data = await res.json();
      return {
        success: true,
        message: `Connected to Server-Side TutorOrchestrator (${testConfig.provider.toUpperCase()}, Profile: ${data.deploymentProfile || 'active'})`
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Server connection check failed' };
    }
  }

  public async startLevel(level: Level): Promise<string> {
    this.currentLevel = level;
    this.history = [];
    return `Connected to Task ${level.id}: ${level.title}. Use the real Linux terminal to execute commands and the Guided AI Tutor panel for Socratic assistance.`;
  }

  public async initializeSession(level: Level, _user?: any, config?: AIConfig): Promise<string> {
    if (config) {
      this.updateConfig(config);
    }
    return this.startLevel(level);
  }

  public logLevelStart(): void {
    // Telemetry is recorded server-side via /api/telemetry/events
  }

  public logFlagAttempt(..._args: any[]): void {
    // Flag attempts are recorded server-side via POST /api/tasks/submit-flag
  }

  public logTrustEvent(..._args: any[]): void {
    // Trust events are recorded server-side via /api/telemetry/events
  }

  public async downloadLogs(): Promise<void> {
    const response = await authService.fetchAuthenticated('/api/export/research-package');
    if (!response.ok) {
      throw new Error(`Research export failed (HTTP ${response.status}).`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `research_package_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }

  /**
   * Sends a learner question to the server-side TutorOrchestrator (POST /api/ai/chat).
   */
  public async askTutor(params: {
    taskId: number;
    userQuery: string;
    sessionId?: string;
    userId?: string;
    authToken?: string | null;
  }): Promise<{
    reply: string;
    guardrailIntervened: boolean;
    finalDecision: string;
    interactionId?: string;
  }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (params.authToken) {
      headers['Authorization'] = `Bearer ${params.authToken}`;
    }

    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        taskId: params.taskId,
        assignedCondition: 'guided',
        messages: this.history,
        userQuery: params.userQuery,
        sessionId: params.sessionId,
        userId: params.userId || 'cadet'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Tutor request failed (${res.status})`);
    }

    const reply = data.reply || data.response || 'No response received.';
    this.history.push({ role: 'user', content: params.userQuery });
    this.history.push({ role: 'assistant', content: reply });

    return {
      reply,
      guardrailIntervened: Boolean(data.guardrailIntervened || data.guardrailTriggered),
      finalDecision: data.finalDecision || 'ALLOW',
      interactionId: data.interactionId
    };
  }

  /**
   * Backward-compatible wrapper routing [AI TUTOR] messages to POST /api/ai/chat.
   */
  public async sendCommand(command: string): Promise<string> {
    const taskId = this.currentLevel?.id || 1;
    const cleanQuery = command.replace(/^\[AI TUTOR\]\s*/i, '').trim();
    const res = await this.askTutor({
      taskId,
      userQuery: cleanQuery || command
    });
    return res.reply;
  }
}

export const terminalService = new TerminalService();