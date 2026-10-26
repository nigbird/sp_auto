/**
 * The narrative report summary for one reporting period, written without AI:
 * sentences built from the approved figures, the owners' own comments tidied
 * up, and fixed sentence patterns in the style of the bank's performance
 * report ("To enhance customer engagement, …").
 *
 * Product owners edit the generated sections before exporting them; the
 * generator only supplies the first draft. Only approved reports count, as in
 * the rest of the performance report.
 *
 * Body text markup (kept deliberately small so a plain textarea can edit it):
 * paragraphs are separated by a blank line, and lines starting with "- " are
 * bullet points.
 *
 * Pure: safe to import from client components.
 */

import { formatRatio, rollUp, type ReportRow } from './report-calculations';
import { buildPerformanceTree, type ReportActivity, type ReportEntryValues, type TreePillar } from './performance-report';
import { attentionItems, delayedActivities, type InsightActivity } from './performance-insights';
import type { ActivityDelayRow } from './dashboard-metrics';

// ---------------------------------------------------------------------------
// Wording corrections
// ---------------------------------------------------------------------------

/** A recurring typo or term fix, applied to owners' text (whole words, any case). */
export interface SummaryCorrection { find: string; replace: string }

export const MAX_CORRECTIONS = 200;

/** Reads the saved corrections, dropping malformed rows. */
export function parseCorrections(value: unknown): SummaryCorrection[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is SummaryCorrection => !!c && typeof c === 'object' && typeof (c as SummaryCorrection).find === 'string' && typeof (c as SummaryCorrection).replace === 'string')
    .map(c => ({ find: c.find.trim(), replace: c.replace.trim() }))
    .filter(c => c.find.length > 0)
    .slice(0, MAX_CORRECTIONS);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function applyCorrections(text: string, corrections: SummaryCorrection[]): string {
  let out = text;
  for (const c of corrections) {
    // \b only works next to word characters, so phrases like "&" still match as plain text.
    const start = /^\w/.test(c.find) ? '\\b' : '';
    const end = /\w$/.test(c.find) ? '\\b' : '';
    out = out.replace(new RegExp(`${start}${escapeRegExp(c.find)}${end}`, 'gi'), c.replace);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Text cleanup
// ---------------------------------------------------------------------------

/**
 * "1899291332" → "1,899,291,332". Years, dates, decimals, numbers already
 * grouped, and phone or account numbers (a leading zero, or over 12 digits)
 * are left alone.
 */
function groupThousands(text: string): string {
  return text.replace(/(?<![\d.,/:+-])[1-9]\d{4,11}(?![\d/:-]|[.,]\d)/g, n => Number(n).toLocaleString('en-US'));
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Lower-cases the first letter so a sentence can follow "To …, ", unless it starts an acronym or a name like "NIB-Tera". */
function continueSentence(s: string): string {
  const word = s.split(/\s/, 1)[0] ?? '';
  if (word.length > 1 && word.slice(0, 2) === word.slice(0, 2).toUpperCase()) return s; // EMC, IFB, T24, CVP…
  if (/[A-Z]/.test(word.slice(1))) return s; // NIB-Tera, iPhone-style names
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Splits text into tidy sentences: bullets and line breaks become sentences,
 * spacing is normalised, each starts with a capital and ends with a full stop.
 */
export function cleanSentences(text: string | null | undefined, corrections: SummaryCorrection[] = []): string[] {
  if (!text) return [];
  const pieces = text
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map(line => line.replace(/^\s*(?:[-*•‣▪◦]|\d+[.)]|[a-z][.)])\s+/i, '').trim())
    .filter(Boolean);
  const sentences: string[] = [];
  const seen = new Set<string>();
  for (const piece of pieces) {
    let s = applyCorrections(piece, corrections)
      .replace(/[​-‍﻿]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,;:])(?=[A-Za-z])/g, '$1 ')
      .trim();
    if (!s) continue;
    s = capitalise(groupThousands(s));
    if (!/[.!?]$/.test(s)) s = `${s.replace(/[,;:]+$/, '')}.`;
    // The same sentence typed twice (a common copy/paste slip) appears once.
    const key = s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    sentences.push(s);
  }
  return sentences;
}

export const cleanText = (text: string | null | undefined, corrections: SummaryCorrection[] = []) => cleanSentences(text, corrections).join(' ');

// ---------------------------------------------------------------------------
// Sentence patterns
// ---------------------------------------------------------------------------

/** Verbs initiative titles commonly start with; such titles read as "To <title>, …". */
const LEADING_VERBS = new Set([
  'achieve', 'adopt', 'align', 'assess', 'attract', 'automate', 'boost', 'build', 'conduct', 'create', 'define', 'deploy', 'design',
  'develop', 'digitalize', 'digitalise', 'digitize', 'digitise', 'diversify', 'drive', 'embed', 'enable', 'enhance', 'ensure', 'establish',
  'expand', 'explore', 'facilitate', 'formulate', 'foster', 'grow', 'identify', 'implement', 'improve', 'increase', 'institutionalize',
  'institutionalise', 'integrate', 'introduce', 'launch', 'leverage', 'maintain', 'maximize', 'maximise', 'minimize', 'minimise', 'mobilize',
  'mobilise', 'modernize', 'modernise', 'monitor', 'optimize', 'optimise', 'organize', 'organise', 'prepare', 'promote', 'provide', 'reduce',
  'reengineer', 're-engineer', 'retain', 'review', 'revise', 'roll', 'scale', 'set', 'standardize', 'standardise', 'streamline', 'strengthen',
  'support', 'transform', 'undertake', 'update', 'upgrade',
]);

/** "Enhance Resource Efficiency (3.91%)" → "Enhance Resource Efficiency": the plan's weights read badly inside a sentence. */
const withoutWeight = (title: string) => title.trim().replace(/\s*\(\s*[\d.,]+\s*%\s*\)\s*$/, '').trim().replace(/[.;:]+$/, '');

/** "Enhance Customer Engagement" → "To enhance Customer Engagement, "; other titles get "In relation to the initiative “…”, ". */
export function initiativeLead(title: string): string {
  const t = withoutWeight(title);
  const first = t.split(/\s/, 1)[0]?.toLowerCase().replace(/[^a-z-]/g, '') ?? '';
  if (LEADING_VERBS.has(first)) return `To ${continueSentence(t)}, `;
  return `In relation to the initiative “${t}”, `;
}

/** Connectors that join one activity's progress to the next, in a fixed rotation. */
const CONNECTORS = ['In addition, ', 'Furthermore, ', 'Moreover, ', 'Meanwhile, ', 'Also, '];

const longDate = (d: Date | string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const pct = (v: number | null) => (v == null ? '—' : formatRatio(v));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A sentence from the figures, for an approved activity whose owner wrote no comment. */
function statusSentence(a: ReportActivity): string | null {
  const row = a.row;
  if (!row) return null;
  const name = `the activity “${a.title.trim().replace(/[.;:]+$/, '')}”`;
  const done = a.entry.completionDate ? ` on ${longDate(a.entry.completionDate)}` : '';
  switch (row.status) {
    case 'Completed As Per The Target': return `${capitalise(name)} has been completed${done}.`;
    case 'In Good Progress': return `${capitalise(name)} is in good progress, at ${pct(row.achievement)} of the plan to date.`;
    case 'Not In Good Progress': return `${capitalise(name)} is behind plan, at ${pct(row.achievement)} of the plan to date.`;
    case 'Not Started': return `${capitalise(name)} has not yet started.`;
    default: return null;
  }
}

/** One paragraph per initiative: the lead-in, then each approved activity's progress. */
export function initiativeParagraph(title: string, activities: ReportActivity[], corrections: SummaryCorrection[] = []): string | null {
  const approved = activities.filter(a => a.row);
  const parts = approved
    .map(a => cleanText(a.entry.comment, corrections) || statusSentence(a))
    .filter((s): s is string => !!s);
  // Two activities can carry the same comment; say it once.
  const unique = parts.filter((p, n) => parts.findIndex(q => q.toLowerCase() === p.toLowerCase()) === n);
  if (unique.length === 0) return null;

  let paragraph = initiativeLead(title) + continueSentence(unique[0]);
  unique.slice(1).forEach((p, n) => { paragraph += ` ${CONNECTORS[n % CONNECTORS.length]}${continueSentence(p)}`; });

  if (approved.length > 1) {
    const completed = approved.filter(a => a.row!.isCompleted).length;
    paragraph += completed === approved.length
      ? (approved.length === 2 ? ' Both activities under this initiative have been completed as planned.' : ` All ${approved.length} activities under this initiative have been completed as planned.`)
      : completed > 0 ? ` Overall, ${completed} of the ${approved.length} activities under this initiative ${completed === 1 ? 'has' : 'have'} been completed.` : '';
  }
  return paragraph;
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

export interface ExecutionCounts {
  initiatives: number;
  activities: number;
  /** Activities whose report is approved. */
  approved: number;
  /** Activities due by the period end (the "Plan" column). */
  planned: number;
  /** Approved as completed against the target (the "Actual" column). */
  completed: number;
  inGoodProgress: number;
  behindPlan: number;
  notStarted: number;
  /** Still awaiting a report or its approval. */
  pending: number;
}

const isDue = (a: ReportActivity, periodEnd: Date) => {
  const due = a.row?.dueDate ?? new Date(a.endDate);
  return !Number.isNaN(due.getTime()) && due <= periodEnd;
};

export function executionCounts(activities: (ReportActivity & { initiativeId?: string })[], periodEndDate: string | Date, initiatives?: number): ExecutionCounts {
  const end = new Date(periodEndDate);
  const status = (s: string) => activities.filter(a => a.row?.status === s).length;
  return {
    initiatives: initiatives ?? new Set(activities.map(a => a.initiativeId)).size,
    activities: activities.length,
    approved: activities.filter(a => a.row).length,
    planned: activities.filter(a => isDue(a, end)).length,
    completed: activities.filter(a => a.row?.isCompleted).length,
    inGoodProgress: status('In Good Progress'),
    behindPlan: status('Not In Good Progress'),
    notStarted: status('Not Started'),
    pending: activities.filter(a => !a.row).length,
  };
}

/** "3 are in good progress, 2 are behind plan and 1 has not started" (only the non-zero parts). */
function progressPhrase(c: ExecutionCounts): string {
  const parts = [
    c.inGoodProgress && `${c.inGoodProgress} ${c.inGoodProgress === 1 ? 'is' : 'are'} in good progress`,
    c.behindPlan && `${c.behindPlan} ${c.behindPlan === 1 ? 'is' : 'are'} behind plan`,
    c.notStarted && `${c.notStarted} ${c.notStarted === 1 ? 'has' : 'have'} not started`,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return '';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function countsSentence(c: ExecutionCounts, periodEnd: Date, subject: string): string {
  let s = `${subject}, ${plural(c.initiatives, 'initiative')} with ${plural(c.activities, 'activity', 'activities')} ${c.initiatives === 1 ? 'was' : 'were'} reported on. `;
  if (c.planned === 0 && c.completed === 0) s += `${c.activities === 1 ? 'It was not' : 'None of them were'} due for completion by ${longDate(periodEnd)}`;
  else {
    s += `${plural(c.completed, 'activity', 'activities')} ${c.completed === 1 ? 'has' : 'have'} been completed against ${c.planned} planned for completion by ${longDate(periodEnd)}`;
    s += c.planned > 0 ? ` (${Math.round((c.completed / c.planned) * 100)}%)` : '';
  }
  const progress = progressPhrase(c);
  s += progress ? `; of the rest, ${progress}.` : '.';
  if (c.pending > 0) s += ` ${plural(c.pending, 'report')} ${c.pending === 1 ? 'is' : 'are'} still awaiting submission or approval and ${c.pending === 1 ? 'is' : 'are'} not counted.`;
  return s;
}

// ---------------------------------------------------------------------------
// Work-stream table
// ---------------------------------------------------------------------------

export interface WorkStreamRow {
  office: string;
  initiatives: number;
  activities: number;
  /** Approved completions. */
  actual: number;
  /** Due by the period end. */
  plan: number;
  deviation: number;
}

/** The "Summary of execution status by work stream" table, one row per lead-owner office. */
export function workStreamTable(pillars: TreePillar<ReportActivity>[], periodEndDate: string | Date): WorkStreamRow[] {
  const end = new Date(periodEndDate);
  const byOffice = new Map<string, { initiatives: Set<string>; activities: ReportActivity[] }>();
  for (const p of pillars) for (const o of p.objectives) for (const i of o.initiatives) for (const a of i.activities) {
    const group = byOffice.get(a.office) ?? { initiatives: new Set<string>(), activities: [] };
    group.initiatives.add(i.id);
    group.activities.push(a);
    byOffice.set(a.office, group);
  }
  return Array.from(byOffice, ([office, g]) => {
    const actual = g.activities.filter(a => a.row?.isCompleted).length;
    const plan = g.activities.filter(a => isDue(a, end)).length;
    return { office, initiatives: g.initiatives.size, activities: g.activities.length, actual, plan, deviation: actual - plan };
  }).sort((x, y) => x.office.localeCompare(y.office));
}

export function workStreamTotals(rows: WorkStreamRow[]): Omit<WorkStreamRow, 'office'> {
  const sum = (k: keyof Omit<WorkStreamRow, 'office'>) => rows.reduce((t, r) => t + r[k], 0);
  return { initiatives: sum('initiatives'), activities: sum('activities'), actual: sum('actual'), plan: sum('plan'), deviation: sum('deviation') };
}

function workStreamHighlights(rows: WorkStreamRow[]): string {
  const withPlan = rows.filter(r => r.plan > 0);
  if (withPlan.length === 0) return 'No activities were due for completion by the end of this period.';
  const totals = workStreamTotals(rows);
  const best = [...withPlan].sort((x, y) => y.deviation - x.deviation || y.actual / y.plan - x.actual / x.plan)[0];
  const worst = [...withPlan].sort((x, y) => x.deviation - y.deviation || x.actual / x.plan - y.actual / y.plan)[0];
  let s = `Across ${plural(rows.length, 'work stream')}, ${plural(totals.actual, 'activity', 'activities')} ${totals.actual === 1 ? 'has' : 'have'} been completed against ${totals.plan} due by the end of the period (deviation ${totals.deviation >= 0 ? '+' : ''}${totals.deviation}).`;
  const onPlan = withPlan.filter(r => r.deviation >= 0);
  if (onPlan.length === withPlan.length) s += ' Every work stream completed all of its activities due in the period.';
  else if (best.office !== worst.office) {
    s += ` ${best.office} ${best.deviation >= 0 ? 'completed all activities due' : `had the smallest deviation (${best.deviation})`}, while ${worst.office} had the largest deviation (${worst.deviation}).`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// The summary
// ---------------------------------------------------------------------------

export interface GeneratedSection {
  /** Stable id of what the section covers, so regenerating keeps edits in the right place. */
  key: string;
  level: 1 | 2;
  heading: string;
  body: string;
}

/** Key of the work-stream section. */
export const WORKSTREAM_SECTION_KEY = 'workstreams';

export interface SummaryPlanInput {
  name: string;
  pillars: Parameters<typeof buildPerformanceTree>[0];
}

export interface SummaryPeriodInput { name: string; endDate: string | Date }

/** The activities with a report request in the period, grouped as in the report; shared by the generator and the exports. */
export function summaryTree(plan: SummaryPlanInput, entries: ReportEntryValues[], period: SummaryPeriodInput) {
  return buildPerformanceTree(plan.pillars, entries, period.endDate);
}

/**
 * Writes every section of the summary from the period's reports. `delayRows`
 * (the dashboard's activity delay rows for the period) makes "planned but not
 * executed" count the same activities as its table.
 */
export function generateSummary(plan: SummaryPlanInput, entries: ReportEntryValues[], period: SummaryPeriodInput, corrections: SummaryCorrection[] = [], delayRows?: ActivityDelayRow[]): GeneratedSection[] {
  const tree = summaryTree(plan, entries, period);
  const end = new Date(period.endDate);
  const withInitiative = (pillars: typeof tree) => pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities.map(a => ({ ...a, initiativeId: i.id })))));
  const all = withInitiative(tree);
  const rowsOf = (list: ReportActivity[]) => list.map(a => a.row).filter((r): r is ReportRow => r !== null);
  const sections: GeneratedSection[] = [];

  // Overview.
  const total = rollUp(rowsOf(all));
  const counts = executionCounts(all, end);
  let overview = `This report presents the execution status of the strategic initiatives of ${plan.name.trim()} for ${period.name.trim()}, as of ${longDate(end)}.`;
  overview += `\n\n${countsSentence(counts, end, `Across ${plural(tree.length, 'pillar')}`)}`;
  if (total.weightedPlan > 0) {
    overview += `\n\nThe overall achieved result is ${pct(total.achievedResult)} (${total.status.toLowerCase()})`;
    overview += total.achievedWithDelay != null && pct(total.achievedWithDelay) !== pct(total.achievedResult) ? `, or ${pct(total.achievedWithDelay)} after the penalty for late completion.` : '.';
  }
  sections.push({ key: 'overview', level: 1, heading: 'Executive summary', body: overview });

  // Work streams.
  const streams = workStreamTable(tree, end);
  sections.push({ key: WORKSTREAM_SECTION_KEY, level: 1, heading: 'Summary of execution status by work stream', body: workStreamHighlights(streams) });

  // Pillars and objectives.
  tree.forEach((p, pn) => {
    const pActs = withInitiative([p]);
    const pRoll = rollUp(rowsOf(pActs));
    const pCounts = executionCounts(pActs, end);
    let pBody = countsSentence(pCounts, end, 'Under this pillar');
    if (pRoll.weightedPlan > 0) pBody += ` The pillar's achieved result is ${pct(pRoll.achievedResult)} (${pRoll.status.toLowerCase()}).`;
    // Plans often number their pillars already ("Pillar 1: Profitable Growth").
    const pillarHeading = /^pillar\s*\d+/i.test(p.title.trim()) ? p.title.trim() : `Pillar ${pn + 1}: ${p.title.trim()}`;
    sections.push({ key: `pillar:${p.id}`, level: 1, heading: pillarHeading, body: pBody });

    p.objectives.forEach(o => {
      const oActs = withInitiative([{ ...p, objectives: [o] }]);
      const paragraphs = [countsSentence(executionCounts(oActs, end, o.initiatives.length), end, 'Under this objective')];
      for (const i of o.initiatives) {
        const para = initiativeParagraph(i.title, i.activities, corrections);
        if (para) paragraphs.push(para);
      }
      sections.push({ key: `objective:${o.id}`, level: 2, heading: o.statement.trim(), body: paragraphs.join('\n\n') });
    });
  });

  // Planned but not executed.
  const insight: InsightActivity[] = tree.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities.map(a => ({
    title: a.title, initiative: i.title, owner: a.owner, office: a.office, collaborators: a.collaborators.join(', '),
    endDate: a.endDate, reportStatus: a.state, row: a.row, completionDate: a.entry.completionDate,
    reasonForVariation: a.entry.reasonForVariation, wayForward: a.entry.wayForward, escalationIssues: a.entry.escalationIssues,
  })))));
  // With the dashboard's delay rows, count exactly what its activity delay table shows
  // (an activity due on the period end is overdue there); otherwise use the report's own rule.
  const overdue = delayRows
    ? delayRows
        .filter(r => r.delivery === 'overdue' && !r.duplicate)
        .map(r => ({ activity: r.activity, office: r.stream, daysDelayed: r.daysDelayed ?? 0, status: r.status as string }))
        .sort((x, y) => y.daysDelayed - x.daysDelayed)
    : delayedActivities(insight, end).filter(d => d.kind === 'Overdue')
        .map(d => ({ activity: d.activity, office: d.office, daysDelayed: d.daysDelayed, status: '' }));
  let notExecuted = overdue.length === 0
    ? `Every activity due by ${longDate(end)} has been completed.`
    : `${plural(overdue.length, 'activity', 'activities')} planned for completion by ${longDate(end)} ${overdue.length === 1 ? 'has' : 'have'} not been completed.`;
  if (overdue.length > 0) {
    const statusCounts = new Map<string, number>();
    for (const d of overdue) if (d.status) statusCounts.set(d.status, (statusCounts.get(d.status) ?? 0) + 1);
    if (statusCounts.size > 0) {
      const parts = Array.from(statusCounts).sort(([, x], [, y]) => y - x).map(([s, n]) => `${n} ${n === 1 ? 'is' : 'are'} ${s.toLowerCase()}`);
      notExecuted += ` Of these, ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`}.`;
    }
    const byOffice = new Map<string, number>();
    for (const d of overdue) byOffice.set(d.office, (byOffice.get(d.office) ?? 0) + 1);
    const ranked = Array.from(byOffice).sort(([xo, x], [yo, y]) => y - x || xo.localeCompare(yo));
    notExecuted += ` By work stream: ${ranked.map(([office, n]) => `${office} (${n})`).join(', ')}.`;
    const worst = overdue[0];
    if (worst.daysDelayed > 0) notExecuted += ` The longest delay is ${plural(worst.daysDelayed, 'day')}, for “${worst.activity.trim().replace(/[.;:]+$/, '')}” (${worst.office}).`;
  }
  sections.push({ key: 'not-executed', level: 1, heading: 'Strategic initiatives / activities planned but not executed', body: notExecuted });

  // Reasons for variation, challenges and way forward.
  const attention = attentionItems(insight);
  const variations = attention.length === 0
    ? 'No reasons for variation, challenges or escalation issues were reported in approved reports.'
    : attention.map(a => {
        const lines = [`${a.activity.trim().replace(/[.;:]+$/, '')} (${a.office}, ${a.status.toLowerCase()}${a.achievement != null ? `, ${pct(a.achievement)} of plan` : ''})`];
        const challenge = cleanText(a.challenge, corrections);
        const way = cleanText(a.wayForward, corrections);
        const escalation = cleanText(a.escalation, corrections);
        if (challenge) lines.push(`- Reason / challenge: ${challenge}`);
        if (way) lines.push(`- Way forward: ${way}`);
        if (escalation) lines.push(`- Needs management attention: ${escalation}`);
        return lines.join('\n');
      }).join('\n\n');
  sections.push({ key: 'variations', level: 1, heading: 'Reasons for variations, challenges faced and way forward', body: variations });

  return sections;
}

// ---------------------------------------------------------------------------
// Body markup
// ---------------------------------------------------------------------------

export type SummaryBlock = { type: 'paragraph'; text: string } | { type: 'bullets'; items: string[] };

/** Splits a section body into paragraphs and bullet lists (lines starting with "- "). */
export function parseBody(body: string): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];
  for (const chunk of body.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    let text: string[] = [];
    let bullets: string[] = [];
    const flushText = () => { if (text.length) blocks.push({ type: 'paragraph', text: text.join(' ') }); text = []; };
    const flushBullets = () => { if (bullets.length) blocks.push({ type: 'bullets', items: bullets }); bullets = []; };
    for (const raw of chunk.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const bullet = /^[-*•]\s+(.*)$/.exec(line);
      if (bullet) { flushText(); bullets.push(bullet[1]); }
      else { flushBullets(); text.push(line); }
    }
    flushText();
    flushBullets();
  }
  return blocks;
}
