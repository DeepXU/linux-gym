import React, { useState, useEffect } from 'react';
import { X, Play, CheckCircle2, XCircle, RefreshCw, ListChecks, Lock, Unlock, ShieldCheck } from 'lucide-react';
import { TestCase, GroundTruthRecord, PublicSequesteredCaseView } from '../types';
import { authService } from '../services/authService';

interface TestCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRunId?: string;
  currentTaskId?: number;
}

export const TestCaseModal: React.FC<TestCaseModalProps> = ({
  isOpen,
  onClose,
  activeRunId = 'unlocked_session',
  currentTaskId
}) => {
  const [activeTab, setActiveTab] = useState<'known' | 'sequestered'>('known');
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [groundTruthMap, setGroundTruthMap] = useState<Record<string, GroundTruthRecord>>({});
  const [sequesteredCases, setSequesteredCases] = useState<PublicSequesteredCaseView[]>([]);
  const [knownCaseRegressionComplete, setKnownCaseRegressionComplete] = useState<boolean>(false);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runOutcome, setRunOutcome] = useState<any | null>(null);
  const [batchResults, setBatchResults] = useState<any | null>(null);
  const [consistencyResults, setConsistencyResults] = useState<any | null>(null);
  const [sequesteredResults, setSequesteredResults] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchTestCases();
      fetchGroundTruth();
      fetchSequestered();
    }
  }, [isOpen]);

  const fetchTestCases = async () => {
    try {
      const res = await fetch('/api/test-cases', { headers: authService.getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTestCases(data);
        if (data.length > 0 && !selectedCase) {
          setSelectedCase(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load test cases:', e);
    }
  };

  const fetchGroundTruth = async () => {
    try {
      const res = await fetch('/api/ground-truth', { headers: authService.getAuthHeaders() });
      if (res.ok) {
        const list: GroundTruthRecord[] = await res.json();
        const map: Record<string, GroundTruthRecord> = {};
        list.forEach(gt => {
          map[gt.caseId] = gt;
        });
        setGroundTruthMap(map);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatusMessage(data.error || `Ground-truth records are unavailable (HTTP ${res.status}).`);
      }
    } catch (e) {
      console.error('Failed to load ground truth records:', e);
    }
  };

  const fetchSequestered = async () => {
    try {
      const res = await fetch('/api/sequestered-cases', { headers: authService.getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setKnownCaseRegressionComplete(Boolean(data.knownCaseRegressionComplete));
        setSequesteredCases(data.cases || []);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatusMessage(data.error || `Sequestered cases are unavailable (HTTP ${res.status}).`);
      }
    } catch (e) {
      console.error('Failed to load sequestered cases:', e);
    }
  };

  const handleVerifyGroundTruth = async (caseId: string) => {
    setIsRunning(true);
    setStatusMessage(`Verifying Ground Truth record for ${caseId} against sandbox...`);
    try {
      const res = await fetch(`/api/ground-truth/${encodeURIComponent(caseId)}/verify`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ verifiedBy: 'investigator-evaluator' })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchGroundTruth();
        setStatusMessage(`Ground Truth for ${caseId} verified (${data.verificationStatus}).`);
      } else {
        setStatusMessage(`Verification failed: ${data.error}`);
      }
    } catch (e: any) {
      setStatusMessage(`Verification error: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleRegressionComplete = async (complete: boolean) => {
    try {
      const res = await fetch('/api/sequestered-cases/regression-complete', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ complete })
      });
      if (res.ok) {
        await fetchSequestered();
        setStatusMessage(
          complete
            ? 'Known-case regression marked COMPLETE. Sequestered cases (SQ-01..SQ-06) may now be released.'
            : 'Known-case regression marked INCOMPLETE. Sequestered cases remain locked.'
        );
      } else {
        const data = await res.json().catch(() => ({}));
        setStatusMessage(data.error || `Regression state was not changed (HTTP ${res.status}).`);
      }
    } catch (e: any) {
      setStatusMessage(`Error updating regression status: ${e.message}`);
    }
  };

  const handleReleaseSequestered = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/sequestered-cases/release', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ releasedBy: 'investigator-evaluator' })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchSequestered();
        setStatusMessage('Sequestered cases SQ-01..SQ-06 unsealed for final acceptance run.');
      } else {
        setStatusMessage(`Cannot release sequestered cases: ${data.error}`);
      }
    } catch (e: any) {
      setStatusMessage(`Error releasing sequestered cases: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunSequesteredSuite = async () => {
    setIsRunning(true);
    setStatusMessage('Running 6 sequestered acceptance cases (SQ-01..SQ-06)...');
    setSequesteredResults(null);
    try {
      const res = await fetch('/api/sequestered-cases/run', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ runId: 'sequestered_acceptance' })
      });
      const data = await res.json();
      if (res.ok) {
        setSequesteredResults(data);
        setStatusMessage(`Sequestered acceptance suite completed: ${data.passed}/${data.total} passed.`);
      } else {
        setStatusMessage(`Sequestered run blocked: ${data.error}`);
      }
    } catch (e: any) {
      setStatusMessage(`Sequestered run error: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runConsistencySuite = async () => {
    setIsRunning(true);
    setStatusMessage('Executing 15 consistency runs (5 high-risk cases x 3 repetitions)...');
    setConsistencyResults(null);
    setBatchResults(null);
    try {
      const res = await fetch('/api/test-cases/consistency-run', {
        method: 'POST',
        headers: authService.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setConsistencyResults(data);
        setStatusMessage(`15 Consistency Executions completed: ${data.identicalOutcomePercentage}% identical outcomes, ${data.criticalFailuresCount} critical failures.`);
      }
    } catch (e: any) {
      setStatusMessage(`Consistency run failed: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runSingle = async (tcId: string) => {
    setIsRunning(true);
    setStatusMessage(`Executing test case ${tcId}...`);
    setRunOutcome(null);
    try {
      const res = await fetch('/api/test-cases/run', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ testCaseId: tcId, runId: activeRunId })
      });
      const out = await res.json();
      if (res.ok) {
        setRunOutcome(out);
        setStatusMessage(`Test case ${tcId} completed: ${out.passed ? 'PASSED' : 'FAILED'}`);
      } else {
        setStatusMessage(`Execution refused: ${out.error}`);
      }
    } catch (e: any) {
      setStatusMessage(`Error executing test case: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runBatch = async () => {
    setIsRunning(true);
    setStatusMessage('Executing full 24-case standardized test suite...');
    setBatchResults(null);
    try {
      const res = await fetch('/api/test-cases/batch', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ runId: activeRunId })
      });
      if (res.ok) {
        const data = await res.json();
        setBatchResults(data);
        setStatusMessage(`Suite completed: ${data.passed} / ${data.total} passed (${((data.passed / data.total) * 100).toFixed(1)}%)`);
      }
    } catch (e: any) {
      setStatusMessage(`Batch run failed: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  if (!isOpen) return null;

  const selectedGroundTruth = selectedCase ? groundTruthMap[selectedCase.testCaseId] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <ListChecks className="text-blue-400" size={20} />
            <h2 className="text-lg font-bold text-white">Case Library, Ground Truth, &amp; Sequestered Suite</h2>
            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('known')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  activeTab === 'known' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                24 Standardized Cases (TC-001..024)
              </button>
              <button
                onClick={() => setActiveTab('sequestered')}
                className={`px-2.5 py-1 rounded font-bold transition-colors flex items-center gap-1 ${
                  activeTab === 'sequestered' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock size={11} />
                6 Sequestered Cases (SQ-01..06)
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'known' && (
              <>
                <button
                  onClick={runConsistencySuite}
                  disabled={isRunning}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow"
                >
                  <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
                  Run 15 Consistency Executions (RQ3)
                </button>
                <button
                  onClick={runBatch}
                  disabled={isRunning}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow"
                >
                  <Play size={14} />
                  {isRunning ? 'Running...' : 'Run 24-Case Suite'}
                </button>
              </>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {activeTab === 'sequestered' ? (
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            <div className="p-4 bg-purple-950/20 border border-purple-800/50 rounded-lg flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-purple-200 flex items-center gap-2">
                  {knownCaseRegressionComplete ? <Unlock size={16} className="text-emerald-400" /> : <Lock size={16} className="text-amber-400" />}
                  Sequestered Final Acceptance Suite (SQ-01 through SQ-06)
                </h3>
                <p className="text-xs text-slate-400 max-w-2xl">
                  Per Requirement 3.4, sequestered cases remain sealed (displaying only SHA-256 prompt and ground-truth hashes) until all known-case refinements and regression checks are marked complete. They are never mixed into Round 1 or regression counts.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleRegressionComplete(!knownCaseRegressionComplete)}
                  className={`px-3 py-1.5 rounded text-xs font-bold border ${
                    knownCaseRegressionComplete
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {knownCaseRegressionComplete ? 'Regression Complete: YES' : 'Mark Regression Complete'}
                </button>
                <button
                  onClick={handleReleaseSequestered}
                  disabled={!knownCaseRegressionComplete || isRunning}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold rounded shadow"
                >
                  Unseal SQ-01..06
                </button>
                <button
                  onClick={handleRunSequesteredSuite}
                  disabled={!knownCaseRegressionComplete || isRunning}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded flex items-center gap-1 shadow"
                >
                  <Play size={13} />
                  Execute Sequestered Acceptance
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sequesteredCases.map(sq => (
                <div key={sq.caseId} className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-purple-300">{sq.caseId} (Task {sq.taskId})</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      sq.sealed ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {sq.sealed ? 'SEALED' : 'RELEASED'}
                    </span>
                  </div>
                  <div className="text-slate-400 capitalize">Scenario: {sq.scenarioType.replace(/_/g, ' ')}</div>
                  <div className="font-mono text-[10px] text-slate-500 truncate">
                    Prompt SHA-256: {sq.promptHash}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 truncate">
                    Ground-Truth SHA-256: {sq.groundTruthHash}
                  </div>
                  {!sq.sealed && sq.scriptedInteraction && (
                    <div className="mt-2 p-2 bg-slate-900 rounded border border-slate-800 space-y-1">
                      {sq.scriptedInteraction.map((t, i) => (
                        <div key={i} className="font-mono text-[11px] text-slate-200">
                          <span className="text-purple-400">Turn {i + 1}:</span> {t.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {sequesteredResults && (
              <div className="p-4 bg-slate-950 border border-emerald-800/60 rounded-lg space-y-2 text-xs">
                <h4 className="font-bold text-emerald-300 uppercase">
                  Sequestered Acceptance Results ({sequesteredResults.passed} / {sequesteredResults.total} Passed)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {sequesteredResults.results?.map((r: any) => (
                    <div key={r.testCaseId} className="p-2 bg-slate-900 rounded border border-slate-800 flex justify-between">
                      <span className="font-mono text-slate-200">{r.testCaseId}</span>
                      <span className={r.passed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {r.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Known 24 Cases Layout */
          <div className="flex-1 flex overflow-hidden">
            {/* Test Case Selector Sidebar */}
            <div className="w-1/3 border-r border-slate-800 bg-slate-950/50 p-3 overflow-y-auto space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                Standardized Scenarios ({testCases.length})
              </div>
              {testCases.map((tc) => {
                const isSelected = selectedCase?.testCaseId === tc.testCaseId;
                const gt = groundTruthMap[tc.testCaseId];
                return (
                  <button
                    key={tc.testCaseId}
                    onClick={() => {
                      setSelectedCase(tc);
                      setRunOutcome(null);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-500/50 text-blue-200 shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span>{tc.testCaseId}</span>
                      <div className="flex items-center gap-1">
                        {gt?.verifiedInSandbox && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            GT Verified
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-slate-800 rounded text-slate-400">
                          Task {tc.taskId}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 capitalize mt-0.5">
                      {tc.scenarioType.replace(/_/g, ' ')}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Test Case Detail & Execution Panel */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {selectedCase ? (
                <>
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          {selectedCase.testCaseId}: {selectedCase.scenarioType.replace(/_/g, ' ').toUpperCase()}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">{selectedCase.notes}</p>
                      </div>
                      <button
                        onClick={() => runSingle(selectedCase.testCaseId)}
                        disabled={isRunning}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow"
                      >
                        <Play size={13} />
                        Execute Single
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-slate-500 block">Assigned Condition:</span>
                        <span className="font-semibold text-slate-300 capitalize">{selectedCase.condition}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Repetition Count:</span>
                        <span className="font-semibold text-slate-300">{selectedCase.repetitionCount}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 block">Expected Tutor Behavior:</span>
                        <span className="text-slate-200">{selectedCase.expectedTutorBehavior}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 block">Prohibited Behavior:</span>
                        <span className="text-red-400 font-medium">{selectedCase.prohibitedBehavior}</span>
                      </div>
                    </div>
                  </div>

                  {/* Per-Case Ground Truth Record (Requirement 3.3) */}
                  {selectedGroundTruth && (
                    <div className="p-4 bg-slate-950 rounded-lg border border-emerald-900/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck size={14} />
                          Authoritative Ground-Truth Record ({selectedGroundTruth.caseId})
                        </span>
                        <button
                          onClick={() => handleVerifyGroundTruth(selectedGroundTruth.caseId)}
                          disabled={isRunning}
                          className="px-2.5 py-1 rounded bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 font-bold text-[11px]"
                        >
                          Verify Ground Truth in Sandbox
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-slate-500 block">Verified Facts:</span>
                          <ul className="list-disc list-inside text-slate-300">
                            {selectedGroundTruth.verifiedFacts.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Valid Verification Commands:</span>
                          <div className="font-mono text-blue-300">
                            {selectedGroundTruth.validVerificationCommands.join(' ; ')}
                          </div>
                          <span className="text-slate-500 block mt-1.5">Allowed Next-Step Guidance:</span>
                          <span className="text-slate-300">{selectedGroundTruth.allowedNextStepGuidance.join(' ')}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scripted Interaction Sequence */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Scripted Interaction Prompt(s)
                    </h4>
                    <div className="space-y-2">
                      {selectedCase.scriptedInteraction.map((turn, idx) => (
                        <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                          <span className="text-[10px] uppercase font-bold text-blue-400 block mb-1">
                            Turn #{idx + 1} ({turn.role})
                          </span>
                          <p className="text-slate-200 font-mono">{turn.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Execution Result */}
                  {runOutcome && (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                          {runOutcome.passed ? (
                            <CheckCircle2 className="text-green-400" size={16} />
                          ) : (
                            <XCircle className="text-red-400" size={16} />
                          )}
                          Execution Outcome: {runOutcome.passed ? 'PASSED' : 'FAILED'}
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          RQ4 Record Integrity: {runOutcome.integrityReport?.recordIntegrityPassed ? 'PASSED (9/9)' : 'FAILED'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {runOutcome.logs.map((lg: any, i: number) => (
                          <div key={i} className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1 text-xs">
                            <p className="text-slate-400"><strong className="text-slate-300">User:</strong> {lg.user}</p>
                            <p className="text-amber-300"><strong className="text-slate-300">Tutor:</strong> {lg.tutor}</p>
                            {lg.preCheckViolated && (
                              <span className="inline-block text-[10px] px-1.5 py-0.5 bg-red-900/40 text-red-300 rounded border border-red-800">
                                Input Guardrail Triggered &amp; Redirected
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Batch Results Overview */}
                  {batchResults && (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Batch Evaluation Summary ({batchResults.total} Cases)
                      </h4>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-green-400 font-bold">Passed: {batchResults.passed}</span>
                        <span className="text-red-400 font-bold">Failed: {batchResults.total - batchResults.passed}</span>
                        <span className="text-slate-400">
                          Rate: {((batchResults.passed / batchResults.total) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 15 Consistency Executions Summary (RQ3) */}
                  {consistencyResults && (
                    <div className="p-4 bg-slate-950 border border-amber-900/60 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                          <RefreshCw size={13} className="text-amber-400" />
                          RQ3: 15 Consistency Executions Summary (5 Cases &times; 3 Runs)
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Identical Outcome Rate: {consistencyResults.identicalOutcomePercentage}%
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Select a standardized scenario on the left to inspect and run.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Status */}
        {statusMessage && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-2">
            <RefreshCw size={12} className={isRunning ? 'animate-spin text-blue-400' : 'text-slate-500'} />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
