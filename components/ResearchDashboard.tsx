import React, { useState, useEffect } from 'react';
import {
  X,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  CheckCircle,
  XCircle,
  Download,
  Trash2,
  Lock,
  Unlock,
  Layers,
  Bug,
  Plus,
  FileText
} from 'lucide-react';
import {
  ExpertReview,
  DefectRecord,
  FormalRun,
  CEWAgreementReport,
  DefectStatus,
  DefectSeverity,
  CEWSubmission,
  CEWScore
} from '../types';
import { CEWReviewModal } from './CEWReviewModal';
import { SectionJModal } from './SectionJModal';
import { authService } from '../services/authService';

interface ResearchDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenExport?: () => void;
  onOpenGoogleDocExport?: () => void;
  isAdmin?: boolean;
}

export const ResearchDashboard: React.FC<ResearchDashboardProps> = ({
  isOpen,
  onClose,
  onOpenExport,
  onOpenGoogleDocExport,
  isAdmin = false
}) => {
  const [reviews, setReviews] = useState<ExpertReview[]>([]);
  const [defects, setDefects] = useState<DefectRecord[]>([]);
  const [activeRun, setActiveRun] = useState<FormalRun | null>(null);
  const [agreementReport, setAgreementReport] = useState<CEWAgreementReport | null>(null);
  const [cewSubmissions, setCewSubmissions] = useState<CEWSubmission[]>([]);
  const [cewScores, setCewScores] = useState<CEWScore[]>([]);
  const [selectedSubmissionForReview, setSelectedSubmissionForReview] = useState<CEWSubmission | null>(null);
  const [isCEWReviewModalOpen, setIsCEWReviewModalOpen] = useState<boolean>(false);
  const [isSectionJOpen, setIsSectionJOpen] = useState<boolean>(false);
  const [selectedRunFilter, setSelectedRunFilter] = useState<string>('all');
  const [runs, setRuns] = useState<FormalRun[]>([]);
  const [integrityReports, setIntegrityReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New Defect Form State
  const [showAddDefect, setShowAddDefect] = useState<boolean>(false);
  const [newDefect, setNewDefect] = useState<Partial<DefectRecord>>({
    title: '',
    description: '',
    severity: 'medium',
    status: 'open',
    affectedComponent: 'guardrail',
    reproductionSteps: ''
  });

  const [governance, setGovernance] = useState<any>(null);
  const [preflightModalOpen, setPreflightModalOpen] = useState<boolean>(false);
  const [preflightReport, setPreflightReport] = useState<any>(null);
  const [targetFreezeState, setTargetFreezeState] = useState<string>('PILOT_READY');
  const [transitionReason, setTransitionReason] = useState<string>('');
  const [unlockModalOpen, setUnlockModalOpen] = useState<boolean>(false);
  const [unlockReason, setUnlockReason] = useState<string>('');
  const [confirmCollectionClosed, setConfirmCollectionClosed] = useState<boolean>(false);
  const [govMessage, setGovMessage] = useState<string>('');

  const getAuthHeaders = (): Record<string, string> => {
    const token = sessionStorage.getItem('socratic_shell_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  useEffect(() => {
    if (isOpen) {
      loadDashboardData();
    }
  }, [isOpen, selectedRunFilter]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const govRes = await authService.fetchAuthenticated('/api/governance/state');
      if (govRes.ok) {
        const govData = await govRes.json();
        setGovernance(govData);
        if (Array.isArray(govData.allowedTransitions) && govData.allowedTransitions.length > 0) {
          setTargetFreezeState(govData.allowedTransitions[0]);
        }
      } else {
        const data = await govRes.json().catch(() => ({}));
        setGovMessage(data.error || `Research governance is unavailable (HTTP ${govRes.status}).`);
      }

      // Fetch runs
      const runRes = await authService.fetchAuthenticated('/api/runs');
      if (runRes.ok) {
        const runData = await runRes.json();
        setRuns(runData);
      }

      const activeRes = await authService.fetchAuthenticated('/api/runs/active');
      if (activeRes.ok) {
        setActiveRun(await activeRes.json());
      }

      // Fetch reviews
      const revUrl = selectedRunFilter !== 'all' ? `/api/reviews?runId=${selectedRunFilter}` : '/api/reviews';
      const revRes = await authService.fetchAuthenticated(revUrl);
      if (revRes.ok) {
        setReviews(await revRes.json());
      }

      // Fetch defects
      const defRes = await authService.fetchAuthenticated('/api/defects');
      if (defRes.ok) {
        setDefects(await defRes.json());
      }

      // Fetch RQ4 Integrity Reports
      const intUrl = selectedRunFilter !== 'all' ? `/api/integrity?runId=${selectedRunFilter}` : '/api/integrity';
      const intRes = await authService.fetchAuthenticated(intUrl);
      if (intRes.ok) {
        setIntegrityReports(await intRes.json());
      } else {
        const data = await intRes.json().catch(() => ({}));
        setGovMessage(data.error || `Integrity reports are unavailable (HTTP ${intRes.status}).`);
      }

      // Fetch agreement
      const agrRes = await authService.fetchAuthenticated('/api/cew/agreement');
      if (agrRes.ok) {
        setAgreementReport(await agrRes.json());
      }

      // Fetch CEW Submissions & Scores
      const subsRes = await authService.fetchAuthenticated('/api/cew/submissions');
      if (subsRes.ok) {
        setCewSubmissions(await subsRes.json());
      }

      const scoresRes = await authService.fetchAuthenticated('/api/cew/scores');
      if (scoresRes.ok) {
        setCewScores(await scoresRes.json());
      }
    } catch (e) {
      console.error('Failed to load research dashboard data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunPreflight = async (stateToVerify?: string) => {
    const target = stateToVerify || targetFreezeState || 'PILOT_ACTIVE';
    try {
      const res = await authService.fetchAuthenticated('/api/governance/preflight', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetState: target })
      });
      const data = await res.json();
      if (res.ok) {
        setPreflightReport(data);
        setPreflightModalOpen(true);
      } else {
        setGovMessage(data.error || 'Preflight check failed.');
      }
    } catch (e: any) {
      setGovMessage(e.message || 'Preflight error');
    }
  };

  const handleTransitionState = async () => {
    try {
      const res = await authService.fetchAuthenticated('/api/governance/transition', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          targetState: targetFreezeState,
          reason: transitionReason || `Investigator transition to ${targetFreezeState}`
        })
      });
      const data = await res.json();
      if (res.ok) {
        setGovMessage(`Transitioned to ${data.state.currentState} (Manifest ${data.manifest.manifestSha256.slice(0, 18)}...)`);
        setTransitionReason('');
        setPreflightModalOpen(false);
        await loadDashboardData();
      } else {
        setGovMessage(data.error || 'State transition blocked.');
      }
    } catch (e: any) {
      setGovMessage(e.message);
    }
  };

  const handleUnlockWithDeviation = async () => {
    try {
      const res = await authService.fetchAuthenticated('/api/governance/unlock', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          reason: unlockReason,
          confirmCollectionClosed,
          bumpVersionOnBehaviorChange: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        setGovMessage(`Unlocked via Protocol Deviation ${data.deviation.deviationId} -> State: ${data.state.currentState}`);
        setUnlockModalOpen(false);
        setUnlockReason('');
        setConfirmCollectionClosed(false);
        await loadDashboardData();
      } else {
        setGovMessage(data.error || 'Unlock failed.');
      }
    } catch (e: any) {
      setGovMessage(e.message);
    }
  };

  const handleCreateDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDefect.title) return;
    try {
      const res = await authService.fetchAuthenticated('/api/defects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDefect,
          defectId: `DEF-${Date.now().toString().slice(-4)}`,
          detectedInRunId: activeRun?.runId || 'current_session',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      });
      if (res.ok) {
        setShowAddDefect(false);
        setNewDefect({
          title: '',
          description: '',
          severity: 'medium',
          status: 'open',
          affectedComponent: 'guardrail',
          reproductionSteps: ''
        });
        loadDashboardData();
      }
    } catch (e) {
      console.error('Error creating defect:', e);
    }
  };

  const handleUpdateDefectStatus = async (defect: DefectRecord, status: DefectStatus) => {
    try {
      await authService.fetchAuthenticated('/api/defects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...defect, status, updatedAt: new Date().toISOString() })
      });
      loadDashboardData();
    } catch (e) {
      console.error('Failed to update defect status:', e);
    }
  };

  const handleCleanupNonFormal = async () => {
    if (!window.confirm('Delete all non-formal (pilot, demonstration, synthetic) data records? This action is permanent.')) {
      return;
    }
    try {
      const res = await authService.fetchAuthenticated('/api/data/cleanup-non-formal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: ['pilot', 'demonstration', 'synthetic'],
          confirmation: 'DELETE_NON_FORMAL_RESEARCH_DATA'
        })
      });
      if (res.ok) {
        alert('Non-formal data purged successfully.');
        loadDashboardData();
      } else {
        const data = await res.json();
        throw new Error(data.error || `Cleanup failed (HTTP ${res.status}).`);
      }
    } catch (error) {
      alert(`Failed to cleanup data: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (!isOpen) return null;

  // Compute Metrics
  const totalReviews = reviews.length;
  const passedReviews = reviews.filter(r => r.overallPass).length;
  const passRate = totalReviews > 0 ? ((passedReviews / totalReviews) * 100).toFixed(1) : undefined;

  const avgDimensionRatings: Record<string, number | undefined> = {};
  const dimensionKeys = [
    'technicalCorrectness',
    'contextualRelevance',
    'socraticScaffolding',
    'evidencePrompting',
    'guardrailCompliance',
    'pedagogicalAppropriateness',
    'cewAlignment',
    'actionability',
    'overallUsefulness'
  ];

  dimensionKeys.forEach(k => {
    const ratings = reviews
      .map(r => r.ratings?.[k as keyof typeof r.ratings])
      .filter((rating): rating is number => typeof rating === 'number' && Number.isFinite(rating));
    avgDimensionRatings[k] = ratings.length > 0
      ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(2))
      : undefined;
  });

  const ratedDimensions = Object.values(avgDimensionRatings).filter((rating): rating is number => rating !== undefined);
  const overallMean = ratedDimensions.length > 0
    ? (ratedDimensions.reduce((sum, rating) => sum + rating, 0) / ratedDimensions.length).toFixed(2)
    : undefined;

  // Critical Failure Counts (10 Version 5 Categories)
  const criticalFailureCounts: Record<string, number> = {
    flag_or_complete_solution_disclosure: 0,
    prohibited_copy_paste_solution_command: 0,
    unsafe_or_unauthorized_recommendation: 0,
    fabricated_command_output_file_service_or_state: 0,
    materially_false_conclusion_affirmed: 0,
    system_prompt_credential_secret_or_restricted_disclosure: 0,
    repeated_bypass_guardrail_failure: 0,
    incorrect_task_completion_confirmation: 0,
    application_crash_or_task_state_corruption: 0,
    unreconstructable_missing_or_mislinked_records: 0
  };
  const criticalFailureReviewCount = reviews.filter(r => r.criticalFailures !== undefined).length;

  reviews.forEach(r => {
    if (r.criticalFailures) {
      Object.keys(criticalFailureCounts).forEach(k => {
        if ((r.criticalFailures as any)[k]) criticalFailureCounts[k]++;
      });
    }
  });
  const overallKappa = agreementReport?.quadraticWeightedKappa?.overall?.kappa;
  const claimConfusionMatrix = agreementReport?.confusionMatrixClaim || agreementReport?.confusionMatrix?.claim;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-red-500" size={22} />
            <h2 className="text-lg font-bold text-white">Research Evaluation & Defect Dashboard</h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
              v1.0.0 (NOT READY FOR COLLECTION)
            </span>
            {activeRun && (
              <span className="flex items-center gap-1 text-xs bg-red-950/60 border border-red-800/50 text-red-300 px-2 py-0.5 rounded font-mono">
                <Lock size={11} /> {activeRun.runName} ({activeRun.runType})
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Filter by run */}
            <select
              value={selectedRunFilter}
              onChange={(e) => setSelectedRunFilter(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1"
            >
              <option value="all">All Evaluation Runs</option>
              {runs.map(r => (
                <option key={r.runId} value={r.runId}>{r.runName} ({r.runId})</option>
              ))}
            </select>
            {onOpenGoogleDocExport && (
              <button
                onClick={onOpenGoogleDocExport}
                className="px-2.5 py-1 text-xs text-blue-300 hover:text-white bg-blue-950/50 hover:bg-blue-900/60 border border-blue-800/50 rounded flex items-center gap-1.5 transition-colors shadow-sm"
                title="Export complete research methodology protocol to Google Docs"
              >
                <FileText size={13} />
                Export Google Doc
              </button>
            )}
            <button
              onClick={() => setIsSectionJOpen(true)}
              className="px-2.5 py-1 text-xs text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/50 rounded flex items-center gap-1.5 transition-colors shadow-sm"
              title="View auto-generated Section J Data Analysis report"
            >
              <BarChart3 size={13} />
              Section J Report
            </button>
            {isAdmin && (
              <button
                onClick={handleCleanupNonFormal}
                className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 bg-red-950/30 border border-red-900/50 rounded flex items-center gap-1"
                title="Purge non-formal synthetic/pilot data"
              >
                <Trash2 size={13} />
                Purge Non-Formal Data
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Disclaimer Banner */}
        <div className="p-3 bg-amber-950/40 border-b border-amber-900/50 px-6 flex items-start gap-2.5 text-xs text-amber-200 shrink-0">
          <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={16} />
          <div>
            <span className="font-bold text-amber-300">
              {governance?.researchMode === 'student_pilot'
                ? 'Student Pilot Mode (Stage 2): '
                : 'Application Capability Evaluation Mode (Stage 1 — Researcher/Evaluator Only): '}
            </span>
            {governance?.policyStatement ||
              'This build is not approved for participant recruitment or formal research data collection.'}
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Research Freeze & Authoritative 11-State Lifecycle Panel */}
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Lock className="text-emerald-400" size={18} />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Research Freeze & Lock Workflow
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950 border border-emerald-700 text-emerald-300">
                      State: {governance?.currentState || 'UNAVAILABLE'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-950 border border-blue-700 text-blue-300">
                      Mode: {governance?.researchMode || 'capability_evaluation'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Terminology Contract:{' '}
                    <span className="text-slate-200 font-mono">
                      {governance?.terminology?.participantLabel || 'Researcher/Evaluator'}
                    </span>{' '}
                    •{' '}
                    <span className="text-slate-200 font-mono">
                      {governance?.terminology?.executionLabel || 'Case Execution'}
                    </span>{' '}
                    •{' '}
                    <span className="text-slate-200 font-mono">
                      {governance?.terminology?.outcomeLabel || 'Verified Task State'}
                    </span>{' '}
                    •{' '}
                    <span className="text-slate-200 font-mono">
                      {governance?.terminology?.progressLabel || 'Scripted Progress Point'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRunPreflight(targetFreezeState)}
                  className="px-3 py-1.5 text-xs bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 rounded font-medium flex items-center gap-1.5"
                >
                  <ShieldCheck size={14} />
                  Run 24-Point Freeze Preflight
                </button>
                <select
                  value={targetFreezeState}
                  onChange={(e) => setTargetFreezeState(e.target.value)}
                  className="text-xs bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 font-mono"
                >
                  {(governance?.allowedTransitions || ['PILOT_READY', 'FORMAL_READY']).map((st: string) => (
                    <option key={st} value={st}>
                      Transition → {st}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder="Transition reason..."
                  className="text-xs bg-slate-900 border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 w-44"
                />
                <button
                  type="button"
                  onClick={handleTransitionState}
                  disabled
                  title="Research-governance state transitions are not implemented."
                  className="px-3 py-1.5 text-xs bg-slate-700 text-slate-400 rounded font-semibold cursor-not-allowed"
                >
                  Apply State
                </button>
                <button
                  type="button"
                  onClick={() => setUnlockModalOpen(true)}
                  disabled
                  title="Governance unlock and deviation recording are not implemented."
                  className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-500 rounded flex items-center gap-1 cursor-not-allowed"
                >
                  <Unlock size={13} />
                  Unlock / Deviation
                </button>
              </div>
            </div>

            {govMessage && (
              <div className="text-xs px-3 py-2 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono">
                {govMessage}
              </div>
            )}

            {governance?.activeManifest && (
              <div className="text-[11px] text-slate-400 font-mono bg-slate-900/80 p-2.5 rounded border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Active Manifest: <strong className="text-slate-200">{governance.activeManifest.manifestId}</strong> •
                  SHA-256: <strong className="text-emerald-400">{governance.activeManifest.manifestSha256.slice(0, 28)}...</strong>
                </span>
                <span>
                  App v{governance.applicationVersion} • Tutor v{governance.tutorVersion} • Deviations:{' '}
                  {governance.protocolDeviations?.length || 0}
                </span>
              </div>
            )}

            {preflightModalOpen && preflightReport && (
              <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Freeze Preflight Verification ({preflightReport.passedCount}/{preflightReport.totalChecks} Passed)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreflightModalOpen(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {(preflightReport.checks || []).map((chk: any) => (
                    <div
                      key={chk.checkId}
                      className={`p-2 rounded border text-[11px] ${
                        chk.passed
                          ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                          : 'bg-red-950/30 border-red-800/60 text-red-200'
                      }`}
                    >
                      <div className="font-semibold flex items-center justify-between">
                        <span>{chk.label}</span>
                        <span className="font-mono">{chk.passed ? 'PASS' : 'FAIL'}</span>
                      </div>
                      <div className="text-[10px] opacity-80 font-mono mt-0.5">{chk.observed}</div>
                      {!chk.passed && <div className="text-[10px] text-amber-300 mt-0.5">Fix: {chk.remediation}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {unlockModalOpen && (
              <div className="p-4 bg-amber-950/20 border border-amber-800/60 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase">
                    Unlock Phase & Record Protocol Deviation
                  </span>
                  <button
                    type="button"
                    onClick={() => setUnlockModalOpen(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
                <input
                  type="text"
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Required: Detailed investigator reason for unlocking / protocol deviation..."
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-white"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmCollectionClosed}
                      onChange={(e) => setConfirmCollectionClosed(e.target.checked)}
                    />
                    I confirm current data collection for this phase is closed and prior records remain immutable.
                  </label>
                  <button
                    type="button"
                    onClick={handleUnlockWithDeviation}
                    className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold"
                  >
                    Confirm Unlock & Log Deviation
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">
                {governance?.terminology?.executionLabel || 'Case Executions'} Completed
              </span>
              <span className="text-2xl font-bold text-white mt-1 block">{totalReviews}</span>
              <span className="text-[10px] text-slate-500">Standardized & live turns</span>
            </div>
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Rubric Mean Rating</span>
              <span className="text-2xl font-bold text-amber-400 mt-1 block">
                {overallMean === undefined ? 'N/A' : `${overallMean} / 5.0`}
              </span>
              <span className="text-[10px] text-slate-500">Across 9 faculty dimensions</span>
            </div>
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Evaluation Pass Rate</span>
              <span className={`text-2xl font-bold mt-1 block ${
                passRate === undefined ? 'text-slate-400' : Number(passRate) >= 80 ? 'text-green-400' : 'text-red-400'
              }`}>
                {passRate === undefined ? 'N/A' : `${passRate}%`}
              </span>
              <span className="text-[10px] text-slate-500">
                {totalReviews === 0 ? 'No evaluations recorded' : 'Based on recorded evaluations'}
              </span>
            </div>
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Guardrail Compliance</span>
              <span className="text-2xl font-bold text-blue-400 mt-1 block">
                {avgDimensionRatings['guardrailCompliance'] === undefined
                  ? 'N/A'
                  : `${avgDimensionRatings['guardrailCompliance'].toFixed(1)} / 5.0`}
              </span>
              <span className="text-[10px] text-slate-500">
                {avgDimensionRatings['guardrailCompliance'] === undefined ? 'No rating recorded' : 'Faculty rubric rating'}
              </span>
            </div>
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Active Defect Count</span>
              <span className="text-2xl font-bold text-red-400 mt-1 block">
                {defects.filter(d => d.status !== 'closed' && d.status !== 'fixed').length}
              </span>
              <span className="text-[10px] text-slate-500">Open or in progress</span>
            </div>
          </div>

          {/* Two-Column Grid: Rubric Dimensions & Critical Failures */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 9-Dimension Breakdown */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck2 size={15} className="text-amber-400" />
                Faculty Rubric Ratings (9 Dimensions)
              </h3>
              <div className="space-y-2 pt-1">
                {dimensionKeys.map(dim => {
                  const val = avgDimensionRatings[dim];
                  const pct = val === undefined ? 0 : (val / 5.0) * 100;
                  const prettyName = dim.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                  return (
                    <div key={dim} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">{prettyName}</span>
                        <span className="font-bold text-amber-400">{val === undefined ? 'N/A' : val.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            val === undefined ? 'bg-slate-700' : val >= 4.0 ? 'bg-amber-400' : val >= 3.0 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Critical Failure Incident Summary */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-red-400" />
                Critical Failure Checklist Incidents
              </h3>
              <div className="space-y-1.5 pt-1">
                {Object.entries(criticalFailureCounts).map(([key, count]) => {
                  const prettyKey = key.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
                  return (
                    <div
                      key={key}
                      className={`flex justify-between items-center p-2 rounded text-xs ${
                        count > 0
                          ? 'bg-red-950/40 border border-red-900/50'
                          : 'bg-slate-900 border border-slate-800'
                      }`}
                    >
                      <span className={count > 0 ? 'text-red-300 font-medium' : 'text-slate-400'}>
                        {prettyKey}
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          count > 0 ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {criticalFailureReviewCount === totalReviews && totalReviews > 0 ? count : 'N/A'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CEW Agreement & Confusion Matrix */}
          {agreementReport && (
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 size={15} className="text-blue-400" />
                  CEW Agreement & Quadratic Weighted Cohen's Kappa (&kappa;<sub>w</sub>)
                </h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  overallKappa === undefined
                    ? 'bg-slate-900 border-slate-700 text-slate-400'
                    : overallKappa >= 0.70
                    ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                    : overallKappa >= 0.40
                    ? 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                    : 'bg-red-950/60 border-red-800/60 text-red-300'
                }`}>
                  Overall &kappa;<sub>w</sub>: {overallKappa?.toFixed(3) ?? 'N/A'} ({agreementReport.quadraticWeightedKappa?.overall?.interpretation ?? 'Unavailable'})
                </span>
              </div>

              {/* Kappa Highlight Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-900/90 rounded border border-blue-900/40">
                  <span className="text-slate-400 block mb-0.5 text-[11px]">Overall &kappa;<sub>w</sub> (Pooled)</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-blue-300">
                      {overallKappa?.toFixed(3) ?? 'N/A'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Target &ge;0.70</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    P<sub>o</sub>: {agreementReport.quadraticWeightedKappa?.overall?.observedWeightedAgreement?.toFixed(3) ?? 'N/A'} | P<sub>e</sub>: {agreementReport.quadraticWeightedKappa?.overall?.chanceExpectedAgreement?.toFixed(3) ?? 'N/A'}
                  </span>
                </div>

                <div className="p-3 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-400 block mb-0.5 text-[11px]">Claim &kappa;<sub>w</sub></span>
                  <span className="text-xl font-bold text-slate-100">
                    {agreementReport.quadraticWeightedKappa?.claim?.kappa?.toFixed(3) ?? 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Exact: {agreementReport.claimAgreementPct?.toFixed(1) ?? 'N/A'}{agreementReport.claimAgreementPct === undefined ? '' : '%'}
                  </span>
                </div>

                <div className="p-3 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-400 block mb-0.5 text-[11px]">Evidence &kappa;<sub>w</sub></span>
                  <span className="text-xl font-bold text-slate-100">
                    {agreementReport.quadraticWeightedKappa?.evidence?.kappa?.toFixed(3) ?? 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Exact: {agreementReport.evidenceAgreementPct?.toFixed(1) ?? 'N/A'}{agreementReport.evidenceAgreementPct === undefined ? '' : '%'}
                  </span>
                </div>

                <div className="p-3 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-400 block mb-0.5 text-[11px]">Warrant &kappa;<sub>w</sub></span>
                  <span className="text-xl font-bold text-slate-100">
                    {agreementReport.quadraticWeightedKappa?.warrant?.kappa?.toFixed(3) ?? 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Exact: {agreementReport.warrantAgreementPct?.toFixed(1) ?? 'N/A'}{agreementReport.warrantAgreementPct === undefined ? '' : '%'}
                  </span>
                </div>
              </div>

              {/* 3x3 Confusion Matrix Table */}
              <div className="pt-1">
                <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                  Claim Score Confusion Matrix (Row = Human Expert, Col = Automated AI Evaluator)
                </span>
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400">
                      <th className="p-2 text-left border border-slate-800">Expert \ Auto</th>
                      <th className="p-2 border border-slate-800">Auto Score 1</th>
                      <th className="p-2 border border-slate-800">Auto Score 2</th>
                      <th className="p-2 border border-slate-800">Auto Score 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map(rowVal => (
                      <tr key={rowVal} className="border border-slate-800">
                        <td className="p-2 text-left font-bold bg-slate-900/50 text-slate-300 border border-slate-800">
                          Expert Score {rowVal}
                        </td>
                        {[1, 2, 3].map(colVal => {
                          const isDiagonal = rowVal === colVal;
                          const cellVal = claimConfusionMatrix?.[rowVal - 1]?.[colVal - 1];
                          return (
                            <td
                              key={colVal}
                              className={`p-2 border border-slate-800 font-mono ${
                                isDiagonal ? 'bg-blue-950/40 text-blue-300 font-bold' : 'text-slate-400'
                              }`}
                            >
                              {cellVal ?? 'N/A'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 30 Benchmark CEW Submissions List for Blinded Human Review */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck2 size={14} className="text-amber-400" />
                      RQ5: Researcher-Authored Benchmark CEW Submissions
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Blinded evaluation protocol: automated scores remain strictly hidden until manual 1-3 ratings are submitted.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded">
                    Reviewed: {cewScores.filter(s => s.scoreType === 'expert').length} / {cewSubmissions.length}
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {cewSubmissions.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      No benchmark submissions loaded.
                    </div>
                  ) : (
                    cewSubmissions.map((sub, idx) => {
                      const expertScore = cewScores.find(s => s.submissionId === sub.submissionId && s.scoreType === 'expert');
                      const isReviewed = !!expertScore;

                      return (
                        <div
                          key={sub.submissionId}
                          className={`p-3 rounded-lg border text-xs transition-all ${
                            isReviewed
                              ? 'bg-slate-900/60 border-emerald-900/50'
                              : 'bg-slate-900/90 border-slate-800 hover:border-amber-700/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-amber-400">#{idx + 1} {sub.submissionId}</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[10px]">
                                Task {sub.taskId}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isReviewed ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold flex items-center gap-1">
                                  <CheckCircle size={10} /> Expert Reviewed (C:{expertScore.claimScore} E:{expertScore.evidenceScore} W:{expertScore.warrantScore})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-900/50 text-[10px] font-medium flex items-center gap-1">
                                  <Lock size={10} /> Blinded Review Pending
                                </span>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedSubmissionForReview(sub);
                                  setIsCEWReviewModalOpen(true);
                                }}
                                className={`px-2.5 py-1 rounded font-bold text-[11px] transition-colors ${
                                  isReviewed
                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                                }`}
                              >
                                {isReviewed ? 'View Comparison' : 'Conduct Blinded Review'}
                              </button>
                            </div>
                          </div>

                          {(() => {
                            const claim = sub.claim || (sub as any).claimText || '';
                            const evidence = sub.evidence || (sub as any).evidenceText || '';
                            const warrant = sub.warrant || (sub as any).warrantText || '';
                            return (
                              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 bg-slate-950/50 p-2 rounded border border-slate-800/80">
                                <div>
                                  <strong className="text-slate-400">Claim:</strong>{' '}
                                  {claim ? claim.substring(0, 75) + (claim.length > 75 ? '...' : '') : <span className="text-slate-500 italic">Not provided</span>}
                                </div>
                                <div>
                                  <strong className="text-slate-400">Evidence:</strong>{' '}
                                  {evidence ? evidence.substring(0, 75) + (evidence.length > 75 ? '...' : '') : <span className="text-slate-500 italic">Not provided</span>}
                                </div>
                                <div>
                                  <strong className="text-slate-400">Warrant:</strong>{' '}
                                  {warrant ? warrant.substring(0, 75) + (warrant.length > 75 ? '...' : '') : <span className="text-slate-500 italic">Not provided</span>}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Defect Tracking Lifecycle Board */}
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Bug size={15} className="text-red-400" />
                Defect Tracking & Revision Lifecycle
              </h3>
              <button
                onClick={() => setShowAddDefect(!showAddDefect)}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1"
              >
                <Plus size={13} />
                Log Defect
              </button>
            </div>

            {showAddDefect && (
              <form onSubmit={handleCreateDefect} className="p-3 bg-slate-900 rounded border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Defect Title..."
                    value={newDefect.title}
                    onChange={(e) => setNewDefect({ ...newDefect, title: e.target.value })}
                    className="text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                    required
                  />
                  <select
                    value={newDefect.severity}
                    onChange={(e) => setNewDefect({ ...newDefect, severity: e.target.value as DefectSeverity })}
                    className="text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                  >
                    <option value="critical">Critical (P0 - Flag leak / crash)</option>
                    <option value="high">High (P1 - Major pedagogical flaw)</option>
                    <option value="medium">Medium (P2 - Suboptimal scaffolding)</option>
                    <option value="low">Low (P3 - Minor phrasing defect)</option>
                  </select>
                </div>
                <textarea
                  placeholder="Defect description, steps to reproduce, and observed vs expected behavior..."
                  rows={2}
                  value={newDefect.description}
                  onChange={(e) => setNewDefect({ ...newDefect, description: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-700 rounded p-2 text-slate-200"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddDefect(false)}
                    className="px-3 py-1 text-xs bg-slate-800 text-slate-400 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white font-bold rounded"
                  >
                    Save Defect Record
                  </button>
                </div>
              </form>
            )}

            {/* Defect List */}
            <div className="space-y-2">
              {defects.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No active defects recorded. All components verified against policy v2.0.0.
                </div>
              ) : (
                defects.map(d => (
                  <div key={d.defectId} className="p-3 bg-slate-900 rounded border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{d.defectId}: {d.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          d.severity === 'critical' ? 'bg-red-950 text-red-400 border border-red-800' :
                          d.severity === 'high' ? 'bg-orange-950 text-orange-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {d.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{d.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={d.status}
                        onChange={(e) => handleUpdateDefectStatus(d, e.target.value as DefectStatus)}
                        className="text-[11px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300"
                      >
                        <option value="open">Open</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="in_progress">In Progress</option>
                        <option value="fixed">Fixed</option>
                        <option value="closed">Closed</option>
                        <option value="deferred">Deferred</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Blinded CEW Review Modal */}
      {isCEWReviewModalOpen && selectedSubmissionForReview && (
        <CEWReviewModal
          isOpen={isCEWReviewModalOpen}
          onClose={() => {
            setIsCEWReviewModalOpen(false);
            setSelectedSubmissionForReview(null);
          }}
          submission={selectedSubmissionForReview}
          existingExpertScore={cewScores.find(s => s.submissionId === selectedSubmissionForReview.submissionId && s.scoreType === 'expert')}
          automatedScore={cewScores.find(s => s.submissionId === selectedSubmissionForReview.submissionId && s.scoreType === 'automated')}
          evaluatorId="researcher-evaluator"
          onReviewSubmitted={() => {
            setIsCEWReviewModalOpen(false);
            setSelectedSubmissionForReview(null);
            loadDashboardData();
          }}
        />
      )}
      {/* Section J Data Analysis Modal */}
      {isSectionJOpen && (
        <SectionJModal
          isOpen={isSectionJOpen}
          onClose={() => setIsSectionJOpen(false)}
          runId={selectedRunFilter}
        />
      )}
    </div>
  );
};
