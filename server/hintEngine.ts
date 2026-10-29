import { Level, ProgressiveHintItem, HintState } from '../types';

export class ProgressiveHintEngine {
  public static readonly VERSION = '2.0.0';

  public static getNextHint(
    task: Level,
    currentLevelRequested: number,
    studentCommandCount: number,
    hasAttemptedFlag: boolean
  ): { hintItem: ProgressiveHintItem; state: HintState } {
    const progression: ProgressiveHintItem[] = task.approvedHintProgression && task.approvedHintProgression.length > 0
      ? task.approvedHintProgression
      : [
          { level: 0, title: 'Clarification', text: 'What command output or observation led to your current thought?' },
          { level: 1, title: 'Socratic Inquiry', text: task.hints?.[0] || 'Which Linux command might be applicable here?' },
          { level: 2, title: 'Conceptual Reminder', text: task.hints?.[1] || 'Consider the relationship between file locations and commands.' },
          { level: 3, title: 'Procedural Hint', text: 'Review the manual page for relevant commands to find applicable options.' },
          { level: 4, title: 'Bounded Example', text: 'Consider syntax like `command [options] [target]`.' }
        ];

    // Progression gating: learner should have attempted at least 1 command before unlocking procedural/example hints
    let targetLevel = Math.min(Math.max(0, currentLevelRequested), 4);
    let prerequisitesMet = true;
    let reason = 'Requested hint level granted';

    if (targetLevel >= 3 && studentCommandCount < 1) {
      targetLevel = 1;
      prerequisitesMet = false;
      reason = 'Prerequisite not met: At least one command must be attempted before procedural hints are unlocked.';
    }

    const matched = progression.find(p => p.level === targetLevel) || progression[0];

    const state: HintState = {
      hintLevelRequested: currentLevelRequested,
      hintLevelDelivered: targetLevel,
      reason,
      prerequisitesMet
    };

    return {
      hintItem: matched,
      state
    };
  }
}
