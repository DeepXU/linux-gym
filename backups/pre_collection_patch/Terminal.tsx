import React, { useState, useEffect, useRef } from 'react';
import { TerminalLine } from '../types';
import { RotateCcw } from 'lucide-react';

interface TerminalProps {
  lines: TerminalLine[];
  onCommand: (cmd: string) => void;
  isProcessing: boolean;
  onReset: () => void;
  cwd: string;
  onTrustEvent?: (lineId: string, hintText: string, accepted: boolean) => void;
}

export const Terminal: React.FC<TerminalProps> = ({ 
  lines, 
  onCommand, 
  isProcessing, 
  onReset,
  cwd,
  onTrustEvent
}) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  // Refocus input when processing finishes
  useEffect(() => {
    if (!isProcessing) {
      // Small timeout to ensure the DOM has updated and input is re-enabled
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [isProcessing]);

  // Focus input on click anywhere in terminal
  const handleContainerClick = () => {
    // Don't focus if selecting text
    const selection = window.getSelection();
    if (selection && selection.type === 'Range') return;
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    
    // Only add non-empty commands to history
    if (input.trim()) {
      setHistory(prev => [...prev, input]);
      setHistoryPointer(null);
    }
    
    onCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+C: Cancel current input
    if (e.key === 'c' && e.ctrlKey) {
       setInput('');
       setHistoryPointer(null);
       onCommand('^C');
       return;
    }

    // Ctrl+L: Clear screen
    if (e.key === 'l' && e.ctrlKey) {
       e.preventDefault();
       onCommand('clear');
       return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;

      const newPointer = historyPointer === null 
        ? history.length - 1 
        : Math.max(0, historyPointer - 1);
      
      setHistoryPointer(newPointer);
      setInput(history[newPointer]);
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPointer === null) return;

      const newPointer = historyPointer + 1;
      if (newPointer >= history.length) {
        setHistoryPointer(null);
        setInput('');
      } else {
        setHistoryPointer(newPointer);
        setInput(history[newPointer]);
      }
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-[#0f172a] rounded-lg border border-slate-700 overflow-hidden shadow-2xl font-mono text-sm md:text-base relative group"
      onClick={handleContainerClick}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 select-none">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          <span className="ml-2 text-slate-400 text-xs">cadet@linux-ctf:~</span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
          title="Reset Session"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 p-4 overflow-y-auto terminal-scroll space-y-1">
        {lines.map((line) => (
          <div key={line.id} className="break-words">
            {line.type === 'input' && (
              <div className="flex text-emerald-400 font-bold">
                <span className="mr-2 shrink-0">
                  <span className="text-blue-400">cadet@linux-ctf</span>:<span className="text-indigo-400">{line.directory || '~'}</span>$
                </span>
                <span className="text-slate-100">{line.content}</span>
              </div>
            )}
            {line.type === 'output' && (
              <div className="text-slate-300 whitespace-pre-wrap ml-0">{line.content}</div>
            )}
            {line.type === 'error' && (
              <div className="text-red-400 whitespace-pre-wrap">{line.content}</div>
            )}
            {line.type === 'system' && (
              <div className="text-cyan-400 italic opacity-80 py-1">{line.content}</div>
            )}
            {line.type === 'hint' && (
              <div className="my-2 p-3 bg-blue-950/40 border-l-4 border-blue-500 rounded-r-md text-blue-200">
                <div className="flex gap-2">
                   <div className="font-bold text-blue-400 shrink-0 select-none">AI GUIDE &gt;</div>
                   <div className="italic leading-relaxed">{line.content.replace('💡 MENTOR:', '').trim()}</div>
                </div>
                {line.isHintAccepted === undefined || line.isHintAccepted === null ? (
                   <div className="mt-2 flex gap-2 justify-end">
                      <button 
                         onClick={(e) => { e.stopPropagation(); onTrustEvent?.(line.id, line.content, true); }}
                         className="px-3 py-1 bg-green-600/30 hover:bg-green-600/50 text-green-300 rounded text-xs transition-colors border border-green-500/50"
                      >
                         Accept Suggestion
                      </button>
                      <button 
                         onClick={(e) => { e.stopPropagation(); onTrustEvent?.(line.id, line.content, false); }}
                         className="px-3 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded text-xs transition-colors border border-red-500/50"
                      >
                         Reject Suggestion
                      </button>
                   </div>
                ) : (
                   <div className="mt-2 text-right">
                      <span className={`text-xs ${line.isHintAccepted ? 'text-green-400' : 'text-red-400'}`}>
                         {line.isHintAccepted ? '✓ You accepted this suggestion.' : '✗ You rejected this suggestion.'}
                      </span>
                   </div>
                )}
              </div>
            )}
          </div>
        ))}
        
        {/* Input Line */}
        <form onSubmit={handleSubmit} className="flex items-center text-slate-100 mt-2">
           <span className="mr-2 text-emerald-400 font-bold shrink-0">
             <span className="text-blue-400">cadet@linux-ctf</span>:<span className="text-indigo-400">{cwd}</span>$
           </span>
           <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none outline-none text-slate-100 placeholder-slate-600 caret-emerald-400"
              autoComplete="off"
              autoFocus
              disabled={isProcessing}
            />
            {!isProcessing && (
              <div 
                className="absolute top-0 w-2.5 h-5 bg-emerald-400/50 animate-pulse pointer-events-none"
                style={{ left: `${input.length}ch` }} // Approximate cursor position
              />
            )}
           </div>
        </form>
        <div ref={bottomRef} />
      </div>
    </div>
  );
};