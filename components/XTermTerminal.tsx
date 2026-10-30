import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Bot, RotateCcw, Send, TerminalSquare, UserCheck } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { authService } from '../services/authService';

interface XTermTerminalProps {
  levelId?: number;
  sessionId?: string;
  username?: string;
  authToken?: string | null;
  onCommand?: (cmd: string) => void;
  onCommandExecuted?: () => void;
  onSubmitFlag?: (flag: string) => void;
  onResetSession?: () => void;
}

export const XTermTerminal: React.FC<XTermTerminalProps> = ({
  levelId = 1,
  sessionId = 'default_pty_session',
  username = 'cadet',
  authToken,
  onCommand,
  onCommandExecuted,
  onSubmitFlag,
  onResetSession
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputBufferRef = useRef<string>('');
  const [askAiInput, setAskAiInput] = useState('');
  const [isAskingAi, setIsAskingAi] = useState(false);

  const safeUsername = (username || 'cadet').replace(/[^a-zA-Z0-9_-]/g, '') || 'cadet';

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: '#0f172a',
        foreground: '#f8fafc',
        cursor: '#34d399'
      },
      fontFamily: 'monospace',
      fontSize: 13
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      levelId: String(levelId),
      sessionId,
      username: safeUsername
    });
    if (authToken) {
      params.set('token', authToken);
    }
    const wsUrl = `${protocol}//${window.location.host}/pty?${params.toString()}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln(
        `\x1b[38;5;48m[Socratic Shell PTY]\x1b[0m Session \x1b[1;32m${safeUsername}@socratic-shell\x1b[0m attached to Task #${levelId} (${sessionId})`
      );
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      } else if (event.data instanceof Blob) {
        event.data.text().then((text) => term.write(text)).catch(() => {});
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
      if (data === '\r' || data === '\n') {
        const cmd = inputBufferRef.current.trim();
        if (cmd) {
          if (/^submit\s+/i.test(cmd) && onSubmitFlag) {
            const flagCandidate = cmd.replace(/^submit\s+/i, '').trim();
            if (flagCandidate) {
              onSubmitFlag(flagCandidate);
            }
          }
          if (onCommand) onCommand(cmd);
          if (onCommandExecuted) onCommandExecuted();
        }
        inputBufferRef.current = '';
      } else if (data === '\u007F' || data === '\b') {
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
      } else if (data.length === 1 && data >= ' ') {
        inputBufferRef.current += data;
      }
    });

    const handleResize = () => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch {
          // ignore transient fit error when hidden
        }
      });
    };
    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && terminalRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      ws.close();
      term.dispose();
    };
  }, [levelId, sessionId, safeUsername, authToken]);

  const handleAskAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = askAiInput.trim();
    if (!raw || isAskingAi) return;

    const cleanQuestion = raw.replace(/^ask-ai\s+/i, '').replace(/^["']([\s\S]*)["']$/, '$1').trim();
    if (!cleanQuestion) return;

    setAskAiInput('');
    setIsAskingAi(true);

    const term = xtermRef.current;
    if (term) {
      term.writeln(
        `\r\n\x1b[36m$ ask-ai "${cleanQuestion}"\x1b[0m`
      );
      term.writeln(
        `\x1b[90m[Guided AI] Reviewing observed terminal evidence...\x1b[0m`
      );
    }

    try {
      const res = await authService.fetchAuthenticated('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: levelId,
          assignedCondition: 'guided',
          userQuery: cleanQuestion,
          sessionId,
          userId: safeUsername
        })
      });
      const data = await res.json();
      const replyText = data.response || data.error || 'No response received from Guided AI.';
      const stateLabel = data.guidanceState || 'socratic_guidance';
      if (term) {
        const formattedLines = String(replyText)
          .split('\n')
          .map((l: string) => `  \x1b[36m│\x1b[0m ${l}`)
          .join('\r\n');
        term.writeln(
          `\x1b[1;36m┌─ Socratic Shell Tutor (${stateLabel}) ──────────────────────\x1b[0m\r\n${formattedLines}\r\n\x1b[1;36m└─────────────────────────────────────────────────────────────────────\x1b[0m`
        );
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('\r');
      }
    } catch (err: any) {
      if (term) {
        term.writeln(
          `\x1b[31m[Guided AI Error]\x1b[0m ${err.message || 'Unable to reach Guided AI tutor.'}\r\n`
        );
      }
    } finally {
      setIsAskingAi(false);
      setTimeout(() => {
        xtermRef.current?.focus();
      }, 20);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] rounded-lg border border-slate-700 overflow-hidden shadow-2xl">
      {/* Real Linux Bash / tmux Status Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-emerald-500/30 select-none shrink-0">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shrink-0"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shrink-0"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 shrink-0"></div>
          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold tracking-tight shrink-0">
            [tmux 0:bash*]
          </span>
          <span className="text-slate-100 text-xs font-mono flex items-center gap-1.5 truncate">
            <TerminalSquare size={13} className="text-emerald-400 shrink-0" />
            <span className="text-emerald-300 font-bold">{safeUsername}@socratic-shell</span>
            <span className="text-slate-500">—</span>
            <span>Task #{levelId}</span>
          </span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-300 font-mono bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700">
            <UserCheck size={11} className="text-emerald-400" />
            <span>{safeUsername}</span>
          </span>
          <span className="hidden md:inline text-[10px] text-emerald-400/90 font-mono">
            {sessionId}
          </span>
          {onResetSession && (
            <button
              type="button"
              onClick={onResetSession}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-mono flex items-center gap-1 transition-colors"
              title="Reset and re-provision a clean Linux Bash sandbox for this task"
            >
              <RotateCcw size={10} />
              <span>Reset Shell</span>
            </button>
          )}
        </div>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 p-1.5 relative min-h-0 w-full">
        <div ref={terminalRef} className="absolute inset-0 p-1" />
      </div>

      {/* Integrated Terminal ask-ai Input Bar */}
      <form
        onSubmit={handleAskAiSubmit}
        className="shrink-0 bg-slate-900/95 border-t border-slate-700/80 px-2.5 py-1.5 flex items-center gap-2"
      >
        <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-mono font-semibold shrink-0">
          <Bot size={13} />
          <span>ask-ai</span>
        </div>
        <input
          type="text"
          value={askAiInput}
          onChange={(e) => setAskAiInput(e.target.value)}
          disabled={isAskingAi}
          placeholder="Ask Guided AI about your terminal output or next step..."
          className="flex-1 bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={isAskingAi || !askAiInput.trim()}
          className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 disabled:opacity-40 text-cyan-200 border border-cyan-500/40 text-xs font-mono font-semibold flex items-center gap-1 transition-colors"
        >
          <Send size={11} />
          {isAskingAi ? 'Thinking...' : 'Ask Tutor'}
        </button>
      </form>
    </div>
  );
};
