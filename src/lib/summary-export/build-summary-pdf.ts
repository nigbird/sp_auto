import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cleanPdfCell, pdfText } from '@/lib/pdf-text';
import { parseBody } from '@/lib/report-summary';
import { longDate, numberedTables, type SummaryDocument } from './summary-document';

const ACCENT: [number, number, number] = [217, 119, 6];
const MARGIN = 18;
const LINE = 5.2;

/** The summary as a portrait A4 PDF: cover, then every section in order, with the work-stream table under its section. */
export function buildSummaryPdf(doc: SummaryDocument): Buffer {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const textWidth = width - MARGIN * 2;
  let y = MARGIN;

  const ensure = (needed: number) => {
    if (y + needed > height - MARGIN) { pdf.addPage(); y = MARGIN; }
  };
  const write = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number } = {}) => {
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    pdf.setFontSize(opts.size ?? 10.5);
    pdf.setTextColor(...(opts.color ?? [17, 24, 39]));
    const indent = opts.indent ?? 0;
    const lines: string[] = pdf.splitTextToSize(pdfText(text), textWidth - indent);
    for (const line of lines) {
      ensure(LINE);
      pdf.text(line, MARGIN + indent, y);
      y += LINE * ((opts.size ?? 10.5) / 10.5);
    }
    y += opts.gap ?? 2.5;
  };

  // Cover.
  y = height * 0.33;
  for (const [text, size] of [[doc.planName.toUpperCase(), 20], ['STRATEGIC INITIATIVES', 17], [`${doc.periodName.toUpperCase()} PERFORMANCE REPORT`, 17]] as const) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(size);
    pdf.setTextColor(...(size === 20 ? ACCENT : [17, 24, 39] as [number, number, number]));
    for (const line of pdf.splitTextToSize(pdfText(text), textWidth) as string[]) { pdf.text(line, width / 2, y, { align: 'center' }); y += size * 0.5; }
    y += 4;
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(75, 85, 99);
  pdf.text(pdfText(`Version ${doc.planVersion} | As of ${longDate(doc.periodEndDate)}`), width / 2, y + 10, { align: 'center' });

  pdf.addPage();
  y = MARGIN;
  const tablesBySection = numberedTables(doc);
  for (const s of doc.sections) {
    ensure(18);
    if (s.level === 1) write(s.heading, { size: 14, bold: true, color: ACCENT, gap: 3 });
    else write(s.heading, { size: 12, bold: true, gap: 2 });
    for (const block of parseBody(s.body)) {
      if (block.type === 'paragraph') write(block.text, { gap: 3 });
      else {
        for (const item of block.items) {
          ensure(LINE);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10.5);
          pdf.text('-', MARGIN + 2, y);
          write(item, { indent: 6, gap: 0.8 });
        }
        y += 2;
      }
    }
    for (const { number, table: t } of tablesBySection.get(s.key) ?? []) {
      ensure(20);
      write(`Table ${number}. ${t.title}`, { size: 9.5, bold: true, gap: 1 });
      const total = (t.widths ?? t.head.map(() => 1)).reduce((a, b) => a + b, 0);
      const columnStyles: Record<number, { cellWidth?: number; halign?: 'center' }> = {};
      t.head.forEach((_, c) => {
        columnStyles[c] = { ...(t.widths ? { cellWidth: (t.widths[c] / total) * textWidth } : {}), ...(t.center?.includes(c) ? { halign: 'center' as const } : {}) };
      });
      autoTable(pdf, {
        didParseCell: cleanPdfCell,
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [t.head],
        body: t.rows.map((r, n) => r.map(v => (t.boldRows?.includes(n) ? { content: v, styles: { fontStyle: 'bold' as const } } : v))),
        styles: { fontSize: 7.5, cellPadding: 1.4, valign: 'top' },
        columnStyles,
        headStyles: { fillColor: ACCENT, fontSize: 7.5 },
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
      if (t.note) write(t.note, { size: 8, color: [107, 114, 128], gap: 1 });
      y += 3;
    }
    y += 2;
  }

  const pages = pdf.getNumberOfPages();
  for (let n = 2; n <= pages; n++) {
    pdf.setPage(n);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text(pdfText(`${doc.planName} - ${doc.periodName} performance report`), MARGIN, height - 8);
    pdf.text(`Page ${n - 1} of ${pages - 1}`, width - MARGIN, height - 8, { align: 'right' });
  }
  return Buffer.from(pdf.output('arraybuffer'));
}
