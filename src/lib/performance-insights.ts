/**
 * The management sections of the performance report, shared by its Excel and
 * PDF exports: the trend across reporting periods, the delayed activities, and
 * the challenges and issues that need management attention.
 *
 * Only approved reports feed the figures; a completion date or comment still
 * awaiting approval is not treated as official.
 *
 * Pure: safe to import from client components.
 */

import { rollUp, type ReportRollup, type ReportRow } from './report-calculations';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One activity with a report request in the period, as the insights need it. */
export interface InsightActivity {
  title: string;
  initiative: string;
  owner: string;
  office: string;
  /** The activity's end date, used as the due date when there is no approved monthly plan. */
  endDate: string | Date;
  /** Report status for the period (REQUESTED, SUBMITTED, APPROVED, RETURNED). */
  reportStatus: string;
  /** Computed values; only approved reports have them. */
  row: ReportRow | null;
  completionDate: string | Date | null;
  reasonForVariation: string | null;
  wayForward: string | null;
  escalationIssues: string | null;
}

// ---------------------------------------------------------------------------
// Delayed activities
// ---------------------------------------------------------------------------

export type DelayKind = 'Overdue' | 'Completed late';

export interface DelayedActivity {
  activity: string;
  initiative: string;
  owner: string;
  office: string;
  reportStatus: string;
  dueDate: Date;
  completionDate: Date | null;
  daysDelayed: number;
  kind: DelayKind;
}

/**
 * Activities past their due date at the period end without an approved
 * completion ("Overdue", days counted to the period end), and activities
 * whose approved completion came after the due date ("Completed late").
 * Worst delay first.
 */
export function delayedActivities(activities: InsightActivity[], periodEndDate: string | Date): DelayedActivity[] {
  const periodEnd = new Date(periodEndDate);
  const out: DelayedActivity[] = [];
  for (const a of activities) {
    const due = a.row?.dueDate ?? new Date(a.endDate);
    if (Number.isNaN(due.getTime())) continue;
    const approved = a.reportStatus === 'APPROVED';
    const completed = approved && a.completionDate ? new Date(a.completionDate) : null;
    const base = { activity: a.title, initiative: a.initiative, owner: a.owner, office: a.office, reportStatus: a.reportStatus, dueDate: due };
    if (completed) {
      const days = a.row?.daysDelayed ?? Math.round((completed.getTime() - due.getTime()) / DAY_MS);
      if (days > 0) out.push({ ...base, completionDate: completed, daysDelayed: days, kind: 'Completed late' });
    } else if (due < periodEnd && !(approved && a.row?.isCompleted)) {
      out.push({ ...base, completionDate: null, daysDelayed: Math.round((periodEnd.getTime() - due.getTime()) / DAY_MS), kind: 'Overdue' });
    }
  }
  return out.sort((x, y) => y.daysDelayed - x.daysDelayed);
}

// ---------------------------------------------------------------------------
// Challenges and management attention
// ---------------------------------------------------------------------------

export interface AttentionItem {
  activity: string;
  initiative: string;
  owner: string;
  office: string;
  status: string;
  achievement: number | null;
  /** The reported challenge (Reasons for Variation). */
  challenge: string;
  wayForward: string;
  escalation: string;
}

const text = (v: string | null | undefined) => (v ?? '').trim();

/**
 * Approved reports that raise an escalation issue, or that are behind plan
 * and explain why. Escalations first, then the furthest behind.
 */
export function attentionItems(activities: InsightActivity[]): AttentionItem[] {
  return activities
    .filter(a => a.reportStatus === 'APPROVED' && a.row)
    .filter(a => text(a.escalationIssues) || (a.row!.isBehindPlan && (text(a.reasonForVariation) || text(a.wayForward))))
    .map(a => ({
      activity: a.title,
      initiative: a.initiative,
      owner: a.owner,
      office: a.office,
      status: a.row!.status,
      achievement: a.row!.achievement,
      challenge: text(a.reasonForVariation),
      wayForward: text(a.wayForward),
      escalation: text(a.escalationIssues),
    }))
    .sort((x, y) => Number(!!y.escalation) - Number(!!x.escalation) || (x.achievement ?? 0) - (y.achievement ?? 0));
}

// ---------------------------------------------------------------------------
// Trend across periods
// ---------------------------------------------------------------------------

export interface TrendLine {
  title: string;
  /** Achieved result per period (null where nothing was approved), in the order of `periods`. */
  values: (number | null)[];
}

export interface PerformanceTrend {
  periods: string[];
  /** "Overall" first, then one line per pillar. */
  lines: TrendLine[];
}

export interface TrendPeriodInput<A extends { row: ReportRow | null }> {
  name: string;
  /** The report tree for that period (same filters as the report). */
  pillars: { title: string; objectives: { initiatives: { activities: A[] }[] }[] }[];
}

const achieved = (r: ReportRollup) => (r.weightedPlan > 0 ? r.achievedResult : null);
const rowsOf = <A extends { row: ReportRow | null }>(activities: A[]) => activities.flatMap(a => (a.row ? [a.row] : []));
const activitiesOf = <A>(p: { objectives: { initiatives: { activities: A[] }[] }[] }) => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities));

/** Achieved result for the whole plan and each pillar, period by period (oldest first). */
export function performanceTrend<A extends { row: ReportRow | null }>(periods: TrendPeriodInput<A>[]): PerformanceTrend {
  const pillarTitles: string[] = [];
  for (const p of periods) for (const pillar of p.pillars) if (!pillarTitles.includes(pillar.title)) pillarTitles.push(pillar.title);
  return {
    periods: periods.map(p => p.name),
    lines: [
      { title: 'Overall', values: periods.map(p => achieved(rollUp(rowsOf(p.pillars.flatMap(activitiesOf))))) },
      ...pillarTitles.map(title => ({
        title,
        values: periods.map(p => {
          const pillar = p.pillars.find(x => x.title === title);
          return pillar ? achieved(rollUp(rowsOf(activitiesOf(pillar)))) : null;
        }),
      })),
    ],
  };
}

/** Change between the last two periods with a value, as a fraction (0.05 = +5 points). */
export function trendChange(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null);
  return known.length >= 2 ? known[known.length - 1] - known[known.length - 2] : null;
}
