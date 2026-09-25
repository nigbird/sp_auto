/**
 * The calculated (non-blue) columns of the "Revised Strategic Init & Ac"
 * sheet, ported formula by formula. Column letters in the comments refer to
 * that sheet so the two can be checked against each other.
 *
 * All ratios are fractions (1 = 100%); weights are percentages of the whole
 * plan, as on the activity (e.g. 0.5 = 0.5%).
 */

import { monthKey, plannedFinishDate, planUpToMonth, type BreakdownEntry, type TargetAggregation, type TargetType } from './monthly-breakdown';

export type ReportStatusLabel =
  | 'Completed As Per The Target'
  | 'In Good Progress'
  | 'Not In Good Progress'
  | 'Not Started'
  | 'No Target';

export interface ReportActivityInput {
  weight: number;                 // I  Activity Weight
  countsTowardWeight?: boolean;   // K  = I unless the activity is a duplicate (then 0)
  targetType: TargetType | null;
  annualTarget: number | null;    // S  Target
  targetAggregation?: TargetAggregation | null; // AG uses =SUM (cumulative) or =MAX (recurring)
  targetDirection?: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | null; // AI = AH/AG, or AG/AH when lower is better
  monthlyTargets: { month: string | Date; value: number }[]; // T..AE
}

export interface ReportEntryInput {
  actualToDate: number | null;          // AH Actual up to the reporting period
  completionDate: string | Date | null; // AJ Completion Date
}

export interface ReportRow {
  planToDate: number;                 // AG Plan up to the reporting period
  completionShare: number | null;     // AF Comp. = AG / S
  weightForPeriod: number | null;     // J  = I × AG / S
  weightForPeriodNoDup: number | null;// L  = K × AG / S
  achievement: number | null;         // AI %age Achiev't = AH / AG
  dueDate: Date | null;               // R  End date (last planned month)
  daysDelayed: number | null;         // AK = AJ − R (days)
  achievementWithDelay: number | null;// AL penalised AI
  weightedPlan: number | null;        // AQ
  weightedActual: number | null;      // AR
  weightedActualWithDelay: number | null; // AS
  weightedActualNoDup: number | null; // AT
  achievedResult: number | null;      // AU = AR / AQ
  achievedWithDelay: number | null;   // AV = AS / AQ
  status: ReportStatusLabel;          // AW
  isBehindPlan: boolean;              // AI < 100% — Reasons & Way forward become required
  isCompleted: boolean;               // BE
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toEntries(monthlyTargets: ReportActivityInput['monthlyTargets']): BreakdownEntry[] {
  return monthlyTargets.map(t => ({ month: typeof t.month === 'string' && /^\d{4}-\d{2}$/.test(t.month) ? t.month : monthKey(t.month), value: t.value }));
}

/** AW / BD: the status label for an achieved-result ratio. */
export function statusForAchievement(achieved: number | null): ReportStatusLabel {
  if (achieved == null || !Number.isFinite(achieved)) return 'No Target';
  if (achieved >= 1) return 'Completed As Per The Target';
  if (achieved > 0.7499) return 'In Good Progress';
  if (achieved > 0.0001) return 'Not In Good Progress';
  if (achieved === 0) return 'Not Started';
  return 'No Target';
}

/** AL: the achievement, cut by 10% / 20% / 50% when finished more than 30 / 60 / 90 days late. */
export function applyDelayPenalty(achievement: number, daysDelayed: number | null): number {
  if (daysDelayed == null || daysDelayed <= 30) return achievement;
  if (daysDelayed <= 60) return achievement * 0.9;
  if (daysDelayed <= 90) return achievement * 0.8;
  return achievement * 0.5;
}

/** Plan up to (and including) the month the period ends in — AG. */
export function planToDateForPeriod(activity: Pick<ReportActivityInput, 'monthlyTargets' | 'targetAggregation'>, periodEndDate: string | Date): number {
  return planUpToMonth(toEntries(activity.monthlyTargets), monthKey(periodEndDate), activity.targetAggregation ?? 'CUMULATIVE');
}

export function computeReportRow(activity: ReportActivityInput, entry: ReportEntryInput, periodEndDate: string | Date): ReportRow {
  const entries = toEntries(activity.monthlyTargets);
  const target = activity.annualTarget ?? 0;
  const weight = activity.weight ?? 0;
  const weightNoDup = activity.countsTowardWeight === false ? 0 : weight;

  const planToDate = planUpToMonth(entries, monthKey(periodEndDate), activity.targetAggregation ?? 'CUMULATIVE');
  const hasPlan = planToDate > 0 && target > 0;

  const completionShare = target > 0 ? planToDate / target : null;
  const weightForPeriod = hasPlan ? weight * planToDate / target : null;
  const weightForPeriodNoDup = hasPlan ? weightNoDup * planToDate / target : null;

  const actual = entry.actualToDate;
  // AI: Actual ÷ Plan, or Plan ÷ Actual for lower-is-better targets (hitting 0 then counts as met).
  const lowerIsBetter = activity.targetDirection === 'LOWER_IS_BETTER';
  const achievement = !hasPlan || actual == null
    ? null
    : lowerIsBetter
      ? (actual > 0 ? planToDate / actual : 1)
      : actual / planToDate;

  const dueDate = plannedFinishDate(entries);
  const daysDelayed = entry.completionDate && dueDate
    ? Math.round((new Date(entry.completionDate).getTime() - dueDate.getTime()) / DAY_MS)
    : null;
  const achievementWithDelay = achievement != null ? applyDelayPenalty(achievement, daysDelayed) : null;

  const weightedPlan = weightForPeriod;
  const weightedActual = weightedPlan != null && achievement != null ? (achievement >= 1 ? weightedPlan : weightedPlan * achievement) : null;
  const weightedActualWithDelay = weightedPlan != null && achievementWithDelay != null ? (achievementWithDelay >= 1 ? weightedPlan : weightedPlan * achievementWithDelay) : null;
  const weightedActualNoDup = weightForPeriodNoDup != null && achievement != null ? (achievement >= 1 ? weightForPeriodNoDup : weightForPeriodNoDup * achievement) : null;

  const achievedResult = weightedPlan && weightedActual != null ? weightedActual / weightedPlan : (achievement != null ? Math.min(achievement, 1) : null);
  const achievedWithDelay = weightedPlan && weightedActualWithDelay != null ? weightedActualWithDelay / weightedPlan : (achievementWithDelay != null ? Math.min(achievementWithDelay, 1) : null);

  return {
    planToDate,
    completionShare,
    weightForPeriod,
    weightForPeriodNoDup,
    achievement,
    dueDate,
    daysDelayed,
    achievementWithDelay,
    weightedPlan,
    weightedActual,
    weightedActualWithDelay,
    weightedActualNoDup,
    achievedResult,
    achievedWithDelay,
    status: hasPlan ? statusForAchievement(achievedResult) : 'No Target',
    isBehindPlan: achievement != null && achievement < 1,
    isCompleted: completionShare != null && completionShare >= 1 && achievedResult != null && achievedResult >= 1,
  };
}

export interface ReportRollup {
  weightedPlan: number;             // AX  Σ AQ
  weightedActual: number;           // AY  Σ AR
  weightedActualWithDelay: number;  // AZ  Σ AS
  weightedActualNoDup: number;      // BA  Σ AT
  achievedResult: number | null;    // BB  = AY / AX
  achievedWithDelay: number | null; // BC  = AZ / AX
  status: ReportStatusLabel;        // BD
}

/** Initiative (IV), objective, pillar or whole-plan totals over a set of rows. */
export function rollUp(rows: ReportRow[]): ReportRollup {
  const sum = (pick: (r: ReportRow) => number | null) => rows.reduce((total, r) => total + (pick(r) ?? 0), 0);
  const weightedPlan = sum(r => r.weightedPlan);
  const weightedActual = sum(r => r.weightedActual);
  const weightedActualWithDelay = sum(r => r.weightedActualWithDelay);
  const weightedActualNoDup = sum(r => r.weightedActualNoDup);
  const achievedResult = weightedPlan > 0 ? weightedActual / weightedPlan : null;
  return {
    weightedPlan,
    weightedActual,
    weightedActualWithDelay,
    weightedActualNoDup,
    achievedResult,
    achievedWithDelay: weightedPlan > 0 ? weightedActualWithDelay / weightedPlan : null,
    status: statusForAchievement(achievedResult),
  };
}

export function formatRatio(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatWeight(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}%`;
}
