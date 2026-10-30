import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, FileCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import { TelemetryValidationReport } from '../types';
import { authService } from '../services/authService';

interface TelemetryValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRunId?: string;
}

export const TelemetryValidationModal: React.FC<TelemetryValidationModalProps> = ({
  isOpen,
  onClose,
  activeRunId = 'unlocked_session'
}) => {
  const [validations, setValidations] = useState<TelemetryValidationReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<TelemetryValidationReport | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchValidations();
    }
  }, [isOpen, activeRunId]);

  const fetchValidations = async () => {
    try {
      const res = await authService.fetchAuthenticated(`/api/telemetry/validation?runId=${activeRunId}`);
      if (res.ok) {
        const data = await res.json();
        setValidations(data);
        if (data.length > 0) setSelectedReport(data[0]);
      }
    } catch (e) {
      console.error('Failed to load telemetry validations:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <FileCheck className="text-green-400" size={20} />
            <h2 className="text-lg font-bold text-white">Telemetry Schema & Event Completeness Validator</h2>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
              v2.0.0
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Reports */}
          <div className="w-1/3 border-r border-slate-800 bg-slate-950/40 p-3 overflow-y-auto space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
              Reports ({validations.length})
            </div>
            {validations.length === 0 ? (
              <p className="text-xs text-slate-500 p-2">No validation reports generated yet. Run standardized test cases to generate reports.</p>
            ) : (
              validations.map(val => {
                const isSelected = selectedReport?.validationId === val.validationId;
                return (
                  <button
                    key={val.validationId}
                    onClick={() => setSelectedReport(val)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'bg-green-600/10 border-green-500/50 text-green-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span>{val.testCaseId || (val.validationId ? val.validationId.slice(0, 10) : 'Validation')}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded ${val.passed ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                        {val.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Completeness: {val.completenessPercentage}%
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Report Detail */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {selectedReport ? (
              <>
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        {selectedReport.passed ? (
                          <CheckCircle className="text-green-400" size={18} />
                        ) : (
                          <AlertCircle className="text-red-400" size={18} />
                        )}
                        Validation: {selectedReport.testCaseId || selectedReport.validationId}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-mono">{selectedReport.timestamp}</p>
                    </div>
                    <span className="text-xs font-bold text-green-400 bg-green-950 px-2 py-1 rounded border border-green-800">
                      {selectedReport.completenessPercentage}% Log Completeness
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-slate-500 block">Expected Events:</span>
                      <span className="font-bold text-slate-200">{selectedReport.expectedCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Observed Events:</span>
                      <span className="font-bold text-slate-200">{selectedReport.observedCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Missing Events:</span>
                      <span className={`font-bold ${selectedReport.missingEvents.length === 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedReport.missingEvents.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Missing Events List */}
                {selectedReport.missingEvents.length > 0 && (
                  <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-lg space-y-2">
                    <h4 className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert size={14} /> Missing Required Events
                    </h4>
                    <ul className="text-xs text-red-200 space-y-1 list-disc pl-4 font-mono">
                      {selectedReport.missingEvents.map((evt, i) => (
                        <li key={i}>{evt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sequence Integrity */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Monotonic Sequence Integrity
                  </h4>
                  {selectedReport.sequenceErrors.length === 0 ? (
                    <p className="text-xs text-green-400 flex items-center gap-1.5">
                      <CheckCircle size={14} /> All events strictly ordered with monotonic timestamps and sequence numbers.
                    </p>
                  ) : (
                    <ul className="text-xs text-red-400 space-y-1">
                      {selectedReport.sequenceErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                Select a telemetry validation report on the left.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
