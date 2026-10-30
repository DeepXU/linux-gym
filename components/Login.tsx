import React, { useState } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { Shield, User as UserIcon, Lock } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (!adminUsername.trim() || !adminPassword.trim()) {
        setError('Please enter both investigator username and password');
        return;
      }

      const user = await authService.loginWithServer(adminUsername, adminPassword);
      if (user) {
        onLogin(user);
      } else {
        setError('Invalid investigator credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-8">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-red-600/10 rounded-full mb-4 ring-1 ring-red-500/50">
            <Shield className="text-red-500 w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center tracking-tight">Socratic Shell</h1>
          <p className="text-slate-400 text-xs mt-1.5 text-center">
            Evidence-Grounded Socratic Linux Terminal &amp; Research Workbench (Protocol V5.0.0)
          </p>
          <span className="mt-2 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-mono">
            Single-Investigator Research Mode (24 Cases / 8 Tasks)
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5 tracking-wider">
                Investigator / Evaluator ID
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                  placeholder="Investigator username"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5 tracking-wider">
                Passphrase
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-500 w-4 h-4" />
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                  placeholder="Enter passphrase"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 text-center">
                Use the investigator credentials configured by your server administrator.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-red-300 text-xs font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-red-900/30 active:scale-[0.98] border border-red-500/50"
          >
            Enter Investigator Workbench
          </button>
        </form>
      </div>

      <p className="mt-8 text-slate-600 text-xs text-center max-w-xs leading-relaxed">
        Formative Software &amp; Instrument Evaluation Only.<br />No Human-Subjects Enrollment Enabled.
      </p>
    </div>
  );
};

