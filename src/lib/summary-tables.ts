/**
 * The tables a report summary section can show under its text — the tables
 * of the bank's performance report, filled from the same figures as the
 * dashboard and the performance report. Tables are built from live data each
 * time the summary is shown or exported; a section only stores their keys.
 *
 * A key is the table's name plus its filter as URL parameters, e.g.
 * "stream-performance?stream=Chief Finance Officer|Chief Strategy Officer&rating=Good".
 * Each table declares the fields it can be filtered by.
 *
 * Pure: safe to import from client components.
 */

import { formatRatio, formatWeight } from './report-calculations';
import { ACTIVITY_STATUS_ORDER, DELAY_BUCKET_LABEL, DELIVERY_STATE_LABEL, INITIATIVE_STATUS_LABEL, INITIATIVE_STATUS_ORDER, ratingFor, type DashboardMetrics, type DelayBucket, type Rating } from './dashboard-metrics';
import { DELIVERY_ORDER, delayFilterFromParams, describeDelayFilter, filterDelayRows, formatDays, groupDelayRows } from './activity-delay-table';
import type { TrendPoint } from './dashboard-data';
import { attentionItems, delayedActivities, type InsightActivity } from './performance-insights';
import { RESULT_STATUSES, type ReportActivity, type TreePillar } from './performance-report';
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

/** One way a table can be filtered. `multi` = any of several values; `select` = one value; `text` = a search. */
export interface FilterField {
  name: string;
  label: string;
  kind: 'multi' | 'select' | 'text';
  options: { value: string; label: string }[];
}

/** Chosen values per field name; a text field holds one value. */
export type FilterValues = Record<string, string[]>;

export interface TableOption {
  key: string;
  label: string;
  description: string;
  /** Fields this table can be filtered by, with the values available for this period. */
  filters?: FilterField[];
}

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
const sortedUnique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
const asOptions = (values: string[]) => values.map(v => ({ value: v, label: v }));

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

const FIXED: Omit<TableOption, 'filters'>[] = [
  { key: 'workstreams', label: 'Execution status by work stream', description: '# of initiatives and activities per work stream, completed against plan, and deviation.' },
  { key: 'plan-execution', label: 'Summary of strategic plan execution status', description: 'Weighted plan, actual and achievement for every pillar and objective, with rating.' },
  { key: 'stream-performance', label: 'Work stream performance evaluation', description: "Each work stream's achievement, result out of 30 and rating, as on the dashboard." },
  { key: 'initiative-status', label: 'Initiatives by status', description: 'How many initiatives per pillar met the period target, are on track, behind or not started.' },
  { key: 'activity-delays', label: 'Activity delays', description: "The dashboard's activity delay table — filter it by activity status, delivery or work stream, e.g. only In Good Progress and Not In Good Progress." },
  { key: 'delayed', label: 'Activities planned but not executed', description: 'Activities past their due date without an approved completion, with days delayed.' },
  { key: 'delay-ageing', label: 'Delay ageing', description: 'Initiatives and activities by how late they are (on time, up to 30 days, 31–60, …).' },
  { key: 'challenges', label: 'Challenges, way forward and escalations', description: 'Reasons for variation, way forward and issues for management attention from approved reports.' },
  { key: 'trend', label: 'Trend across reporting periods', description: 'Achieved result, with delay and full-year progress for this and earlier periods.' },
];

const RATINGS: Rating[] = ['Outstanding', 'Very Good', 'Good', 'Fair', 'Unsatisfactory', 'No Target'];

/** The fields each table can be filtered by, in the order they are stored and shown. Options are filled per period. */
const FIELD_SPECS: Record<string, Omit<FilterField, 'options'>[]> = {
  'workstreams': [{ name: 'stream', label: 'Work stream', kind: 'multi' }],
  'plan-execution': [{ name: 'pillar', label: 'Pillar', kind: 'multi' }],
  'stream-performance': [{ name: 'stream', label: 'Work stream', kind: 'multi' }, { name: 'rating', label: 'Rating', kind: 'multi' }],
  'initiative-status': [{ name: 'pillar', label: 'Pillar', kind: 'multi' }],
  // Same parameter names as the dashboard's activity delay table, so its filter helpers read them.
  'activity-delays': [
    { name: 'status', label: 'Activity status', kind: 'multi' },
    { name: 'delivery', label: 'Delivery', kind: 'multi' },
    { name: 'stream', label: 'Work stream', kind: 'select' },
    { name: 'q', label: 'Search', kind: 'text' },
  ],
  'delayed': [{ name: 'stream', label: 'Work stream', kind: 'multi' }],
  'challenges': [{ name: 'stream', label: 'Work stream', kind: 'multi' }, { name: 'status', label: 'Activity status', kind: 'multi' }],
};

/** Values a field may hold regardless of the period; other fields (work streams, pillars) are checked for shape only. */
const FIXED_VALUES: Record<string, Record<string, readonly string[]>> = {
  'stream-performance': { rating: RATINGS },
  'activity-delays': { status: ACTIVITY_STATUS_ORDER, delivery: DELIVERY_ORDER },
  'challenges': { status: RESULT_STATUSES },
};

const OBJECTIVE_PREFIX = 'objective-execution:';

/** Splits a key into the table name and its filter. */
export function parseTableKey(key: string): { base: string; values: FilterValues } {
  const at = key.indexOf('?');
  const base = at < 0 ? key : key.slice(0, at);
  const params = new URLSearchParams(at < 0 ? '' : key.slice(at + 1));
  const values: FilterValues = {};
  for (const f of FIELD_SPECS[base] ?? []) {
    const raw = params.get(f.name);
    if (!raw) continue;
    const list = (f.kind === 'text' ? [raw] : raw.split('|')).map(v => v.trim()).filter(Boolean);
    if (list.length) values[f.name] = f.kind === 'multi' ? list : list.slice(0, 1);
  }
  return { base, values };
}

/** The key for a table with this filter; empty fields are left out, so an unfiltered table's key is just its name. */
export function tableKeyOf(base: string, values: FilterValues): string {
  const params = new URLSearchParams();
  for (const f of FIELD_SPECS[base] ?? []) {
    const list = (values[f.name] ?? []).map(v => v.trim()).filter(Boolean);
    if (list.length) params.set(f.name, f.kind === 'multi' ? Array.from(new Set(list)).join('|') : list[0]);
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export const isFiltered = (key: string) => Object.keys(parseTableKey(key).values).length > 0;

/** The default for "planned but not executed": activities in progress but not finished. */
export const IN_PROGRESS_DELAYS_KEY = tableKeyOf('activity-delays', { status: ['In Good Progress', 'Not In Good Progress'] });

/** Filled-in filter fields for a table, with the values available in this period. */
function filterFields(base: string, ctx: TableContext): FilterField[] | undefined {
  const spec = FIELD_SPECS[base];
  if (!spec) return undefined;
  const m = ctx.metrics;
  const treeOffices = () => sortedUnique(ctx.tree.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities.map(a => a.office)))));
  const options = (name: string): FilterField['options'] => {
    if (name === 'pillar') return (m?.pillars ?? ctx.tree).map(p => ({ value: p.id, label: strip(p.title) }));
    if (name === 'rating') return asOptions(RATINGS);
    if (name === 'delivery') return DELIVERY_ORDER.map(d => ({ value: d, label: DELIVERY_STATE_LABEL[d] }));
    if (name === 'status') return asOptions(base === 'activity-delays' ? [...ACTIVITY_STATUS_ORDER] : RESULT_STATUSES);
    if (name === 'stream') {
      if (base === 'workstreams') return asOptions(workStreamTable(ctx.tree, ctx.periodEndDate).map(r => r.office));
      if (base === 'stream-performance') return asOptions(sortedUnique((m?.streams ?? []).map(s => s.name)));
      if (base === 'activity-delays') return asOptions(sortedUnique((m?.activityDelayRows ?? []).map(r => r.stream)));
      return asOptions(treeOffices());
    }
    return [];
  };
  return spec.map(f => ({ ...f, options: options(f.name) }));
}

/** Every table that can be added for this summary's plan and period, with how each can be filtered. */
export function tableCatalog(ctx: TableContext): TableOption[] {
  return [
    ...FIXED.map(o => ({ ...o, filters: filterFields(o.key, ctx) })),
    ...ctx.tree.flatMap(p => p.objectives.map(o => ({
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
  if (sectionKey === 'not-executed') return [IN_PROGRESS_DELAYS_KEY];
  if (sectionKey.startsWith('objective:')) return [`${OBJECTIVE_PREFIX}${sectionKey.slice('objective:'.length)}`];
  return [];
}

/**
 * Keeps only well-formed, distinct keys, at most ten. Filters are re-encoded:
 * unknown fields are dropped, fixed-choice fields keep only known values, and
 * free values (work streams, pillars, search) are length-limited.
 */
export function sanitizeTableKeys(keys: unknown): string[] | null {
  if (!Array.isArray(keys) || keys.length > MAX_TABLES_PER_SECTION) return null;
  const out: string[] = [];
  for (const k of keys) {
    if (typeof k !== 'string' || k.length > 2000) return null;
    const { base, values } = parseTableKey(k);
    if (/^objective-execution:[\w-]{1,64}$/.test(base)) { out.push(base); continue; }
    if (!FIXED.some(f => f.key === base)) return null;
    const clean: FilterValues = {};
    for (const [name, list] of Object.entries(values)) {
      const allowed = FIXED_VALUES[base]?.[name];
      clean[name] = list.slice(0, 50).map(v => v.slice(0, name === 'q' ? 100 : 200)).filter(v => !allowed || allowed.includes(v));
    }
    out.push(tableKeyOf(base, clean));
  }
  return Array.from(new Set(out));
}

/** "Work stream: A, B · Rating: Good" for a filtered table, using the options' labels. */
function describeFilter(fields: FilterField[] | undefined, values: FilterValues): string {
  return (fields ?? [])
    .filter(f => values[f.name]?.length)
    .map(f => `${f.label}: ${values[f.name].map(v => f.options.find(o => o.value === v)?.label ?? v).join(', ')}`)
    .join(' · ');
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

/** Keeps items whose value is among the chosen ones (or all, when nothing is chosen). */
const pick = <T>(items: T[], chosen: string[] | undefined, valueOf: (item: T) => string) =>
  chosen?.length ? items.filter(i => chosen.includes(valueOf(i))) : items;

function workstreams(ctx: TableContext, v: FilterValues): SummaryTable {
  const rows = pick(workStreamTable(ctx.tree, ctx.periodEndDate), v.stream, r => r.office);
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

function planExecution(m: DashboardMetrics, v: FilterValues): SummaryTable {
  const rows: string[][] = [];
  const bold: number[] = [];
  const line = (pillar: string, objective: string, s: DashboardMetrics['overall']) => {
    const hasPlan = s.rollup.weightedPlan > 0;
    return [pillar, objective, formatWeight(s.rollup.weightedPlan), formatWeight(s.rollup.weightedActual), hasPlan ? formatRatio(s.rollup.achievedResult) : '—', ratingFor(s.rollup.achievedResult, hasPlan, m.ratingThresholds)];
  };
  for (const p of pick(m.pillars, v.pillar, p => p.id)) {
    bold.push(rows.length);
    rows.push(line(strip(p.title), 'All objectives', p.summary));
    // Skip the code when the statement already carries its number ("Objective 1: …").
    for (const o of p.objectives) rows.push(line('', /^objective\s*\d+/i.test(o.statement.trim()) ? strip(o.statement) : `${o.code} ${strip(o.statement)}`.trim(), o.summary));
  }
  // The overall line covers the whole plan, so it only belongs on the unfiltered table.
  if (!v.pillar?.length) {
    bold.push(rows.length);
    rows.push(line('Overall', '', m.overall));
  }
  return {
    title: 'Summary of strategic plan execution status',
    head: ['Strategic pillar', 'Strategic objective', 'Weighted plan', 'Weighted actual', "Achiev't", 'Rating'],
    rows, boldRows: bold, widths: [24, 36, 10, 10, 9, 11], center: [2, 3, 4, 5],
  };
}

function streamPerformance(m: DashboardMetrics, v: FilterValues): SummaryTable {
  const streams = pick(pick(m.streams, v.stream, s => s.name), v.rating, s => s.rating);
  return {
    title: 'Work stream performance evaluation',
    head: ['S.No.', 'Work stream', 'Weighted plan', 'Weighted actual', "Achiev't", 'With delay', 'Result out of 30', 'Rating'],
    rows: streams.length
      ? [...streams]
          .sort((x, y) => (y.summary.rollup.achievedWithDelay ?? -1) - (x.summary.rollup.achievedWithDelay ?? -1))
          .map((s, n) => {
            const r = s.summary.rollup;
            const hasPlan = r.weightedPlan > 0;
            return [String(n + 1), s.name, formatWeight(r.weightedPlan), formatWeight(r.weightedActual), hasPlan ? formatRatio(r.achievedResult) : '—', hasPlan ? formatRatio(r.achievedWithDelay) : '—', s.score30 == null ? '—' : s.score30.toFixed(2), s.rating];
          })
      : [['', 'No work streams match this filter.', '', '', '', '', '', '']],
    widths: [6, 32, 10, 10, 9, 9, 11, 11], center: [0, 2, 3, 4, 5, 6, 7],
    note: 'Ranked by achievement with the late-completion penalty. Result out of 30 = achievement with delay × 30.',
  };
}

function initiativeStatus(m: DashboardMetrics, v: FilterValues): SummaryTable {
  const statuses = INITIATIVE_STATUS_ORDER.filter(s => s !== 'noTarget');
  const pillars = pick(m.pillars, v.pillar, p => p.id);
  const row = (name: string, counts: Record<string, number>, total: number) => [name, ...statuses.map(s => String(counts[s] ?? 0)), String(total)];
  const totals = Object.fromEntries(statuses.map(s => [s, pillars.reduce((t, p) => t + (p.statusCounts[s] ?? 0), 0)]));
  return {
    title: 'Initiatives by status',
    head: ['Pillar', ...statuses.map(s => INITIATIVE_STATUS_LABEL[s]), 'Total'],
    rows: [
      ...pillars.map(p => row(strip(p.title), p.statusCounts, p.initiatives)),
      row('Total', totals, pillars.reduce((t, p) => t + p.initiatives, 0)),
    ],
    boldRows: [pillars.length],
    widths: [34, ...statuses.map(() => 11), 9], center: statuses.map((_, n) => n + 1).concat(statuses.length + 1),
  };
}

function delayed(ctx: TableContext, v: FilterValues): SummaryTable {
  const overdue = pick(delayedActivities(insightActivities(ctx.tree), ctx.periodEndDate).filter(d => d.kind === 'Overdue'), v.stream, d => d.office)
    .sort((x, y) => x.office.localeCompare(y.office) || y.daysDelayed - x.daysDelayed);
  return {
    title: 'Strategic activities planned but not executed',
    head: ['Work stream', 'Initiative', 'Activity', 'Due date', '# of days delayed'],
    rows: overdue.length
      ? overdue.map(d => [d.office, strip(d.initiative), strip(d.activity), day(d.dueDate), String(d.daysDelayed)])
      : [['No activities past their due date match.', '', '', '', '']],
    widths: [20, 26, 34, 11, 9], center: [3, 4],
    note: `Days counted to the period end (${day(ctx.periodEndDate)}).`,
  };
}

/** The dashboard's activity delay table as filtered: one line per activity, stream and initiative shown once per group. */
function activityDelays(m: DashboardMetrics, key: string): SummaryTable {
  const at = key.indexOf('?');
  const filter = delayFilterFromParams(new URLSearchParams(at < 0 ? '' : key.slice(at + 1)));
  const rows = filterDelayRows(m.activityDelayRows, filter);
  const lines: string[][] = [];
  for (const s of groupDelayRows(rows)) {
    s.initiatives.forEach((i, ni) => i.rows.forEach((r, nr) => lines.push([
      ni === 0 && nr === 0 ? s.stream : '',
      nr === 0 ? `${i.code} ${strip(i.title)}`.trim() : '',
      strip(r.activity),
      r.deliverable ? strip(r.deliverable) : '',
      day(r.dueDate),
      day(r.completionDate),
      formatDays(r.daysDelayed),
      r.status,
      DELIVERY_STATE_LABEL[r.delivery],
    ])));
  }
  return {
    title: 'Activity delays',
    head: ['Work stream', 'Initiative', 'Major activity', 'Deliverable', 'Due date', 'Completed', '# of days delayed', 'Activity status', 'Delivery'],
    rows: lines.length ? lines : [['No activities match this filter.', '', '', '', '', '', '', '', '']],
    widths: [13, 15, 19, 13, 8, 8, 7, 10, 7], center: [4, 5, 6],
    note: `${describeDelayFilter(filter)} · ${rows.length} activit${rows.length === 1 ? 'y' : 'ies'}. Days delayed = completion date (or period end if open) − due date; negative = days still to go.`,
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

function challenges(ctx: TableContext, v: FilterValues): SummaryTable {
  const items = pick(pick(attentionItems(insightActivities(ctx.tree)), v.stream, a => a.office), v.status, a => a.status);
  return {
    title: 'Challenges, way forward and issues for management attention',
    head: ['Work stream', 'Activity', 'Status', 'Reason / challenge', 'Way forward', 'Needs management attention'],
    rows: items.length
      ? items.map(a => [a.office, strip(a.activity), `${a.status}${a.achievement != null ? ` (${formatRatio(a.achievement)})` : ''}`, cleanText(a.challenge, ctx.corrections), cleanText(a.wayForward, ctx.corrections), cleanText(a.escalation, ctx.corrections)])
      : [['No challenges or escalation issues match.', '', '', '', '', '']],
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
    const { base, values: v } = parseTableKey(key);
    let table: SummaryTable | null = null;
    if (base === 'workstreams') table = workstreams(ctx, v);
    else if (base === 'plan-execution') table = m && planExecution(m, v);
    else if (base === 'stream-performance') table = m && streamPerformance(m, v);
    else if (base === 'initiative-status') table = m && initiativeStatus(m, v);
    else if (base === 'activity-delays') table = m && activityDelays(m, key);
    else if (base === 'delayed') table = delayed(ctx, v);
    else if (base === 'delay-ageing') table = m && delayAgeing(m);
    else if (base === 'challenges') table = challenges(ctx, v);
    else if (base === 'trend') table = ctx.trend.length ? trend(ctx) : null;
    else if (base.startsWith(OBJECTIVE_PREFIX)) table = objectiveExecution(ctx, base.slice(OBJECTIVE_PREFIX.length));
    // Activity delays describes its own filter; other filtered tables say what they show.
    const described = base !== 'activity-delays' ? describeFilter(filterFields(base, ctx), v) : '';
    if (table && described) table = { ...table, note: [`Filtered — ${described}.`, table.note].filter(Boolean).join(' ') };
    if (table) out[key] = table;
  }
  return out;
}
