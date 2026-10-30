import React from 'react';
import { Level, Difficulty, User } from '../types';
import { TerminalSquare, Shield, Download, LogOut, User as UserIcon, Award, ListChecks, BarChart3, FileCheck, FileText } from 'lucide-react';
import { terminalService } from '../services/aiService';

interface SidebarProps {
  levels: Level[];
  currentLevelId: number;
  onSelectLevel: (id: number) => void;
  user: User;
  onLogout: () => void;
  onOpenFacultyReview?: () => void;
  onOpenTestCases?: () => void;
  onOpenResearchDashboard?: () => void;
  onOpenTelemetryValidation?: () => void;
  onOpenGoogleDocExport?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  levels,
  currentLevelId,
  onSelectLevel,
  user,
  onLogout,
  onOpenFacultyReview,
  onOpenTestCases,
  onOpenResearchDashboard,
  onOpenTelemetryValidation,
  onOpenGoogleDocExport
}) => {
  
  const handleDownloadLogs = async () => {
    try {
      await terminalService.downloadLogs();
    } catch (error) {
      alert(`Research export failed: ${(error as Error).message}`);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-slate-900 border-r border-slate-800">
      {/* Brand - Fixed at top */}
      <div className="p-6 border-b border-slate-800 bg-slate-950 shrink-0">
         <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-red-600/10 rounded-lg">
               <Shield className="text-red-500" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight text-white">Socratic Shell</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-medium">
                  v1.0.0
                </span>
              </div>
              <p className="text-xs text-slate-500">Research Baseline Freeze 1</p>
            </div>
         </div>
         
         {/* User Info Card */}
         <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2 overflow-hidden">
               <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                  <UserIcon size={14} className={user.role === 'admin' ? 'text-red-400' : 'text-blue-400'} />
               </div>
               <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate">{user.username}</p>
                  <p className="text-[10px] text-slate-500 uppercase">{user.role}</p>
               </div>
            </div>
            <button onClick={onLogout} className="text-slate-500 hover:text-white transition-colors" title="Logout">
               <LogOut size={14} />
            </button>
         </div>
      </div>

      {/* Challenges Header - Fixed above scroll area */}
      <div className="px-4 pt-4 pb-2 bg-slate-900 shrink-0 z-20 flex items-center justify-between">
         <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Study Tasks (1–8)</h2>
         <span className="text-[10px] font-mono text-slate-400">{levels.length} Tasks</span>
      </div>

      {/* Levels List - Scrollable Area with Overlay */}
      <div className="flex-1 relative min-h-0 flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {levels.slice(0, 8).map((level) => {
            const isActive = currentLevelId === level.id;

            return (
              <button
                key={level.id}
                onClick={() => onSelectLevel(level.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-red-600/10 border-red-500/50 shadow-md shadow-red-900/20' 
                    : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-medium ${isActive ? 'text-red-300' : 'text-slate-300'}`}>
                     Task {level.id}: {level.title}
                  </span>
                  {isActive && <TerminalSquare size={16} className="text-red-500" />}
                </div>
                <div className="flex items-center gap-2">
                   <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                     level.difficulty === Difficulty.EASY ? 'bg-green-500/10 text-green-400' :
                     level.difficulty === Difficulty.MEDIUM ? 'bg-yellow-500/10 text-yellow-400' :
                     'bg-red-500/10 text-red-400'
                   }`}>
                     {level.difficulty}
                   </span>
                   <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                     3 Cases
                   </span>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Scroll Indicator Gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
      </div>

      {/* Research Tools Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 shrink-0 space-y-1.5">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
          Study Instrumentation (V5.0.0)
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {onOpenFacultyReview && (
            <button
              onClick={onOpenFacultyReview}
              className="flex items-center gap-1.5 text-[11px] font-semibold bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 py-1.5 px-2 rounded border border-amber-800/40 transition-all"
              title="Open 9-dimension rubric & 10 critical-failure evaluation"
            >
              <Award size={12} />
              Evaluation Rubric
            </button>
          )}
          {onOpenTestCases && (
            <button
              onClick={onOpenTestCases}
              className="flex items-center gap-1.5 text-[11px] font-semibold bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 py-1.5 px-2 rounded border border-blue-800/40 transition-all"
              title="24 Standardized Cases, Ground Truth, & Sequestered Suite"
            >
              <ListChecks size={12} />
              Case Library
            </button>
          )}
          {onOpenResearchDashboard && (
            <button
              onClick={onOpenResearchDashboard}
              className="flex items-center gap-1.5 text-[11px] font-semibold bg-red-950/40 hover:bg-red-900/50 text-red-300 py-1.5 px-2 rounded border border-red-800/40 transition-all"
              title="Open study control, RQ1-RQ5 analytics, & defect tracker"
            >
              <BarChart3 size={12} />
              Study Analytics
            </button>
          )}
          {onOpenTelemetryValidation && (
            <button
              onClick={onOpenTelemetryValidation}
              className="flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 py-1.5 px-2 rounded border border-emerald-800/40 transition-all"
              title="Verify RQ4 record integrity & telemetry completeness"
            >
              <FileCheck size={12} />
              Record Integrity
            </button>
          )}
        </div>
        {user.role !== 'student' && (
          <button
            onClick={handleDownloadLogs}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 py-1.5 px-2 rounded border border-slate-800 transition-all"
            title="Download the authenticated research package"
          >
            <Download size={12} />
            Export Research Package
          </button>
        )}
      </div>
    </div>
  );
};
