import * as XLSX from 'xlsx';
import { monthKey, type TargetType } from '@/lib/monthly-breakdown';
import type { ImportIssue, ImportReport } from './parse-workbook';

/**
 * Reads a period report from a workbook: one row per activity with its
 * actual and comments. Needs only the activity title, lead owner and actual
 * columns, so both the short report template and the full cascaded plan
 * sheet (whose other columns are ignored) can be imported.
 */

export interface ReportSheetRow {
  row: number;
  code: string;
  title: string;
  leadOwner: string;
  /** The actual as entered; turned into the activity's units by actualInTargetUnits. */
  actualRaw: number | null;
  actualIsPercentCell: boolean;
  /** What the Actual cell held when it couldn't be read as a number ("N/A", "-", "#REF!"); empty when blank or numeric. */
  actualText: string;
  completionDate: string | null; // yyyy-mm-dd
  accomplishedTasks: string;
  reasonForVariation: string;
  wayForward: string;
  escalationIssues: string;
  /** A numeric actual was read. Rows without one are still listed in the preview with the reason they're skipped. */
  hasReport: boolean;
}

export interface ParsedReport {
  sheetName: string;
  /** The month ("YYYY-MM") the report runs up to, when the sheet's "Plan up to the reporting period" formulas show it; null otherwise. */
  throughMonth: string | null;
  rows: ReportSheetRow[];
  issues: ImportIssue[];
}

const HEADERS = {
  code: /^code$/i,
  activity: /major activit|^activit(y|ies)$/i,
  leadOwner: /lead\s*\/?\s*owner/i,
  actual: /actual up to the reporting period|^actual$/i,
  completionDate: /^completion date$/i,
  accomplished: /accomplished tasks/i,
  reasonForVariation: /reasons? for variation/i,
  wayForward: /way forward/i,
  escalation: /issues that need escalation/i,
  planToDate: /plan up to the reporting period/i,
};

const clean = (v: unknown) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
const serialToDate = (v: unknown) => (typeof v === 'number' && v > 20000 && v < 80000 ? new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000) : null);

/** Text that is only a number ("1,200", " 85 % ", "0.5"), as typed into a cell formatted as text. */
const NUMERIC_TEXT = /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?\s*%?$/;

/**
 * The Actual cell as a number. Numbers stored as text are read too, so a
 * text-formatted column doesn't drop its rows; anything else that isn't
 * blank comes back as `text` so the preview can say why the row is skipped.
 */
function readActual(cell: XLSX.CellObject | undefined): { value: number | null; isPercent: boolean; text: string } {
  if (!cell || cell.v == null) return { value: null, isPercent: false, text: '' };
  if (cell.t === 'e') return { value: null, isPercent: false, text: String(cell.w ?? '#ERROR') };
  if (typeof cell.v === 'number') {
    return Number.isFinite(cell.v)
      ? { value: cell.v, isPercent: /%/.test(String(cell.z ?? '')), text: '' }
      : { value: null, isPercent: false, text: String(cell.v) };
  }
  const raw = clean(cell.v);
  if (!raw) return { value: null, isPercent: false, text: '' };
  if (NUMERIC_TEXT.test(raw) && /\d/.test(raw)) {
    const isPercent = raw.endsWith('%');
    const n = Number(raw.replace(/[,%\s]/g, ''));
    if (Number.isFinite(n)) return { value: isPercent ? n / 100 : n, isPercent, text: '' };
  }
  return { value: null, isPercent: false, text: raw };
}

/** The actual in the activity's units: a percentage target keeps 85 for 85%, whether typed as 85%, 0.85 or 85. */
export function actualInTargetUnits(row: Pick<ReportSheetRow, 'actualRaw' | 'actualIsPercentCell'>, targetType: TargetType | null): number | null {
  if (row.actualRaw == null) return null;
  if (targetType !== 'PERCENT') return row.actualRaw;
  const scaled = row.actualIsPercentCell || row.actualRaw <= 1 ? row.actualRaw * 100 : row.actualRaw;
  return Math.round(scaled * 1e9) / 1e9;
}

export function toImportReport(row: ReportSheetRow, actualToDate: number | null): ImportReport {
  return {
    actualToDate,
    completionDate: row.completionDate,
    accomplishedTasks: row.accomplishedTasks,
    reasonForVariation: row.reasonForVariation,
    wayForward: row.wayForward,
    escalationIssues: row.escalationIssues,
  };
}

function findHeader(ws: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 40); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (HEADERS.activity.test(clean(ws[XLSX.utils.encode_cell({ r, c })]?.v))) return r;
    }
  }
  return -1;
}

export function parseReportWorkbook(data: Buffer): ParsedReport {
  const wb = XLSX.read(data, { type: 'buffer', cellFormula: true, cellNF: true, cellDates: false });
  const issues: ImportIssue[] = [];
  // The sheet with an activity column and an actual column, preferring the cascaded plan sheet.
  const candidates = wb.SheetNames.filter(name => {
    const ws = wb.Sheets[name];
    if (!ws['!ref']) return false;
    const header = findHeader(ws);
    if (header < 0) return false;
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let c = range.s.c; c <= range.e.c; c++) if (HEADERS.actual.test(clean(ws[XLSX.utils.encode_cell({ r: header, c })]?.v))) return true;
    return false;
  });
  const sheetName = candidates.find(n => /strategic init/i.test(n)) ?? candidates[0];
  if (!sheetName) {
    issues.push({ row: null, severity: 'error', message: 'No sheet has the report columns. The header row needs "Major Activities", "Lead/ Owner (Activity)" and "Actual up to the reporting period" — download the template to see the layout.' });
    return { sheetName: '', throughMonth: null, rows: [], issues };
  }

  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref']!);
  const header = findHeader(ws);
  const cellAt = (r: number, c: number | undefined) => (c == null ? undefined : ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined);

  const col: Partial<Record<keyof typeof HEADERS, number>> = {};
  const monthByCol = new Map<number, string>();
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = cellAt(header, c);
    const text = clean(cell?.v);
    for (const [key, re] of Object.entries(HEADERS) as [keyof typeof HEADERS, RegExp][]) {
      if (col[key] == null && text && re.test(text)) col[key] = c;
    }
    const asDate = serialToDate(cell?.v);
    if (asDate) monthByCol.set(c, monthKey(asDate));
  }
  if (col.leadOwner == null) issues.push({ row: header + 1, severity: 'error', message: 'Couldn\'t find the "Lead/ Owner (Activity)" column — rows are matched to activities by title and lead owner.' });
  if (issues.length > 0) return { sheetName, throughMonth: null, rows: [], issues };

  const rows: ReportSheetRow[] = [];
  const throughVotes = new Map<string, number>();
  for (let r = header + 1; r <= range.e.r; r++) {
    const title = clean(cellAt(r, col.activity)?.v);
    if (!title) continue;
    const excelRow = r + 1;
    const code = clean(cellAt(r, col.code)?.w ?? cellAt(r, col.code)?.v);
    const leadOwner = clean(cellAt(r, col.leadOwner)?.v);
    const actual = readActual(cellAt(r, col.actual));
    const text = (c: number | undefined) => clean(cellAt(r, c)?.v);
    const completion = serialToDate(cellAt(r, col.completionDate)?.v);

    const planFormula = String(cellAt(r, col.planToDate)?.f ?? '');
    const rangeEnd = planFormula.match(/(?:SUM|MAX)\(\s*\$?[A-Z]+\$?\d+\s*:\s*\$?([A-Z]+)\$?\d+\s*\)/i);
    const month = rangeEnd ? monthByCol.get(XLSX.utils.decode_col(rangeEnd[1].toUpperCase())) : undefined;
    if (month) throughVotes.set(month, (throughVotes.get(month) ?? 0) + 1);

    const row: ReportSheetRow = {
      row: excelRow,
      code,
      title,
      leadOwner,
      actualRaw: actual.value,
      actualIsPercentCell: actual.isPercent,
      actualText: actual.text,
      completionDate: completion && completion.getUTCFullYear() >= 2000 ? completion.toISOString().slice(0, 10) : null,
      accomplishedTasks: text(col.accomplished),
      reasonForVariation: text(col.reasonForVariation),
      wayForward: text(col.wayForward),
      escalationIssues: text(col.escalation),
      hasReport: actual.value != null,
    };
    // Rows that can't be imported (no actual, unreadable actual, no lead owner) are kept: the preview lists each with its reason.
    rows.push(row);
  }
  if (rows.length === 0) issues.push({ row: null, severity: 'error', message: `Sheet "${sheetName}" has no activity rows under its header — there is nothing to import.` });
  else if (!rows.some(r => r.hasReport)) issues.push({ row: null, severity: 'error', message: `None of the ${rows.length} activity rows has a number in "Actual up to the reporting period" — there is nothing to import.` });

  return {
    sheetName,
    throughMonth: Array.from(throughVotes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    rows,
    issues,
  };
}
