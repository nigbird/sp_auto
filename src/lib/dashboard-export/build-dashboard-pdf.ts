import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData, type RowInput } from 'jspdf-autotable';
import { cleanPdfCell, pdfText } from '@/lib/pdf-text';
import type { DashboardData } from '@/lib/dashboard-data';
import { DELAY_BUCKET_LABEL, INITIATIVE_STATUS_LABEL, INITIATIVE_STATUS_ORDER, streamTotals, type DelayBucket } from '@/lib/dashboard-metrics';
import { describeRatingBands } from '@/lib/rating-bands';
import type { ChartImage, ChartKey } from './dashboard-charts';
import { drawActivityDelayTable } from './activity-delay-export';

type Ready = Extract<DashboardData, { state: 'ready' }>;
type RGB = [number, number, number];

const BROWN: RGB = [94, 66, 49];
const INK: RGB = [47, 42, 37];
const MUTED: RGB = [133, 123, 112];
const GOLD: RGB = [223, 154, 58];
const CARD: RGB = [250, 246, 240];
const GROUP: RGB = [243, 234, 219];

const M = 12; // page margin (mm)
const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`);
const w = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(2)}%`);
const strip = (s: string, word: string) => s.replace(new RegExp(`^${word}\\s*\\d+\\s*:?\\s*`, 'i'), '');
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');

/**
 * The executive dashboard as a landscape PDF: one section per dashboard tab,
 * with the same charts (rendered images) and tables. Figures come from the same
 * computeDashboard results as the on-screen dashboard and the Excel export.
 */
export function buildDashboardPdf(data: Ready, charts: Record<ChartKey, ChartImage>, generatedAt = new Date()): Buffer {
  const m = data.metrics;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const subtitle = `${data.plan.name} · As of ${day(data.period.endDate)} (${data.period.name})`;
  let y = M;

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const txt = (s: string, x: number, yy: number, opts?: Parameters<typeof doc.text>[3]) => doc.text(pdfText(s), x, yy, opts);

  const sectionHeader = (title: string, first = false) => {
    if (!first) doc.addPage();
    y = M;
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.rect(M, y, 3, 9, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); setColor(BROWN);
    txt(title, M + 6, y + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setColor(MUTED);
    txt(subtitle, M + 6, y + 13);
    y += 20;
  };

  const ensure = (h: number) => {
    if (y + h > PH - M - 6) { doc.addPage(); y = M; }
  };

  /** Places a chart at a given width (mm), keeping its aspect ratio. Returns its height. */
  const image = (key: ChartKey, x: number, yy: number, width: number) => {
    const c = charts[key];
    const h = (width * c.height) / c.width;
    doc.addImage(c.png, 'PNG', x, yy, width, h, key, 'FAST');
    return h;
  };

  /** Two charts side by side. */
  const imagePair = (a: ChartKey, b: ChartKey) => {
    const colW = (PW - 2 * M - 6) / 2;
    const ha = (colW * charts[a].height) / charts[a].width;
    const hb = (colW * charts[b].height) / charts[b].width;
    ensure(Math.max(ha, hb));
    image(a, M, y, colW);
    image(b, M + colW + 6, y, colW);
    y += Math.max(ha, hb) + 5;
  };

  const imageFull = (key: ChartKey, width = PW - 2 * M) => {
    const h = (width * charts[key].height) / charts[key].width;
    ensure(h);
    image(key, M + (PW - 2 * M - width) / 2, y, width);
    y += h + 5;
  };

  const sub = (title: string) => {
    ensure(14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); setColor(BROWN);
    txt(title, M, y + 4);
    y += 8;
  };

  const table = (head: string[], body: RowInput[], opts: { columnStyles?: Record<number, object>; fontSize?: number; groupRows?: Set<number>; totalRow?: number; totalRows?: Set<number> } = {}) => {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: M + 6 },
      head: [head],
      body,
      theme: 'grid',
      styles: { fontSize: opts.fontSize ?? 8, cellPadding: 1.6, textColor: INK, lineColor: [226, 216, 200], lineWidth: 0.1, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: BROWN, textColor: [255, 255, 255], fontStyle: 'bold', valign: 'middle' },
      alternateRowStyles: { fillColor: [253, 251, 248] },
      columnStyles: opts.columnStyles,
      didParseCell: (hook: CellHookData) => {
        cleanPdfCell(hook);
        if (hook.section !== 'body') return;
        if (opts.groupRows?.has(hook.row.index)) { hook.cell.styles.fillColor = GROUP; hook.cell.styles.fontStyle = 'bold'; }
        if (opts.totalRow === hook.row.index || opts.totalRows?.has(hook.row.index)) { hook.cell.styles.fillColor = [234, 223, 203]; hook.cell.styles.fontStyle = 'bold'; }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };

  const kpiTiles = (tiles: { label: string; value: string; note?: string }[]) => {
    const gap = 4, tw = (PW - 2 * M - gap * (tiles.length - 1)) / tiles.length, th = 22;
    tiles.forEach((t, i) => {
      const x = M + i * (tw + gap);
      doc.setFillColor(CARD[0], CARD[1], CARD[2]);
      doc.roundedRect(x, y, tw, th, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setColor(MUTED); txt(t.label, x + 3.5, y + 6);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); setColor(INK); txt(t.value, x + 3.5, y + 14);
      if (t.note) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); setColor(MUTED); txt(t.note, x + 3.5, y + 19, { maxWidth: tw - 6 }); }
    });
    y += th + 6;
  };

  // --- Overview ------------------------------------------------------------
  const { rollup, coverage, yearProgress } = m.overall;
  sectionHeader('Strategic Plan Execution Dashboard', true);
  kpiTiles([
    { label: 'Overall execution', value: rollup.weightedPlan > 0 ? pct(rollup.achievedResult) : '—', note: `${pct(rollup.achievedWithDelay)} after delays` },
    { label: 'Weighted actual / plan', value: `${w(rollup.weightedActual)} / ${w(rollup.weightedPlan)}`, note: 'for the period' },
    { label: 'Full-year progress', value: pct(yearProgress), note: 'of total plan weight' },
    { label: 'Initiatives completed', value: `${m.initiativesCompleted} / ${m.initiatives.length}`, note: `${m.initiativesDue} due by ${day(data.period.endDate)}` },
    { label: 'Objectives >= 80%', value: `${m.objectivesAtLeast80.count} / ${m.objectivesAtLeast80.of}`, note: 'with a target this period' },
    { label: 'Reports approved', value: `${coverage.approved} / ${coverage.planned}`, note: coverage.pending ? `${coverage.pending} awaiting approval` : 'planned activities' },
  ]);
  {
    const gaugeW = 70, trendW = 125, statusW = PW - 2 * M - gaugeW - trendW - 8;
    const h = Math.max(
      (gaugeW * charts.gauge.height) / charts.gauge.width,
      (trendW * charts.trend.height) / charts.trend.width,
      (statusW * charts.status.height) / charts.status.width
    );
    image('gauge', M, y, gaugeW);
    image('trend', M + gaugeW + 4, y, trendW);
    image('status', M + gaugeW + trendW + 8, y, statusW);
    y += h + 6;
  }
  sub('Highlights');
  table(['', 'Result', 'Name'], ([
    ['Strongest pillar · this period', m.strongestPillarPeriod],
    ['Strongest pillar · full year', m.strongestPillarYear],
    ['Weakest pillar · this period', m.weakestPillarPeriod],
    ['Strongest initiative · this period', m.strongestInitiative],
    ['Weakest initiative · this period', m.weakestInitiative],
  ] as const).map(([label, h]) => [label, h ? pct(h.value) : '—', h ? `${h.code} · ${h.title}` : '—']), { columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 22, halign: 'right' } } });

  sub('Story in brief');
  y += 3;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); setColor(INK);
  for (const line of m.story) {
    const lines = doc.splitTextToSize(pdfText(line), PW - 2 * M - 6) as string[];
    ensure(lines.length * 4.6 + 2);
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]); doc.circle(M + 1.2, y - 1.2, 0.9, 'F');
    doc.text(lines, M + 5, y);
    y += lines.length * 4.6 + 1.5;
  }
  y += 3;
  sub('Issues that need management attention');
  if (m.issues.length === 0) {
    doc.setFontSize(9); setColor(MUTED); txt('No escalations in approved reports.', M, y + 2); y += 8;
  } else {
    table(['Issue', 'Initiative', 'Activity', 'Lead owner'], m.issues.map(i => [i.text, `${i.initiativeCode} · ${i.initiative}`, i.activity, i.owner]), { columnStyles: { 0: { cellWidth: 110 } } });
  }

  // --- Pillars & Objectives --------------------------------------------------------
  sectionHeader('Pillars & Objectives');
  imagePair('contribution', 'planActual');
  imageFull('pillarStatus', 190);
  sub('Pillar & objective performance');
  {
    const body: RowInput[] = [];
    const groups = new Set<number>();
    const statusCells = (c: Record<string, number>) => INITIATIVE_STATUS_ORDER.map(s => String(c[s]));
    for (const p of m.pillars) {
      groups.add(body.length);
      body.push([p.code, strip(p.title, 'Pillar'), w(p.summary.totalWeight), w(p.summary.rollup.weightedPlan), w(p.summary.rollup.weightedActual), p.summary.rollup.weightedPlan > 0 ? pct(p.summary.rollup.achievedResult) : '—', pct(p.summary.yearProgress), ...statusCells(p.statusCounts)]);
      for (const o of p.objectives) {
        body.push([o.code, strip(o.statement, 'Objective'), w(o.summary.totalWeight), w(o.summary.rollup.weightedPlan), w(o.summary.rollup.weightedActual), o.summary.rollup.weightedPlan > 0 ? pct(o.summary.rollup.achievedResult) : '—', pct(o.summary.yearProgress), ...statusCells(o.statusCounts)]);
      }
    }
    const totalRow = body.length;
    body.push(['', 'Overall', w(m.overall.totalWeight), w(rollup.weightedPlan), w(rollup.weightedActual), pct(rollup.achievedResult), pct(yearProgress), ...statusCells(m.statusCounts)]);
    const right = Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => [i, { halign: 'right' }]));
    table(['Code', 'Pillar / objective', 'Weight', 'Plan', 'Actual', 'Achievement', 'Full year', ...INITIATIVE_STATUS_ORDER.map(s => INITIATIVE_STATUS_LABEL[s])], body, {
      groupRows: groups, totalRow, fontSize: 7.5, columnStyles: { ...right, 0: { cellWidth: 11 }, 1: { cellWidth: 80 } },
    });
  }

  // --- Initiatives ------------------------------------------------------------
  sectionHeader('Initiatives');
  imageFull('scatter', 175);
  sub(`All initiatives (${m.initiatives.length})`);
  table(
    ['Code', 'Initiative', 'Lead owner', 'Ends', 'Total wt', 'Planned wt', 'Attained wt', 'Achievement', 'Status', 'Overall', 'Rating'],
    m.initiatives.map(i => {
      const hasPlan = i.summary.rollup.weightedPlan > 0;
      return [i.code, i.title, i.owner, day(i.dueDate), w(i.summary.totalWeight), w(i.summary.rollup.weightedPlan), w(i.summary.rollup.weightedActual), hasPlan ? pct(i.summary.rollup.achievedResult) : '—', INITIATIVE_STATUS_LABEL[i.status], i.completed ? 'Completed' : 'Not completed', i.rating];
    }),
    { fontSize: 7.5, columnStyles: { 0: { cellWidth: 13 }, 1: { cellWidth: 68 }, 2: { cellWidth: 42 }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } } }
  );
  const withNotes = m.initiatives.filter(i => Object.values(i.narratives).some(n => n.length));
  if (withNotes.length) {
    sub('Report notes (approved reports)');
    const join = (items: { text: string; activity: string }[]) => items.map(n => `• ${n.text} (${n.activity})`).join('\n');
    table(
      ['Code', 'Initiative', 'Accomplished tasks', 'Reasons for variation', 'Way forward', 'Critical issues'],
      withNotes.map(i => [i.code, i.title, join(i.narratives.accomplished), join(i.narratives.variation), join(i.narratives.wayForward), join(i.narratives.escalation)]),
      { fontSize: 7, columnStyles: { 0: { cellWidth: 13 }, 1: { cellWidth: 42 } } }
    );
  }

  // --- Delivery & Delays ---------------------------------------------------------
  sectionHeader('Delivery & Delays');
  kpiTiles([
    { label: 'Due initiatives completed', value: `${m.initiativesDue - m.initiativesOverdue} / ${m.initiativesDue}`, note: 'due by the period end' },
    { label: 'Due activities completed', value: `${m.activitiesDue - m.activitiesOverdue} / ${m.activitiesDue}`, note: `+${Math.max(0, m.activitiesCompleted - (m.activitiesDue - m.activitiesOverdue))} ahead of schedule` },
    { label: 'Overdue activities', value: String(m.activitiesOverdue), note: 'past planned end, not completed' },
    { label: 'Activities without a target', value: String(m.activitiesWithoutTarget.length), note: `of ${m.activitiesTotal}` },
  ]);
  imagePair('quartersInitiatives', 'quartersActivities');
  imagePair('deliveryInitiatives', 'deliveryActivities');
  imageFull('delays', 170);
  sub(`Completion plan · ${m.fiscalYearLabel}`);
  table(['Due in', 'Initiatives expected', 'Completed', 'Activities expected', 'Completed'],
    m.initiativeQuarters.map((q, k) => [q.label, String(q.expected), String(q.completed), String(m.activityQuarters[k].expected), String(m.activityQuarters[k].completed)]),
    { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
  const due: DelayBucket[] = ['onTime', 'd1_30', 'd31_60', 'd61_90', 'd90plus', 'notElapsed'];
  sub('Delays');
  table(['How late', 'Initiatives', 'Activities'], due.map(k => [DELAY_BUCKET_LABEL[k], String(m.initiativeDelays[k]), String(m.activityDelays[k])]), { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } });
  sub('Completed initiatives');
  if (m.completedInitiatives.length) table(['Code', 'Initiative', 'Lead owner'], m.completedInitiatives.map(c => [c.code, c.title, c.owner]));
  else { doc.setFontSize(9); setColor(MUTED); txt('None yet.', M, y + 2); y += 8; }
  sub(`Activities without a target (${m.activitiesWithoutTarget.length})`);
  table(['Initiative', 'Activity', 'Lead owner', 'Why'], m.activitiesWithoutTarget.map(a => [a.code, a.title, a.owner, a.note]), { fontSize: 7.5, columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 120 } } });

  // --- Activity delays (work stream → initiative → activity) --------------------------
  sectionHeader('Activity Delays');
  doc.setFontSize(8.5); setColor(MUTED);
  txt(`${m.activityDelayRows.length} activities. Days delayed = completion date (or the period end, if still open) minus the due date; negative = days still to go.`, M, y);
  y = drawActivityDelayTable(doc, m.activityDelayRows, y + 3, M) + 4;

  // --- Streams & Departments --------------------------------------------------------
  sectionHeader('Streams & Departments');
  const totals = streamTotals(m);
  kpiTiles([
    { label: 'Initiatives, with duplication', value: String(totals.initiativesWithDuplication), note: "sum of every lead owner's count" },
    { label: 'Initiatives, without duplication', value: String(totals.initiativesWithoutDuplication), note: 'each initiative counted once' },
    { label: 'Shared initiatives (duplicates)', value: String(totals.initiativesDuplicated), note: 'led by more than one office' },
    { label: 'Activities', value: String(totals.activities), note: 'each has one lead owner' },
    { label: 'Planned this period', value: String(totals.activitiesPlanned), note: 'activities with a period plan' },
  ]);
  imagePair('streamWorkload', 'streamAchievement');
  imageFull('streamDelivery', (PW - 2 * M - 6) / 2);
  sub('Streams & departments performance');
  const prevByName = new Map(data.previousMetrics?.streams.map(s => [s.name, s]) ?? []);
  const streamRows: RowInput[] = m.streams.map((s, k) => {
    const hasPlan = s.summary.rollup.weightedPlan > 0 && s.summary.coverage.approved > 0;
    const prev = prevByName.get(s.name);
    const prevHas = prev && prev.summary.rollup.weightedPlan > 0 && prev.summary.coverage.approved > 0;
    const delta = hasPlan && prevHas ? (s.summary.rollup.achievedResult ?? 0) - (prev!.summary.rollup.achievedResult ?? 0) : null;
    return [String(k + 1), s.name, String(s.initiatives), String(s.summary.coverage.activities), String(s.summary.coverage.planned), w(s.summary.totalWeight), w(s.summary.rollup.weightedPlan), w(s.summary.rollup.weightedActual),
      hasPlan ? pct(s.summary.rollup.achievedResult) : '—', hasPlan ? pct(s.summary.rollup.achievedWithDelay) : '—', s.score30 == null ? '—' : s.score30.toFixed(1), s.rating,
      delta == null ? '—' : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)} pts`, String(s.activitiesDue), String(s.activitiesCompleted),
      String(s.summary.coverage.missing - s.summary.coverage.pending), String(s.summary.coverage.pending)];
  });
  const blanks = (n: number) => Array.from({ length: n }, () => '');
  streamRows.push(
    ['', 'Total, with duplication', String(totals.initiativesWithDuplication), String(totals.activities), String(totals.activitiesPlanned), ...blanks(12)],
    ['', 'Total, without duplication', String(totals.initiativesWithoutDuplication), String(totals.activities), ...blanks(13)],
    ['', 'Duplicated (shared initiatives)', String(totals.initiativesDuplicated), '0', ...blanks(13)],
  );
  table(
    ['#', 'Stream / director', 'Init.', 'Act.', 'Planned', 'Weight', 'Plan', 'Actual', 'Achievement', 'After delays', 'Score /30', 'Rating', 'vs last', 'Act. due', 'Act. done', 'Not sub.', 'Pending'],
    streamRows,
    { fontSize: 7.5, totalRows: new Set([m.streams.length, m.streams.length + 1, m.streams.length + 2]), columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 58 }, ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16].map(i => [i, { halign: 'right' }])) } }
  );
  doc.setFontSize(8); setColor(MUTED);
  const note = doc.splitTextToSize(pdfText(`Score /30 = achievement × 30. Ratings (set in Configuration): ${describeRatingBands(m.ratingThresholds)}. Achievement = weighted actual ÷ weighted plan for the period, from approved reports only; planned activities without an approved report count as zero.`), PW - 2 * M) as string[];
  ensure(note.length * 4);
  doc.text(note, M, y);

  // --- Footer on every page ----------------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 216, 200); doc.setLineWidth(0.2);
    doc.line(M, PH - M + 1, PW - M, PH - M + 1);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); setColor(MUTED);
    txt(`Nib International Bank · Strategic Plan Execution Dashboard · Generated ${generatedAt.toLocaleString('en-GB', { timeZone: 'Africa/Addis_Ababa' })}`, M, PH - M + 5);
    txt(`Page ${p} of ${pages}`, PW - M, PH - M + 5, { align: 'right' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}
