import * as XLSX from 'xlsx';

/**
 * Download templates for the two Excel imports: just the header row the
 * importer reads and a couple of example rows to overwrite.
 */

type Cell = XLSX.CellObject;
const s = (v: string): Cell => ({ t: 's', v });
const n = (v: number, z?: string): Cell => ({ t: 'n', v, ...(z ? { z } : {}) });
const serial = (y: number, m: number, d = 1) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
const month = (y: number, m: number) => n(serial(y, m), 'mmm-yy');

function toBuffer(rows: (Cell | null)[][], widths: number[], sheetName: string): Buffer {
  const ws: XLSX.WorkSheet = {};
  rows.forEach((row, r) => row.forEach((cell, c) => { if (cell) ws[XLSX.utils.encode_cell({ r, c })] = cell; }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: widths.length - 1 } });
  ws['!cols'] = widths.map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * The plan template for fiscal year `year` (Jul–Jun): a pillar, objective
 * and initiative row, and two example activities — a percentage target and
 * a number target, each with its monthly plan.
 */
export function buildPlanTemplate(year: number): Buffer {
  const y = year, ny = year + 1;
  const months = Array.from({ length: 12 }, (_, i) => (i < 6 ? [y, i + 7] : [ny, i - 5]));
  const header = ['Code', 'Pillar', 'Objective', 'Initiatives', 'Major Activities', 'Deliverables', 'Activity Weight', 'Lead/ Owner (Activity)', 'Start Date', 'End Date', 'Target'].map(s);
  const blank = (count: number) => Array<Cell | null>(count).fill(null);
  const monthValues = (values: Record<string, number>, z?: string) => months.map(([yy, mm]) => {
    const v = values[`${yy}-${mm}`];
    return v == null ? null : n(v, z);
  });

  const rows: (Cell | null)[][] = [
    [...header, ...months.map(([yy, mm]) => month(yy, mm))],
    [s('1'), s('Pillar 1: Profitable Growth (30%)'), ...blank(9 + 12)],
    [s('1.1'), null, s('Objective 1: Enhance profitable growth'), ...blank(8 + 12)],
    [s('1.1.1'), null, null, s('Enhance resource mobilization'), ...blank(7 + 12)],
    [s('1.1.1.1'), null, null, null, s('Segment customers by the segmentation guideline'), s('Segmented customer list'),
      n(0.0081, '0.00%'), s('Chief Wholesale Banking Officer'), month(y, 7), month(y, 9), n(1, '0%'),
      ...monthValues({ [`${y}-8`]: 0.4, [`${y}-9`]: 0.6 }, '0%')],
    [s('1.1.1.2'), null, null, null, s('Open new branches'), s('Branches opened'),
      n(0.005, '0.00%'), s('Chief Retail Banking Officer'), month(y, 7), month(ny, 6), n(10),
      ...monthValues({ [`${y}-9`]: 3, [`${y}-12`]: 3, [`${ny}-3`]: 4 })],
  ];
  return toBuffer(rows, [9, 28, 32, 30, 45, 28, 10, 30, 10, 10, 8, ...months.map(() => 8)], 'Strategic Plan');
}

/** The report template: the columns a period report needs and two example rows. */
export function buildReportTemplate(): Buffer {
  const rows: (Cell | null)[][] = [
    ['Code', 'Major Activities', 'Lead/ Owner (Activity)', 'Actual up to the reporting period', 'Completion Date',
      'Accomplished Tasks & Key achievements', 'Reasons for Variation', 'the way forward', 'Issues that need Escalation'].map(s),
    [s('1.1.1.1'), s('Segment customers by the segmentation guideline'), s('Chief Wholesale Banking Officer'), n(0.85, '0%'), null,
      s('Corporate customers segmented'), s('Retail customer data still being cleaned'), s('Finish the retail segment next month'), null],
    [s('1.1.1.2'), s('Open new branches'), s('Chief Retail Banking Officer'), n(3), n(serial(2026, 9, 30), 'dd-mmm-yy'),
      s('3 branches opened'), null, null, null],
  ];
  return toBuffer(rows, [9, 45, 30, 14, 14, 40, 35, 30, 30], 'Report');
}
