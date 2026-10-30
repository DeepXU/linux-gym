import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Eye } from 'lucide-react';
import { CEWSubmission, CEWScore } from '../types';
import { authService } from '../services/authService';

interface CEWReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: CEWSubmission;
  automatedScore: CEWScore | null;
  existingExpertScore: CEWScore | null;
  evaluatorId: string;
  onReviewSubmitted?: () => void;
}

export const CEWReviewModal: React.FC<CEWReviewModalProps> = ({
  isOpen,
  onClose,
  submission,
  automatedScore,
  existingExpertScore,
  evaluatorId,
  onReviewSubmitted
}) => {
  const [claimScore, setClaimScore] = useState<number>(3);
  const [evidenceScore, setEvidenceScore] = useState<number>(3);
  const [warrantScore, setWarrantScore] = useState<number>(3);
  const [claimRationale, setClaimRationale] = useState('');
  const [evidenceRationale, setEvidenceRationale] = useState('');
  const [warrantRationale, setWarrantRationale] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showAutomated, setShowAutomated] = useState(false);

  // If expert already scored it, show automated immediately.
  useEffect(() => {
    if (existingExpertScore) {
      setShowAutomated(true);
      setClaimScore(existingExpertScore.claimScore);
      setEvidenceScore(existingExpertScore.evidenceScore);
      setWarrantScore(existingExpertScore.warrantScore);
      setClaimRationale(existingExpertScore.claimRationale);
      setEvidenceRationale(existingExpertScore.evidenceRationale);
      setWarrantRationale(existingExpertScore.warrantRationale);
    }
  }, [existingExpertScore]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (existingExpertScore) return; // Prevent rescoring in this simplistic UI for now, or could allow
    setIsSubmitting(true);
    try {
      const payload = {
        submissionId: submission.submissionId,
        testCaseId: submission.testCaseId,
        evaluatorId: evaluatorId,
        provider: 'human',
        model: 'human',
        rubricVersion: '2.0.0',
        claimScore,
        evidenceScore,
        warrantScore,
        claimRationale,
        evidenceRationale,
        warrantRationale,
        feedbackCategory: 'manual_expert_review'
      };
      
      const res = await authService.fetchAuthenticated('/api/cew/expert-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setSuccessMessage('Expert CEW score saved successfully.');
        setShowAutomated(true); // Unblind
        onReviewSubmitted?.();
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Blinded CEW Expert Review
            </h2>
            <span className="text-xs text-slate-400">Submission ID: {submission.submissionId}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="p-4 bg-slate-800/50 rounded border border-slate-700">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Original Submission</h3>
            <div className="mb-2"><strong>Claim:</strong> <span className="text-slate-200">{submission.claim || (submission as any).claimText || 'N/A'}</span></div>
            <div className="mb-2"><strong>Evidence:</strong> <span className="text-slate-200">{submission.evidence || (submission as any).evidenceText || 'N/A'}</span></div>
            <div><strong>Warrant:</strong> <span className="text-slate-200">{submission.warrant || (submission as any).warrantText || 'N/A'}</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-800 rounded border border-slate-700">
                <label className="text-sm font-bold block mb-1 text-slate-200">Claim Score (1-3)</label>
                <select disabled={!!existingExpertScore} value={claimScore} onChange={e => setClaimScore(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 mb-2">
                  <option value={1}>1 - Missing/Vague</option>
                  <option value={2}>2 - Partial</option>
                  <option value={3}>3 - Strong</option>
                </select>
                <textarea disabled={!!existingExpertScore} value={claimRationale} onChange={e => setClaimRationale(e.target.value)} placeholder="Rationale..." className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-sm h-16" />
              </div>
              <div className="p-3 bg-slate-800 rounded border border-slate-700">
                <label className="text-sm font-bold block mb-1 text-slate-200">Evidence Score (1-3)</label>
                <select disabled={!!existingExpertScore} value={evidenceScore} onChange={e => setEvidenceScore(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 mb-2">
                  <option value={1}>1 - Missing/Vague</option>
                  <option value={2}>2 - Partial</option>
                  <option value={3}>3 - Strong</option>
                </select>
                <textarea disabled={!!existingExpertScore} value={evidenceRationale} onChange={e => setEvidenceRationale(e.target.value)} placeholder="Rationale..." className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-sm h-16" />
              </div>
              <div className="p-3 bg-slate-800 rounded border border-slate-700">
                <label className="text-sm font-bold block mb-1 text-slate-200">Warrant Score (1-3)</label>
                <select disabled={!!existingExpertScore} value={warrantScore} onChange={e => setWarrantScore(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 mb-2">
                  <option value={1}>1 - Missing/Vague</option>
                  <option value={2}>2 - Partial</option>
                  <option value={3}>3 - Strong</option>
                </select>
                <textarea disabled={!!existingExpertScore} value={warrantRationale} onChange={e => setWarrantRationale(e.target.value)} placeholder="Rationale..." className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-sm h-16" />
              </div>
            </div>

            {successMessage && (
              <div className="text-green-400 flex items-center gap-2"><CheckCircle size={16} /> {successMessage}</div>
            )}

            {!existingExpertScore && (
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded text-white font-bold w-full">
                Submit Blinded Expert Rating
              </button>
            )}
          </form>

          {/* Automated Score Panel (Hidden until manual submitted) */}
          <div className={`p-4 border rounded ${showAutomated ? 'border-amber-500 bg-amber-900/10' : 'border-slate-800 bg-slate-900'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Eye size={16} />
                Automated System Score
              </h3>
              {!showAutomated && <span className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">BLINDED</span>}
            </div>
            
            {showAutomated ? (
              automatedScore ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-3">
                  <div><strong>Claim:</strong> {automatedScore.claimScore}/3<p className="text-xs text-slate-400 mt-1">{automatedScore.claimRationale}</p></div>
                  <div><strong>Evidence:</strong> {automatedScore.evidenceScore}/3<p className="text-xs text-slate-400 mt-1">{automatedScore.evidenceRationale}</p></div>
                  <div><strong>Warrant:</strong> {automatedScore.warrantScore}/3<p className="text-xs text-slate-400 mt-1">{automatedScore.warrantRationale}</p></div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">No automated score exists for this submission.</p>
              )
            ) : (
              <p className="text-xs text-slate-500 italic">Submit your manual expert rating above to reveal the automated system score.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
