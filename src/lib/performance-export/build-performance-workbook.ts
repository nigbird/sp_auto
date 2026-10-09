import { format } from 'date-fns';
import { rollUp, type ReportRollup } from '@/lib/report-calculations';
import { REPORT_COLUMNS } from '@/components/reports/performance-report-columns';
import { REPORT_STATE_LABEL, RESULT_STATUSES, treeActivities, type ReportActivity, type ReportState, type TreePillar } from '@/lib/performance-report';
import { SheetBuilder, writeStyledWorkbook, type StyleRole, type StyledCell } from '@/lib/dashboard-export/xlsx-styling';

type Kind = 'row' | 'group' | 'sub' | 'ini' | 'total';

const num = (v: number | null | undefined): number | string => (v == null || !Number.isFinite(v) ? '—' : v);
const day = (d: string | Date) => format(new Date(d), 'd MMM yyyy');
const cell = (v: number | string | null | undefined, role: StyleRole): StyledCell => ({ v: v ?? '', role });

const ROLE: Record<Kind, { text: StyleRole; weight: StyleRole; pct: StyleRole }> = {
  row: { text: 'text', weight: 'weight', pct: 'pct' },
  group: { text: 'group', weight: 'groupWeight', pct: 'groupPct' },
  sub: { text: 'sub', weight: 'subWeight', pct: 'subPct' },
  ini: { text: 'ini', weight: 'iniWeight', pct: 'iniPct' },
  total: { text: 'total', weight: 'totalWeight', pct: 'totalPct' },
};

const weightedRows = (activities: ReportActivity[]) => activities.flatMap(a => (a.row ? [a.row] : []));

/** Σ weighted values and ratios: the right-hand block of a pillar, objective, initiative or total line. */
function rollupCells(r: ReportRollup, kind: Kind): StyledCell[] {
  const s = ROLE[kind], hasPlan = r.weightedPlan > 0;
  return [
    cell(r.weightedPlan, s.weight),
    cell(r.weightedActual, s.weight),
    cell(r.weightedActualWithDelay, s.weight),
    cell(r.weightedActualNoDup, s.weight),
    cell(hasPlan ? num(r.achievedResult) : '—', s.pct),
    cell(hasPlan ? num(r.achievedWithDelay) : '—', s.pct),
    cell(hasPlan ? r.status : '—', s.text),
  ];
}

/** An activity's report columns, as typed Excel values in REPORT_COLUMNS order. */
function activityCells(a: ReportActivity): StyledCell[] {
  const { row, entry } = a;
  if (!row) return REPORT_COLUMNS.map(() => cell('', 'text'));
  const target: StyleRole = a.targetType === 'PERCENT' ? 'score' : 'num';
  return [
    cell(row.planToDate, target),
    cell(entry.actualToDate ?? '—', target),
    cell(num(row.achievement), 'pct'),
    cell(entry.completionDate ? day(entry.completionDate) : '', 'text'),
    cell(row.daysDelayed ?? '', 'int'),
    cell(num(row.achievementWithDelay), 'pct'),
    cell(entry.comment ?? '', 'wrap'),
    cell(entry.reasonForVariation ?? '', 'wrap'),
    cell(entry.wayForward ?? '', 'wrap'),
    cell(entry.escalationIssues ?? '', 'wrap'),
    cell(num(row.weightedPlan), 'weight'),
    cell(num(row.weightedActual), 'weight'),
    cell(num(row.weightedActualWithDelay), 'weight'),
    cell(num(row.weightedActualNoDup), 'weight'),
    cell(num(row.achievedResult), 'pct'),
    cell(num(row.achievedWithDelay), 'pct'),
    cell(row.status, 'text'),
  ];
}

export interface PerformanceWorkbookInput {
  planName: string;
  period: { name: string; startDate: string | Date; endDate: string | Date };
  /** The report tree, already narrowed by any filters. */
  pillars: TreePillar<ReportActivity>[];
  /** The active filters in words, or '' for the whole report. */
  filters: string;
  generatedAt?: Date;
}

/**
 * The performance report as a styled workbook in the dashboard export's look:
 * a summary sheet (headline figures and results by pillar and objective) and
 * the full report sheet with the plan's report columns.
 */
export function buildPerformanceWorkbook({ planName, period, pillars, filters, generatedAt = new Date() }: PerformanceWorkbookInput): Buffer {
  const all = treeActivities(pillars);
  const total = rollUp(weightedRows(all));
  const subtitle = [
    planName,
    `${period.name} (${day(period.startDate)} – ${day(period.endDate)})`,
    `Generated ${generatedAt.toLocaleString('en-GB', { timeZone: 'Africa/Addis_Ababa' })}`,
  ].join(' · ');
  const scope = filters ? `Filtered: ${filters}. Totals cover the activities shown.` : 'All activities with a report request this period.';
  const approvedOf = (activities: ReportActivity[]) => `${activities.filter(a => a.state === 'APPROVED').length} of ${activities.length}`;

  // --- Summary ----------------------------------------------------------------
  const sm = new SheetBuilder('Summary', [58, 16, 14, 14, 16, 14, 14, 26]);
  sm.showGrid = false;
  sm.row([{ v: 'Performance Report', role: 'title' }]);
  sm.row([{ v: subtitle, role: 'subtitle' }]);
  sm.row([{ v: scope, role: 'subtitle' }]);
  sm.blank();

  sm.row([{ v: 'Headline figures', role: 'section' }]);
  const kpis: [string, StyledCell][] = [
    ['Reports approved', cell(approvedOf(all), 'kpi')],
    ['Weighted plan', cell(total.weightedPlan, 'kpiWeight')],
    ['Weighted actual', cell(total.weightedActual, 'kpiWeight')],
    ['Weighted actual with delay', cell(total.weightedActualWithDelay, 'kpiWeight')],
    ['Achieved result', cell(total.weightedPlan > 0 ? num(total.achievedResult) : '—', 'kpiPct')],
    ['Achieved result with delay', cell(total.weightedPlan > 0 ? num(total.achievedWithDelay) : '—', 'kpiPct')],
    ['Status', cell(total.weightedPlan > 0 ? total.status : '—', 'kpi')],
  ];
  for (const [label, value] of kpis) sm.row([{ v: label, role: 'label' }, value]);
  sm.blank();

  sm.row([{ v: 'Results by pillar and objective', role: 'section' }]);
  const smHeader = sm.row(['Pillar / objective', 'Reports approved', 'Weighted plan', 'Weighted actual', 'Weighted actual with delay', 'Achieved result', 'Achieved with delay', 'Status'], 'header');
  sm.rowHeights.set(smHeader, 32);
  const summaryRow = (title: string, activities: ReportActivity[], kind: Kind) => {
    const r = rollUp(weightedRows(activities)), s = ROLE[kind], hasPlan = r.weightedPlan > 0;
    sm.row([
      cell(title, kind === 'row' ? 'wrap' : s.text), cell(approvedOf(activities), s.text),
      cell(r.weightedPlan, s.weight), cell(r.weightedActual, s.weight), cell(r.weightedActualWithDelay, s.weight),
      cell(hasPlan ? num(r.achievedResult) : '—', s.pct), cell(hasPlan ? num(r.achievedWithDelay) : '—', s.pct), cell(hasPlan ? r.status : '—', s.text),
    ]);
  };
  for (const p of pillars) {
    summaryRow(p.title, treeActivities([p]), 'group');
    for (const o of p.objectives) summaryRow(o.statement, o.initiatives.flatMap(i => i.activities), 'row');
  }
  summaryRow('Overall', all, 'total');
  sm.blank();

  sm.row([{ v: 'Where reports stand', role: 'section' }]);
  sm.row(['Report status', 'Activities', 'Share'], 'header');
  for (const s of Object.keys(REPORT_STATE_LABEL) as ReportState[]) {
    const n = all.filter(a => a.state === s).length;
    sm.row([cell(REPORT_STATE_LABEL[s], 'text'), cell(n, 'int'), cell(all.length ? n / all.length : 0, 'pct')]);
  }
  sm.blank();

  sm.row([{ v: 'Results of approved reports', role: 'section' }]);
  sm.row(['Activity status', 'Activities', 'Share'], 'header');
  const approved = all.filter(a => a.result);
  for (const s of RESULT_STATUSES) {
    const n = approved.filter(a => a.result === s).length;
    sm.row([cell(s, 'text'), cell(n, 'int'), cell(approved.length ? n / approved.length : 0, 'pct')]);
  }

  // --- Report -------------------------------------------------------------------
  const lead = ['Major Activities', 'Lead owner', 'Responsible', 'Report status'];
  const rp = new SheetBuilder('Performance Report', [56, 24, 22, 17, 12, 12, 11, 12, 10, 12, 42, 42, 42, 42, 11, 11, 12, 12, 11, 11, 24]);
  rp.row([{ v: 'Performance Report', role: 'title' }]);
  rp.row([{ v: subtitle, role: 'subtitle' }]);
  rp.row([{ v: `${scope} Blue columns are filled in by the activity owner; totals count approved reports only.`, role: 'subtitle' }]);
  rp.blank();
  const header = rp.row([
    ...lead.map(v => cell(v, 'header')),
    ...REPORT_COLUMNS.map(c => cell(c.label, c.owner ? 'headerOwner' : 'header')),
  ]);
  rp.rowHeights.set(header, 42);
  rp.freezeRows = header + 1;

  const blanks = (n: number, role: StyleRole) => Array.from({ length: n }, () => cell('', role));
  const lineRow = (title: string, activities: ReportActivity[], kind: Kind) => {
    const s = ROLE[kind];
    const r = rp.row([cell(title, s.text), ...blanks(lead.length - 1 + 10, s.text), ...rollupCells(rollUp(weightedRows(activities)), kind)]);
    rp.merge(r, 0, lead.length - 1);
  };

  for (const p of pillars) {
    lineRow(p.title, treeActivities([p]), 'group');
    for (const o of p.objectives) {
      lineRow(o.statement, o.initiatives.flatMap(i => i.activities), 'sub');
      for (const i of o.initiatives) {
        lineRow(i.title, i.activities, 'ini');
        for (const a of i.activities) {
          rp.row([cell(a.title, 'wrap'), cell(a.office, 'wrap'), cell(a.owner, 'wrap'), cell(REPORT_STATE_LABEL[a.state], 'text'), ...activityCells(a)]);
        }
      }
    }
  }
  const last = rp.row([cell('Overall', 'total'), ...blanks(lead.length - 1 + 10, 'total'), ...rollupCells(total, 'total')]);
  rp.autoFilter = `A${header + 1}:U${last}`; // the Overall line stays out of the filter range

  return writeStyledWorkbook([sm, rp]);
}
