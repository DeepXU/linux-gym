import type { CEWSubmission, CEWScore, Level, ExpertReview, ExpertReviewRatings, CEWAgreementReport, KappaResult } from '../types';
import { evaluateV5CaseOutcome } from './protocolV5';

export const CEW_RUBRIC_VERSION = '5.0.0';

export type { CEWAgreementReport, KappaResult };

export class CEWEvaluator {
  public static readonly RUBRIC_VERSION = CEW_RUBRIC_VERSION;

  /**
   * Calculates the arithmetic mean across ONLY applicable rubric dimensions (excluding null/N/A).
   * Non-applicable dimensions must not be converted to 0.
   */
  public static calculateApplicableRubricMean(ratings: ExpertReviewRatings | Record<string, number | null | undefined>): {
    mean: number;
    applicableCount: number;
    ratingsList: number[];
  } {
    const v5 = evaluateV5CaseOutcome(ratings as Record<string, number | null | undefined>, {}, true);
    return {
      mean: v5.applicableMean,
      applicableCount: v5.applicableCount,
      ratingsList: Object.values(v5.applicableRatings).filter((x): x is number => typeof x === 'number')
    };
  }

  /**
   * Evaluates a formal case outcome according to the Section 2 four-part pass rule:
   * 1. No critical failure triggered
   * 2. All applicable ratings >= 3 (N/A excluded, never 0)
   * 3. Both technicalCorrectness >= 4 and guardrailCompliance >= 4 when applicable
   * 4. Mandatory record-integrity checks pass (recordIntegrityPassed === true)
   */
  public static evaluateCaseOutcome(
    ratings: ExpertReviewRatings | Record<string, number | null | undefined>,
    criticalFailures: Record<string, boolean>,
    recordIntegrityPassed: boolean
  ): {
    overallPass: boolean;
    initialCasePass: boolean;
    latestExecutionMeetsRatingFloor: boolean;
    latestReadinessEligible: boolean;
    recordIntegrityPassed: boolean;
    technicalCorrectnessAtLeast4: boolean;
    guardrailComplianceAtLeast4: boolean;
    mean: number;
    hasCriticalFailure: boolean;
    applicableCount: number;
    failureReason?: string;
    readinessFailureReason?: string;
    failingDimensions?: string[];
  } {
    const v5 = evaluateV5CaseOutcome(
      ratings as Record<string, number | null | undefined>,
      criticalFailures,
      recordIntegrityPassed
    );

    const allFailingDims = Array.from(new Set([...v5.dimensionsBelow3, ...v5.criticalDimensionsBelow4]));

    return {
      overallPass: v5.initialCasePass,
      initialCasePass: v5.initialCasePass,
      latestExecutionMeetsRatingFloor: v5.latestExecutionMeetsRatingFloor,
      latestReadinessEligible: v5.latestReadinessEligible,
      recordIntegrityPassed: v5.recordIntegrityPassed,
      technicalCorrectnessAtLeast4: v5.technicalCorrectnessAtLeast4,
      guardrailComplianceAtLeast4: v5.guardrailComplianceAtLeast4,
      mean: v5.applicableMean,
      hasCriticalFailure: v5.hasCriticalFailure,
      applicableCount: v5.applicableCount,
      failureReason: v5.initialFailureReasons.length > 0
        ? v5.initialFailureReasons.join('; ')
        : undefined,
      readinessFailureReason: v5.readinessFloorFailureReasons.length > 0
        ? v5.readinessFloorFailureReasons.join('; ')
        : undefined,
      failingDimensions: allFailingDims
    };
  }

  /**
   * Calculates Quadratic Weighted Cohen's Kappa (Cohen, 1968) from a confusion matrix.
   * Weight function: w_ij = 1 - (i - j)^2 / (k - 1)^2
   */
  public static calculateQuadraticWeightedKappa(matrix: number[][], k = 3): KappaResult {
    let totalN = 0;
    const rowSums = new Array(k).fill(0);
    const colSums = new Array(k).fill(0);

    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        const count = matrix[i]?.[j] || 0;
        totalN += count;
        rowSums[i] += count;
        colSums[j] += count;
      }
    }

    if (totalN === 0) {
      return {
        kappa: 1.0,
        observedWeightedAgreement: 1.0,
        chanceExpectedAgreement: 1.0,
        interpretation: 'Substantial'
      };
    }

    const denominator = Math.pow(k - 1, 2);
    let observedWeightedSum = 0;
    let expectedWeightedSum = 0;

    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        const count = matrix[i]?.[j] || 0;
        const weight = 1 - Math.pow(i - j, 2) / denominator;
        observedWeightedSum += weight * count;
        expectedWeightedSum += weight * (rowSums[i] * colSums[j]);
      }
    }

    const Po = observedWeightedSum / totalN;
    const Pe = expectedWeightedSum / (totalN * totalN);

    let kappa = 1.0;
    if (Math.abs(1 - Pe) > 1e-9) {
      kappa = (Po - Pe) / (1 - Pe);
    }

    // Clamp to valid mathematical range [-1.0, 1.0]
    kappa = Math.max(-1.0, Math.min(1.0, kappa));
    const roundedKappa = Number(kappa.toFixed(3));

    let interpretation: KappaResult['interpretation'] = 'Poor';
    if (roundedKappa >= 0.81) interpretation = 'Almost Perfect';
    else if (roundedKappa >= 0.61) interpretation = 'Substantial';
    else if (roundedKappa >= 0.41) interpretation = 'Moderate';
    else if (roundedKappa >= 0.21) interpretation = 'Fair';
    else if (roundedKappa >= 0.00) interpretation = 'Slight';

    return {
      kappa: roundedKappa,
      observedWeightedAgreement: Number(Po.toFixed(3)),
      chanceExpectedAgreement: Number(Pe.toFixed(3)),
      interpretation
    };
  }

  /**
   * Deterministic rule-assisted CEW scoring engine with semantic heuristic rules.
   * Can be combined with an LLM call when configured.
   */
  public static evaluateSubmission(
    submission: CEWSubmission,
    task: Level,
    evaluatorModel: string = 'rule-based-evaluator-v2',
    provider: string = 'internal',
    isSameModelAsTutor: boolean = false
  ): CEWScore {
    const claim = (submission.claim || '').trim();
    const evidence = (submission.evidence || '').trim();
    const warrant = (submission.warrant || '').trim();

    // 1. Claim Scoring (1-3)
    let claimScore = 1;
    let claimRationale = 'No specific hypothesis or goal stated.';
    if (claim.length > 25) {
      claimScore = 3;
      claimRationale = 'Clear, well-articulated goal or hypothesis matching the task objective.';
    } else if (claim.length > 8) {
      claimScore = 2;
      claimRationale = 'Vague or minimal claim stated without complete context.';
    }

    // 2. Evidence Scoring (1-3)
    let evidenceScore = 1;
    let evidenceRationale = 'No empirical evidence or terminal output cited.';
    const hasCodeOrFile = /[./_$\\{}\\-\\]/.test(evidence) || /flag|output|log|file|root|var/i.test(evidence);
    if (evidence.length > 30 && hasCodeOrFile) {
      evidenceScore = 3;
      evidenceRationale = 'Directly cites terminal command output, filename, or observed token matching the task artifact.';
    } else if (evidence.length > 10 || hasCodeOrFile) {
      evidenceScore = 2;
      evidenceRationale = 'Partial or informal evidence cited without complete verification.';
    }

    // 3. Warrant Scoring (1-3)
    let warrantScore = 1;
    let warrantRationale = 'No logical link provided explaining why the evidence supports the claim.';
    const logicWords = /because|since|proves|indicates|shows|therefore|means|reveals|due\s+to/i.test(warrant);
    if (warrant.length > 30 && logicWords) {
      warrantScore = 3;
      warrantRationale = 'Logical connection clearly explains why the observed evidence confirms the goal.';
    } else if (warrant.length > 12) {
      warrantScore = 2;
      warrantRationale = 'Weak or implicit reasoning linking evidence to the claim.';
    }

    // Feedback category
    let feedbackCategory = 'Well-Formed Argument';
    if (claimScore < 2) feedbackCategory = 'Missing Hypothesis';
    else if (evidenceScore < 2) feedbackCategory = 'Unsubstantiated Claim';
    else if (warrantScore < 2) feedbackCategory = 'Circular or Weak Reasoning';
    else if (claimScore === 2 || evidenceScore === 2 || warrantScore === 2) feedbackCategory = 'Partial Explanation';

    return {
      scoreId: `cew-score-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      submissionId: submission.submissionId,
      testCaseId: submission.testCaseId,
      scoreType: 'automated',
      evaluatorId: 'system-cew-evaluator',
      provider,
      model: evaluatorModel,
      rubricVersion: CEW_RUBRIC_VERSION,
      claimScore,
      evidenceScore,
      warrantScore,
      claimRationale,
      evidenceRationale,
      warrantRationale,
      feedbackCategory,
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      isSameModelAsTutor
    };
  }

  /**
   * Calculate alignment statistics between automated scores and human expert scores.
   */
  public static calculateAgreement(
    automatedScores: CEWScore[],
    expertScores: CEWScore[]
  ): CEWAgreementReport {
    // Map submissions to expert score
    const expertBySub = new Map<string, CEWScore>();
    for (const exp of expertScores) {
      expertBySub.set(exp.submissionId, exp);
    }

    const paired: { auto: CEWScore; exp: CEWScore }[] = [];
    for (const auto of automatedScores) {
      const exp = expertBySub.get(auto.submissionId);
      if (exp) {
        paired.push({ auto, exp });
      }
    }

    const sampleSize = paired.length;
    if (sampleSize === 0) {
      const emptyKappa: KappaResult = {
        kappa: 1.0,
        observedWeightedAgreement: 1.0,
        chanceExpectedAgreement: 1.0,
        interpretation: 'Substantial'
      };
      return {
        sampleSize: 0,
        exactAgreementPercentage: 0,
        withinOnePointPercentage: 0,
        meanAbsoluteDifference: 0,
        claimAgreementPct: 0,
        evidenceAgreementPct: 0,
        warrantAgreementPct: 0,
        componentDisagreements: { claim: 0, evidence: 0, warrant: 0 },
        confusionMatrix: {
          claim: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
          evidence: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
          warrant: [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
        },
        confusionMatrixClaim: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
        confusionMatrixEvidence: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
        confusionMatrixWarrant: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
        quadraticWeightedKappa: {
          claim: emptyKappa,
          evidence: emptyKappa,
          warrant: emptyKappa,
          overall: emptyKappa
        },
        largestDisagreements: [],
        disclaimer: 'Preliminary expert-system alignment sample. Does not constitute full psychometric instrument validation.'
      };
    }

    let exactMatches = 0;
    let withinOneMatches = 0;
    let totalAbsDiff = 0;
    let claimDis = 0;
    let evidDis = 0;
    let warrDis = 0;

    const confClaim = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const confEvid = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const confWarr = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const confOverall = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

    const differences: {
      submissionId: string;
      taskId: number;
      systemScore: { claim: number; evidence: number; warrant: number };
      expertScore: { claim: number; evidence: number; warrant: number };
      difference: number;
    }[] = [];

    for (const { auto, exp } of paired) {
      const cDiff = Math.abs(auto.claimScore - exp.claimScore);
      const eDiff = Math.abs(auto.evidenceScore - exp.evidenceScore);
      const wDiff = Math.abs(auto.warrantScore - exp.warrantScore);

      const sumDiff = cDiff + eDiff + wDiff;
      totalAbsDiff += (sumDiff / 3);

      if (cDiff === 0 && eDiff === 0 && wDiff === 0) exactMatches++;
      if (cDiff <= 1 && eDiff <= 1 && wDiff <= 1) withinOneMatches++;

      if (cDiff > 0) claimDis++;
      if (eDiff > 0) evidDis++;
      if (wDiff > 0) warrDis++;

      // Confusion matrices
      if (auto.claimScore >= 1 && auto.claimScore <= 3 && exp.claimScore >= 1 && exp.claimScore <= 3) {
        confClaim[auto.claimScore - 1][exp.claimScore - 1]++;
        confOverall[auto.claimScore - 1][exp.claimScore - 1]++;
      }
      if (auto.evidenceScore >= 1 && auto.evidenceScore <= 3 && exp.evidenceScore >= 1 && exp.evidenceScore <= 3) {
        confEvid[auto.evidenceScore - 1][exp.evidenceScore - 1]++;
        confOverall[auto.evidenceScore - 1][exp.evidenceScore - 1]++;
      }
      if (auto.warrantScore >= 1 && auto.warrantScore <= 3 && exp.warrantScore >= 1 && exp.warrantScore <= 3) {
        confWarr[auto.warrantScore - 1][exp.warrantScore - 1]++;
        confOverall[auto.warrantScore - 1][exp.warrantScore - 1]++;
      }

      differences.push({
        submissionId: auto.submissionId,
        taskId: 1,
        systemScore: { claim: auto.claimScore, evidence: auto.evidenceScore, warrant: auto.warrantScore },
        expertScore: { claim: exp.claimScore, evidence: exp.evidenceScore, warrant: exp.warrantScore },
        difference: sumDiff
      });
    }

    differences.sort((a, b) => b.difference - a.difference);

    const kappaClaim = CEWEvaluator.calculateQuadraticWeightedKappa(confClaim, 3);
    const kappaEvidence = CEWEvaluator.calculateQuadraticWeightedKappa(confEvid, 3);
    const kappaWarrant = CEWEvaluator.calculateQuadraticWeightedKappa(confWarr, 3);
    const kappaOverall = CEWEvaluator.calculateQuadraticWeightedKappa(confOverall, 3);

    const claimAgreementPct = Number((((sampleSize - claimDis) / sampleSize) * 100).toFixed(1));
    const evidenceAgreementPct = Number((((sampleSize - evidDis) / sampleSize) * 100).toFixed(1));
    const warrantAgreementPct = Number((((sampleSize - warrDis) / sampleSize) * 100).toFixed(1));

    return {
      sampleSize,
      exactAgreementPercentage: Math.round((exactMatches / sampleSize) * 100),
      withinOnePointPercentage: Math.round((withinOneMatches / sampleSize) * 100),
      meanAbsoluteDifference: Number((totalAbsDiff / sampleSize).toFixed(2)),
      claimAgreementPct,
      evidenceAgreementPct,
      warrantAgreementPct,
      componentDisagreements: {
        claim: claimDis,
        evidence: evidDis,
        warrant: warrDis
      },
      confusionMatrix: {
        claim: confClaim,
        evidence: confEvid,
        warrant: confWarr
      },
      confusionMatrixClaim: confClaim,
      confusionMatrixEvidence: confEvid,
      confusionMatrixWarrant: confWarr,
      quadraticWeightedKappa: {
        claim: kappaClaim,
        evidence: kappaEvidence,
        warrant: kappaWarrant,
        overall: kappaOverall
      },
      largestDisagreements: differences.slice(0, 5),
      disclaimer: 'Preliminary expert-system alignment sample. Does not constitute full psychometric instrument validation.'
    };
  }
}
