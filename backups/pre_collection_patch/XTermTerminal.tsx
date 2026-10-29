import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface XTermTerminalProps {
  levelId?: number;
  sessionId?: string;
  authToken?: string | null;
  onCommand?: (cmd: string) => void;
  onCommandExecuted?: () => void;
}

export const XTermTerminal: React.FC<XTermTerminalProps> = ({
  levelId = 1,
  sessionId = 'default_pty_session',
  authToken,
  onCommand,
  onCommandExecuted
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputBufferRef = useRef<string>('');

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0f172a',
        foreground: '#f8fafc',
        cursor: '#34d399'
      },
      fontFamily: 'monospace'
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams({
      levelId: String(levelId),
      sessionId
    });
    if (authToken) {
      params.set('token', authToken);
    }
    const wsUrl = `${protocol}//${window.location.host}/pty?${params.toString()}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln(`\x1b[36m[Sandbox PTY]\x1b[0m Connected to Task ${levelId} Linux environment (${sessionId}).`);
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
      if (data === '\r' || data === '\n') {
        const cmd = inputBufferRef.current.trim();
        if (cmd) {
          if (onCommand) onCommand(cmd);
          if (onCommandExecuted) onCommandExecuted();
        }
        inputBufferRef.current = '';
      } else if (data === '\u007F') {
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
      } else if (data.length === 1 && data >= ' ') {
        inputBufferRef.current += data;
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [levelId, sessionId, authToken]);

  return (
    <div className="flex flex-col h-full bg-[#0f172a] rounded-lg border border-slate-700 overflow-hidden shadow-2xl">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 select-none">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          <span className="ml-2 text-slate-300 text-xs font-mono">
            Real Linux Sandbox PTY — Task #{levelId}
          </span>
        </div>
        <span className="text-[10px] text-emerald-400 font-mono">
          Session: {sessionId}
        </span>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 p-2 relative h-full w-full">
        <div ref={terminalRef} className="absolute inset-0" />
      </div>
    </div>
  );
};
