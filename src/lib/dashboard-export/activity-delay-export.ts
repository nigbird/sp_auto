import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { cleanPdfCell, pdfText } from '@/lib/pdf-text';
import { DELIVERY_STATE_LABEL, type ActivityDelayRow } from '@/lib/dashboard-metrics';
import { formatDays, groupDelayRows } from '@/lib/activity-delay-table';
import { SheetBuilder, writeStyledWorkbook, type StyledCell } from './xlsx-styling';

/**
 * The "Work Stream / Initiatives Assigned / # of Days Delayed / Major
 * Activities / # of Days Delayed" table as an Excel sheet and as PDF pages —
 * used on its own (the table's filtered export) and inside the full dashboard
 * export.
 */

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');

const HEAD = ['Work Stream / Department', 'Initiatives Assigned', '# of Days Delayed', 'Major Activities', 'Deliverable', 'Due Date', 'Completed', '# of Days Delayed', 'Activity Status', 'Delivery'];

/** A styled sheet with the stream and initiative cells merged down their rows, as in the Excel. */
export function activityDelaySheet(rows: ActivityDelayRow[], subtitle: string, filterLabel: string, name = 'Activity Delays'): SheetBuilder {
  const sh = new SheetBuilder(name, [30, 38, 11, 56, 34, 13, 13, 11, 26, 18]);
  sh.row([{ v: 'Activity delays', role: 'title' }]);
  sh.row([{ v: subtitle, role: 'subtitle' }]);
  sh.row([{ v: `${filterLabel} · ${rows.length} activit${rows.length === 1 ? 'y' : 'ies'} · Days delayed = completion date (or period end if open) − due date; negative = days still to go.`, role: 'label' }]);
  sh.blank();
  const header = sh.row(HEAD, 'header');
  sh.rowHeights.set(header, 30);
  sh.freezeRows = header + 1;

  if (rows.length === 0) {
    sh.row([{ v: 'No activities match the selected filters.', role: 'label' }]);
    return sh;
  }

  for (const stream of groupDelayRows(rows)) {
    const streamStart = sh.rows.length;
    for (const initiative of stream.initiatives) {
      const initiativeStart = sh.row([
        { v: stream.stream, role: 'wrap' },
        { v: `${initiative.code} ${initiative.title}`, role: 'wrap' },
        { v: initiative.worstDelay, role: 'groupInt' },
        ...Array.from({ length: 7 }, (): StyledCell => ({ v: '', role: 'group' })),
      ]);
      for (const r of initiative.rows) {
        sh.row([
          '', '', '',
          { v: r.activity, role: 'wrap' },
          { v: r.deliverable ?? '', role: 'wrap' },
          { v: day(r.dueDate), role: 'text' },
          { v: r.completionDate ? day(r.completionDate) : '', role: 'text' },
          { v: r.daysDelayed, role: 'int' },
          { v: r.status, role: 'text' },
          { v: DELIVERY_STATE_LABEL[r.delivery], role: 'text' },
        ]);
      }
      sh.merge(initiativeStart, 1, 1, sh.rows.length - 1);
    }
    sh.merge(streamStart, 0, 0, sh.rows.length - 1);
  }
  sh.autoFilter = `A${header + 1}:J${sh.rows.length}`;
  return sh;
}

export function buildActivityDelayWorkbook(rows: ActivityDelayRow[], subtitle: string, filterLabel: string): Buffer {
  return writeStyledWorkbook([activityDelaySheet(rows, subtitle, filterLabel)]);
}

const BROWN: [number, number, number] = [94, 66, 49];
const INK: [number, number, number] = [47, 42, 37];
const MUTED: [number, number, number] = [133, 123, 112];
const GROUP: [number, number, number] = [243, 234, 219];
const LATE: [number, number, number] = [192, 57, 43];

/** Draws the table with row spans for stream and initiative. Returns the y after it. */
export function drawActivityDelayTable(doc: jsPDF, rows: ActivityDelayRow[], startY: number, margin: number): number {
  const body: RowInput[] = [];
  for (const stream of groupDelayRows(rows)) {
    const streamSpan = stream.initiatives.reduce((n, i) => n + i.rows.length + 1, 0);
    stream.initiatives.forEach((initiative, k) => {
      const first: RowInput = [];
      if (k === 0) first.push({ content: stream.stream, rowSpan: streamSpan, styles: { fontStyle: 'bold', fillColor: [232, 240, 250] } });
      first.push(
        { content: `${initiative.code} ${initiative.title}`, rowSpan: initiative.rows.length + 1, styles: { fontStyle: 'bold' } },
        { content: formatDays(initiative.worstDelay), styles: { halign: 'right', fontStyle: 'bold', fillColor: GROUP, textColor: (initiative.worstDelay ?? 0) > 0 ? LATE : INK } },
        { content: '', colSpan: 5, styles: { fillColor: GROUP } },
      );
      body.push(first);
      for (const r of initiative.rows) {
        // Stream and initiative cells are row-spanned above; '' fills the initiative "# Days" column.
        body.push([
          '',
          r.activity,
          r.dueDate ? day(r.dueDate) : '—',
          { content: formatDays(r.daysDelayed), styles: { halign: 'right', textColor: (r.daysDelayed ?? 0) > 0 && r.delivery !== 'completedOnTime' ? LATE : (r.daysDelayed ?? 0) < 0 ? MUTED : INK } },
          r.status,
          DELIVERY_STATE_LABEL[r.delivery],
        ]);
      }
    });
  }

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin, bottom: margin + 6 },
    head: [['Work Stream / Department', 'Initiatives Assigned', '# Days', 'Major Activities', 'Due', '# Days', 'Activity Status', 'Delivery']],
    body: body.length ? body : [[{ content: 'No activities match the selected filters.', colSpan: 8, styles: { textColor: MUTED } }]],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5, textColor: INK, lineColor: [226, 216, 200], lineWidth: 0.1, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: BROWN, textColor: [255, 255, 255], fontStyle: 'bold', valign: 'middle' },
    columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 52 }, 2: { cellWidth: 14 }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 22 }, 5: { cellWidth: 14 }, 6: { cellWidth: 36 }, 7: { cellWidth: 26 } },
    didParseCell: cleanPdfCell,
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

export function buildActivityDelayPdf(rows: ActivityDelayRow[], title: string, subtitle: string, filterLabel: string, generatedAt = new Date()): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const M = 12;
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...BROWN);
  doc.text(pdfText(title), M, M + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
  doc.text(pdfText(subtitle), M, M + 12);
  doc.text(pdfText(`${filterLabel} · ${rows.length} activities · Days delayed = completion (or period end if open) - due date; negative = days still to go.`), M, M + 17);
  drawActivityDelayTable(doc, rows, M + 21, M);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(pdfText(`Generated ${generatedAt.toLocaleString('en-GB', { timeZone: 'Africa/Addis_Ababa' })}`), M, PH - M + 5);
    doc.text(`Page ${p} of ${pages}`, PW - M, PH - M + 5, { align: 'right' });
  }
  return Buffer.from(doc.output('arraybuffer'));
}
