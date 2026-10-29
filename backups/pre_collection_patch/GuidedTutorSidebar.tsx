import React, { useState } from 'react';
import { Bot, Send, HelpCircle, ShieldAlert, Sparkles, Terminal as TerminalIcon } from 'lucide-react';
import { Level, User } from '../types';
import { INITIAL_LEVELS } from '../constants';

interface TutorTurn {
  id: string;
  role: 'user' | 'assistant' | 'hint';
  text: string;
  guardrailIntervened?: boolean;
  finalDecision?: string;
  timestamp: string;
}

interface GuidedTutorSidebarProps {
  currentLevel?: Level;
  level?: Level;
  sessionId?: string;
  userId?: string;
  user?: User;
  authToken?: string | null;
  commandCount?: number;
  hasAttemptedFlag?: boolean;
  onHintDelivered?: (hintText: string, level: number) => void;
}

export const GuidedTutorSidebar: React.FC<GuidedTutorSidebarProps> = ({
  currentLevel: propCurrentLevel,
  level: propLevel,
  sessionId = 'default_session',
  userId: propUserId,
  user: propUser,
  authToken,
  commandCount = 0,
  hasAttemptedFlag = false,
  onHintDelivered
}) => {
  const currentLevel = propCurrentLevel || propLevel || INITIAL_LEVELS[0];
  const userId = propUserId || propUser?.username || 'cadet';
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hintLevelRequested, setHintLevelRequested] = useState(1);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const handleAskTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    const userTurn: TutorTurn = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString()
    };
    setTurns(prev => [...prev, userTurn]);
    setQuery('');
    setIsLoading(true);
    setStatusNote(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: currentLevel.id,
          assignedCondition: 'guided',
          messages: turns
            .filter(t => t.role === 'user' || t.role === 'assistant')
            .map(t => ({ role: t.role as 'user' | 'assistant', content: t.text })),
          userQuery: trimmed,
          sessionId,
          userId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Tutor error (${res.status})`);
      }

      const replyText = data.reply || data.response || 'No response received.';
      const aiTurn: TutorTurn = {
        id: data.interactionId || `ai-${Date.now()}`,
        role: 'assistant',
        text: replyText,
        guardrailIntervened: Boolean(data.guardrailIntervened || data.guardrailTriggered),
        finalDecision: data.finalDecision || 'ALLOW',
        timestamp: new Date().toLocaleTimeString()
      };
      setTurns(prev => [...prev, aiTurn]);
    } catch (err: any) {
      setStatusNote(err.message || 'Failed to contact Guided AI Tutor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestServerHint = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setStatusNote(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch('/api/hints/request', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: currentLevel.id,
          currentLevelRequested: hintLevelRequested,
          commandCount,
          hasAttemptedFlag,
          sessionId,
          userId
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request progressive hint');
      }

      const deliveredText = data.hintItem?.text || 'Explore the current directory and inspect available files.';
      const deliveredLevel = data.state?.hintLevelDelivered ?? hintLevelRequested;
      const prerequisitesMet = data.state?.prerequisitesMet !== false;

      setTurns(prev => [
        ...prev,
        {
          id: `hint-${Date.now()}`,
          role: 'hint',
          text: `[Progressive Hint L${deliveredLevel} — ${data.hintItem?.title || 'Guidance'}]: ${deliveredText}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);

      if (!prerequisitesMet && data.state?.reason) {
        setStatusNote(data.state.reason);
      } else {
        setHintLevelRequested(prev => Math.min(4, prev + 1));
      }

      if (onHintDelivered) {
        onHintDelivered(deliveredText, deliveredLevel);
      }
    } catch (err: any) {
      setStatusNote(err.message || 'Hint request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/95 border border-slate-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-emerald-400" />
          <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
            Guided AI Tutor (V5)
          </span>
        </div>
        <button
          type="button"
          onClick={handleRequestServerHint}
          disabled={isLoading}
          className="px-2.5 py-1 rounded text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-colors disabled:opacity-50"
          title="Request progressive hint from Server Hint Engine (POST /api/hints/request)"
        >
          <HelpCircle size={12} />
          Progressive Hint (L{hintLevelRequested})
        </button>
      </div>

      {/* Context Notice */}
      <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <TerminalIcon size={11} className="text-blue-400" />
          Task {currentLevel.id}: {currentLevel.title}
        </span>
        <span className="font-mono text-[10px] text-emerald-400">
          Server Orchestrator Active
        </span>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        {turns.length === 0 ? (
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles size={13} className="text-emerald-400" />
              Socratic Investigation Assistant
            </div>
            <p className="text-[11px] leading-relaxed">
              Ask conceptual or troubleshooting questions about <strong>{currentLevel.title}</strong>. The tutor observes your recent terminal evidence and guides your Claim-Evidence-Warrant reasoning without revealing flags or copy-paste solutions.
            </p>
          </div>
        ) : (
          turns.map(turn => (
            <div
              key={turn.id}
              className={`p-2.5 rounded-lg border ${
                turn.role === 'user'
                  ? 'bg-blue-950/30 border-blue-800/50 text-blue-100 ml-4'
                  : turn.role === 'hint'
                  ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                  : 'bg-slate-950 border-slate-800 text-slate-200 mr-2'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="font-bold uppercase">
                  {turn.role === 'user' ? 'Learner Query' : turn.role === 'hint' ? 'Server Hint Engine' : 'Guided AI Tutor'}
                </span>
                <span className="font-mono">{turn.timestamp}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-[11px]">{turn.text}</p>
              {turn.guardrailIntervened && (
                <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800 text-[10px] text-amber-300">
                  <ShieldAlert size={10} />
                  Guardrail Policy Redirect ({turn.finalDecision})
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {statusNote && (
        <div className="px-3 py-1.5 bg-amber-950/60 border-t border-amber-800/60 text-[11px] text-amber-200">
          {statusNote}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleAskTutor} className="p-2.5 bg-slate-950 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ask the Guided AI Tutor about your terminal observations..."
          disabled={isLoading}
          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1 transition-colors"
        >
          <Send size={12} />
          Ask
        </button>
      </form>
    </div>
  );
};
