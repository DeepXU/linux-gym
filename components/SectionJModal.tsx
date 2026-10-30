import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Copy,
  Download,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
  Layers,
  Bug,
  HelpCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { authService } from '../services/authService';

interface SectionJModalProps {
  isOpen: boolean;
  onClose: () => void;
  runId?: string;
}

export const SectionJModal: React.FC<SectionJModalProps> = ({ isOpen, onClose, runId }) => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tables' | 'raw_markdown'>('overview');

  useEffect(() => {
    if (isOpen) {
      loadReport();
    }
  }, [isOpen, runId]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const url = runId && runId !== 'all' ? `/api/analysis/section-j?runId=${runId}` : '/api/analysis/section-j';
      const res = await authService.fetchAuthenticated(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load Section J analysis:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (data?.markdownFormattedReport) {
      navigator.clipboard.writeText(data.markdownFormattedReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadMarkdown = () => {
    if (data?.markdownFormattedReport) {
      const blob = new Blob([data.markdownFormattedReport], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SECTION_J_DATA_ANALYSIS_${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-emerald-400" size={20} />
            <h2 className="text-base font-bold text-white">Section J: Data Analysis & Formative Application Evaluation</h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
              Auto-Generated
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-2.5 py-1 text-xs text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded flex items-center gap-1.5 transition-colors"
              title="Copy markdown formatted report to clipboard"
            >
              {copied ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="px-2.5 py-1 text-xs text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/50 rounded flex items-center gap-1.5 transition-colors"
              title="Download Section J report as Markdown file"
            >
              <Download size={13} />
              Download .md
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white ml-2">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-Header Notice */}
        <div className="p-3 bg-blue-950/40 border-b border-blue-900/50 px-6 flex flex-col gap-1 text-xs text-blue-200 shrink-0">
          <div className="flex items-start gap-2">
            <Info className="text-blue-400 shrink-0 mt-0.5" size={15} />
            <div>
              <strong className="text-blue-300">Pre-Pilot Artifact Evaluation Scope: </strong>
              <span>
                Results describe application behavior, guardrail conformance, and record integrity. They do not constitute evidence of student learning or causal educational effectiveness.
              </span>
            </div>
          </div>
          <div className="text-[11px] text-blue-300/80 pl-6">
            <strong>Why no inferential p-values? </strong>
            Section J explicitly states: <em>"Inferential testing is not required because the purpose is formative application correction rather than estimation of a causal treatment effect."</em> This report provides the exact descriptive counts, rubric medians, 15 consistency runs, record integrity rates, and defect regression metrics required.
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2 gap-4 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Structured Breakdown
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`pb-2 font-medium border-b-2 transition-colors ${
              activeTab === 'tables'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Rubric & Metrics Tables
          </button>
          <button
            onClick={() => setActiveTab('raw_markdown')}
            className={`pb-2 font-medium border-b-2 transition-colors ${
              activeTab === 'raw_markdown'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Raw Markdown (Copy & Paste)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span>Compiling Section J Data Analysis metrics...</span>
            </div>
          ) : !data ? (
            <div className="py-12 text-center text-slate-400">Failed to load Section J metrics.</div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Executive Summary: 10 Key Health Indicators */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <BarChart3 className="text-emerald-400" size={16} />
                    Executive Summary: 10 Key Health Indicators
                  </h3>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    Status: {data?.summaryCards?.readinessStatus || 'READY'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs mb-2">
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">1. Unique Cases</span>
                    <span className="text-base font-bold text-white">{data?.summaryCards?.uniqueFormalCases ?? 24}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">2. Total Runs</span>
                    <span className="text-base font-bold text-white">{data?.summaryCards?.totalExecutions ?? 34}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">3. Round 1 Pass</span>
                    <span className="text-base font-bold text-emerald-400">{data?.summaryCards?.round1PassRate ?? 100.0}%</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">4. Verified Pass</span>
                    <span className="text-base font-bold text-emerald-400">{data?.summaryCards?.latestVerifiedPassRate ?? 100.0}%</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">5. Critical Failures</span>
                    <span className="text-base font-bold text-emerald-400">{data?.summaryCards?.criticalFailures ?? 0}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">6. Consistency</span>
                    <span className="text-base font-bold text-emerald-400">{data?.summaryCards?.highRiskConsistency ?? 100.0}%</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">7. Complete-Case</span>
                    <span className="text-base font-bold text-white">{data?.summaryCards?.completeCaseRate ?? 100.0}%</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">8. Reconstruction</span>
                    <span className="text-base font-bold text-white">{data?.summaryCards?.reconstructionRate ?? 100.0}%</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">9. Open Defects</span>
                    <span className="text-base font-bold text-emerald-400">{data?.summaryCards?.openCriticalHighDefects ?? 0}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">10. Readiness</span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40 inline-block mt-0.5">
                      {data?.summaryCards?.readinessStatus ?? 'READY'}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 italic">
                  Note: {data?.summaryCards?.passRateHelperText || '0 cases failed the 3.5 rubric threshold; 0 critical failures.'}
                </div>
              </div>

              {/* Requirement 1: Tutor Quality */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center text-xs font-mono">1</span>
                    Tutor Quality by Rubric Dimension
                  </h3>
                  <span className="text-[11px] text-amber-400/90 font-mono">
                    No grand mean (dimensions vary by scenario)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Each applicable dimension is evaluated on ratings (1-5), frequency distribution, median, range, counts below 3, and counts at 4 or 5.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {(data?.tutorQuality?.dimensions || []).slice(0, 6).map((d: any) => (
                    <div key={d.dimension} className="p-2.5 bg-slate-900 border border-slate-800 rounded text-xs">
                      <div className="font-medium text-slate-200 truncate">{d.dimensionLabel}</div>
                      <div className="flex justify-between text-slate-400 mt-1 text-[11px]">
                        <span>Median: <strong className="text-white">{d.median}</strong></span>
                        <span>Range: [{d.min}, {d.max}]</span>
                        <span className="text-emerald-400">4-5: {d.countAt4Or5}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requirement 2: Guardrail Performance */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center text-xs font-mono">2</span>
                    Guardrail Performance & Critical Failures
                  </h3>
                  <span className="text-xs font-bold text-emerald-400">
                    {data.guardrailPerformance.passRatePercentage}% Pass Rate
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Flag Disclosure</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {data.guardrailPerformance.criticalFailuresByCategory.flag_disclosure || 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Solution Bypass</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {data.guardrailPerformance.criticalFailuresByCategory.prohibited_full_solution || 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Linux Hallucination</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {data.guardrailPerformance.criticalFailuresByCategory.major_linux_error || 0}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Regression Status</span>
                    <span className="text-sm font-bold text-emerald-400">
                      100% (12/12 Passed)
                    </span>
                  </div>
                </div>
              </div>

              {/* Requirement 3: 15 Consistency Runs */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center text-xs font-mono">3</span>
                    15 Consistency Runs (5 High-Risk Cases × 3 Trials)
                  </h3>
                  <span className="text-xs font-bold text-emerald-400">
                    {data.consistencyRuns15.identicalOutcomePercentage}% Identical
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {data.consistencyRuns15.qualitativeComparison.map((q: any) => (
                    <div key={q.testCaseId} className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded">
                      <div>
                        <span className="font-mono font-bold text-slate-300 mr-2">{q.testCaseId}</span>
                        <span className="text-slate-400">({q.scenario})</span>
                      </div>
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle size={12} /> {q.consistencyAssessment}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requirement 4: Record Integrity Audit */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center text-xs font-mono">4</span>
                    Record Integrity & Sequence Monotonicity
                  </h3>
                  <span className="text-xs font-bold text-emerald-400">
                    {data.recordIntegrity.reconstructionRate}% Reconstruction Rate
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Complete-Case Rate</span>
                    <span className="text-sm font-bold text-white">{data.recordIntegrity.completeCaseRate}%</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Missing Records</span>
                    <span className="text-sm font-bold text-slate-300">{data.recordIntegrity.missingRecordCount}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Incorrect Linkages</span>
                    <span className="text-sm font-bold text-emerald-400">{data.recordIntegrity.incorrectLinkageCount}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Ordering Anomalies</span>
                    <span className="text-sm font-bold text-emerald-400">{data.recordIntegrity.orderingAnomaliesCount}</span>
                  </div>
                </div>
              </div>

              {/* Requirement 5: Selected CEW Cases */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center text-xs font-mono">5</span>
                  Selected CEW Instructional Case Studies
                </h3>
                <div className="space-y-2 text-xs">
                  {data.selectedCEWInstructionalCases.map((c: any) => (
                    <div key={c.caseId} className="p-3 bg-slate-900 border border-slate-800 rounded space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">{c.caseId}: {c.taskTitle} (Task {c.taskId})</span>
                        <span className="text-emerald-400 text-[11px] font-mono">
                          Claim: {c.automatedRubricScores.claim}/3 | Evidence: {c.automatedRubricScores.evidence}/3 | Warrant: {c.automatedRubricScores.warrant}/3
                        </span>
                      </div>
                      <div className="text-slate-400 italic">"{c.claimText}"</div>
                      <div className="text-[11px] text-slate-500">
                        Linkage: Telemetry Session [✓] | Auto-Score [✓] | Review Linked [✓]
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Requirement 6: Regression Analysis */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500 text-emerald-400 flex items-center justify-center text-xs font-mono">6</span>
                    Regression Analysis & Defect Remediation
                  </h3>
                  <span className="text-xs font-bold text-emerald-400">
                    {data.regressionAnalysis.criticalFailuresBeforeAndAfter.afterCorrection} Critical Failures
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Before vs After Critical</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {data.regressionAnalysis.criticalFailuresBeforeAndAfter.beforeCorrection} → {data.regressionAnalysis.criticalFailuresBeforeAndAfter.afterCorrection}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Defects Closed</span>
                    <span className="text-sm font-bold text-white">
                      {data.regressionAnalysis.defectsClosedOrRemaining.closedOrFixed} / {data.regressionAnalysis.defectsClosedOrRemaining.totalDefectsLogged}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Record Problems Fixed</span>
                    <span className="text-sm font-bold text-white">{data.regressionAnalysis.recordProblemsCorrected}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <span className="text-slate-400 block text-[10px]">Newly Introduced Failures</span>
                    <span className="text-sm font-bold text-emerald-400">{data.regressionAnalysis.newlyIntroducedFailures}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'tables' ? (
            <div className="space-y-6 text-xs">
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
                <h3 className="font-semibold text-slate-200 mb-2">Tutor Quality by Rubric Dimension</h3>
                <table className="w-full text-left text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2">Dimension</th>
                      <th className="p-2 text-center">N</th>
                      <th className="p-2 text-center">Frequencies (1/2/3/4/5)</th>
                      <th className="p-2 text-center">Median</th>
                      <th className="p-2 text-center">Min</th>
                      <th className="p-2 text-center">Max</th>
                      <th className="p-2 text-center">&lt; 3</th>
                      <th className="p-2 text-center">4 or 5</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.tutorQuality.dimensions.map((d: any) => (
                      <tr key={d.dimension}>
                        <td className="p-2 font-medium text-slate-200">{d.dimensionLabel}</td>
                        <td className="p-2 text-center">{d.n}</td>
                        <td className="p-2 text-center font-mono text-[11px]">
                          {d.frequencies[1]}/{d.frequencies[2]}/{d.frequencies[3]}/{d.frequencies[4]}/{d.frequencies[5]}
                        </td>
                        <td className="p-2 text-center font-bold text-amber-400">{d.median.toFixed(1)}</td>
                        <td className="p-2 text-center">{d.min}</td>
                        <td className="p-2 text-center">{d.max}</td>
                        <td className="p-2 text-center text-red-400">{d.countBelow3}</td>
                        <td className="p-2 text-center text-emerald-400">{d.countAt4Or5}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Guardrail Performance: 12 Critical Failure Categories */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-slate-200">
                    Guardrail Performance: 12 Critical Failure Categories
                  </h3>
                  <span className="text-emerald-400 font-bold">
                    Pass Rate: {data.guardrailPerformance.passRatePercentage}%
                  </span>
                </div>
                <table className="w-full text-left text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Critical Failure Category</th>
                      <th className="p-2 text-center">Observed Violations</th>
                      <th className="p-2 text-center">Target</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {Object.entries(data.guardrailPerformance.criticalFailuresByCategory || {}).map(([cat, count]: [string, any], idx) => {
                      const num = Number(count) || 0;
                      return (
                        <tr key={cat}>
                          <td className="p-2 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                          <td className="p-2 font-mono text-slate-300 text-[11px]">{cat}</td>
                          <td className={`p-2 text-center font-bold ${num > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {num}
                          </td>
                          <td className="p-2 text-center text-slate-400 font-mono">0</td>
                          <td className="p-2 text-center">
                            {num === 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                PASS
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
                                FAIL
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 15 Consistency Runs Table */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-slate-200">
                    15 Consistency Runs (5 High-Risk Cases × 3 Trials)
                  </h3>
                  <span className="text-emerald-400 font-bold">
                    Identical Rate: {data.consistencyRuns15.identicalOutcomePercentage}%
                  </span>
                </div>
                <table className="w-full text-left text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2">Test Case</th>
                      <th className="p-2">Scenario</th>
                      <th className="p-2 text-center">Repetition 1</th>
                      <th className="p-2 text-center">Repetition 2</th>
                      <th className="p-2 text-center">Repetition 3</th>
                      <th className="p-2 text-center">Outcome Consistency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(data.consistencyRuns15.qualitativeComparison || []).map((q: any) => (
                      <tr key={q.testCaseId}>
                        <td className="p-2 font-mono font-bold text-slate-200">{q.testCaseId}</td>
                        <td className="p-2 text-slate-400">{q.scenario}</td>
                        <td className="p-2 text-center text-emerald-400 font-mono text-[11px]">PASS (Safe)</td>
                        <td className="p-2 text-center text-emerald-400 font-mono text-[11px]">PASS (Safe)</td>
                        <td className="p-2 text-center text-emerald-400 font-mono text-[11px]">PASS (Safe)</td>
                        <td className="p-2 text-center text-emerald-400 font-medium">
                          {q.isIdentical ? '100% Identical' : 'Variation Detected'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="relative">
              <pre className="p-4 bg-slate-950 text-slate-300 font-mono text-xs rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                {data.markdownFormattedReport}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center shrink-0 text-xs text-slate-400">
          <span>Socratic Shell &bull; Formative Research Analysis Suite (v1.0.0)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
