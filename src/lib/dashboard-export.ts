import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { Activity, Pillar } from './types';
import { calculateWeightedProgress, generateReportSummary, getObjectiveProgress, getObjectiveWeight, getPillarActual, getPillarPlan, getPillarWeight } from './utils';
import { cleanPdfCell, pdfText } from './pdf-text';

/**
 * Exports of the Dashboard exactly as it is filtered on screen (plan and
 * department/person), built in the browser from the data already loaded.
 * The numbers come from the same helpers the dashboard cards and pillar
 * table use, so the file always matches what the user sees.
 */

export interface DashboardExportInput {
  planName: string;
  unitLabel: string; // "All" or the department / person filtered to
  pillars: Pillar[];
  activities: Activity[];
}

const STATUSES = ['Completed As Per Target', 'On Track', 'Delayed', 'Overdue', 'Not Started'];
const personName = (a: Activity) => (typeof a.responsible === 'string' ? a.responsible : a.responsible?.name) ?? '';
const pct = (n: number) => `${n.toFixed(1)}%`;

function pillarRows(pillars: Pillar[]) {
  const rows: { level: string; name: string; weight: number; plan: number; actual: number; achievement: number }[] = [];
  for (const pillar of pillars) {
    const plan = getPillarPlan(pillar);
    const actual = getPillarActual(pillar);
    rows.push({ level: 'Pillar', name: pillar.title, weight: getPillarWeight(pillar), plan, actual, achievement: plan > 0 ? (actual / plan) * 100 : 0 });
    for (const objective of pillar.objectives) {
      const oPlan = getObjectiveWeight(objective);
      const oActual = (getObjectiveProgress(objective) / 100) * oPlan;
      rows.push({ level: 'Objective', name: objective.statement, weight: oPlan, plan: oPlan, actual: oActual, achievement: oPlan > 0 ? (oActual / oPlan) * 100 : 0 });
    }
  }
  return rows;
}

function departmentRows(activities: Activity[]) {
  const departments = Array.from(new Set(activities.map(a => a.department).filter(Boolean))).sort();
  return departments.map(department => {
    const list = activities.filter(a => a.department === department);
    const counts = Object.fromEntries(STATUSES.map(s => [s, list.filter(a => a.status === s).length]));
    return { department, total: list.length, weightedProgress: calculateWeightedProgress(list), ...counts } as Record<string, string | number>;
  });
}

function activityRows(pillars: Pillar[], activities: Activity[]) {
  const shown = new Set(activities.map(a => a.id));
  return pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities
    .filter(a => shown.size === 0 || shown.has(a.id))
    .map(a => ({
      Pillar: p.title,
      Objective: o.statement,
      Initiative: i.title,
      Activity: a.title,
      Deliverable: a.deliverable ?? '',
      Department: a.department,
      Responsible: personName(a),
      'Start Date': format(new Date(a.startDate), 'yyyy-MM-dd'),
      'End Date': format(new Date(a.endDate), 'yyyy-MM-dd'),
      'Weight (%)': a.weight,
      'Progress (%)': a.progress,
      Status: a.status,
    })))));
}

const fileBase = (input: DashboardExportInput) =>
  `dashboard ${input.planName}${input.unitLabel !== 'All' ? ` - ${input.unitLabel}` : ''} ${format(new Date(), 'yyyy-MM-dd')}`.replace(/[^\w\s.-]+/g, '').trim();

export function exportDashboardExcel(input: DashboardExportInput) {
  const summary = generateReportSummary(input.pillars);
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['Dashboard'],
    ['Plan', input.planName],
    ['Showing', input.unitLabel === 'All' ? 'All departments and people' : input.unitLabel],
    ['Exported', format(new Date(), 'PPpp')],
    [],
    ['Pillars', summary.totalPillars],
    ['Objectives', summary.totalObjectives],
    ['Initiatives', summary.totalInitiatives],
    ['Activities', summary.totalActivities],
    ['Overall progress (%)', Number(summary.overallProgress.toFixed(2))],
    ['Overdue activities', summary.overdueActivities],
  ]);
  summarySheet['!cols'] = [{ wch: 24 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  const pillarSheet = XLSX.utils.json_to_sheet(pillarRows(input.pillars).map(r => ({
    Level: r.level, Name: r.name, 'Weight (%)': round(r.weight), 'Plan': round(r.plan), 'Actual': round(r.actual), 'Achievement (%)': round(r.achievement),
  })));
  pillarSheet['!cols'] = [{ wch: 10 }, { wch: 60 }, { wch: 11 }, { wch: 9 }, { wch: 9 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, pillarSheet, 'Pillar Performance');

  const deptSheet = XLSX.utils.json_to_sheet(departmentRows(input.activities).map(r => ({
    Department: r.department, Activities: r.total, 'Weighted progress (%)': round(Number(r.weightedProgress)),
    ...Object.fromEntries(STATUSES.map(s => [s, r[s]])),
  })));
  deptSheet['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 20 }, ...STATUSES.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, deptSheet, 'By Department');

  const activitySheet = XLSX.utils.json_to_sheet(activityRows(input.pillars, input.activities));
  activitySheet['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 30 }, { wch: 45 }, { wch: 30 }, { wch: 24 }, { wch: 20 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 11 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, activitySheet, 'Activities');

  XLSX.writeFile(wb, `${fileBase(input)}.xlsx`);
}

export async function exportDashboardPdf(input: DashboardExportInput) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const summary = generateReportSummary(input.pillars);
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.text(pdfText('Dashboard'), 14, 16);
  doc.setFontSize(10);
  doc.text(pdfText(`Plan: ${input.planName}   ·   Showing: ${input.unitLabel === 'All' ? 'All departments and people' : input.unitLabel}   ·   ${format(new Date(), 'PPp')}`), 14, 23);

  autoTable(doc, {
    didParseCell: cleanPdfCell,
    startY: 28,
    head: [['Pillars', 'Objectives', 'Initiatives', 'Activities', 'Overall progress', 'Overdue']],
    body: [[summary.totalPillars, summary.totalObjectives, summary.totalInitiatives, summary.totalActivities, pct(summary.overallProgress), summary.overdueActivities]],
    styles: { halign: 'center' },
  });

  autoTable(doc, {
    head: [['Pillar / Objective', 'Weight', 'Plan', 'Actual', 'Achievement']],
    body: pillarRows(input.pillars).map(r => [r.level === 'Objective' ? `    ${r.name}` : r.name, pct(r.weight), r.plan.toFixed(2), r.actual.toFixed(2), pct(r.achievement)]),
    didParseCell: (data) => {
      cleanPdfCell(data);
      // Pillar lines in bold; objective lines are the indented ones.
      if (data.section === 'body' && !String((data.row.raw as unknown[])[0]).startsWith('    ')) data.cell.styles.fontStyle = 'bold';
    },
    columnStyles: { 0: { cellWidth: pageWidth * 0.5 } },
  });

  autoTable(doc, {
    didParseCell: cleanPdfCell,
    head: [['Department', 'Activities', 'Weighted progress', ...STATUSES]],
    body: departmentRows(input.activities).map(r => [r.department, r.total, pct(Number(r.weightedProgress)), ...STATUSES.map(s => r[s])]),
  });

  autoTable(doc, {
    didParseCell: cleanPdfCell,
    head: [['Activity', 'Department', 'Responsible', 'End', 'Weight', 'Progress', 'Status']],
    body: activityRows(input.pillars, input.activities).map(a => [a.Activity, a.Department, a.Responsible, a['End Date'], `${a['Weight (%)']}%`, `${a['Progress (%)']}%`, a.Status]),
    styles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: pageWidth * 0.35 } },
  });

  doc.save(`${fileBase(input)}.pdf`);
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
