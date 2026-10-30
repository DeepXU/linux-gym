import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { XTermTerminal } from './components/XTermTerminal';
import { SettingsModal } from './components/SettingsModal';
import { Login } from './components/Login';
import { FacultyReviewModal } from './components/FacultyReviewModal';
import { TestCaseModal } from './components/TestCaseModal';
import { ResearchDashboard } from './components/ResearchDashboard';
import { TelemetryValidationModal } from './components/TelemetryValidationModal';
import { GoogleDocExportModal } from './components/GoogleDocExportModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TERMINAL_WELCOME } from './constants';
import { TerminalLine, GameState, AIConfig, User, Level } from './types';
import { terminalService } from './services/aiService';
import { authService } from './services/authService';
import { levelService } from './services/levelService';
import { Menu, X, Settings, Flag, TerminalSquare, FileText, AlertTriangle, BookOpen, ShieldCheck, CheckCircle2, ChevronDown, ChevronUp, GripHorizontal, Maximize2, Minimize2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [deploymentProfile, setDeploymentProfile] = useState<'local_research' | 'cloud_demo'>('local_research');
  const [dockerAvailable, setDockerAvailable] = useState<boolean>(true);
  const [liveModelDigest, setLiveModelDigest] = useState<string>('sha256:pending');
  const [profileBannerMessage, setProfileBannerMessage] = useState<string | null>(null);
  const [commandCount, setCommandCount] = useState<number>(0);
  const [hasAttemptedFlag, setHasAttemptedFlag] = useState<boolean>(false);
  const [showTerminalHistory, setShowTerminalHistory] = useState<boolean>(false);
  const [terminalHistory, setTerminalHistory] = useState<{ commands: any[]; outputs: any[]; containerSessions: any[] }>({
    commands: [],
    outputs: [],
    containerSessions: []
  });
  
  // State for Levels (Loaded from DB)
  const [levels, setLevels] = useState<Level[]>([]);
  
  const [gameState, setGameState] = useState<GameState>({
    currentLevelId: 1,
    completedLevelIds: [],
    flagsFound: {},
  });

  const currentLevel = levels.find(l => l.id === gameState.currentLevelId) || levels[0];
  
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFacultyReviewOpen, setIsFacultyReviewOpen] = useState(false);
  const [isTestCasesOpen, setIsTestCasesOpen] = useState(false);
  const [isResearchDashboardOpen, setIsResearchDashboardOpen] = useState(false);
  const [isTelemetryValidationOpen, setIsTelemetryValidationOpen] = useState(false);
  const [isGoogleDocExportOpen, setIsGoogleDocExportOpen] = useState(false);
  const [cwd, setCwd] = useState('~');

  // Research State
  const [levelStartTime, setLevelStartTime] = useState<number>(Date.now());
  const [pendingFlag, setPendingFlag] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(3);
  const [claim, setClaim] = useState<string>('');
  const [evidence, setEvidence] = useState<string>('');
  const [warrant, setWarrant] = useState<string>('');

  // Flag Submission State
  const [flagInput, setFlagInput] = useState('');
  const [sessionNonce, setSessionNonce] = useState<number>(1);

  // Condensed & Resizable Task Instructions State
  const [instructionsMode, setInstructionsMode] = useState<'condensed' | 'minimized' | 'expanded'>('condensed');
  const [instructionsHeight, setInstructionsHeight] = useState<number>(84);
  const [isResizingInstructions, setIsResizingInstructions] = useState<boolean>(false);

  const handleStartResizeInstructions = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = instructionsMode === 'minimized' ? 0 : instructionsHeight;
    setIsResizingInstructions(true);

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const deltaY = moveEvt.clientY - startY;
      const nextHeight = Math.max(0, Math.min(340, startHeight + deltaY));
      if (nextHeight < 28) {
        setInstructionsMode('minimized');
      } else {
        setInstructionsMode('condensed');
        setInstructionsHeight(nextHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizingInstructions(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Default configuration: Local Ollama (http://127.0.0.1:2004, qwen2.5-coder:7b)
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'ollama',
    ollamaUrl: 'http://127.0.0.1:2004',
    ollamaModel: 'qwen2.5-coder:7b',
    tutorProvider: 'ollama',
    tutorModel: 'qwen2.5-coder:7b',
    llamaGuardModel: 'llama-guard3:1b',
    enableLlamaGuard: true
  });

  const loadTerminalHistory = async (taskId: number) => {
    try {
      const res = await authService.fetchAuthenticated(`/api/terminal/history?taskId=${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTerminalHistory({
          commands: data.commands || [],
          outputs: data.outputs || [],
          containerSessions: data.containerSessions || []
        });
      }
    } catch (e) {
      // ignore transient error
    }
  };

  useEffect(() => {
    // 0. Sync from backend
    const initializeData = async () => {
      await authService.initFromServer();
      
      // Deployment health is public; private configuration is loaded after investigator authentication.
      try {
        const healthRes = await fetch('/api/health');
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          if (healthData.deploymentProfile) {
            setDeploymentProfile(healthData.deploymentProfile);
          }
          if (typeof healthData.dockerAvailable === 'boolean') {
            setDockerAvailable(healthData.dockerAvailable);
          }
          if (healthData.tutorModelDigest) {
            setLiveModelDigest(healthData.tutorModelDigest);
          }
          if (healthData.bannerMessage) {
            setProfileBannerMessage(healthData.bannerMessage);
          }
        }
      } catch (e) {
        console.warn('Failed to load global config or health from DB');
      }
    };
    
    initializeData().then(() => {
        // 1. Check for existing session
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            const savedState = authService.getGameState(currentUser.username);
            if (savedState) setGameState(savedState);
        }

        // 2. Load Levels from DB
        const loadedLevels = levelService.getLevels();
        setLevels(loadedLevels);
    });
  }, []);

  useEffect(() => {
    if (!user || user.role === 'student') return;
    let active = true;
    authService.fetchAuthenticated('/api/config')
      .then(async response => {
        if (!response.ok) throw new Error(`Failed to load configuration (HTTP ${response.status}).`);
        const config = await response.json();
        if (active && config) setAiConfig(config);
      })
      .catch((error: Error) => console.error(error.message));
    return () => {
      active = false;
    };
  }, [user]);

  // Load level on start or change, ONLY if user is logged in
  useEffect(() => {
    if (user && levels.length > 0) {
      // Ensure currentLevelId exists in loaded levels, fallback to 1 if not
      const levelExists = levels.find(l => l.id === gameState.currentLevelId);
      if (!levelExists && levels.length > 0) {
          // If the current level ID was deleted, go to the first available level
          /* Note: purposely not updating gameState here to avoid infinite loops, handled inside loadLevel logic safely */
          loadLevel(levels[0].id);
      } else {
          loadLevel(gameState.currentLevelId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentLevelId, aiConfig, user, levels]); // Added levels dependency

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    const savedState = authService.getGameState(newUser.username);
    if (savedState) {
       setGameState(savedState);
    } else {
       // Reset to level 1 for new user or missing state
       setGameState({ currentLevelId: 1, completedLevelIds: [], flagsFound: {} });
    }
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setTerminalLines([]); // Clear sensitive terminal history
  };

  // Save game state anytime it changes
  useEffect(() => {
     if (user) {
        authService.updateGameState(user.username, gameState);
     }
  }, [gameState, user]);

  // Save game state anytime it changes
  useEffect(() => {
     if (user) {
        authService.updateGameState(user.username, gameState);
     }
  }, [gameState, user]);

  const refreshLevels = () => {
    const updated = levelService.getLevels();
    setLevels(updated);
  };

  const addLine = (content: string, type: TerminalLine['type'], directory?: string) => {
    setTerminalLines(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      type,
      content,
      directory
    }]);
  };

  const loadLevel = async (levelId: number) => {
    if (!user) return;
    if (levels.length === 0) return;

    setIsProcessing(true);
    const level = levels.find(l => l.id === levelId);
    
    if (!level) {
       setIsProcessing(false);
       return;
    }

    setTerminalLines([]); // Clear terminal
    setCwd('~');
    setFlagInput(''); // Clear flag input
    setPendingFlag(null);
    setLevelStartTime(Date.now());
    
    try {
      // Initialize session with USER context
      const initMessage = await terminalService.initializeSession(level, user, aiConfig);
      
      // header
      if (TERMINAL_WELCOME.length > 0) {
        addLine(TERMINAL_WELCOME[0], 'system');
      }
      
      // connection status inserted here
      addLine(initMessage, initMessage.includes('⚠️') || initMessage.includes('Offline') ? 'error' : 'system');

      // rest of welcome message
      if (TERMINAL_WELCOME.length > 1) {
        TERMINAL_WELCOME.slice(1).forEach(line => addLine(line, 'system'));
      }

      // Mission Briefing Block
      addLine('', 'output'); // Spacer
      addLine(`=== MISSION BRIEFING: ${level.title} ===`, 'system');
      addLine(`SCENARIO: ${level.description}`, 'output');
      addLine(`OBJECTIVE: ${level.objective}`, 'system');
      addLine('', 'output'); // Spacer

    } catch (e) {
      addLine(`Error initializing terminal session: ${e}`, 'error');
    } finally {
      // Log that the level has officially started for this user
      terminalService.logLevelStart();
      setIsProcessing(false);
    }
  };

  // Centralized Flag Check Logic
  const processFlagSubmission = (attempt: string) => {
    setPendingFlag(attempt);
  };

  const confirmFlagSubmission = async () => {
    if (!pendingFlag || !user) return;
    
    const currentLevel = levels.find(l => l.id === gameState.currentLevelId);
    if (!currentLevel) return;

    const submittedFlag = pendingFlag.trim();
    const timeToSolveMs = Date.now() - levelStartTime;
    setHasAttemptedFlag(true);
    
    try {
      const res = await fetch('/api/flags/submit', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          taskId: currentLevel.id,
          flag: submittedFlag,
          sessionId: `sess_${user.username}`,
          timeToSolveMs,
          confidence,
          claim,
          evidence,
          warrant
        })
      });

      const data = await res.json();
      const isCorrect = data.isCorrect ?? (submittedFlag === currentLevel.flag);

      // Local mirror log
      terminalService.logFlagAttempt(submittedFlag, isCorrect, confidence, claim, evidence, warrant, timeToSolveMs);

      if (isCorrect) {
         addLine(`🎉 CORRECT FLAG SUBMITTED: ${submittedFlag}`, 'success');
         addLine(`Level ${currentLevel.id} Completed!`, 'system');
         if (data.score) {
           addLine(`[CEW Reasoning Score]: Claim: ${data.score.claimScore}/3, Evidence: ${data.score.evidenceScore}/3, Warrant: ${data.score.warrantScore}/4 (Total: ${data.score.totalScore}/10)`, 'system');
         }
         
         setGameState(prev => ({
           ...prev,
           completedLevelIds: [...prev.completedLevelIds, currentLevel.id],
           flagsFound: { ...prev.flagsFound, [currentLevel.id]: true }
         }));
         setFlagInput('');
      } else {
         addLine(`❌ INCORRECT FLAG: ${submittedFlag}`, 'error');
      }
    } catch (e) {
      const isCorrect = submittedFlag === currentLevel.flag;
      terminalService.logFlagAttempt(submittedFlag, isCorrect, confidence, claim, evidence, warrant, timeToSolveMs);

      if (isCorrect) {
         addLine(`🎉 CORRECT FLAG SUBMITTED: ${submittedFlag}`, 'success');
         addLine(`Level ${currentLevel.id} Completed!`, 'system');
         setGameState(prev => ({
           ...prev,
           completedLevelIds: [...prev.completedLevelIds, currentLevel.id],
           flagsFound: { ...prev.flagsFound, [currentLevel.id]: true }
         }));
         setFlagInput('');
      } else {
         addLine(`❌ INCORRECT FLAG: ${submittedFlag}`, 'error');
      }
    }
    
    setPendingFlag(null);
    setConfidence(3);
    setClaim('');
    setEvidence('');
    setWarrant('');
  };

  const handleTrustEvent = (lineId: string, hintText: string, accepted: boolean) => {
     terminalService.logTrustEvent(hintText, accepted);
     setTerminalLines(prev => prev.map(line => 
        line.id === lineId ? { ...line, isHintAccepted: accepted } : line
     ));
  };

  const handleCommand = async (command: string) => {
    // Always echo the command line (even if empty) to mimic real shell enter behavior
    addLine(command, 'input', cwd);

    const trimmedCmd = command.trim();
    if (!trimmedCmd) return;

    // --- CLIENT SIDE COMMANDS ---
    
    // Clear
    if (trimmedCmd === 'clear' || trimmedCmd === 'cls') {
      setTerminalLines([]);
      return;
    }

    // Submit command
    if (trimmedCmd.startsWith('submit ')) {
      const flagPart = trimmedCmd.substring(7); // remove "submit "
      processFlagSubmission(flagPart);
      return;
    }

    // Reserved ask-ai terminal command interception (never reaches shell)
    if (/^ask-ai(\s+|$)/i.test(trimmedCmd)) {
      const question = trimmedCmd.replace(/^ask-ai\s*/i, '').replace(/^["']([\s\S]*)["']$/, '$1').trim();
      if (!question) {
        addLine('Usage: ask-ai "<your question or interpretation>"', 'hint');
        return;
      }
      setIsProcessing(true);
      try {
        const activeSessionId = user ? `sess_${user.username}_task_${gameState.currentLevelId}_s${sessionNonce}` : `sess_cadet_task_${gameState.currentLevelId}`;
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: authService.getAuthHeaders(),
          body: JSON.stringify({
            taskId: gameState.currentLevelId,
            assignedCondition: 'guided',
            userQuery: question,
            sessionId: activeSessionId,
            userId: user?.username || 'cadet'
          })
        });
        const data = await res.json();
        const reply = data.response || data.error || 'No response received from Guided AI.';
        addLine(`💡 MENTOR: [${data.guidanceState || 'socratic_guidance'}]\n${reply}`, 'hint');
      } catch (err: any) {
        addLine(`Guided AI error: ${err.message || 'Unable to reach tutor.'}`, 'error');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    setIsProcessing(true);
    try {
      const output = await terminalService.sendCommand(command);
      
      if (command.startsWith('cd')) {
         const parts = command.split(' ');
         const target = parts.length > 1 ? parts[1] : '~';
         
         if (!output.toLowerCase().includes('no such file')) {
           if (target === '..') {
              setCwd(prev => prev === '~' ? '/' : prev.split('/').slice(0, -1).join('/') || '/');
           } else if (target === '~' || target === '') {
              setCwd('~');
           } else if (target.startsWith('/')) {
              setCwd(target);
           } else {
              setCwd(prev => prev === '~' || prev === '/' ? `${prev === '/' ? '' : prev}/${target}` : `${prev}/${target}`);
           }
         }
      }

      if (output) {
        if (output.includes("💡 MENTOR:")) {
           addLine(output, 'hint');
        } else {
           addLine(output, 'output');
        }
      }
    } catch (error) {
      addLine("Communication error with shell.", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFlagSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagInput.trim()) return;
    processFlagSubmission(flagInput);
  };

  const getProviderLabel = () => {
    switch(aiConfig.provider) {
      case 'gemini': return 'Gemini';
      case 'ollama': return `Llama (${aiConfig.ollamaModel})`;
      case 'openai': return 'OpenAI';
      case 'anthropic': return 'Claude';
      case 'custom': return 'Custom/Local';
      default: return 'Offline';
    }
  };

  // RENDER LOGIN SCREEN IF NOT AUTHENTICATED
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const isLevelComplete = gameState.completedLevelIds.includes(gameState.currentLevelId);

  return (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden flex flex-row font-sans">
      
      {/* Mobile Menu Toggle */}
      <button 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden absolute top-4 right-4 z-50 p-2 bg-slate-800 text-slate-200 rounded-md border border-slate-700"
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Settings Button (ALL USERS) */}
      <button 
        onClick={() => setIsSettingsOpen(true)}
        className="hidden md:flex absolute top-4 right-6 z-30 items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-full border border-slate-700 transition-all text-xs font-medium backdrop-blur-sm"
      >
        <Settings size={14} />
        {getProviderLabel()}
      </button>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-80 h-full transform transition-transform duration-300 ease-in-out bg-slate-900
        md:relative md:translate-x-0 md:shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar 
          levels={levels}
          currentLevelId={gameState.currentLevelId}
          onSelectLevel={(id) => {
            if (id !== gameState.currentLevelId && user) {
              const prevSessionId = `sess_${user.username}_task_${gameState.currentLevelId}_s${sessionNonce}`;
              authService.fetchAuthenticated('/api/tasks/reset', {
                method: 'POST',
                headers: authService.getAuthHeaders(),
                body: JSON.stringify({
                  taskId: gameState.currentLevelId,
                  sessionId: prevSessionId,
                  userId: user.username
                })
              }).catch(() => {});
              setSessionNonce(prev => prev + 1);
              setCommandCount(0);
              setHasAttemptedFlag(false);
            }
            setGameState(prev => ({ ...prev, currentLevelId: id }));
            setIsMobileMenuOpen(false);
          }}
          user={user}
          onLogout={handleLogout}
          onOpenFacultyReview={() => setIsFacultyReviewOpen(true)}
          onOpenTestCases={() => setIsTestCasesOpen(true)}
          onOpenResearchDashboard={() => setIsResearchDashboardOpen(true)}
          onOpenTelemetryValidation={() => setIsTelemetryValidationOpen(true)}
          onOpenGoogleDocExport={() => setIsGoogleDocExportOpen(true)}
        />
        
        {/* Mobile Settings Button in Sidebar (ALL USERS) */}
        <div className="md:hidden p-4 border-t border-slate-800 bg-slate-900">
           <button 
            onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-md border border-slate-700"
           >
             <Settings size={16} /> Configure AI
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
         {/* Background Grid */}
         <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
              style={{ 
                backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)', 
                backgroundSize: '40px 40px' 
              }}
         ></div>

         <div className="z-10 flex flex-col h-full w-full px-3 py-2 md:px-4 md:py-2.5">
            {(deploymentProfile === 'cloud_demo' || !dockerAvailable) && (
              <div className="mb-1.5 shrink-0 bg-amber-950/90 border border-amber-500/70 rounded-md px-3 py-1 flex items-center gap-2 text-amber-200 text-[11px] font-medium shadow">
                <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                <div className="truncate">
                  <span className="font-bold tracking-wide uppercase text-amber-300 mr-1.5">
                    NOT VALID FOR FORMAL DATA COLLECTION:
                  </span>
                  <span>
                    {profileBannerMessage || 'Running without verified local Docker sandbox. Formal evaluation runs require local_research mode with Docker and local Ollama.'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Condensed Single-Line Header Area */}
            <div className="mb-1.5 shrink-0 flex items-center justify-between gap-2 pr-0 md:pr-28"> 
               <div className="flex items-baseline gap-2.5 min-w-0">
                 <h2 className="text-base md:text-lg font-bold text-white tracking-tight truncate">
                   Task {gameState.currentLevelId}: {currentLevel?.title}
                 </h2>
                 <span className="text-[11px] text-slate-400 hidden sm:inline whitespace-nowrap">
                    Task {gameState.currentLevelId}/{levels.length} • Protocol V5.0.0 ({deploymentProfile}) • CLO-{currentLevel?.clo || 1} ({currentLevel?.difficulty || 'Beginner'})
                 </span>
               </div>
               <div className="flex items-center gap-1.5 shrink-0">
                 <button 
                   onClick={() => setIsGoogleDocExportOpen(true)}
                   className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border bg-blue-900/40 text-blue-300 border-blue-700/60 hover:bg-blue-800/50 hover:text-white shadow-sm"
                   title="Export system capabilities & research methodology to Google Docs"
                 >
                   <FileText size={12} />
                   <span className="hidden lg:inline">Export Google Doc</span>
                 </button>
                 <div
                   className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                   title="Connected to real Linux Bash PTY (/pty)"
                 >
                   <TerminalSquare size={12} className="text-emerald-400" />
                   <span>{user.username}@socratic-shell (tmux)</span>
                 </div>
               </div>
            </div>

            {/* Condensed & Resizable Full-Width Task Instructions Card (Above Terminal) */}
            {currentLevel && (
              <div
                data-testid="task-instructions-card"
                className="shrink-0 bg-slate-900/95 border border-slate-700/80 rounded-t-lg px-3 py-1.5 shadow-lg text-[11px] text-slate-200 flex flex-col"
              >
                {/* Compact Header Bar with Minimize / Condensed / Expand Controls */}
                <div className="flex items-center justify-between gap-2 select-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-300 uppercase tracking-wider text-[11px] shrink-0">
                      <BookOpen size={13} className="text-cyan-400" />
                      <span>Task {currentLevel.id} Briefing — {currentLevel.title}</span>
                    </div>
                    {instructionsMode === 'minimized' && (
                      <span className="text-slate-400 truncate text-[11px] border-l border-slate-700 pl-2">
                        <strong className="text-slate-200">Your task:</strong> {currentLevel.studentTask}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (instructionsMode === 'minimized') {
                          setInstructionsMode('condensed');
                          if (instructionsHeight < 50) setInstructionsHeight(72);
                        } else {
                          setInstructionsMode('minimized');
                        }
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 text-[10px] font-medium transition-colors"
                      title={instructionsMode === 'minimized' ? 'Restore condensed instructions' : 'Minimize instructions to a single line'}
                    >
                      {instructionsMode === 'minimized' ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                      <span>{instructionsMode === 'minimized' ? 'Show' : 'Hide'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (instructionsMode === 'expanded') {
                          setInstructionsMode('condensed');
                          setInstructionsHeight(72);
                        } else {
                          setInstructionsMode('expanded');
                        }
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 text-[10px] font-medium transition-colors"
                      title={instructionsMode === 'expanded' ? 'Switch to condensed view' : 'Expand all instructions'}
                    >
                      {instructionsMode === 'expanded' ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
                      <span>{instructionsMode === 'expanded' ? 'Compact' : 'Full'}</span>
                    </button>
                  </div>
                </div>

                {/* Resizable / Collapsible 3-Column Instructions Body (Zero Duplication) */}
                <div
                  style={
                    instructionsMode === 'minimized'
                      ? { maxHeight: 0, overflow: 'hidden' }
                      : instructionsMode === 'condensed'
                      ? { height: `${instructionsHeight}px`, overflowY: 'auto' }
                      : { maxHeight: '240px', overflowY: 'auto' }
                  }
                  className={
                    instructionsMode === 'minimized'
                      ? 'transition-all duration-150'
                      : 'mt-1.5 pt-1.5 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-2 leading-snug pr-1'
                  }
                >
                  {/* 1. What to Accomplish */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded px-2.5 py-1.5 flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-white mr-1">Your task:</span>
                      <span className="text-slate-200">{currentLevel.studentTask}</span>
                    </div>
                    <div className="mt-1 pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
                      <span className="font-semibold text-emerald-300 inline-flex items-center gap-1 mr-1">
                        <CheckCircle2 size={10} /> Success evidence:
                      </span>
                      <span>{currentLevel.successEvidence}</span>
                    </div>
                  </div>

                  {/* 2. Necessary Context & Environment Constraints */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded px-2.5 py-1.5 flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-amber-300 mr-1">Context:</span>
                      <span className="text-slate-300">{currentLevel.context}</span>
                    </div>
                    <div className="mt-1 pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-300 mr-1">Constraints:</span>
                      <span>
                        {Array.isArray(currentLevel.constraints)
                          ? currentLevel.constraints.join(' • ')
                          : currentLevel.constraints}
                      </span>
                    </div>
                  </div>

                  {/* 3. What to Do in the Terminal & How to Use Guided AI */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded px-2.5 py-1.5 flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-cyan-300 mr-1">How to work:</span>
                      <span className="text-slate-300">{currentLevel.howToWork}</span>
                    </div>
                    <div className="mt-1 pt-1 border-t border-slate-800/60 text-[10px] text-emerald-300 font-mono flex items-center gap-1">
                      <ShieldCheck size={11} className="shrink-0 text-emerald-400" />
                      <span>
                        Need help? Run <code className="bg-slate-900 px-1 py-0.5 rounded text-cyan-300">ask-ai "&lt;question&gt;"</code> or use the bar below.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Drag-to-Resize Handle Between Task Instructions and Terminal */}
            <div
              data-testid="workspace-resize-handle"
              onMouseDown={handleStartResizeInstructions}
              onDoubleClick={() => {
                setInstructionsMode(prev => (prev === 'minimized' ? 'condensed' : 'minimized'));
              }}
              title="Drag up or down to resize Task Instructions & Terminal (double-click to collapse/restore)"
              className={`h-2.5 shrink-0 cursor-ns-resize flex items-center justify-center bg-slate-900/80 hover:bg-cyan-950/70 border-x border-b border-slate-700/80 rounded-b-md mb-1.5 transition-colors select-none group ${
                isResizingInstructions ? 'bg-cyan-900/60 border-cyan-500/60' : ''
              }`}
            >
              <GripHorizontal size={13} className="text-slate-500 group-hover:text-cyan-300 transition-colors" />
            </div>
            
            {/* Primary Work Area: Full-Width Real Linux Bash / tmux Terminal with Integrated ask-ai Path */}
            <div className="flex-1 min-h-0 flex flex-col">
               <div className="flex-1 min-h-0 shadow-2xl rounded-lg overflow-hidden border border-slate-700/50 bg-[#0f172a]">
                 <XTermTerminal
                   levelId={gameState.currentLevelId}
                   username={user.username}
                   sessionId={`sess_${user.username}_task_${gameState.currentLevelId}_s${sessionNonce}`}
                   authToken={authService.getToken()}
                   onCommandExecuted={() => setCommandCount(prev => prev + 1)}
                   onSubmitFlag={(flag) => processFlagSubmission(flag)}
                   onResetSession={() => {
                     const prevSessionId = `sess_${user.username}_task_${gameState.currentLevelId}_s${sessionNonce}`;
                     authService.fetchAuthenticated('/api/tasks/reset', {
                       method: 'POST',
                       headers: authService.getAuthHeaders(),
                       body: JSON.stringify({
                         taskId: gameState.currentLevelId,
                         sessionId: prevSessionId,
                         userId: user.username
                       })
                     }).catch(() => {});
                     setSessionNonce(prev => prev + 1);
                     setCommandCount(0);
                   }}
                 />
               </div>
            </div>

            {/* Compact Flag Submission Bar - BOTTOM */}
            <div className="mt-1.5 shrink-0 flex justify-center items-center w-full">
               {!pendingFlag ? (
                 <form onSubmit={handleFlagSubmitForm} className="flex w-full md:max-w-2xl gap-2 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800/60 backdrop-blur-sm shadow-lg">
                   <div className="relative flex-1">
                     <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                       <Flag size={13} className={isLevelComplete ? 'text-green-500' : 'text-slate-500'} />
                     </div>
                     <input 
                       type="text" 
                       value={flagInput}
                       onChange={(e) => setFlagInput(e.target.value)}
                       placeholder="Enter Flag (or type 'submit FLAG{...}' in terminal)"
                       disabled={isLevelComplete}
                       className={`w-full bg-slate-950 border text-xs rounded-md pl-8 pr-3 py-1.5 outline-none focus:ring-1 transition-all ${
                         isLevelComplete 
                           ? 'border-green-500/50 text-green-400 placeholder-green-700' 
                           : 'border-slate-700 text-white placeholder-slate-500 focus:border-red-500 focus:ring-red-500'
                       }`}
                     />
                   </div>
                   <button 
                     type="submit"
                     disabled={isLevelComplete || !flagInput}
                     className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                       isLevelComplete
                         ? 'bg-green-600/20 text-green-400 cursor-default border border-green-500/30'
                         : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-md shadow-red-900/20 border border-red-500'
                     }`}
                   >
                     {isLevelComplete ? 'Solved' : 'Submit Flag'}
                   </button>
                 </form>
               ) : (
                 <div className="w-full md:max-w-2xl bg-slate-900 border border-indigo-500/50 rounded-xl p-4 shadow-2xl shadow-indigo-900/20 animate-in slide-in-from-bottom-4">
                    <h3 className="text-indigo-400 font-bold mb-3 flex items-center gap-2">
                       <Flag size={16} /> Submission Review
                    </h3>
                    <div className="space-y-4">
                       <div>
                          <label className="block text-xs text-slate-400 mb-1">How confident are you in this answer? (1 = Guessing, 5 = Certain)</label>
                          <div className="flex gap-2">
                             {[1, 2, 3, 4, 5].map(num => (
                                <button
                                   key={num}
                                   type="button"
                                   onClick={() => setConfidence(num)}
                                   className={`flex-1 py-2 rounded border text-sm font-bold transition-colors ${
                                      confidence === num 
                                      ? 'bg-indigo-600 border-indigo-500 text-white' 
                                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-indigo-500/50'
                                   }`}
                                >
                                   {num}
                                </button>
                             ))}
                          </div>
                       </div>
                       <div>
                          <label className="block text-xs text-slate-400 mb-1">State your Goal or Hypothesis (Claim):</label>
                          <textarea
                             value={claim}
                             onChange={(e) => setClaim(e.target.value)}
                             placeholder="I am trying to find the hidden configuration file."
                             rows={2}
                             className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none resize-none"
                          />
                       </div>
                       <div>
                          <label className="block text-xs text-slate-400 mb-1">Cite Output/Files (Evidence):</label>
                          <textarea
                             value={evidence}
                             onChange={(e) => setEvidence(e.target.value)}
                             placeholder="The output of 'ls -al' showed a .secret_config file."
                             rows={2}
                             className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none resize-none"
                          />
                       </div>
                       <div>
                          <label className="block text-xs text-slate-400 mb-1">Explain your Logic (Warrant):</label>
                          <textarea
                             value={warrant}
                             onChange={(e) => setWarrant(e.target.value)}
                             placeholder="Because the file is hidden and named 'secret', it likely contains the flag."
                             rows={2}
                             className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none resize-none"
                          />
                       </div>
                       <div className="flex gap-2 pt-2">
                          <button 
                             onClick={() => setPendingFlag(null)}
                             className="flex-1 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors"
                          >
                             Cancel
                          </button>
                          <button 
                             onClick={confirmFlagSubmission}
                             disabled={!claim.trim() || !evidence.trim() || !warrant.trim()}
                             className="flex-1 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
                          >
                             Confirm Submission
                          </button>
                       </div>
                    </div>
                 </div>
               )}
            </div>
         </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Settings Modal (ALL USERS) */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        config={aiConfig}
        onSave={(cfg) => { 
            setAiConfig(cfg); 
            authService.fetchAuthenticated('/api/config', {
               method: 'POST', 
               headers: authService.getAuthHeaders(), 
               body: JSON.stringify(cfg)
            }).catch(e => console.warn('Failed to save config to server'));
        }}
        onLevelsChange={refreshLevels}
        isAdmin={user?.role === 'admin'}
      />

      {/* Research Modals */}
      <ErrorBoundary>
        <FacultyReviewModal 
          isOpen={isFacultyReviewOpen}
          onClose={() => setIsFacultyReviewOpen(false)}
          reviewerId={user?.username || 'investigator'}
          currentTaskId={gameState.currentLevelId}
          currentTask={currentLevel}
        />

        <TestCaseModal 
          isOpen={isTestCasesOpen}
          onClose={() => setIsTestCasesOpen(false)}
          currentTaskId={gameState.currentLevelId}
        />

        <ResearchDashboard 
          isOpen={isResearchDashboardOpen}
          onClose={() => setIsResearchDashboardOpen(false)}
          isAdmin={user?.role === 'admin'}
          onOpenGoogleDocExport={() => setIsGoogleDocExportOpen(true)}
        />

        <TelemetryValidationModal 
          isOpen={isTelemetryValidationOpen}
          onClose={() => setIsTelemetryValidationOpen(false)}
        />

        <GoogleDocExportModal
          isOpen={isGoogleDocExportOpen}
          onClose={() => setIsGoogleDocExportOpen(false)}
        />
      </ErrorBoundary>
    </div>
  );
};

export default App;
