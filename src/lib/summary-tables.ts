/**
 * The tables a report summary section can show under its text — the tables
 * of the bank's performance report, filled from the same figures as the
 * dashboard and the performance report. Tables are built from live data each
 * time the summary is shown or exported; a section only stores their keys.
 *
 * Pure: safe to import from client components.
 */

import { formatRatio, formatWeight } from './report-calculations';
import { DELAY_BUCKET_LABEL, INITIATIVE_STATUS_LABEL, INITIATIVE_STATUS_ORDER, ratingFor, type DashboardMetrics, type DelayBucket } from './dashboard-metrics';
import type { TrendPoint } from './dashboard-data';
import { attentionItems, delayedActivities, type InsightActivity } from './performance-insights';
import type { ReportActivity, TreePillar } from './performance-report';
import { cleanText, workStreamTable, workStreamTotals, type SummaryCorrection } from './report-summary';

export interface SummaryTable {
  title: string;
  head: string[];
  rows: string[][];
  /** Rows shown in bold (e.g. totals or pillar lines), by index into `rows`. */
  boldRows?: number[];
  /** Relative column widths (any scale); the exports use them. */
  widths?: number[];
  /** Columns centred rather than left-aligned. */
  center?: number[];
  note?: string;
}

export interface TableOption { key: string; label: string; description: string }

/** What tables are built from: the summary's report tree and the dashboard's figures for the same period. */
export interface TableContext {
  tree: TreePillar<ReportActivity>[];
  periodEndDate: string | Date;
  /** Null when the dashboard couldn't be computed for this plan and period. */
  metrics: DashboardMetrics | null;
  trend: TrendPoint[];
  corrections: SummaryCorrection[];
}

const MAX_TABLES_PER_SECTION = 10;
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const day = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const strip = (s: string) => s.trim().replace(/[.;:]+$/, '');

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

const FIXED: TableOption[] = [
  { key: 'workstreams', label: 'Execution status by work stream', description: '# of initiatives and activities per work stream, completed against plan, and deviation.' },
  { key: 'plan-execution', label: 'Summary of strategic plan execution status', description: 'Weighted plan, actual and achievement for every pillar and objective, with rating.' },
  { key: 'stream-performance', label: 'Work stream performance evaluation', description: "Each work stream's achievement, result out of 30 and rating, as on the dashboard." },
  { key: 'initiative-status', label: 'Initiatives by status', description: 'How many initiatives per pillar met the period target, are on track, behind or not started.' },
  { key: 'delayed', label: 'Activities planned but not executed', description: 'Activities past their due date without an approved completion, with days delayed.' },
  { key: 'delay-ageing', label: 'Delay ageing', description: 'Initiatives and activities by how late they are (on time, up to 30 days, 31–60, …).' },
  { key: 'challenges', label: 'Challenges, way forward and escalations', description: 'Reasons for variation, way forward and issues for management attention from approved reports.' },
  { key: 'trend', label: 'Trend across reporting periods', description: 'Achieved result, with delay and full-year progress for this and earlier periods.' },
];

const OBJECTIVE_PREFIX = 'objective-execution:';

/** Every table that can be added, for this summary's plan and period. */
export function tableCatalog(tree: TreePillar<ReportActivity>[]): TableOption[] {
  return [
    ...FIXED,
    ...tree.flatMap(p => p.objectives.map(o => ({
      key: `${OBJECTIVE_PREFIX}${o.id}`,
      label: `Execution status: ${strip(o.statement)}`,
      description: 'Each initiative under this objective with its key activities for the period and key accomplishments.',
    }))),
  ];
}

/** Tables a newly generated section starts with. */
export function defaultTables(sectionKey: string): string[] {
  if (sectionKey === 'overview') return ['plan-execution'];
  if (sectionKey === 'workstreams') return ['workstreams', 'stream-performance'];
  if (sectionKey === 'not-executed') return ['delayed'];
  if (sectionKey.startsWith('objective:')) return [`${OBJECTIVE_PREFIX}${sectionKey.slice('objective:'.length)}`];
  return [];
}

/** Keeps only well-formed, distinct keys, at most ten. */
export function sanitizeTableKeys(keys: unknown): string[] | null {
  if (!Array.isArray(keys) || keys.length > MAX_TABLES_PER_SECTION) return null;
  const ok = keys.every(k => typeof k === 'string' && (FIXED.some(f => f.key === k) || /^objective-execution:[\w-]{1,64}$/.test(k)));
  return ok ? Array.from(new Set(keys as string[])) : null;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function insightActivities(tree: TreePillar<ReportActivity>[]): InsightActivity[] {
  return tree.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities.map(a => ({
    title: a.title, initiative: i.title, owner: a.owner, office: a.office, collaborators: a.collaborators.join(', '),
    endDate: a.endDate, reportStatus: a.state, row: a.row, completionDate: a.entry.completionDate,
    reasonForVariation: a.entry.reasonForVariation, wayForward: a.entry.wayForward, escalationIssues: a.entry.escalationIssues,
  })))));
}

function workstreams(ctx: TableContext): SummaryTable {
  const rows = workStreamTable(ctx.tree, ctx.periodEndDate);
  const t = workStreamTotals(rows);
  return {
    title: 'Summary of execution status by work stream',
    head: ['S.No.', 'Work stream', '# of initiatives', '# of activities', 'Completed (actual)', 'Completed (plan)', 'Deviation'],
    rows: [
      ...rows.map((r, n) => [String(n + 1), r.office, String(r.initiatives), String(r.activities), String(r.actual), String(r.plan), signed(r.deviation)]),
      ['', 'Total', String(t.initiatives), String(t.activities), String(t.actual), String(t.plan), signed(t.deviation)],
    ],
    boldRows: [rows.length],
    widths: [6, 38, 11, 11, 12, 11, 11],
    center: [0, 2, 3, 4, 5, 6],
    note: 'Plan = activities due by the period end; actual = those approved as completed.',
  };
}

function planExecution(m: DashboardMetrics): SummaryTable {
  const rows: string[][] = [];
  const bold: number[] = [];
  const line = (pillar: string, objective: string, s: DashboardMetrics['overall']) => {
    const hasPlan = s.rollup.weightedPlan > 0;
    return [pillar, objective, formatWeight(s.rollup.weightedPlan), formatWeight(s.rollup.weightedActual), hasPlan ? formatRatio(s.rollup.achievedResult) : '—', ratingFor(s.rollup.achievedResult, hasPlan, m.ratingThresholds)];
  };
  for (const p of m.pillars) {
    bold.push(rows.length);
    rows.push(line(strip(p.title), 'All objectives', p.summary));
    // Skip the code when the statement already carries its number ("Objective 1: …").
    for (const o of p.objectives) rows.push(line('', /^objective\s*\d+/i.test(o.statement.trim()) ? strip(o.statement) : `${o.code} ${strip(o.statement)}`.trim(), o.summary));
  }
  bold.push(rows.length);
  rows.push(line('Overall', '', m.overall));
  return {
    title: 'Summary of strategic plan execution status',
    head: ['Strategic pillar', 'Strategic objective', 'Weighted plan', 'Weighted actual', "Achiev't", 'Rating'],
    rows, boldRows: bold, widths: [24, 36, 10, 10, 9, 11], center: [2, 3, 4, 5],
  };
}

function streamPerformance(m: DashboardMetrics): SummaryTable {
  return {
    title: 'Work stream performance evaluation',
    head: ['S.No.', 'Work stream', 'Weighted plan', 'Weighted actual', "Achiev't", 'With delay', 'Result out of 30', 'Rating'],
    rows: [...m.streams]
      .sort((x, y) => (y.summary.rollup.achievedWithDelay ?? -1) - (x.summary.rollup.achievedWithDelay ?? -1))
      .map((s, n) => {
        const r = s.summary.rollup;
        const hasPlan = r.weightedPlan > 0;
        return [String(n + 1), s.name, formatWeight(r.weightedPlan), formatWeight(r.weightedActual), hasPlan ? formatRatio(r.achievedResult) : '—', hasPlan ? formatRatio(r.achievedWithDelay) : '—', s.score30 == null ? '—' : s.score30.toFixed(2), s.rating];
      }),
    widths: [6, 32, 10, 10, 9, 9, 11, 11], center: [0, 2, 3, 4, 5, 6, 7],
    note: 'Ranked by achievement with the late-completion penalty. Result out of 30 = achievement with delay × 30.',
  };
}

function initiativeStatus(m: DashboardMetrics): SummaryTable {
  const statuses = INITIATIVE_STATUS_ORDER.filter(s => s !== 'noTarget');
  const row = (name: string, counts: Record<string, number>, total: number) => [name, ...statuses.map(s => String(counts[s] ?? 0)), String(total)];
  return {
    title: 'Initiatives by status',
    head: ['Pillar', ...statuses.map(s => INITIATIVE_STATUS_LABEL[s]), 'Total'],
    rows: [
      ...m.pillars.map(p => row(strip(p.title), p.statusCounts, p.initiatives)),
      row('Total', m.statusCounts, m.pillars.reduce((t, p) => t + p.initiatives, 0)),
    ],
    boldRows: [m.pillars.length],
    widths: [34, ...statuses.map(() => 11), 9], center: statuses.map((_, n) => n + 1).concat(statuses.length + 1),
  };
}

function delayed(ctx: TableContext): SummaryTable {
  const overdue = delayedActivities(insightActivities(ctx.tree), ctx.periodEndDate)
    .filter(d => d.kind === 'Overdue')
    .sort((x, y) => x.office.localeCompare(y.office) || y.daysDelayed - x.daysDelayed);
  return {
    title: 'Strategic activities planned but not executed',
    head: ['Work stream', 'Initiative', 'Activity', 'Due date', '# of days delayed'],
    rows: overdue.length
      ? overdue.map(d => [d.office, strip(d.initiative), strip(d.activity), day(d.dueDate), String(d.daysDelayed)])
      : [['Every activity due by the end of the period has been completed.', '', '', '', '']],
    widths: [20, 26, 34, 11, 9], center: [3, 4],
    note: `Days counted to the period end (${day(ctx.periodEndDate)}).`,
  };
}

function delayAgeing(m: DashboardMetrics): SummaryTable {
  const buckets: DelayBucket[] = ['onTime', 'd1_30', 'd31_60', 'd61_90', 'd90plus', 'notElapsed'];
  return {
    title: 'Delay ageing',
    head: ['', ...buckets.map(b => DELAY_BUCKET_LABEL[b])],
    rows: [
      ['Initiatives', ...buckets.map(b => String(m.initiativeDelays[b] ?? 0))],
      ['Activities', ...buckets.map(b => String(m.activityDelays[b] ?? 0))],
    ],
    widths: [16, 14, 14, 14, 14, 14, 14], center: [1, 2, 3, 4, 5, 6],
  };
}

function challenges(ctx: TableContext): SummaryTable {
  const items = attentionItems(insightActivities(ctx.tree));
  return {
    title: 'Challenges, way forward and issues for management attention',
    head: ['Work stream', 'Activity', 'Status', 'Reason / challenge', 'Way forward', 'Needs management attention'],
    rows: items.length
      ? items.map(a => [a.office, strip(a.activity), `${a.status}${a.achievement != null ? ` (${formatRatio(a.achievement)})` : ''}`, cleanText(a.challenge, ctx.corrections), cleanText(a.wayForward, ctx.corrections), cleanText(a.escalation, ctx.corrections)])
      : [['No challenges or escalation issues were reported in approved reports.', '', '', '', '', '']],
    widths: [14, 20, 12, 20, 18, 16],
  };
}

function trend(ctx: TableContext): SummaryTable {
  return {
    title: 'Trend across reporting periods',
    head: ['Reporting period', 'Achieved result', 'With delay', 'Full-year progress', 'Reports approved'],
    rows: ctx.trend.map(t => [t.name, formatRatio(t.achieved), formatRatio(t.achievedWithDelay), formatRatio(t.yearProgress), `${t.approved} of ${t.planned}`]),
    widths: [28, 18, 18, 18, 18], center: [1, 2, 3, 4],
  };
}

function objectiveExecution(ctx: TableContext, objectiveId: string): SummaryTable | null {
  for (const p of ctx.tree) for (const o of p.objectives) {
    if (o.id !== objectiveId) continue;
    const codeOf = new Map((ctx.metrics?.initiatives ?? []).map(i => [i.id, i.code]));
    return {
      title: `Execution status of initiatives under: ${strip(o.statement)}`,
      head: ['Initiative code', 'Initiative title', 'Key activities planned for the period', 'Key accomplishment during the period'],
      rows: o.initiatives.map(i => {
        const done = i.activities
          .filter(a => a.row)
          .map(a => cleanText(a.entry.comment, ctx.corrections) || `${strip(a.title)}: ${a.row!.status.toLowerCase()}.`);
        return [codeOf.get(i.id) ?? '', strip(i.title), i.activities.map(a => `- ${strip(a.title)}`).join('\n'), done.map(d => `- ${d}`).join('\n') || 'Awaiting approved reports.'];
      }),
      widths: [9, 21, 32, 38], center: [0],
    };
  }
  return null;
}

/** Builds the tables for the given keys; keys that no longer apply (e.g. an objective without reports) are left out. */
export function buildTables(ctx: TableContext, keys: string[]): Record<string, SummaryTable> {
  const out: Record<string, SummaryTable> = {};
  const m = ctx.metrics;
  for (const key of keys) {
    if (out[key]) continue;
    let table: SummaryTable | null = null;
    if (key === 'workstreams') table = workstreams(ctx);
    else if (key === 'plan-execution') table = m && planExecution(m);
    else if (key === 'stream-performance') table = m && streamPerformance(m);
    else if (key === 'initiative-status') table = m && initiativeStatus(m);
    else if (key === 'delayed') table = delayed(ctx);
    else if (key === 'delay-ageing') table = m && delayAgeing(m);
    else if (key === 'challenges') table = challenges(ctx);
    else if (key === 'trend') table = ctx.trend.length ? trend(ctx) : null;
    else if (key.startsWith(OBJECTIVE_PREFIX)) table = objectiveExecution(ctx, key.slice(OBJECTIVE_PREFIX.length));
    if (table) out[key] = table;
  }
  return out;
}
