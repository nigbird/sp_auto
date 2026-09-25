import * as XLSX from 'xlsx';
import { monthKey, monthsBetween, plannedFinishDate, type TargetAggregation, type TargetType } from '@/lib/monthly-breakdown';
import { computeReportRow, rollUp, type ReportRow } from '@/lib/report-calculations';

/**
 * Builds the strategic plan as a workbook laid out like the cascaded
 * initiatives sheet (Code, Pillar … Target, one column per month), followed
 * by the period report columns. Calculated columns are real Excel formulas
 * (with their values cached), so the file stays live when edited — and
 * because the headers and formulas match what the importer reads, an
 * exported plan can be imported again.
 */

export interface ExportActivity {
  id: string;
  title: string;
  deliverable: string | null;
  description: string | null;
  department: string;
  responsible: { name: string } | null;
  startDate: Date | string;
  endDate: Date | string;
  weight: number;
  countsTowardWeight: boolean;
  targetType: string | null;
  annualTarget: number | null;
  targetAggregation: string;
  targetDirection: string;
  planSubmissionStatus: string | null;
  monthlyTargets: { month: Date | string; value: number }[];
}
export interface ExportPlan {
  name: string;
  version: string;
  startYear: number;
  endYear: number;
  status: string;
  pillars: { id: string; title: string; objectives: { id: string; statement: string; initiatives: { id: string; title: string; activities: ExportActivity[] }[] }[] }[];
}
export interface ExportPeriod { name: string; startDate: Date | string; endDate: Date | string }
export interface ExportEntry {
  activityId: string;
  reportStatus: string;
  actualToDate: number | null;
  completionDate: Date | string | null;
  comment: string | null;
  reasonForVariation: string | null;
  wayForward: string | null;
  escalationIssues: string | null;
}

type Cell = XLSX.CellObject;
const PCT = '0%';
const PCT2 = '0.00%';
const DATE = 'mmm-yy';
const DAY = 'dd-mmm-yy';

const excelSerial = (d: Date | string) => {
  const date = new Date(d);
  return Math.round((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86400000);
};
const monthSerial = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, 1) - Date.UTC(1899, 11, 30)) / 86400000);
};

const str = (v: string | null | undefined): Cell => ({ t: 's', v: v ?? '' });
const num = (v: number | null | undefined, z?: string, f?: string): Cell | undefined =>
  v == null || !Number.isFinite(v) ? (f ? { t: 's', v: '', f } : undefined) : { t: 'n', v, ...(z ? { z } : {}), ...(f ? { f } : {}) };
const text = (v: string, f?: string): Cell => ({ t: 's', v, ...(f ? { f } : {}) });

export function buildPlanWorkbook(plan: ExportPlan, period: ExportPeriod | null, entries: ExportEntry[]): Buffer {
  const entryByActivity = new Map(entries.map(e => [e.activityId, e]));
  const activities = plan.pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities)));

  // Month columns: every month any breakdown uses (at most three years), or the plan's first year.
  const usedMonths = activities.flatMap(a => a.monthlyTargets.map(t => monthKey(t.month))).sort();
  let months = usedMonths.length
    ? monthsBetween(`${usedMonths[0]}-01T00:00:00Z`, `${usedMonths[usedMonths.length - 1]}-01T00:00:00Z`)
    : monthsBetween(new Date(Date.UTC(plan.startYear, 6, 1)), new Date(Date.UTC(plan.startYear + 1, 5, 1)));
  months = months.slice(0, 36);
  const periodMonth = period ? monthKey(period.endDate) : months[months.length - 1];

  // Column layout — header texts match what the importer looks for.
  const fixed = ['S/N', 'Code', 'Pillar', 'Objective', 'Initiatives', 'Major Activities', 'Deliverables', 'Activity Weight', 'Activity Weight (No Dup)',
    'Lead/ Owner (Activity)', 'Responsible / Collaborating Unit', 'Assigned Person', 'Start Date', 'End Date', 'End Date for the Year', 'Target'];
  const report = ['Plan up to the reporting period', 'Actual up to the reporting period', "%age Achiev't", 'Completion Date', 'Date Delayed', "%age Achiev't with delayance",
    'Accomplished Tasks & Key achievements (Outputs) for the Reporting period', 'Reasons for Variation', 'the way forward', 'Issues that need Escalation',
    'Weighted Plan for the period', 'Weighted Actual', 'Weighted Actual with Delay', 'Weighted Actual (No DUP)', 'Achieved Result', "Achiev't with Delay", 'Activity Status', 'Report Status'];
  const firstMonthCol = fixed.length;
  const firstReportCol = firstMonthCol + months.length;
  const C: Record<string, string> = {};
  fixed.forEach((h, i) => (C[h] = XLSX.utils.encode_col(i)));
  report.forEach((h, i) => (C[h] = XLSX.utils.encode_col(firstReportCol + i)));
  const col = (name: string) => C[name];
  const monthColOf = (key: string) => {
    const index = months.indexOf(key);
    return index >= 0 ? XLSX.utils.encode_col(firstMonthCol + index) : null;
  };
  const lastPlannedCol = (() => {
    const upTo = months.filter(m => m <= periodMonth);
    return upTo.length ? XLSX.utils.encode_col(firstMonthCol + upTo.length - 1) : null;
  })();

  const ws: XLSX.WorkSheet = {};
  const put = (r: number, c: number | string, cell: Cell | undefined) => {
    if (!cell) return;
    const cIndex = typeof c === 'number' ? c : XLSX.utils.decode_col(c);
    ws[XLSX.utils.encode_cell({ r, c: cIndex })] = cell;
  };

  // Title rows (the importer takes the plan name from the Objective column above the header).
  put(0, 3, str(`${plan.name} — v${plan.version} (${plan.startYear}-${plan.endYear})`));
  put(1, 5, str(`${period ? `Report for ${period.name}` : "No reporting period selected"} · exported ${new Date().toISOString().slice(0, 10)} · status ${plan.status}`));

  const HEADER = 3; // Excel row 4
  fixed.forEach((h, i) => put(HEADER, i, str(h)));
  months.forEach((m, i) => put(HEADER, firstMonthCol + i, { t: 'n', v: monthSerial(m), z: DATE }));
  report.forEach((h, i) => put(HEADER, firstReportCol + i, str(h)));

  let r = HEADER + 1;
  let serialNo = 0;
  const rowsForRollup: { pillar: string; objective: string; initiative: string; row: ReportRow | null; weight: number; countsTowardWeight: boolean }[] = [];
  const initiativeRanges: { row: number; from: number; to: number }[] = [];

  plan.pillars.forEach((pillar, pIndex) => {
    const pCode = `${pIndex + 1}`;
    put(r, 'B', str(pCode)); put(r, 'C', str(pillar.title)); r++;
    pillar.objectives.forEach((objective, oIndex) => {
      const oCode = `${pCode}.${oIndex + 1}`;
      put(r, 'B', str(oCode)); put(r, 'D', str(objective.statement)); r++;
      objective.initiatives.forEach((initiative, iIndex) => {
        const iCode = `${oCode}.${iIndex + 1}`;
        const initiativeRow = r;
        put(r, 'B', str(iCode)); put(r, 'E', str(initiative.title)); r++;

        // Shared activities (same work, several leads) keep one code, like the sheet.
        const codeByGroup = new Map<string, string>();
        let aNo = 0;
        const first = r;
        for (const a of initiative.activities) {
          const n = r + 1; // Excel row number
          const groupKey = `${a.title}|${a.deliverable ?? ''}`;
          let aCode = codeByGroup.get(groupKey);
          if (!aCode || a.countsTowardWeight) {
            aCode = `${iCode}.${++aNo}`;
            codeByGroup.set(groupKey, aCode);
          }
          const type = (a.targetType as TargetType | null) ?? null;
          const scale = type === 'PERCENT' ? 100 : 1;
          const fmt = type === 'PERCENT' ? PCT : undefined;
          const agg = (a.targetAggregation as TargetAggregation) ?? 'CUMULATIVE';
          const lowerIsBetter = a.targetDirection === 'LOWER_IS_BETTER';
          const breakdown = a.monthlyTargets.map(t => ({ month: monthKey(t.month), value: t.value }));
          const finish = plannedFinishDate(breakdown) ?? new Date(a.endDate);
          const entry = entryByActivity.get(a.id);
          const approved = entry?.reportStatus === 'APPROVED';
          const row = period && a.annualTarget != null
            ? computeReportRow(
                { weight: a.weight, countsTowardWeight: a.countsTowardWeight, targetType: type, annualTarget: a.annualTarget, targetAggregation: agg, targetDirection: a.targetDirection as 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER', monthlyTargets: breakdown },
                { actualToDate: approved ? entry!.actualToDate : null, completionDate: approved ? entry!.completionDate : null },
                period.endDate
              )
            : null;
          rowsForRollup.push({ pillar: pillar.title, objective: objective.statement, initiative: initiative.title, row, weight: a.weight, countsTowardWeight: a.countsTowardWeight });

          put(r, 'A', { t: 'n', v: ++serialNo });
          put(r, 'B', str(aCode));
          put(r, 'F', str(a.title));
          put(r, 'G', str(a.deliverable));
          put(r, col('Activity Weight'), num(a.weight / 100, PCT2));
          put(r, col('Activity Weight (No Dup)'), a.countsTowardWeight ? num(a.weight / 100, PCT2) : undefined);
          put(r, col('Lead/ Owner (Activity)'), str(a.department));
          put(r, col('Responsible / Collaborating Unit'), str((a.description ?? '').replace(/^Responsible \/ collaborating unit:\s*/i, '')));
          put(r, col('Assigned Person'), str(a.responsible?.name));
          put(r, col('Start Date'), { t: 'n', v: excelSerial(a.startDate), z: DATE });
          put(r, col('End Date'), { t: 'n', v: excelSerial(a.endDate), z: DATE });
          put(r, col('End Date for the Year'), { t: 'n', v: excelSerial(finish), z: DATE });
          put(r, col('Target'), num(a.annualTarget != null ? a.annualTarget / scale : null, fmt));
          for (const m of breakdown) {
            const mc = monthColOf(m.month);
            if (mc) put(r, mc, num(m.value / scale, fmt));
          }

          // Report columns: formulas mirror the sheet (AG =SUM/MAX of months so far, AI = AH/AG or AG/AH …).
          const AG = `${col('Plan up to the reporting period')}${n}`;
          const AH = `${col('Actual up to the reporting period')}${n}`;
          const AI = `${col("%age Achiev't")}${n}`;
          const AJ = `${col('Completion Date')}${n}`;
          const AK = `${col('Date Delayed')}${n}`;
          const AL = `${col("%age Achiev't with delayance")}${n}`;
          const AQ = `${col('Weighted Plan for the period')}${n}`;
          const AR = `${col('Weighted Actual')}${n}`;
          const AS = `${col('Weighted Actual with Delay')}${n}`;
          const AU = `${col('Achieved Result')}${n}`;
          const I = `${col('Activity Weight')}${n}`;
          const K = `${col('Activity Weight (No Dup)')}${n}`;
          const R = `${col('End Date for the Year')}${n}`;
          const S = `${col('Target')}${n}`;
          const firstMonth = XLSX.utils.encode_col(firstMonthCol);

          const planValue = row ? row.planToDate / scale : null;
          put(r, col('Plan up to the reporting period'), lastPlannedCol
            ? { t: 'n', v: planValue ?? 0, f: `${agg === 'RECURRING' ? 'MAX' : 'SUM'}(${firstMonth}${n}:${lastPlannedCol}${n})`, ...(fmt ? { z: fmt } : {}) }
            : num(0, fmt));
          put(r, col('Actual up to the reporting period'), approved && entry!.actualToDate != null ? num(entry!.actualToDate / scale, fmt) : undefined);
          put(r, col("%age Achiev't"), num(row?.achievement ?? null, PCT, lowerIsBetter ? `IF(OR(${AH}="",${AH}=0),"",${AG}/${AH})` : `IF(OR(${AH}="",${AG}=0),"",${AH}/${AG})`));
          put(r, col('Completion Date'), approved && entry!.completionDate ? { t: 'n', v: excelSerial(entry!.completionDate), z: DAY } : undefined);
          put(r, col('Date Delayed'), num(row?.daysDelayed ?? null, '0', `IF(${AJ}="","",${AJ}-${R})`));
          put(r, col("%age Achiev't with delayance"), num(row?.achievementWithDelay ?? null, PCT, `IF(${AI}="","",IF(OR(${AK}="",${AK}<=30),${AI},IF(${AK}<=60,${AI}*0.9,IF(${AK}<=90,${AI}*0.8,${AI}*0.5))))`));
          if (approved) {
            put(r, col('Accomplished Tasks & Key achievements (Outputs) for the Reporting period'), str(entry!.comment));
            put(r, col('Reasons for Variation'), str(entry!.reasonForVariation));
            put(r, col('the way forward'), str(entry!.wayForward));
            put(r, col('Issues that need Escalation'), str(entry!.escalationIssues));
          }
          put(r, col('Weighted Plan for the period'), num(row?.weightedPlan != null ? row.weightedPlan / 100 : null, PCT2, `IF(AND(N(${AG})>0,N(${S})>0),${I}*${AG}/${S},"")`));
          put(r, col('Weighted Actual'), num(row?.weightedActual != null ? row.weightedActual / 100 : null, PCT2, `IF(OR(${AI}="",${AQ}=""),"",IF(${AI}>=1,${AQ},${AQ}*${AI}))`));
          put(r, col('Weighted Actual with Delay'), num(row?.weightedActualWithDelay != null ? row.weightedActualWithDelay / 100 : null, PCT2, `IF(OR(${AL}="",${AQ}=""),"",IF(${AL}>=1,${AQ},${AQ}*${AL}))`));
          put(r, col('Weighted Actual (No DUP)'), num(row?.weightedActualNoDup != null ? row.weightedActualNoDup / 100 : null, PCT2, `IF(OR(${AI}="",N(${K})=0,N(${S})=0),"",IF(${AI}>=1,${K}*${AG}/${S},${K}*${AG}/${S}*${AI}))`));
          put(r, col('Achieved Result'), num(row && row.weightedActual != null ? row.achievedResult : null, PCT, `IF(OR(${AR}="",N(${AQ})=0),"",${AR}/${AQ})`));
          put(r, col("Achiev't with Delay"), num(row && row.weightedActualWithDelay != null ? row.achievedWithDelay : null, PCT, `IF(OR(${AS}="",N(${AQ})=0),"",${AS}/${AQ})`));
          put(r, col('Activity Status'), text(row && approved ? row.status : '', `IF(${AU}="","",IF(${AU}>=1,"Completed As Per The Target",IF(${AU}>0.7499,"In Good Progress",IF(${AU}>0.0001,"Not In Good Progress","Not Started"))))`));
          put(r, col('Report Status'), str(!period ? '' : entry ? REPORT_STATUS_TEXT[entry.reportStatus] ?? entry.reportStatus : 'Not requested'));
          r++;
        }
        initiativeRanges.push({ row: initiativeRow, from: first + 1, to: r });
      });
    });
  });
  const lastRow = r;

  // Initiative rows carry the (IV) totals; the top row carries the plan totals.
  const sumCols = ['Weighted Plan for the period', 'Weighted Actual', 'Weighted Actual with Delay', 'Weighted Actual (No DUP)'] as const;
  for (const { row, from, to } of initiativeRanges) {
    for (const name of sumCols) put(row, col(name), { t: 'n', v: 0, z: PCT2, f: `SUM(${col(name)}${from}:${col(name)}${to})` });
    put(row, col('Achieved Result'), { t: 's', v: '', z: PCT, f: `IF(N(${col('Weighted Plan for the period')}${row + 1})=0,"",${col('Weighted Actual')}${row + 1}/${col('Weighted Plan for the period')}${row + 1})` });
  }
  const totals = rollUp(rowsForRollup.map(x => x.row).filter((x): x is ReportRow => x !== null));
  put(2, col('Activity Weight'), { t: 'n', v: activities.reduce((s, a) => s + a.weight, 0) / 100, z: PCT2, f: `SUM(${col('Activity Weight')}${HEADER + 2}:${col('Activity Weight')}${lastRow})` });
  put(2, col('Activity Weight (No Dup)'), { t: 'n', v: activities.filter(a => a.countsTowardWeight).reduce((s, a) => s + a.weight, 0) / 100, z: PCT2, f: `SUM(${col('Activity Weight (No Dup)')}${HEADER + 2}:${col('Activity Weight (No Dup)')}${lastRow})` });
  const totalValue: Record<string, number> = {
    'Weighted Plan for the period': totals.weightedPlan / 100,
    'Weighted Actual': totals.weightedActual / 100,
    'Weighted Actual with Delay': totals.weightedActualWithDelay / 100,
    'Weighted Actual (No DUP)': totals.weightedActualNoDup / 100,
  };
  for (const name of sumCols) {
    // Activity rows only (initiative subtotal rows are left out of the grand total).
    put(2, col(name), { t: 'n', v: totalValue[name], z: PCT2, f: `SUMIF(${col('Activity Weight')}${HEADER + 2}:${col('Activity Weight')}${lastRow},"<>",${col(name)}${HEADER + 2}:${col(name)}${lastRow})` });
  }
  put(2, col('Achieved Result'), num(totals.achievedResult, PCT));
  put(2, col('Activity Status'), str(totals.weightedPlan > 0 ? totals.status : ''));
  put(2, 'C', str('Totals →'));

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(lastRow, HEADER + 1), c: firstReportCol + report.length - 1 } });
  ws['!cols'] = [
    { wch: 5 }, { wch: 11 }, { wch: 28 }, { wch: 30 }, { wch: 30 }, { wch: 45 }, { wch: 35 }, { wch: 9 }, { wch: 9 },
    { wch: 28 }, { wch: 30 }, { wch: 20 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 },
    ...months.map(() => ({ wch: 8 })),
    { wch: 11 }, { wch: 11 }, { wch: 9 }, { wch: 11 }, { wch: 9 }, { wch: 11 }, { wch: 45 }, { wch: 35 }, { wch: 30 }, { wch: 30 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 16 },
  ];
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: HEADER, c: 0 }, e: { r: lastRow - 1, c: firstReportCol + report.length - 1 } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Strategic Plan');
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(plan, period, rowsForRollup), 'Summary');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const REPORT_STATUS_TEXT: Record<string, string> = {
  NOT_REQUESTED: 'Not requested',
  REQUESTED: 'Awaiting report',
  SUBMITTED: 'Pending approval',
  APPROVED: 'Approved',
  RETURNED: 'Returned to owner',
};

/** Pillar → objective → initiative results (the Excel's IV columns and dashboard totals). */
function buildSummarySheet(
  plan: ExportPlan,
  period: ExportPeriod | null,
  rows: { pillar: string; objective: string; initiative: string; row: ReportRow | null; weight: number; countsTowardWeight: boolean }[]
): XLSX.WorkSheet {
  const header = ['Level', 'Name', 'Weight', 'Weighted Plan', 'Weighted Actual', 'Weighted Actual with Delay', 'Achieved Result', "Achiev't with Delay", 'Status'];
  const aoa: (string | number | null)[][] = [
    [`${plan.name} — v${plan.version}`],
    [period ? `Reporting period: ${period.name}` : 'No reporting period selected — weights only'],
    [],
    header,
  ];
  const line = (level: string, name: string, subset: typeof rows) => {
    const r = rollUp(subset.map(x => x.row).filter((x): x is ReportRow => x !== null));
    const weight = subset.filter(x => x.countsTowardWeight).reduce((s, x) => s + x.weight, 0) / 100;
    aoa.push([level, name, weight, r.weightedPlan / 100, r.weightedActual / 100, r.weightedActualWithDelay / 100,
      r.achievedResult, r.achievedWithDelay, r.weightedPlan > 0 ? r.status : '']);
  };
  line('Plan', plan.name, rows);
  for (const pillar of plan.pillars) {
    line('Pillar', pillar.title, rows.filter(x => x.pillar === pillar.title));
    for (const objective of pillar.objectives) {
      line('Objective', objective.statement, rows.filter(x => x.pillar === pillar.title && x.objective === objective.statement));
      for (const initiative of objective.initiatives) {
        line('Initiative', initiative.title, rows.filter(x => x.pillar === pillar.title && x.objective === objective.statement && x.initiative === initiative.title));
      }
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let r = 4; r < aoa.length; r++) {
    for (const c of [2, 3, 4, 5]) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && cell.t === 'n') cell.z = PCT2; }
    for (const c of [6, 7]) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && cell.t === 'n') cell.z = PCT; }
  }
  ws['!cols'] = [{ wch: 11 }, { wch: 60 }, { wch: 9 }, { wch: 13 }, { wch: 13 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 26 }];
  return ws;
}
