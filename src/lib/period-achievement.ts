import { calculateDelayDays } from './utils';

export interface PeriodEntryLike {
  plannedProgress: number;
  actualProgress: number | null;
}

export interface ActivityLike {
  weight: number;
  endDate: string | Date;
  countsTowardWeight?: boolean;
}

/**
 * actual/planned*100, clamped at capPercent — same pattern as
 * calculateKpiAchievement (src/lib/kpi.ts), applied here to a period's
 * plan/actual pair instead of a KPI's target/actual pair.
 */
export function computeAchievementPercent(entry: PeriodEntryLike, capPercent: number): number | null {
  if (entry.actualProgress == null) return null;
  if (entry.plannedProgress === 0) return null;
  const raw = (entry.actualProgress / entry.plannedProgress) * 100;
  return Number.isFinite(raw) ? Math.min(raw, capPercent) : null;
}

/**
 * Mirrors the Excel's AL column: an achievement % penalized the later it was
 * reported past the activity's deadline — 10% off for 31-60 days late, 20%
 * for 61-90, 50% beyond that. Not yet overdue (or already at/under 30 days)
 * gets no penalty.
 */
export function computeDelayAdjustedAchievement(
  entry: PeriodEntryLike,
  activity: ActivityLike,
  now: Date = new Date()
): number | null {
  const achievement = computeAchievementPercent(entry, Infinity);
  if (achievement == null) return null;

  const endDate = new Date(activity.endDate);
  const delayDays = calculateDelayDays({ progress: entry.actualProgress ?? 0, endDate }, now);

  if (delayDays <= 30) return achievement;
  if (delayDays <= 60) return achievement * (1 - 0.10);
  if (delayDays <= 90) return achievement * (1 - 0.20);
  return achievement * (1 - 0.50);
}

/**
 * Mirrors AR/AT: the activity's full weight is only earned once achievement
 * reaches 100%; below that the weight is scaled down by the achievement
 * ratio. Duplicate rows (countsTowardWeight === false) contribute nothing,
 * so a shared activity's weight isn't counted once per owning department.
 */
export function computeWeightedContribution(
  activity: ActivityLike,
  entry: PeriodEntryLike,
  capPercent: number,
  useDelayAdjusted = false
): number {
  if (activity.countsTowardWeight === false) return 0;

  const achievement = useDelayAdjusted
    ? computeDelayAdjustedAchievement(entry, activity)
    : computeAchievementPercent(entry, capPercent);

  if (achievement == null) return 0;
  return achievement >= 100 ? activity.weight : activity.weight * (achievement / 100);
}
