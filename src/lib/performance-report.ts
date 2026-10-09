/**
 * The performance report for one reporting period as a pillar → objective →
 * initiative → activity tree, and the filters the report page and its Excel
 * export share, so a download always matches what is on screen.
 *
 * Pure: safe to import from client components.
 */

import type { TargetAggregation, TargetType } from './monthly-breakdown';
import { computeReportRow, type ReportRow, type ReportStatusLabel } from './report-calculations';
import { matchesSearch, overlapsDateRange, type DateRangeValue } from './list-filters';

// ---------------------------------------------------------------------------
// Report and result states
// ---------------------------------------------------------------------------

export type ReportState = 'APPROVED' | 'SUBMITTED' | 'REQUESTED' | 'RETURNED';

export const REPORT_STATE_LABEL: Record<ReportState, string> = {
  APPROVED: 'Approved',
  SUBMITTED: 'Pending approval',
  REQUESTED: 'Awaiting report',
  RETURNED: 'Returned to owner',
};

/** Results an approved report can have (the Excel's Activity Status). */
export const RESULT_STATUSES: ReportStatusLabel[] = ['Completed As Per The Target', 'In Good Progress', 'Not In Good Progress', 'Not Started', 'No Target'];

const isReportState = (s: string): s is ReportState => s in REPORT_STATE_LABEL;

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

export interface TreeInitiative<A> { id: string; title: string; activities: A[] }
export interface TreeObjective<A> { id: string; statement: string; initiatives: TreeInitiative<A>[] }
export interface TreePillar<A> { id: string; title: string; objectives: TreeObjective<A>[] }

/** What the filters look at on each activity. */
export interface FilterableActivity {
  title: string;
  /** The responsible person. */
  owner: string;
  /** The lead-owner office (or department). */
  office: string;
  startDate: string;
  endDate: string;
  state: ReportState;
  /** Activity status from an approved report; null until approved. */
  result: ReportStatusLabel | null;
}

export interface ReportEntryValues {
  activityId: string;
  reportStatus: string;
  actualToDate: number | null;
  completionDate: string | Date | null;
  comment: string | null;
  reasonForVariation: string | null;
  wayForward: string | null;
  escalationIssues: string | null;
}

export interface ReportActivity extends FilterableActivity {
  id: string;
  targetType: TargetType | null;
  entry: ReportEntryValues;
  /** Computed values; only approved reports have them. */
  row: ReportRow | null;
}

interface PlanActivityInput {
  id: string;
  title: string;
  weight: number;
  countsTowardWeight?: boolean | null;
  targetType?: string | null;
  annualTarget?: number | null;
  targetAggregation?: string | null;
  targetDirection?: string | null;
  monthlyTargets?: { month: string | Date; value: number }[] | null;
  leadOwner?: string | null;
  department?: string | null;
  responsible?: unknown;
  startDate: string | Date;
  endDate: string | Date;
}

interface PlanPillarInput {
  id: string;
  title: string;
  objectives: { id: string; statement: string; initiatives: { id: string; title: string; activities: PlanActivityInput[] }[] }[];
}

const iso = (d: string | Date) => (typeof d === 'string' ? d : d.toISOString());
export const officeOf = (a: { leadOwner?: string | null; department?: string | null }) => a.leadOwner || a.department || '—';

/**
 * Builds the report tree for a period. Only activities with a report request
 * appear; groups with none are dropped.
 */
export function buildPerformanceTree(pillars: PlanPillarInput[], entries: ReportEntryValues[], periodEndDate: string | Date): TreePillar<ReportActivity>[] {
  const entryByActivity = new Map(entries.map(e => [e.activityId, e]));

  const toActivity = (a: PlanActivityInput): ReportActivity | null => {
    const entry = entryByActivity.get(a.id);
    if (!entry || !isReportState(entry.reportStatus)) return null;
    const targetType = (a.targetType ?? null) as TargetType | null;
    const row = entry.reportStatus === 'APPROVED'
      ? computeReportRow(
          {
            weight: a.weight,
            countsTowardWeight: a.countsTowardWeight ?? undefined,
            targetType,
            annualTarget: a.annualTarget ?? null,
            targetAggregation: (a.targetAggregation ?? null) as TargetAggregation | null,
            targetDirection: (a.targetDirection ?? null) as 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | null,
            monthlyTargets: a.monthlyTargets ?? [],
          },
          { actualToDate: entry.actualToDate, completionDate: entry.completionDate },
          periodEndDate
        )
      : null;
    return {
      id: a.id,
      title: a.title,
      owner: (a.responsible as { name?: string } | null)?.name ?? '',
      office: officeOf(a),
      startDate: iso(a.startDate),
      endDate: iso(a.endDate),
      state: entry.reportStatus,
      result: row?.status ?? null,
      targetType,
      entry,
      row,
    };
  };

  return pillars.map(p => ({
    id: p.id,
    title: p.title,
    objectives: p.objectives.map(o => ({
      id: o.id,
      statement: o.statement,
      initiatives: o.initiatives.map(i => ({
        id: i.id,
        title: i.title,
        activities: i.activities.map(toActivity).filter((a): a is ReportActivity => a !== null),
      })).filter(i => i.activities.length > 0),
    })).filter(o => o.initiatives.length > 0),
  })).filter(p => p.objectives.length > 0);
}

export const treeActivities = <A>(pillars: TreePillar<A>[]): A[] =>
  pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities)));

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface PerformanceFilters {
  q?: string;
  pillar?: string;
  owner?: string;
  report?: ReportState;
  result?: ReportStatusLabel;
  range?: DateRangeValue;
}

export const isNarrowed = (f: PerformanceFilters) =>
  !!(f.q?.trim() || f.pillar || f.owner || f.report || f.result || f.range?.from || f.range?.to);

/**
 * Keeps the grouping: a search that matches a pillar, objective or initiative
 * shows all of its activities; every other filter applies to each activity.
 */
export function filterPerformanceTree<A extends FilterableActivity>(pillars: TreePillar<A>[], f: PerformanceFilters): TreePillar<A>[] {
  if (!isNarrowed(f)) return pillars;
  const q = f.q?.trim() ?? '';
  const keep = (a: A) =>
    (!f.owner || a.office === f.owner) &&
    (!f.report || a.state === f.report) &&
    (!f.result || a.result === f.result) &&
    (!f.range || overlapsDateRange(a.startDate, a.endDate, f.range));

  return pillars
    .filter(p => !f.pillar || p.id === f.pillar)
    .map(p => ({
      ...p,
      objectives: p.objectives.map(o => ({
        ...o,
        initiatives: o.initiatives.map(i => {
          const groupHit = !q || matchesSearch(q, p.title, o.statement, i.title);
          return { ...i, activities: i.activities.filter(a => keep(a) && (groupHit || matchesSearch(q, a.title, a.owner, a.office))) };
        }).filter(i => i.activities.length > 0),
      })).filter(o => o.initiatives.length > 0),
    }))
    .filter(p => p.objectives.length > 0);
}

/** Filters as URL parameters, for the export link. */
export function filtersToParams(f: PerformanceFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q?.trim()) params.set('q', f.q.trim());
  if (f.pillar) params.set('pillar', f.pillar);
  if (f.owner) params.set('owner', f.owner);
  if (f.report) params.set('report', f.report);
  if (f.result) params.set('result', f.result);
  if (f.range?.from) params.set('from', f.range.from);
  if (f.range?.to) params.set('to', f.range.to);
  return params;
}

export function filtersFromParams(params: URLSearchParams): PerformanceFilters {
  const report = params.get('report') ?? '';
  const result = params.get('result') ?? '';
  const ymd = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return {
    q: params.get('q') ?? undefined,
    pillar: params.get('pillar') ?? undefined,
    owner: params.get('owner') ?? undefined,
    report: isReportState(report) ? report : undefined,
    result: (RESULT_STATUSES as string[]).includes(result) ? (result as ReportStatusLabel) : undefined,
    range: { from: ymd(params.get('from')), to: ymd(params.get('to')) },
  };
}

/** A one-line description of the active filters, for the export's subtitle. */
export function describeFilters(f: PerformanceFilters, pillarTitle?: string): string {
  const parts: string[] = [];
  if (f.q?.trim()) parts.push(`search “${f.q.trim()}”`);
  if (f.pillar) parts.push(pillarTitle ?? 'one pillar');
  if (f.owner) parts.push(`lead owner ${f.owner}`);
  if (f.report) parts.push(`report ${REPORT_STATE_LABEL[f.report].toLowerCase()}`);
  if (f.result) parts.push(`result ${f.result.toLowerCase()}`);
  if (f.range?.from || f.range?.to) parts.push(`running ${f.range.from ?? '…'} to ${f.range.to ?? '…'}`);
  return parts.join(' · ');
}
