import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cleanPdfCell, pdfText } from '@/lib/pdf-text';
import { monthKey, formatTargetValue, type TargetAggregation, type TargetType } from '@/lib/monthly-breakdown';
import { computeReportRow, formatRatio, formatWeight, rollUp, type ReportRow } from '@/lib/report-calculations';
import { attentionItems, delayedActivities, trendChange, type PerformanceTrend } from '@/lib/performance-insights';
import { collaboratorsOf, officeOf } from '@/lib/performance-report';
import type { ExportEntry, ExportPeriod, ExportPlan } from './build-plan-workbook';

const day = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const signedPoints = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)} pts`);

const STATUS_TEXT: Record<string, string> = {
  NOT_REQUESTED: 'Not requested',
  REQUESTED: 'Awaiting report',
  SUBMITTED: 'Pending approval',
  RETURNED: 'Returned to owner',
};

/**
 * The plan's performance report for one period as a landscape PDF: totals,
 * a pillar/objective/initiative summary, then every activity's report line.
 * Same calculations as the plan page and the Excel export; only approved
 * reports are counted. When a period is given it also covers the trend across
 * periods, the delayed activities, and the challenges and issues that need
 * management attention.
 */
export function buildPerformancePdf(plan: ExportPlan, period: ExportPeriod | null, entries: ExportEntry[], trend?: PerformanceTrend): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const entryByActivity = new Map(entries.map(e => [e.activityId, e]));

  type Line = { pillar: string; objective: string; initiative: string; activity: ExportPlan['pillars'][number]['objectives'][number]['initiatives'][number]['activities'][number]; row: ReportRow | null; entry?: ExportEntry };
  const lines: Line[] = [];
  for (const p of plan.pillars) for (const o of p.objectives) for (const i of o.initiatives) for (const a of i.activities) {
    const entry = entryByActivity.get(a.id);
    const approved = entry?.reportStatus === 'APPROVED';
    const row = period && approved && a.annualTarget != null
      ? computeReportRow(
          { weight: a.weight, countsTowardWeight: a.countsTowardWeight, targetType: a.targetType as TargetType | null, annualTarget: a.annualTarget, targetAggregation: a.targetAggregation as TargetAggregation, targetDirection: a.targetDirection as 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER', monthlyTargets: a.monthlyTargets.map(t => ({ month: monthKey(t.month), value: t.value })) },
          { actualToDate: entry!.actualToDate, completionDate: entry!.completionDate },
          period.endDate
        )
      : null;
    lines.push({ pillar: p.title, objective: o.statement, initiative: i.title, activity: a, row, entry });
  }
  const rowsOf = (subset: Line[]) => subset.map(l => l.row).filter((r): r is ReportRow => r !== null);
  const total = rollUp(rowsOf(lines));
  const reported = lines.filter(l => l.entry);
  const approvedCount = lines.filter(l => l.row).length;

  doc.setFontSize(15);
  doc.text(pdfText(`${plan.name} — Performance Report`), 14, 15);
  doc.setFontSize(9);
  doc.text(pdfText(`Version ${plan.version} · ${plan.startYear}-${plan.endYear} · ${period ? `Reporting period: ${period.name}` : 'No reporting period selected'} · Generated ${new Date().toISOString().slice(0, 10)}`), 14, 21);

  autoTable(doc, {
    didParseCell: cleanPdfCell,
    startY: 25,
    head: [['Reports approved', 'Weighted plan', 'Weighted actual', 'Weighted actual with delay', 'Achieved result', 'With delay', 'Status']],
    body: [[`${approvedCount} of ${reported.length}`, formatWeight(total.weightedPlan), formatWeight(total.weightedActual), formatWeight(total.weightedActualWithDelay), formatRatio(total.achievedResult), formatRatio(total.achievedWithDelay), total.weightedPlan > 0 ? total.status : '—']],
    styles: { halign: 'center', fontSize: 9 },
    headStyles: { fillColor: [217, 119, 6] },
  });

  // Pillar → objective → initiative results.
  const summaryBody: (string | { content: string; styles: object })[][] = [];
  for (const p of plan.pillars) {
    const pLines = lines.filter(l => l.pillar === p.title);
    summaryBody.push(summaryRow(p.title, rollUp(rowsOf(pLines)), { fontStyle: 'bold', fillColor: [253, 230, 138] }));
    for (const o of p.objectives) {
      const oLines = pLines.filter(l => l.objective === o.statement);
      summaryBody.push(summaryRow(`  ${o.statement}`, rollUp(rowsOf(oLines)), { fontStyle: 'bold', fillColor: [224, 242, 254] }));
      for (const i of o.initiatives) {
        summaryBody.push(summaryRow(`      ${i.title}`, rollUp(rowsOf(oLines.filter(l => l.initiative === i.title))), {}));
      }
    }
  }
  autoTable(doc, {
    didParseCell: cleanPdfCell,
    head: [['Pillar / Objective / Initiative', 'Weighted plan', 'Weighted actual', 'With delay', 'Achieved', 'Status']],
    body: summaryBody,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [217, 119, 6] },
    columnStyles: { 0: { cellWidth: pageWidth * 0.5 } },
  });

  if (period) {
    const insights = lines
      .filter(l => l.entry && l.entry.reportStatus !== 'NOT_REQUESTED')
      .map(l => ({
        title: l.activity.title, initiative: l.initiative, owner: l.activity.responsible?.name ?? '', office: officeOf(l.activity), collaborators: collaboratorsOf(l.activity).join(', '),
        endDate: l.activity.endDate, reportStatus: l.entry!.reportStatus, row: l.row, completionDate: l.entry!.completionDate,
        reasonForVariation: l.entry!.reasonForVariation, wayForward: l.entry!.wayForward, escalationIssues: l.entry!.escalationIssues,
      }));
    const delayed = delayedActivities(insights, period.endDate);
    const attention = attentionItems(insights);

    if (trend && trend.periods.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text(pdfText('Trend across reporting periods (achieved result)'), 14, 14);
      autoTable(doc, {
        didParseCell: cleanPdfCell,
        startY: 18,
        head: [['Pillar', ...trend.periods, 'Change vs previous']],
        body: trend.lines.map((line, n) => [line.title, ...line.values.map(v => formatRatio(v)), signedPoints(trendChange(line.values))]
          .map(content => ({ content, styles: n === 0 ? { fontStyle: 'bold', fillColor: [253, 230, 138] } : {} }))),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [217, 119, 6] },
        columnStyles: { 0: { cellWidth: 90 } },
      });
    }

    doc.addPage();
    doc.setFontSize(12);
    doc.text(pdfText(`Delayed activities (${delayed.length})`), 14, 14);
    doc.setFontSize(8);
    doc.text(pdfText(`Overdue = past its due date at the period end with no approved completion; days counted to ${day(period.endDate)}.`), 14, 19);
    autoTable(doc, {
      didParseCell: cleanPdfCell,
      startY: 22,
      head: [['Activity', 'Initiative', 'Lead owner', 'Collaborating unit', 'Responsible', 'Due date', 'Completed', 'Days delayed', 'Delay']],
      body: delayed.length
        ? delayed.map(d => [d.activity, d.initiative, d.office, d.collaborators, d.owner, day(d.dueDate), d.completionDate ? day(d.completionDate) : '', String(d.daysDelayed), d.kind])
        : [[{ content: 'No delayed activities in this report.', colSpan: 9 }]],
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [217, 119, 6] },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 60 } },
    });

    doc.addPage();
    doc.setFontSize(12);
    doc.text(pdfText(`Challenges & issues for management attention (${attention.length})`), 14, 14);
    autoTable(doc, {
      didParseCell: cleanPdfCell,
      startY: 18,
      head: [['Activity', 'Lead owner', 'Collaborating unit', 'Status', "Achiev't", 'Challenges / Reasons for variation', 'Way forward', 'Issues that need escalation']],
      body: attention.length
        ? attention.map(a => [a.activity, a.office, a.collaborators, a.status, formatRatio(a.achievement), a.challenge, a.wayForward, a.escalation])
        : [[{ content: 'No challenges or escalation issues were reported in approved reports.', colSpan: 8 }]],
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [217, 119, 6] },
      columnStyles: { 0: { cellWidth: 45 }, 2: { cellWidth: 35 }, 5: { cellWidth: 50 }, 6: { cellWidth: 40 }, 7: { cellWidth: 45 } },
    });
  }

  // Every activity's report line.
  doc.addPage();
  doc.setFontSize(12);
  doc.text(pdfText('Activity reports'), 14, 14);
  autoTable(doc, {
    didParseCell: cleanPdfCell,
    startY: 18,
    head: [['Activity', 'Responsible', 'Plan', 'Actual', "Achiev't", 'With delay', 'W. plan', 'W. actual', 'Status', 'Reasons for variation / Way forward']],
    body: lines.filter(l => l.entry || !period).map(l => {
      const t = l.activity.targetType as TargetType | null;
      const approved = !!l.row;
      return [
        l.activity.title,
        l.activity.responsible?.name ?? '',
        l.row ? formatTargetValue(l.row.planToDate, t) : '',
        approved && l.entry?.actualToDate != null ? formatTargetValue(l.entry.actualToDate, t) : '',
        approved ? formatRatio(l.row!.achievement) : '',
        approved ? formatRatio(l.row!.achievementWithDelay) : '',
        approved ? formatWeight(l.row!.weightedPlan) : '',
        approved ? formatWeight(l.row!.weightedActual) : '',
        approved ? l.row!.status : (l.entry ? STATUS_TEXT[l.entry.reportStatus] ?? l.entry.reportStatus : ''),
        approved ? [l.entry?.reasonForVariation, l.entry?.wayForward].filter(Boolean).join(' / ') : '',
      ];
    }),
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [217, 119, 6] },
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 28 }, 9: { cellWidth: 60 } },
  });

  const pages = doc.getNumberOfPages();
  for (let n = 1; n <= pages; n++) {
    doc.setPage(n);
    doc.setFontSize(7);
    doc.text(pdfText(`Page ${n} of ${pages}`), pageWidth - 30, doc.internal.pageSize.getHeight() - 6);
  }
  return Buffer.from(doc.output('arraybuffer'));
}

function summaryRow(name: string, r: ReturnType<typeof rollUp>, styles: object) {
  return [name, formatWeight(r.weightedPlan), formatWeight(r.weightedActual), formatWeight(r.weightedActualWithDelay), formatRatio(r.achievedResult), r.weightedPlan > 0 ? r.status : '—']
    .map(content => ({ content, styles }));
}
