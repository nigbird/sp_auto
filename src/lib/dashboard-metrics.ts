/**
 * The executive dashboard's numbers: the Excel's summary sheets ("Overall
 * DashBoard", "Pillar Achievement", "Objective Level Achievement",
 * "Initiatives Summary", "Initiatives/Activity Summary @GRAPH", "Summary
 * Streams & Department", "Streams & Depart's Performance") computed from live
 * plan data.
 *
 * Every activity-level figure comes from computeReportRow (the Excel's
 * AG…AW columns); everything above that is a roll-up of those rows. Plan
 * weight counts every activity scheduled for the period; actual weight counts
 * only approved reports, so an unreported activity contributes 0 — the same as
 * a blank Actual cell in the Excel.
 *
 * Pure functions only — the loader in dashboard-data.ts feeds them.
 */

import { computeReportRow, rollUp, type ReportRollup, type ReportRow } from './report-calculations';
import type { TargetAggregation, TargetType } from './monthly-breakdown';
import { DEFAULT_RATING_THRESHOLDS, type RatingThresholds } from './rating-bands';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type EntryStatus = 'NOT_REQUESTED' | 'REQUESTED' | 'SUBMITTED' | 'APPROVED' | 'RETURNED';

export interface MetricActivity {
  id: string;
  title: string;
  weight: number;
  countsTowardWeight: boolean;
  leadOwner: string | null;
  department: string;
  startDate: string;
  /** Planned end date on the activity itself; used when there is no approved breakdown. */
  endDate: string;
  /** Monthly targets only count once the breakdown is approved. */
  breakdownApproved: boolean;
  targetType: TargetType | null;
  annualTarget: number | null;
  targetAggregation: TargetAggregation;
  targetDirection: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  monthlyTargets: { month: string; value: number }[];
}

export interface MetricInitiative { id: string; title: string; activities: MetricActivity[] }
export interface MetricObjective { id: string; statement: string; initiatives: MetricInitiative[] }
export interface MetricPillar { id: string; title: string; objectives: MetricObjective[] }

export interface MetricEntry {
  activityId: string;
  reportStatus: EntryStatus;
  actualToDate: number | null;
  completionDate: string | null;
  comment?: string | null;
  reasonForVariation?: string | null;
  wayForward?: string | null;
  escalationIssues: string | null;
}

export interface MetricPeriod { id: string; name: string; startDate: string; endDate: string }

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/** Initiative status for the period, matching the Excel's five "Summary of Key Activities" columns, plus "awaiting". */
export type InitiativeStatus = 'achieved' | 'onTrack' | 'behind' | 'notStarted' | 'noTarget' | 'awaiting';

export const INITIATIVE_STATUS_ORDER: InitiativeStatus[] = ['achieved', 'onTrack', 'behind', 'notStarted', 'awaiting', 'noTarget'];

export const INITIATIVE_STATUS_LABEL: Record<InitiativeStatus, string> = {
  achieved: 'Met period target',
  onTrack: 'On track',
  behind: 'Behind',
  notStarted: 'Not started',
  awaiting: 'Awaiting reports',
  noTarget: 'No target this period',
};

export type Rating = 'Outstanding' | 'Very Good' | 'Good' | 'Fair' | 'Unsatisfactory' | 'No Target';


export type DelayBucket = 'onTime' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90plus' | 'notElapsed';

export const DELAY_BUCKET_LABEL: Record<DelayBucket, string> = {
  onTime: 'On time',
  d1_30: 'Up to 30 days',
  d31_60: '31–60 days',
  d61_90: '61–90 days',
  d90plus: 'Over 90 days',
  notElapsed: 'Not yet due',
};

export interface Coverage {
  activities: number;
  /** Activities with a plan (weighted plan > 0) for the period. */
  planned: number;
  /** Planned activities whose report is approved. */
  approved: number;
  /** Planned activities with a report submitted and waiting for approval. */
  pending: number;
  /** Planned activities with no approved report (requested, returned, pending or never requested). */
  missing: number;
}

export interface Summary {
  /** Σ activity weight, duplicates counted once — the Excel's "Total WT". */
  totalWeight: number;
  rollup: ReportRollup;
  /** Weighted plan as a share of total weight — the Excel's "From 100% Plan". */
  planShareOfTotal: number | null;
  /** Weighted actual (no duplicates) as a share of total weight — the Excel's "Overall Achiev't". */
  yearProgress: number | null;
  coverage: Coverage;
}

export interface NarrativeItem { activity: string; text: string }

export interface InitiativeSummary {
  id: string;
  code: string;
  title: string;
  pillarCode: string;
  objectiveCode: string;
  /** The lead owner behind most of this initiative's activities. */
  owner: string;
  summary: Summary;
  status: InitiativeStatus;
  rating: Rating;
  /** Earliest activity start and latest planned finish — the Excel's Start Date / End Date. */
  startDate: string | null;
  dueDate: string | null;
  dueByPeriodEnd: boolean;
  completed: boolean;
  delay: DelayBucket | null;
  activities: number;
  /** The Excel's four narrative columns, gathered from approved reports this period. */
  narratives: {
    accomplished: NarrativeItem[];
    variation: NarrativeItem[];
    wayForward: NarrativeItem[];
    escalation: NarrativeItem[];
  };
}

export interface ObjectiveSummary {
  id: string;
  code: string;
  statement: string;
  pillarCode: string;
  summary: Summary;
  statusCounts: Record<InitiativeStatus, number>;
  initiatives: number;
}

export interface PillarSummary {
  id: string;
  code: string;
  title: string;
  summary: Summary;
  statusCounts: Record<InitiativeStatus, number>;
  initiatives: number;
  objectives: ObjectiveSummary[];
}

export interface StreamSummary {
  name: string;
  summary: Summary;
  rating: Rating;
  /** Achievement × 30 — the Excel's "Result out of 30". */
  score30: number | null;
  initiatives: number;
  initiativesDue: number;
  initiativesCompleted: number;
  activitiesDue: number;
  activitiesCompleted: number;
}

/** Expected vs completed by due quarter of the fiscal year (Jul–Jun) that contains the period end. */
export interface QuarterBucket {
  key: 'earlier' | 'q1' | 'q2' | 'q3' | 'q4' | 'later';
  label: string;
  expected: number;
  completed: number;
}

export interface IssueItem { activityId: string; activity: string; initiative: string; initiativeCode: string; owner: string; text: string }

export interface Highlight { code: string; title: string; value: number }

export interface ListItem { id: string; code: string; title: string; owner: string; note: string }

export interface DashboardMetrics {
  overall: Summary;
  pillars: PillarSummary[];
  objectives: ObjectiveSummary[];
  initiatives: InitiativeSummary[];
  streams: StreamSummary[];
  statusCounts: Record<InitiativeStatus, number>;
  initiativeDelays: Record<DelayBucket, number>;
  activityDelays: Record<DelayBucket, number>;
  initiativeQuarters: QuarterBucket[];
  activityQuarters: QuarterBucket[];
  fiscalYearLabel: string;
  activitiesTotal: number;
  activitiesDue: number;
  activitiesCompleted: number;
  initiativesDue: number;
  initiativesCompleted: number;
  /** Due by the period end and not completed. */
  initiativesOverdue: number;
  activitiesOverdue: number;
  completedInitiatives: ListItem[];
  activitiesWithoutTarget: ListItem[];
  objectivesAtLeast80: { count: number; of: number };
  strongestPillarPeriod: Highlight | null;
  strongestPillarYear: Highlight | null;
  weakestPillarPeriod: Highlight | null;
  strongestInitiative: Highlight | null;
  weakestInitiative: Highlight | null;
  issues: IssueItem[];
  story: string[];
  /** The rating thresholds (percent) used for every rating above. */
  ratingThresholds: RatingThresholds;
}

// ---------------------------------------------------------------------------
// Calculation
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

interface ActivityResult {
  activity: MetricActivity;
  entry: MetricEntry | undefined;
  row: ReportRow | null;
  noDupWeight: number;
  hasPlan: boolean;
  status: EntryStatus;
  approved: boolean;
  dueDate: Date | null;
  dueByPeriodEnd: boolean;
  completed: boolean;
  delayDays: number | null;
}

/** Rating for an achievement ratio (1 = 100%), using the configured thresholds (in percent). */
export function ratingFor(achieved: number | null, hasPlan: boolean, t: RatingThresholds = DEFAULT_RATING_THRESHOLDS): Rating {
  if (!hasPlan || achieved == null) return 'No Target';
  const p = achieved * 100;
  if (p >= t.outstanding) return 'Outstanding';
  if (p >= t.veryGood) return 'Very Good';
  if (p >= t.good) return 'Good';
  if (p >= t.fair) return 'Fair';
  return 'Unsatisfactory';
}

/**
 * The Excel's stream totals. An initiative whose activities are led by several
 * offices counts once per office ("with duplication"); each activity has one lead owner.
 */
export interface StreamTotals {
  initiativesWithDuplication: number;
  initiativesWithoutDuplication: number;
  /** Initiatives shared by more than one lead owner, counted per extra owner. */
  initiativesDuplicated: number;
  activities: number;
  activitiesPlanned: number;
}

export function streamTotals(m: Pick<DashboardMetrics, 'streams' | 'initiatives'>): StreamTotals {
  const withDup = m.streams.reduce((s, x) => s + x.initiatives, 0);
  const unique = m.initiatives.filter(i => i.activities > 0).length;
  return {
    initiativesWithDuplication: withDup,
    initiativesWithoutDuplication: unique,
    initiativesDuplicated: withDup - unique,
    activities: m.streams.reduce((s, x) => s + x.summary.coverage.activities, 0),
    activitiesPlanned: m.streams.reduce((s, x) => s + x.summary.coverage.planned, 0),
  };
}

function bucketFor(result: { dueByPeriodEnd: boolean; delayDays: number | null }): DelayBucket {
  if (!result.dueByPeriodEnd) return 'notElapsed';
  const d = result.delayDays ?? 0;
  if (d <= 0) return 'onTime';
  if (d <= 30) return 'd1_30';
  if (d <= 60) return 'd31_60';
  if (d <= 90) return 'd61_90';
  return 'd90plus';
}

function emptyCounts<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map(k => [k, 0])) as Record<K, number>;
}

const DELAY_KEYS: DelayBucket[] = ['onTime', 'd1_30', 'd31_60', 'd61_90', 'd90plus', 'notElapsed'];

const streamOf = (a: MetricActivity) => a.leadOwner?.trim() || a.department?.trim() || 'Unassigned';

function evaluateActivity(activity: MetricActivity, entry: MetricEntry | undefined, periodEnd: Date): ActivityResult {
  const approved = entry?.reportStatus === 'APPROVED';
  const hasTarget = activity.breakdownApproved && (activity.annualTarget ?? 0) > 0;
  // Unapproved reports are scored as a blank actual: the plan still counts, the actual is 0.
  const row = hasTarget
    ? computeReportRow(
        activity,
        approved ? { actualToDate: entry!.actualToDate, completionDate: entry!.completionDate } : { actualToDate: null, completionDate: null },
        periodEnd
      )
    : null;

  const dueDate = row?.dueDate ?? (activity.endDate ? new Date(activity.endDate) : null);
  const dueByPeriodEnd = dueDate != null && dueDate.getTime() <= periodEnd.getTime();
  const completed = approved && row != null && row.isCompleted;

  let delayDays: number | null = null;
  if (dueByPeriodEnd && dueDate) {
    delayDays = completed
      ? Math.max(0, row?.daysDelayed ?? 0)
      // Due but not reported complete is late, even if it fell due on the period's last day.
      : Math.max(1, Math.round((periodEnd.getTime() - dueDate.getTime()) / DAY_MS));
  }

  return {
    activity,
    entry,
    row,
    noDupWeight: activity.countsTowardWeight ? activity.weight : 0,
    hasPlan: (row?.weightedPlan ?? 0) > 0,
    status: entry?.reportStatus ?? 'NOT_REQUESTED',
    approved,
    dueDate,
    dueByPeriodEnd,
    completed,
    delayDays,
  };
}

function summarize(results: ActivityResult[]): Summary {
  const totalWeight = results.reduce((s, r) => s + r.noDupWeight, 0);
  const rows = results.map(r => r.row).filter((r): r is ReportRow => r !== null);
  const rollup = rollUp(rows);
  const planNoDup = rows.reduce((s, r) => s + (r.weightForPeriodNoDup ?? 0), 0);
  const planned = results.filter(r => r.hasPlan);
  return {
    totalWeight,
    rollup,
    planShareOfTotal: totalWeight > 0 ? planNoDup / totalWeight : null,
    yearProgress: totalWeight > 0 ? rollup.weightedActualNoDup / totalWeight : null,
    coverage: {
      activities: results.length,
      planned: planned.length,
      approved: planned.filter(r => r.approved).length,
      pending: planned.filter(r => r.status === 'SUBMITTED').length,
      missing: planned.filter(r => !r.approved).length,
    },
  };
}

/** AW for a group, in the Excel's five buckets; "awaiting" when nothing planned has an approved report yet. */
function statusOf(summary: Summary): InitiativeStatus {
  const { rollup, coverage } = summary;
  if (rollup.weightedPlan <= 0) return 'noTarget';
  if (coverage.approved === 0) return 'awaiting';
  const a = rollup.achievedResult ?? 0;
  if (a >= 1) return 'achieved';
  if (a > 0.7499) return 'onTrack';
  if (a > 0.0001) return 'behind';
  return 'notStarted';
}

const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

function best<T>(items: T[], score: (t: T) => number | null, pick: 'max' | 'min'): T | null {
  let chosen: T | null = null;
  let chosenScore = 0;
  for (const item of items) {
    const s = score(item);
    if (s == null || !Number.isFinite(s)) continue;
    if (chosen === null || (pick === 'max' ? s > chosenScore : s < chosenScore)) {
      chosen = item;
      chosenScore = s;
    }
  }
  return chosen;
}

// --- Fiscal quarters (Jul–Sep, Oct–Dec, Jan–Mar, Apr–Jun) --------------------

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The July-start fiscal year containing a date. */
function fiscalYearStart(d: Date): number {
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

function quarterKey(due: Date, fyStart: number): QuarterBucket['key'] {
  const fy = fiscalYearStart(due);
  if (fy < fyStart) return 'earlier';
  if (fy > fyStart) return 'later';
  const m = due.getUTCMonth();
  return m >= 6 && m <= 8 ? 'q1' : m >= 9 ? 'q2' : m <= 2 ? 'q3' : 'q4';
}

function quarterBuckets(fyStart: number): QuarterBucket[] {
  const range = (a: number, b: number, y: number) => `${MONTH[a]}–${MONTH[b]} ${String(y).slice(2)}`;
  return [
    { key: 'earlier', label: 'Earlier years', expected: 0, completed: 0 },
    { key: 'q1', label: `Q1 · ${range(6, 8, fyStart)}`, expected: 0, completed: 0 },
    { key: 'q2', label: `Q2 · ${range(9, 11, fyStart)}`, expected: 0, completed: 0 },
    { key: 'q3', label: `Q3 · ${range(0, 2, fyStart + 1)}`, expected: 0, completed: 0 },
    { key: 'q4', label: `Q4 · ${range(3, 5, fyStart + 1)}`, expected: 0, completed: 0 },
    { key: 'later', label: 'Later years', expected: 0, completed: 0 },
  ];
}

function tallyQuarters(items: { due: Date | null; completed: boolean }[], fyStart: number): QuarterBucket[] {
  const buckets = quarterBuckets(fyStart);
  for (const item of items) {
    if (!item.due) continue;
    const b = buckets.find(x => x.key === quarterKey(item.due!, fyStart))!;
    b.expected++;
    if (item.completed) b.completed++;
  }
  return buckets;
}

// --- Main ------------------------------------------------------------------------

export function computeDashboard(
  pillars: MetricPillar[],
  entries: MetricEntry[],
  period: MetricPeriod,
  ratingThresholds: RatingThresholds = DEFAULT_RATING_THRESHOLDS
): DashboardMetrics {
  const periodEnd = new Date(period.endDate);
  const entryByActivity = new Map(entries.map(e => [e.activityId, e]));

  const all: ActivityResult[] = [];
  const pillarSummaries: PillarSummary[] = [];
  const objectiveSummaries: ObjectiveSummary[] = [];
  const initiativeSummaries: InitiativeSummary[] = [];
  const issues: IssueItem[] = [];
  const activitiesWithoutTarget: ListItem[] = [];
  const byStream = new Map<string, { results: ActivityResult[]; initiatives: Set<string> }>();

  let objectiveNo = 0;
  let initiativeNo = 0;

  pillars.forEach((pillar, pi) => {
    const pillarCode = `P${pi + 1}`;
    const pillarResults: ActivityResult[] = [];
    const pillarObjectives: ObjectiveSummary[] = [];
    const pillarCounts = emptyCounts(INITIATIVE_STATUS_ORDER);
    let pillarInitiatives = 0;

    for (const objective of pillar.objectives) {
      objectiveNo++;
      const objectiveCode = `O${objectiveNo}`;
      const objectiveResults: ActivityResult[] = [];
      const objectiveCounts = emptyCounts(INITIATIVE_STATUS_ORDER);

      for (const initiative of objective.initiatives) {
        initiativeNo++;
        const code = `${pi + 1}.${objectiveNo}.${initiativeNo}`;
        const results = initiative.activities.map(a => evaluateActivity(a, entryByActivity.get(a.id), periodEnd));
        const summary = summarize(results);
        const status = statusOf(summary);

        // An initiative is due when its last activity is; complete when every activity with a target is.
        const dueDates = results.map(r => r.dueDate).filter((d): d is Date => d !== null);
        const due = dueDates.length ? new Date(Math.max(...dueDates.map(d => d.getTime()))) : null;
        const starts = initiative.activities.map(a => new Date(a.startDate).getTime()).filter(Number.isFinite);
        const dueByPeriodEnd = due != null && due.getTime() <= periodEnd.getTime();
        const targeted = results.filter(r => r.row !== null);
        const completed = targeted.length > 0 && targeted.every(r => r.completed);
        const worstDelay = results.reduce<number | null>((m, r) => (r.delayDays == null ? m : Math.max(m ?? 0, r.delayDays)), null);

        const ownerCounts = new Map<string, number>();
        for (const r of results) ownerCounts.set(streamOf(r.activity), (ownerCounts.get(streamOf(r.activity)) ?? 0) + 1);
        const owner = [...ownerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Unassigned';

        // Narratives come from approved reports only, like every other reported figure.
        const narrative = (pick: (e: MetricEntry) => string | null | undefined): NarrativeItem[] =>
          results.filter(r => r.approved && r.entry && pick(r.entry)?.trim()).map(r => ({ activity: r.activity.title, text: pick(r.entry!)!.trim() }));

        initiativeSummaries.push({
          id: initiative.id,
          code,
          title: initiative.title,
          pillarCode,
          objectiveCode,
          owner,
          summary,
          status,
          rating: ratingFor(summary.rollup.achievedResult, summary.rollup.weightedPlan > 0 && summary.coverage.approved > 0, ratingThresholds),
          startDate: starts.length ? new Date(Math.min(...starts)).toISOString() : null,
          dueDate: due ? due.toISOString() : null,
          dueByPeriodEnd,
          completed,
          delay: due ? bucketFor({ dueByPeriodEnd, delayDays: worstDelay }) : null,
          activities: results.length,
          narratives: {
            accomplished: narrative(e => e.comment),
            variation: narrative(e => e.reasonForVariation),
            wayForward: narrative(e => e.wayForward),
            escalation: narrative(e => e.escalationIssues),
          },
        });

        objectiveCounts[status]++;
        pillarCounts[status]++;
        pillarInitiatives++;
        objectiveResults.push(...results);

        for (const r of results) {
          const stream = streamOf(r.activity);
          const bucket = byStream.get(stream) ?? { results: [], initiatives: new Set<string>() };
          bucket.results.push(r);
          bucket.initiatives.add(initiative.id);
          byStream.set(stream, bucket);

          if (r.row === null) {
            activitiesWithoutTarget.push({
              id: r.activity.id,
              code,
              title: r.activity.title,
              owner: stream,
              note: r.activity.breakdownApproved ? 'No annual target' : 'Monthly breakdown not approved',
            });
          }

          if (r.approved && r.entry?.escalationIssues?.trim()) {
            issues.push({
              activityId: r.activity.id,
              activity: r.activity.title,
              initiative: initiative.title,
              initiativeCode: code,
              owner: stream,
              text: r.entry.escalationIssues.trim(),
            });
          }
        }
      }

      const objectiveSummary: ObjectiveSummary = {
        id: objective.id,
        code: objectiveCode,
        statement: objective.statement,
        pillarCode,
        summary: summarize(objectiveResults),
        statusCounts: objectiveCounts,
        initiatives: objective.initiatives.length,
      };
      pillarObjectives.push(objectiveSummary);
      objectiveSummaries.push(objectiveSummary);
      pillarResults.push(...objectiveResults);
    }

    pillarSummaries.push({
      id: pillar.id,
      code: pillarCode,
      title: pillar.title,
      summary: summarize(pillarResults),
      statusCounts: pillarCounts,
      initiatives: pillarInitiatives,
      objectives: pillarObjectives,
    });
    all.push(...pillarResults);
  });

  const overall = summarize(all);

  const statusCounts = emptyCounts(INITIATIVE_STATUS_ORDER);
  const initiativeDelays = emptyCounts(DELAY_KEYS);
  for (const i of initiativeSummaries) {
    statusCounts[i.status]++;
    if (i.delay) initiativeDelays[i.delay]++;
  }
  const activityDelays = emptyCounts(DELAY_KEYS);
  for (const r of all) if (r.dueDate) activityDelays[bucketFor(r)]++;

  const fyStart = fiscalYearStart(periodEnd);
  const initiativeQuarters = tallyQuarters(initiativeSummaries.map(i => ({ due: i.dueDate ? new Date(i.dueDate) : null, completed: i.completed })), fyStart);
  const activityQuarters = tallyQuarters(all.map(r => ({ due: r.dueDate, completed: r.completed })), fyStart);

  const initiativeById = new Map(initiativeSummaries.map(i => [i.id, i]));
  const streams: StreamSummary[] = [...byStream.entries()].map(([name, { results, initiatives }]) => {
    const summary = summarize(results);
    const hasPlan = summary.rollup.weightedPlan > 0 && summary.coverage.approved > 0;
    const inits = [...initiatives].map(id => initiativeById.get(id)!).filter(Boolean);
    return {
      name,
      summary,
      rating: ratingFor(summary.rollup.achievedResult, hasPlan, ratingThresholds),
      score30: hasPlan && summary.rollup.achievedResult != null ? summary.rollup.achievedResult * 30 : null,
      initiatives: initiatives.size,
      initiativesDue: inits.filter(i => i.dueByPeriodEnd).length,
      initiativesCompleted: inits.filter(i => i.completed).length,
      activitiesDue: results.filter(r => r.dueByPeriodEnd).length,
      activitiesCompleted: results.filter(r => r.completed).length,
    };
  }).sort((a, b) => (b.summary.rollup.achievedResult ?? -1) - (a.summary.rollup.achievedResult ?? -1) || a.name.localeCompare(b.name));

  // Highlights only consider groups with a plan this period.
  const scoredPillars = pillarSummaries.filter(p => p.summary.rollup.weightedPlan > 0);
  const scoredInitiatives = initiativeSummaries.filter(i => i.summary.rollup.weightedPlan > 0 && i.summary.coverage.approved > 0);
  const scoredObjectives = objectiveSummaries.filter(o => o.summary.rollup.weightedPlan > 0);

  const toHighlight = (code: string, title: string, value: number | null): Highlight | null => (value == null ? null : { code, title, value });
  const sPP = best(scoredPillars, p => p.summary.rollup.achievedResult, 'max');
  const wPP = best(scoredPillars, p => p.summary.rollup.achievedResult, 'min');
  const sPY = best(pillarSummaries, p => p.summary.yearProgress, 'max');
  const sI = best(scoredInitiatives, i => i.summary.rollup.achievedResult, 'max');
  const wI = best(scoredInitiatives, i => i.summary.rollup.achievedResult, 'min');

  const objectivesAtLeast80 = {
    count: scoredObjectives.filter(o => (o.summary.rollup.achievedResult ?? 0) >= 0.8).length,
    of: scoredObjectives.length,
  };

  const metrics: DashboardMetrics = {
    overall,
    pillars: pillarSummaries,
    objectives: objectiveSummaries,
    initiatives: initiativeSummaries,
    streams,
    statusCounts,
    initiativeDelays,
    activityDelays,
    initiativeQuarters,
    activityQuarters,
    fiscalYearLabel: `FY ${fyStart}/${String(fyStart + 1).slice(2)}`,
    activitiesTotal: all.length,
    activitiesDue: all.filter(r => r.dueByPeriodEnd).length,
    activitiesCompleted: all.filter(r => r.completed).length,
    initiativesDue: initiativeSummaries.filter(i => i.dueByPeriodEnd).length,
    initiativesCompleted: initiativeSummaries.filter(i => i.completed).length,
    initiativesOverdue: initiativeSummaries.filter(i => i.dueByPeriodEnd && !i.completed).length,
    activitiesOverdue: all.filter(r => r.dueByPeriodEnd && !r.completed).length,
    completedInitiatives: initiativeSummaries.filter(i => i.completed).map(i => ({
      id: i.id, code: i.code, title: i.title, owner: i.owner, note: i.dueDate ? `Due ${i.dueDate.slice(0, 10)}` : '',
    })),
    activitiesWithoutTarget,
    objectivesAtLeast80,
    strongestPillarPeriod: sPP && toHighlight(sPP.code, sPP.title, sPP.summary.rollup.achievedResult),
    strongestPillarYear: sPY && toHighlight(sPY.code, sPY.title, sPY.summary.yearProgress),
    weakestPillarPeriod: wPP && wPP !== sPP ? toHighlight(wPP.code, wPP.title, wPP.summary.rollup.achievedResult) : null,
    strongestInitiative: sI && toHighlight(sI.code, sI.title, sI.summary.rollup.achievedResult),
    weakestInitiative: wI && wI !== sI ? toHighlight(wI.code, wI.title, wI.summary.rollup.achievedResult) : null,
    issues,
    story: [],
    ratingThresholds,
  };
  metrics.story = writeStory(metrics, period);
  return metrics;
}

/** The "Story in brief" paragraph, built only from the numbers above. */
function writeStory(m: DashboardMetrics, period: MetricPeriod): string[] {
  const lines: string[] = [];
  const { rollup, coverage } = m.overall;
  const asOf = new Date(period.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  if (rollup.weightedPlan <= 0) {
    lines.push(`No activities have an approved plan for the period ending ${asOf}, so there is nothing to measure yet.`);
    return lines;
  }

  lines.push(`Overall execution reached ${pct(rollup.achievedResult)} of the plan for the period ending ${asOf} (${pct(rollup.achievedWithDelay)} after delay penalties).`);
  if (m.strongestPillarPeriod) {
    const gap = m.weakestPillarPeriod ? `, while ${m.weakestPillarPeriod.code} is the main gap at ${pct(m.weakestPillarPeriod.value)}` : '';
    lines.push(`${m.strongestPillarPeriod.code} leads at ${pct(m.strongestPillarPeriod.value)}${gap}.`);
  }
  if (m.objectivesAtLeast80.of > 0) {
    lines.push(`${m.objectivesAtLeast80.count} of ${m.objectivesAtLeast80.of} objectives with a target this period achieved at least 80%.`);
  }
  lines.push(`${m.initiativesCompleted} of ${m.initiatives.length} initiatives are fully completed; ${m.initiativesDue} were planned to be complete by now.`);
  if (coverage.missing > 0) {
    lines.push(`${coverage.approved} of ${coverage.planned} planned activities have an approved report; the other ${coverage.missing} count as zero until approved${coverage.pending ? ` (${coverage.pending} awaiting approval)` : ''}.`);
  }
  if (m.issues.length > 0) {
    lines.push(`${m.issues.length} issue${m.issues.length === 1 ? ' needs' : 's need'} management attention.`);
  }
  return lines;
}
