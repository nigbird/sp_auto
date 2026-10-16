import * as XLSX from 'xlsx';
import { monthKey, validateBreakdown, type BreakdownEntry, type TargetAggregation, type TargetType } from '@/lib/monthly-breakdown';

/**
 * Reads a cascaded strategic-initiative workbook (the "Revised Strategic Init
 * & Ac" layout) into a plan tree. Rows are placed by their Code:
 *   "1" pillar · "1.1" objective · "1.1.1" initiative · "1.1.1.1" activity.
 * A repeated activity code is the same activity carried by another lead
 * owner — it's kept as its own activity but marked as a duplicate (no
 * weight), like the sheet's "Activity Weight (No Dup)" column.
 *
 * Columns are found by their header text, not by letter, so a sheet with
 * columns moved around still reads correctly.
 */

export type IssueSeverity = 'error' | 'warning';
export interface ImportIssue { row: number | null; severity: IssueSeverity; message: string }

export const REPORT_MONTH_UNKNOWN = `The sheet's report can't be placed: its "Plan up to the reporting period" column has no =SUM(...) of month columns to show which month it runs to.`;

export interface ImportActivity {
  row: number;
  code: string;
  title: string;
  deliverable: string;
  weight: number;               // % of the whole plan (0.81 = 0.81%)
  countsTowardWeight: boolean;  // false for a duplicate row
  duplicateOfCode: string | null;
  leadOwner: string;            // office title from "Lead/ Owner (Activity)"
  collaborators: string;        // free text from "Responsible / Collaborating Unit"
  startDate: string;            // yyyy-mm-dd
  endDate: string;
  targetType: TargetType | null;
  annualTarget: number | null;  // app units: percent 0-100, numbers as-is
  aggregation: TargetAggregation;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  monthly: BreakdownEntry[];
  /** Why the monthly breakdown can't be imported as-is, if it can't. */
  breakdownProblem: string | null;
  /** The sheet's period report for this row (the blue columns), if anything was filled in. */
  report: ImportReport | null;
}
/** A row's report "up to the reporting period", in the activity's target units. */
export interface ImportReport {
  actualToDate: number | null;
  completionDate: string | null; // yyyy-mm-dd
  accomplishedTasks: string;
  reasonForVariation: string;
  wayForward: string;
  escalationIssues: string;
}
export interface ImportInitiative { row: number; code: string; title: string; activities: ImportActivity[] }
export interface ImportObjective { row: number; code: string; statement: string; initiatives: ImportInitiative[] }
export interface ImportPillar { row: number; code: string; title: string; objectives: ImportObjective[] }

export interface ParsedWorkbook {
  sheetNames: string[];
  sheetName: string;
  planTitle: string;
  startYear: number | null;
  endYear: number | null;
  months: string[];
  /** The month ("YYYY-MM") the sheet's report runs up to, read from its "Plan up to the reporting period" formulas; null if it can't be told. */
  reportThroughMonth: string | null;
  pillars: ImportPillar[];
  leadOwners: string[];
  issues: ImportIssue[];
  counts: { pillars: number; objectives: number; initiatives: number; activities: number; duplicates: number; withBreakdown: number; withReport: number };
}

const HEADER_MATCHERS: Record<string, RegExp> = {
  code: /^code$/i,
  pillar: /^pillar$/i,
  objective: /objective$/i,
  initiative: /^initiatives?$/i,
  activity: /major activit/i,
  deliverable: /^deliverables?$/i,
  weight: /^activity weight$/i,
  weightNoDup: /activity weight \(no dup\)/i,
  leadOwner: /lead\s*\/?\s*owner/i,
  collaborators: /responsible|collaborat/i,
  startDate: /^start date$/i,
  endDate: /^end date$/i,
  endDateForYear: /^end date for/i,
  target: /^target/i,
  planToDate: /plan up to the reporting period/i,
  achievement: /^%age achiev'?t$/i,
  actualToDate: /actual up to the reporting period/i,
  completionDate: /^completion date$/i,
  accomplished: /accomplished tasks/i,
  reasonForVariation: /reasons? for variation/i,
  wayForward: /way forward/i,
  escalation: /issues that need escalation/i,
};

const clean = (v: unknown) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function serialToDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
  }
  if (typeof value === 'string' && value.trim()) {
    // Month-year text such as "Sep-30" or "Jul 2026".
    const my = value.trim().match(/^([A-Za-z]{3})[a-z]*[-\s/](\d{2}|\d{4})$/);
    if (my) {
      const monthIndex = MONTHS.indexOf(my[1].toLowerCase());
      if (monthIndex >= 0) return new Date(Date.UTC(my[2].length === 2 ? 2000 + Number(my[2]) : Number(my[2]), monthIndex, 1));
    }
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

const firstOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const lastOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function findHeaderRow(ws: XLSX.WorkSheet, range: XLSX.Range): number {
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 40); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && HEADER_MATCHERS.activity.test(clean(cell.v))) return r;
    }
  }
  return -1;
}

/** Picks the sheet that has a "Major Activities" header, preferring one named like the cascaded plan. */
function pickSheet(wb: XLSX.WorkBook, requested?: string): string | null {
  if (requested && wb.Sheets[requested]) return requested;
  const candidates = wb.SheetNames.filter(name => {
    const ws = wb.Sheets[name];
    if (!ws['!ref']) return false;
    return findHeaderRow(ws, XLSX.utils.decode_range(ws['!ref'])) >= 0;
  });
  return candidates.find(n => /strategic init/i.test(n)) ?? candidates[0] ?? null;
}

export function parseStrategicPlanWorkbook(data: ArrayBuffer | Buffer, requestedSheet?: string): ParsedWorkbook {
  const wb = XLSX.read(data, { type: data instanceof ArrayBuffer ? 'array' : 'buffer', cellFormula: true, cellNF: true, cellDates: false });
  const issues: ImportIssue[] = [];
  const empty: ParsedWorkbook = {
    sheetNames: wb.SheetNames, sheetName: '', planTitle: '', startYear: null, endYear: null, months: [], reportThroughMonth: null, pillars: [], leadOwners: [], issues,
    counts: { pillars: 0, objectives: 0, initiatives: 0, activities: 0, duplicates: 0, withBreakdown: 0, withReport: 0 },
  };

  const sheetName = pickSheet(wb, requestedSheet);
  if (!sheetName) {
    issues.push({ row: null, severity: 'error', message: 'No sheet with a "Major Activities" column was found. Pick the sheet that holds the initiatives and activities.' });
    return empty;
  }
  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref']!);
  const headerRow = findHeaderRow(ws, range);
  if (headerRow < 0) {
    issues.push({ row: null, severity: 'error', message: `Sheet "${sheetName}" has no "Major Activities" header row.` });
    return { ...empty, sheetName };
  }

  const cellAt = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;

  // Map columns by header text (the header can span the header row and the row above it).
  const col: Record<string, number> = {};
  const monthCols: { c: number; month: string }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const text = clean(cellAt(headerRow, c)?.v);
    for (const [key, re] of Object.entries(HEADER_MATCHERS)) {
      if (col[key] == null && text && re.test(text)) col[key] = c;
    }
    // Month columns: the header cell holds a date (Jul-26 … Jun-27).
    const headerCell = cellAt(headerRow, c);
    const asDate = headerCell && typeof headerCell.v === 'number' ? serialToDate(headerCell.v) : null;
    if (asDate && col.target != null && c > col.target && (monthCols.length === 0 || c === monthCols[monthCols.length - 1].c + 1)) {
      monthCols.push({ c, month: monthKey(asDate) });
    }
  }
  // "Target 2026/27" must not be confused with the target-less "End Date for 2026/27".
  for (const required of ['code', 'activity', 'weight', 'leadOwner', 'startDate', 'endDate', 'target'] as const) {
    if (col[required] == null) issues.push({ row: headerRow + 1, severity: 'error', message: `Couldn't find the "${required === 'leadOwner' ? 'Lead/ Owner' : required}" column in the header row.` });
  }
  if (monthCols.length === 0) issues.push({ row: headerRow + 1, severity: 'warning', message: 'No month columns (Jul-26 … Jun-27) found after the Target column — monthly breakdowns will not be imported.' });
  if (issues.some(i => i.severity === 'error')) return { ...empty, sheetName };

  // Plan title: the first text above the header in the Objective column (e.g. "Corporate_Strategic Initiative Action Plan 2026-27").
  let planTitle = '';
  for (let r = headerRow - 1; r >= range.s.r && !planTitle; r--) {
    const text = clean(cellAt(r, col.objective ?? 3)?.v);
    if (text.length > 15) planTitle = text;
  }

  const pillars: ImportPillar[] = [];
  // "Plan up to the reporting period" is =SUM(T9:U9) — the last month column in
  // the range is the month the report runs up to. Counted per row, most common wins.
  const throughVotes = new Map<string, number>();
  const monthByCol = new Map(monthCols.map(m => [m.c, m.month]));
  const seenActivityCodes = new Map<string, ImportActivity>();
  const leadOwners = new Set<string>();
  let minStart: Date | null = null;
  let maxEnd: Date | null = null;

  const numberAt = (r: number, c: number | undefined) => {
    if (c == null) return null;
    const v = cellAt(r, c)?.v;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const isPercentCell = (r: number, c: number | undefined) => c != null && /%/.test(String(cellAt(r, c)?.z ?? ''));

  /** The blue report columns of one row; null when none of them is filled in. */
  const readReport = (r: number, code: string, title: string, targetType: TargetType | null): ImportReport | null => {
    const text = (c: number | undefined) => (c == null ? '' : clean(cellAt(r, c)?.v));
    let actualToDate = numberAt(r, col.actualToDate);
    // An actual is in the target's units: 0.85 against a 100% target is 85%.
    const percent = targetType ? targetType === 'PERCENT' : isPercentCell(r, col.actualToDate);
    if (actualToDate != null && percent) actualToDate = round(actualToDate * 100);
    if (actualToDate != null && actualToDate < 0) {
      issues.push({ row: r + 1, severity: 'warning', message: `Activity ${code} "${title}": the actual is negative — not imported.` });
      actualToDate = null;
    } else if (actualToDate != null && percent && actualToDate > 100) {
      issues.push({ row: r + 1, severity: 'warning', message: `Activity ${code} "${title}": the actual is ${actualToDate}%, over 100% — not imported.` });
      actualToDate = null;
    }
    const completion = col.completionDate != null ? serialToDate(cellAt(r, col.completionDate)?.v) : null;
    const report: ImportReport = {
      actualToDate,
      completionDate: completion && completion.getUTCFullYear() >= 2000 ? isoDate(completion) : null,
      accomplishedTasks: text(col.accomplished),
      reasonForVariation: text(col.reasonForVariation),
      wayForward: text(col.wayForward),
      escalationIssues: text(col.escalation),
    };
    if (report.actualToDate != null) return report;
    // Without an actual there's nothing to approve (the sheet leaves such a row out of its totals too).
    if (report.completionDate || report.accomplishedTasks || report.reasonForVariation || report.wayForward || report.escalationIssues) {
      issues.push({ row: r + 1, severity: 'warning', message: `Activity ${code} "${title}": has report comments but no "Actual up to the reporting period" — its report is not imported.` });
    }
    return null;
  };

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    // Read the code as displayed: "6.10" is stored as the number 6.1.
    const codeCell = cellAt(r, col.code);
    const code = clean(codeCell?.w ?? codeCell?.v);
    if (!code || !/^\d+(\.\d+)*$/.test(code)) {
      // An uncoded row that still has an activity title is an activity with no
      // link to an initiative. Guessing the initiative from its position could
      // file it under the wrong one, so the row must be numbered in the file.
      const looseTitle = clean(cellAt(r, col.activity)?.v);
      if (!looseTitle) continue;
      issues.push({ row: r + 1, severity: 'error', message: `"${looseTitle.slice(0, 60)}" has no code, so it isn't linked to an initiative. Give it its initiative's code (e.g. 1.1.1.4) in the file.` });
      continue;
    }
    const excelRow = r + 1;
    const depth = code.split('.').length;
    const parentCode = code.split('.').slice(0, -1).join('.');

    if (depth === 1) {
      const title = clean(cellAt(r, col.pillar ?? col.code + 1)?.v);
      if (!title) { issues.push({ row: excelRow, severity: 'warning', message: `Pillar ${code} has no title — skipped.` }); continue; }
      pillars.push({ row: excelRow, code, title, objectives: [] });
      continue;
    }

    if (depth === 2) {
      const statement = clean(cellAt(r, col.objective)?.v);
      if (!statement) { issues.push({ row: excelRow, severity: 'warning', message: `Objective ${code} has no statement — skipped.` }); continue; }
      const pillar = pillars.find(p => p.code === parentCode);
      if (!pillar) { issues.push({ row: excelRow, severity: 'error', message: `Objective ${code} is not linked to a pillar: there is no pillar ${parentCode} above it. Fix the code or add the pillar.` }); continue; }
      pillar.objectives.push({ row: excelRow, code, statement, initiatives: [] });
      continue;
    }

    if (depth === 3) {
      const title = clean(cellAt(r, col.initiative)?.v);
      if (!title) { issues.push({ row: excelRow, severity: 'warning', message: `Initiative ${code} has no title — skipped.` }); continue; }
      const objective = pillars.flatMap(p => p.objectives).find(o => o.code === parentCode);
      if (!objective) { issues.push({ row: excelRow, severity: 'error', message: `Initiative ${code} is not linked to an objective: there is no objective ${parentCode} above it. Fix the code or add the objective.` }); continue; }
      objective.initiatives.push({ row: excelRow, code, title, activities: [] });
      continue;
    }

    // Activity row (depth 4+ — anything deeper is treated as an activity of its initiative).
    const initiativeCode = code.split('.').slice(0, 3).join('.');
    const initiative = pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives)).find(i => i.code === initiativeCode);
    const title = clean(cellAt(r, col.activity)?.v);
    if (!title) { issues.push({ row: excelRow, severity: 'warning', message: `Activity ${code} has no title — skipped.` }); continue; }
    if (!initiative) { issues.push({ row: excelRow, severity: 'error', message: `Activity ${code} "${title.slice(0, 60)}" is not linked to an initiative: there is no initiative ${initiativeCode} above it. Fix the code or add the initiative.` }); continue; }

    const leadOwner = clean(cellAt(r, col.leadOwner)?.v);
    if (!leadOwner) issues.push({ row: excelRow, severity: 'error', message: `Activity ${code} "${title}" has no Lead/ Owner.` });
    else leadOwners.add(leadOwner);

    // A date before 2000 is a typo (e.g. "Sep-30" stored as 1930); fall back to "End Date for <year>".
    const plausible = (d: Date | null) => (d && d.getUTCFullYear() >= 2000 ? d : null);
    const start = plausible(serialToDate(cellAt(r, col.startDate)?.v));
    let end = plausible(serialToDate(cellAt(r, col.endDate)?.v));
    if (start && !end && col.endDateForYear != null) {
      end = plausible(serialToDate(cellAt(r, col.endDateForYear)?.v));
      if (end) issues.push({ row: excelRow, severity: 'warning', message: `Activity ${code}: the End Date "${clean(cellAt(r, col.endDate)?.w ?? cellAt(r, col.endDate)?.v)}" isn't a usable date — used the "End Date for the year" (${isoDate(lastOfMonth(end))}) instead.` });
    }
    if (!start || !end) {
      issues.push({ row: excelRow, severity: 'error', message: `Activity ${code} "${title}" needs a valid start and end date.` });
      continue;
    }
    const startDate = firstOfMonth(start);
    let endDate = lastOfMonth(end);
    if (endDate <= startDate) {
      issues.push({ row: excelRow, severity: 'warning', message: `Activity ${code}: end date (${isoDate(endDate)}) is before the start date — end set to the end of the start month.` });
      endDate = lastOfMonth(start);
    }
    if (!minStart || startDate < minStart) minStart = startDate;
    if (!maxEnd || endDate > maxEnd) maxEnd = endDate;

    // Weight: I is the activity weight; a duplicate row has no "No Dup" weight.
    const weightFraction = numberAt(r, col.weight) ?? 0;
    const noDup = col.weightNoDup != null ? numberAt(r, col.weightNoDup) : weightFraction;
    const previous = seenActivityCodes.get(code);
    const isDuplicate = !!previous || (col.weightNoDup != null && (noDup == null || noDup === 0) && weightFraction > 0);

    // Target: a %-formatted cell is a percentage (stored 1 = 100%).
    const rawTarget = numberAt(r, col.target);
    const targetType: TargetType | null = rawTarget == null ? null : isPercentCell(r, col.target) ? 'PERCENT' : 'NUMBER';
    const scale = targetType === 'PERCENT' ? 100 : 1;
    const annualTarget = rawTarget != null ? round(rawTarget * scale) : null;

    const monthly: BreakdownEntry[] = [];
    for (const { c, month } of monthCols) {
      const v = numberAt(r, c);
      if (v != null && v !== 0) monthly.push({ month, value: round(v * scale) });
    }

    // How the months count and which way is better come from the sheet's own
    // formulas: "Plan up to the period" =MAX(...) means a level held every
    // month, and "%age Achiev't" =Plan/Actual means lower is better. A
    // duplicate row copies its first row; a row with no formula is judged by
    // its numbers (months that each equal the target, rather than add up to it).
    const planFormula = col.planToDate != null ? String(cellAt(r, col.planToDate)?.f ?? '') : '';
    const rangeEnd = planFormula.match(/(?:SUM|MAX)\(\s*\$?[A-Z]+\$?\d+\s*:\s*\$?([A-Z]+)\$?\d+\s*\)/i);
    const throughMonth = rangeEnd ? monthByCol.get(XLSX.utils.decode_col(rangeEnd[1].toUpperCase())) : undefined;
    if (throughMonth) throughVotes.set(throughMonth, (throughVotes.get(throughMonth) ?? 0) + 1);
    const achievementFormula = col.achievement != null ? String(cellAt(r, col.achievement)?.f ?? '') : '';
    const planCol = col.planToDate != null ? XLSX.utils.encode_col(col.planToDate) : '';
    let aggregation: TargetAggregation;
    let direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
    if (previous) {
      aggregation = previous.aggregation;
      direction = previous.direction;
    } else {
      if (/MAX\(/i.test(planFormula)) aggregation = 'RECURRING';
      else if (/SUM\(/i.test(planFormula)) aggregation = 'CUMULATIVE';
      else {
        const total = monthly.reduce((s, m) => s + m.value, 0);
        const looksLikeLevels = annualTarget != null && monthly.length > 1 && Math.abs(total - annualTarget) > 1e-6
          && monthly.every(m => m.value <= annualTarget * 1.5);
        aggregation = looksLikeLevels ? 'RECURRING' : 'CUMULATIVE';
      }
      // Plan ÷ Actual anywhere in the formula (=AG32/AH32, or wrapped in an IF) means lower is better.
      direction = planCol && new RegExp(`\\b${planCol}\\d+\\s*\\/`).test(achievementFormula) ? 'LOWER_IS_BETTER' : 'HIGHER_IS_BETTER';
    }

    let breakdownProblem: string | null = null;
    if (targetType == null || annualTarget == null || annualTarget <= 0) breakdownProblem = 'no target';
    else if (monthly.length === 0) breakdownProblem = 'no monthly values';
    else {
      const check = validateBreakdown({ targetType, aggregation, annualTarget, entries: monthly, startDate, endDate });
      if (!check.valid) breakdownProblem = check.formErrors[0] ?? Object.values(check.rowErrors)[0] ?? 'invalid breakdown';
    }
    if (breakdownProblem && breakdownProblem !== 'no monthly values') {
      issues.push({ row: excelRow, severity: 'warning', message: `Activity ${code} "${title}": breakdown not imported (${breakdownProblem}). The owner can fill it in after a breakdown request.` });
    }

    const activity: ImportActivity = {
      row: excelRow,
      code,
      title,
      deliverable: clean(cellAt(r, col.deliverable)?.v),
      weight: isDuplicate ? round(weightFraction * 100) : round((noDup ?? weightFraction) * 100),
      countsTowardWeight: !isDuplicate,
      duplicateOfCode: isDuplicate ? code : null,
      leadOwner,
      collaborators: clean(cellAt(r, col.collaborators)?.v),
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
      targetType,
      annualTarget,
      aggregation,
      direction,
      monthly,
      breakdownProblem,
      report: readReport(r, code, title, targetType),
    };
    if (activity.report && breakdownProblem) {
      issues.push({ row: excelRow, severity: 'warning', message: `Activity ${code} "${title}": its report (actual ${activity.report.actualToDate}) is not imported — there's no imported breakdown to measure it against (${breakdownProblem}).` });
    }
    if (!previous) seenActivityCodes.set(code, activity);
    initiative.activities.push(activity);
  }

  // Drop empty branches, reporting each.
  for (const p of pillars) {
    for (const o of p.objectives) {
      const before = o.initiatives.length;
      o.initiatives = o.initiatives.filter(i => i.activities.length > 0);
      if (o.initiatives.length < before) issues.push({ row: o.row, severity: 'warning', message: `${before - o.initiatives.length} initiative(s) under objective ${o.code} have no activities and were left out.` });
    }
    const before = p.objectives.length;
    p.objectives = p.objectives.filter(o => o.initiatives.length > 0);
    if (p.objectives.length < before) issues.push({ row: p.row, severity: 'warning', message: `${before - p.objectives.length} objective(s) under pillar ${p.code} have nothing under them and were left out.` });
  }
  const keptPillars = pillars.filter(p => p.objectives.length > 0);
  if (keptPillars.length === 0) issues.push({ row: null, severity: 'error', message: 'No activities were found under any pillar → objective → initiative in this sheet.' });

  const activities = keptPillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities)));
  return {
    sheetNames: wb.SheetNames,
    sheetName,
    planTitle,
    startYear: minStart ? minStart.getUTCFullYear() : null,
    endYear: maxEnd ? maxEnd.getUTCFullYear() : null,
    months: monthCols.map(m => m.month),
    reportThroughMonth: Array.from(throughVotes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    pillars: keptPillars,
    leadOwners: Array.from(leadOwners).sort((a, b) => a.localeCompare(b)),
    issues,
    counts: {
      pillars: keptPillars.length,
      objectives: keptPillars.reduce((n, p) => n + p.objectives.length, 0),
      initiatives: keptPillars.reduce((n, p) => n + p.objectives.reduce((m, o) => m + o.initiatives.length, 0), 0),
      activities: activities.length,
      duplicates: activities.filter(a => !a.countsTowardWeight).length,
      withBreakdown: activities.filter(a => !a.breakdownProblem).length,
      withReport: activities.filter(a => a.report).length,
    },
  };
}

function round(n: number) {
  return Math.round(n * 1e9) / 1e9;
}
