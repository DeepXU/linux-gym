import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  FileCheck,
  ShieldCheck,
  Sparkles,
  LogOut
} from 'lucide-react';
import { 
  signInWithGoogle, 
  getGoogleAccessToken, 
  exportResearchMethodologyToGoogleDoc, 
  initGoogleAuth,
  logoutGoogle,
  ExportDocResult
} from '../services/googleWorkspaceService';
import { User as FirebaseUser } from 'firebase/auth';

interface GoogleDocExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleDocExportModal: React.FC<GoogleDocExportModalProps> = ({ isOpen, onClose }) => {
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportDocResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Listen to Google Auth state
    const unsubscribe = initGoogleAuth(
      (user, activeToken) => {
        setGoogleUser(user);
        setToken(activeToken);
      },
      () => {
        setGoogleUser(null);
        setToken(null);
      }
    );

    const currentToken = getGoogleAccessToken();
    if (currentToken) {
      setToken(currentToken);
    }

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage('Authenticating with Google Workspace...');
    try {
      const { user, accessToken } = await signInWithGoogle();
      setGoogleUser(user);
      setToken(accessToken);
      setStatusMessage('Signed in successfully.');
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      setError(err.message || 'Failed to authenticate with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutGoogle();
      setGoogleUser(null);
      setToken(null);
      setExportResult(null);
      setShowConfirm(false);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const handleStartExportFlow = () => {
    setError(null);
    setShowConfirm(true);
  };

  const handleConfirmExport = async () => {
    setShowConfirm(false);
    setIsLoading(true);
    setError(null);
    setStatusMessage('Creating new Google Doc in your Drive...');
    
    try {
      setStatusMessage('Initializing Google Document via Docs API...');
      const result = await exportResearchMethodologyToGoogleDoc(token || undefined);
      
      setStatusMessage('Formatting architectural breakdown and research methodology...');
      setExportResult(result);
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export document to Google Docs.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                Export to Google Docs
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                  v1.0.0 (Baseline)
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Generate and export the system capabilities & pre-pilot methodology protocol
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Document Summary Card */}
          <div className="bg-zinc-950/40 border border-zinc-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/80 pb-2">
              <span className="font-mono text-zinc-300">Target Document Payload</span>
              <span className="flex items-center gap-1 text-blue-400 font-mono">
                <FileCheck className="w-3.5 h-3.5" /> Full Scientific Report
              </span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              This automated export compiles the complete research package into an editable Google Doc on your Google Drive, including:
            </p>
            <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
              <li><strong className="text-zinc-200">Executive Summary</strong> & Experimental Design Rationale</li>
              <li><strong className="text-zinc-200">System Capabilities</strong>: Dual shell, Socratic hint engine (L0-L4), CEW argumentation, multi-tier guardrails</li>
              <li><strong className="text-zinc-200">Pre-Pilot Methodology</strong>: 5-phase validation protocol (Synthetic stress test, SME 9-dimension rubric, Blinded CEW IRR, Think-Aloud dry runs)</li>
              <li><strong className="text-zinc-200">Formal "Go / No-Go" Criteria Matrix</strong> for institutional clearance</li>
            </ul>
          </div>

          {/* Account & Auth Status */}
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                  Google Workspace Connection
                </span>
                {googleUser ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-medium text-zinc-200">
                      Connected as <span className="text-blue-400 font-mono">{googleUser.email}</span>
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">
                    Sign in with Google to grant permission to create documents in your Google Drive.
                  </p>
                )}
              </div>

              {googleUser && (
                <button
                  onClick={handleSignOut}
                  title="Disconnect Google Account"
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 bg-zinc-800/60 hover:bg-zinc-800 px-3 py-1.5 rounded-md transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              )}
            </div>

            {/* Google Sign-in Button (if not authenticated) */}
            {!googleUser && (
              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-center">
                <button
                  onClick={handleSignIn}
                  disabled={isLoading}
                  className="flex items-center gap-3 bg-white hover:bg-zinc-100 text-zinc-800 px-5 py-2.5 rounded-md font-medium text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </div>
            )}
          </div>

          {/* User Confirmation Step */}
          {showConfirm && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                Confirm Google Drive File Creation
              </div>
              <p className="text-xs text-zinc-300 leading-normal">
                Are you sure you want to create a new file named <strong>"Socratic Shell Research Platform & Pre-Pilot Validation Protocol"</strong> in your personal Google Drive with permission from your account?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmExport}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Export
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center justify-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span>{statusMessage || 'Processing with Google Workspace API...'}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="block font-semibold">Export Failed</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Success State */}
          {exportResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-5 space-y-4 animate-fade-in">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="font-semibold text-sm">Google Doc Created Successfully!</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                The research protocol has been formatted and saved directly to your Google Drive. You can now open, edit, share, or download it as PDF/DOCX.
              </p>
              
              <div className="bg-zinc-950/80 p-3 rounded border border-zinc-800/80 flex items-center justify-between">
                <div className="truncate mr-3">
                  <span className="text-[11px] text-zinc-400 block">Document Title:</span>
                  <span className="text-xs font-mono text-zinc-200 truncate">{exportResult.title}</span>
                </div>
                <a
                  href={exportResult.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-xs font-semibold transition-all shadow-md hover:scale-105 flex-shrink-0"
                >
                  Open in Google Docs
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            OAuth Scopes: documents, drive.file
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Close
            </button>
            
            {googleUser && !exportResult && !showConfirm && (
              <button
                onClick={handleStartExportFlow}
                disabled={isLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-md font-medium text-xs transition-colors shadow disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                Export to Google Docs
              </button>
            )}

            {exportResult && (
              <a
                href={exportResult.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md font-medium text-xs transition-colors shadow"
              >
                View Document
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
