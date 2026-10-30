import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import firebaseConfig from './firebaseConfig';
import { authService } from './authService';

// Initialize Firebase App safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google OAuth Provider with Workspace scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/documents');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory token cache (never persisted to localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initGoogleAuth = (
  onSuccess?: (user: FirebaseUser, token: string) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user && cachedAccessToken) {
      if (onSuccess) onSuccess(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      if (onFailure) onFailure();
    }
  });
};

export const signInWithGoogle = async (): Promise<{ user: FirebaseUser; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve OAuth access token from authentication result.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export interface ExportDocResult {
  documentId: string;
  documentUrl: string;
  title: string;
}

/**
 * Creates and populates a new Google Doc containing the comprehensive
 * Socratic Shell capabilities breakdown and pre-pilot research methodology protocol.
 */
export const exportResearchMethodologyToGoogleDoc = async (
  tokenOverride?: string
): Promise<ExportDocResult> => {
  const token = tokenOverride || cachedAccessToken;
  if (!token) {
    throw new Error('Authentication required: No valid Google OAuth access token available.');
  }

  const title = `Socratic Shell Research Platform & Pre-Pilot Validation Protocol (${new Date().toISOString().split('T')[0]})`;
  const documentBodyText = generateMethodologyDocumentText();

  // Try direct client-side call first
  try {
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    });

    if (createRes.ok) {
      const createData = await createRes.json();
      const documentId = createData.documentId;
      const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

      const updateRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: documentBodyText
                }
              }
            ]
          })
        }
      );

      if (updateRes.ok) {
        return {
          documentId,
          documentUrl,
          title
        };
      }
    }
  } catch (clientErr) {
    console.warn('Direct Google Docs client call failed, using server proxy fallback:', clientErr);
  }

  // Fallback to server endpoint
  const fallbackRes = await authService.fetchAuthenticated('/api/workspace/export-doc', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, bodyText: documentBodyText })
  });

  if (!fallbackRes.ok) {
    const errData = await fallbackRes.json().catch(() => ({}));
    throw new Error(
      errData.error || 'Failed to export document via Google Docs API.'
    );
  }

  return await fallbackRes.json();
};

function generateMethodologyDocumentText(): string {
  const timestamp = new Date().toLocaleString();
  return `SOCRATIC SHELL: ARCHITECTURAL CAPABILITIES & PRE-PILOT RESEARCH VALIDATION PROTOCOL
Application Version: 1.0.0 (Research Baseline Freeze 1) | Date: ${timestamp}
Export Generated via AI Studio Google Workspace Integration

================================================================================
1. EXECUTIVE SUMMARY
================================================================================
This document provides a comprehensive specification of the Socratic Shell Research Platform (v1.0.0 - Research Baseline Freeze 1) and outlines a rigorous, publication-grade pre-pilot research methodology. The protocol is engineered to validate all software, instructional, safety, and psychometric capabilities before launching a live student pilot.

Core Research Objective:
Evaluate how Socratic AI tutoring versus unguided exploration influences students' investigative reasoning, cybersecurity command competency, and Claim-Evidence-Warrant (CEW) scientific argumentation within a controlled, fully instrumented Linux CTF environment.


================================================================================
2. COMPREHENSIVE APPLICATION CAPABILITIES BREAKDOWN
================================================================================
The platform integrates seven core subsystems engineered for cybersecurity instruction and experimental research:

A. Learner Workspace & Dual-Shell Execution
- Terminal Modes: Uses a native pseudo-terminal (pty) execution path via xterm.js for authentic Bash commands, with all AI assistance routed through the authenticated server-side tutor.
- Domain Coverage: Tasks span 9 Linux domains (navigation, permissions, search, processes, users/groups, logs, network, scheduled execution, troubleshooting) aligned with Course Learning Objectives (CLOs).
- Experimental Conditions: Guided (Socratic tutor active), Unguided (command execution without AI), and None (control).
- Progressive Hint Scaffolding: 5-stage hint hierarchy (Levels 0-4: Conceptual Nudge -> Tool Recommendation -> Syntax Example -> Actionable Steps) requiring completed prerequisites.
- Trust Telemetry: Logs whether students accept, reject, modify, or ignore AI suggestions.

B. Claim-Evidence-Warrant (CEW) Scientific Reasoning
- Structured Inquiry: Flag submission requires scientific argument formulation:
  * Claim: The identified vulnerability, system state, or exploit hypothesis.
  * Evidence: Exact terminal outputs, log entries, file permissions, or process IDs.
  * Warrant: The causal technical reasoning connecting the evidence to the claim.
- Temporal & Metacognitive Metrics: Measures student confidence (1-5 Likert) and records active solve time vs. idle time (via automatic activity monitoring).

C. Multi-Tier Adversarial Guardrails
- Pre/Post Filtering: Evaluates inputs and model outputs against regex patterns, semantic classifiers, and task constraints.
- Violation Prevention: Blocks direct answer-seeking ("Give me the flag"), prohibited command disclosure, prompt injections, and system prompt extraction.
- Pedagogical Redirection: Emits a guardrail_event and redirects learners to hypothesis testing and evidence gathering.

D. Automated & Blinded Shadow CEW Evaluation
- Shadow LLM Evaluator: Evaluates student submissions across Claim, Evidence, and Warrant on an ordinal 1-3 scale with qualitative rationales.
- Model Separation: Supports distinct tutor and evaluator models to eliminate self-evaluation bias.
- Blinded Expert Scoring Interface: Unreviewed submissions strictly hide automated scores until the expert submits their rating, preventing anchoring bias.
- Psychometric Analytics: Automatically calculates 3x3 Confusion Matrices, Exact Agreement %, Adjacent Agreement %, and Quadratic Weighted Cohen's Kappa.

E. Standardized Synthetic Test Suite & Telemetry Validator
- 10 Canonical Scenarios: Covers appropriate help, direct answer seeking, plausible misconceptions, unsupported claims, partial evidence, repeated bypass attempts, correct reasoning, ambiguous requests, irrelevant requests, and prompt injection.
- Telemetry Integrity Auditor: Verifies monotonic sequence numbering, chronological order, condition consistency, and mandatory singleton events.

F. Faculty / SME Rubric & Critical Failure Hard Overrides
- 9-Dimension Faculty Rubric (1-5): Technical Correctness, Contextual Relevance, Socratic Scaffolding, Evidence Prompting, Guardrail Compliance, Pedagogical Appropriateness, CEW Alignment, Actionability, and Overall Usefulness.
- 12-Item Critical Failure Checklist: Catastrophic issues (flag disclosure, major Linux error, crash, condition behavior failure) automatically force overallPass = false regardless of numeric average.

G. Formal Run Freezing & Dual-Mode Research Export
- Configuration Snapshot: Captures application version, prompt templates, rubric versions, model IDs, and generation parameters into an immutable frozenConfig.
- In-App Defect Tracker: Tracks defects with severity, lifecycle states, reproduction steps, code references, and regression tests.
- Dual-Mode Export:
  * Internal Research Package: Retains complete prompt history, terminal I/O, student arguments, and qualitative notes.
  * Sanitized Open-Science Package: Scrubs free-text, PII, and secret flags to [STRIPPED] while preserving tabular structures and cryptographic SHA-256 manifests.


================================================================================
3. PRE-PILOT RESEARCH METHODOLOGY & VALIDATION PROTOCOL
================================================================================
To ensure institutional readiness before student deployment, researchers must execute a 5-phase mixed-methods pre-pilot protocol:

PHASE 1: AUTOMATED SYNTHETIC STRESS TESTING & TELEMETRY AUDIT
- Objective: Validate software infrastructure, sequence monotonicity, and guardrail robustness.
- Protocol:
  1. Execute all 10 Standardized Test Cases (TC-001 to TC-010) across Guided and Unguided conditions with N >= 5 repetitions each (minimum 100 turns).
  2. Include adversarial prompt injection, jailbreak attempts, and flag extraction queries.
- Quantitative Metrics:
  * Telemetry Completeness: 100% target.
  * Sequence Monotonicity Violations: 0 target.
  * Guardrail Evasion Rate: 0.0% (zero unauthorized disclosures).
  * Latency: p50 and p95 response time thresholds.
- Qualitative Output:
  * Audit logs of refusal tone and instructional redirection quality.

PHASE 2: FACULTY & SME HEURISTIC EVALUATION
- Objective: Verify pedagogical soundess, technical Linux accuracy, and curriculum alignment.
- Participants: 2-3 Linux / Cybersecurity Faculty or Instructional Designers.
- Protocol:
  1. Each SME completes Gym Tasks 1-5 testing optimal, misconception, and hint-seeking paths.
  2. Complete the 9-Dimension Faculty Rubric and Critical Failure Checklist for each interaction.
- Quantitative Metrics:
  * Mean Rubric Score >= 4.0 / 5.0 across all dimensions.
  * Critical Failure Occurrence: 0%.
  * Inter-Rater Reliability: Intraclass Correlation Coefficient ICC(2,k) >= 0.75.
- Qualitative Output:
  * Thematic defect logs and prescriptive revision recommendations for task descriptions.

PHASE 3: BLINDED CEW INTER-RATER AGREEMENT PROTOCOL
- Objective: Establish concurrent criterion validity of the Automated Shadow LLM Evaluator.
- Protocol:
  1. Seed 30 representative CEW submissions (ranging from exemplary to flawed and adversarial).
  2. Run automated shadow evaluation on all 30 submissions.
  3. Two independent human SMEs score the submissions blindly using the CEW Review Modal.
  4. Unblind and analyze score distributions.
- Quantitative Metrics:
  * Exact Agreement: >= 75%.
  * Adjacent Agreement (+-1 point): >= 95%.
  * Quadratic Weighted Cohen's Kappa: kw >= 0.70 (substantial agreement).
- Qualitative Output:
  * Discrepancy analysis on any case with |Human - LLM| >= 2 to refine prompts and rubric definitions.

PHASE 4: COGNITIVE WALKTHROUGH & THINK-ALOUD DRY RUN
- Objective: Uncover user interface friction, terminal quirks, and cognitive overload.
- Participants: 3-5 Teaching Assistants or advanced students as learner proxies.
- Protocol:
  1. 45-minute lab session completing Tasks 1-3 under formal research conditions.
  2. Concurrent Think-Aloud verbal protocol recorded during task execution.
- Quantitative Metrics:
  * Task Completion Rate and Time-to-Solve (Active vs. Idle split).
  * Hint progression distribution (proportions reaching Level 4).
  * Suggestion Acceptance Ratio (accepted vs. rejected/ignored).
  * System Usability Scale (SUS >= 75) and NASA-TLX cognitive workload.
- Qualitative Output:
  * Usability friction logs regarding command parsing, terminal selection, and UI ergonomics.

PHASE 5: EXPORT PIPELINE AUDIT & FORMAL GATE CHECK
- Objective: Confirm end-to-end data integrity and regulatory compliance before student onboarding.
- Protocol:
  1. Trigger Internal and Sanitized research exports.
  2. Verify all 12 CSV/JSON files match the record counts and cryptographic SHA-256 hashes in export_manifest.json.
  3. Inspect sanitized CSVs to confirm zero PII, system prompt, or flag leakage.


================================================================================
4. FORMAL "GO / NO-GO" GATE CRITERIA MATRIX
================================================================================
All seven criteria must be met before initiating the student pilot study:

1. System Stability: 0 unhandled application crashes or data-loss events.
2. Telemetry Integrity: 100% pass rate on sequence monotonicity; 0 missing events.
3. Guardrail Enforcement: 0% flag or solution disclosure rate across adversarial cases.
4. Pedagogical Quality: Faculty Rubric mean score >= 4.0 / 5.0 with 0 critical failures.
5. Evaluator Reliability: Quadratic Weighted Kappa kw >= 0.70; Adjacent Agreement >= 95%.
6. Defect Backlog: 0 Critical and 0 High severity defects remaining open.
7. Data Governance: 100% of PII, model prompts, and flags scrubbed in sanitized export.

================================================================================
Document generated automatically by Socratic Shell Research System.
`;
}
