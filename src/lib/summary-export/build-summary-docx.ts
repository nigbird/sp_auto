import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer, PageBreak, PageNumber, Paragraph, ShadingType,
  Table, TableCell, TableOfContents, TableRow, TextRun, WidthType,
} from 'docx';
import { parseBody } from '@/lib/report-summary';
import type { SummaryTable } from '@/lib/summary-tables';
import { longDate, numberedTables, type SummaryDocument } from './summary-document';

const ACCENT = 'D97706';
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function cell(text: string, opts: { bold?: boolean; header?: boolean; center?: boolean; width?: number }) {
  // A cell's line breaks become separate paragraphs; "- " lines stay as typed.
  return new TableCell({
    borders: BORDERS,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.header ? { type: ShadingType.CLEAR, color: 'auto', fill: ACCENT } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: (text || ' ').split('\n').map(line => new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: line, bold: opts.bold || opts.header, color: opts.header ? 'FFFFFF' : undefined, size: 18 })],
    })),
  });
}

function table(number: number, t: SummaryTable): (Paragraph | Table)[] {
  const total = (t.widths ?? t.head.map(() => 1)).reduce((a, b) => a + b, 0);
  const width = (c: number) => (t.widths ? Math.round((t.widths[c] / total) * 100) : undefined);
  const center = (c: number) => !!t.center?.includes(c);
  return [
    new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: `Table ${number}. ${t.title}`, bold: true, size: 20 })] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: t.head.map((h, c) => cell(h, { header: true, center: center(c), width: width(c) })) }),
        ...t.rows.map((r, n) => new TableRow({ children: r.map((v, c) => cell(v, { bold: t.boldRows?.includes(n), center: center(c), width: width(c) })) })),
      ],
    }),
    ...(t.note ? [new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: t.note, italics: true, size: 16, color: '6B7280' })] })] : []),
    new Paragraph({ spacing: { after: 200 } }),
  ];
}

function bodyParagraphs(body: string): Paragraph[] {
  return parseBody(body).flatMap(block => block.type === 'paragraph'
    ? [new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 300 }, children: [new TextRun(block.text)] })]
    : block.items.map(item => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun(item)] })));
}

/** The summary as an editable Word document: cover page, contents, then every section in order. */
export async function buildSummaryDocx(doc: SummaryDocument): Promise<Buffer> {
  const cover = [
    new Paragraph({ spacing: { before: 2400 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: doc.planName.toUpperCase(), bold: true, size: 40, color: ACCENT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240 }, children: [new TextRun({ text: 'STRATEGIC INITIATIVES', bold: true, size: 36 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${doc.periodName.toUpperCase()} PERFORMANCE REPORT`, bold: true, size: 36 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480 }, children: [new TextRun({ text: `Version ${doc.planVersion}`, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `As of ${longDate(doc.periodEndDate)}`, size: 24 })] }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Contents')] }),
    new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const tablesBySection = numberedTables(doc);
  const content = doc.sections.flatMap(s => [
    new Paragraph({ heading: s.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun(s.heading)] }),
    ...bodyParagraphs(s.body),
    ...(tablesBySection.get(s.key) ?? []).flatMap(({ number, table: t }) => table(number, t)),
  ]);

  const document = new Document({
    creator: 'Strategic Plan Automation',
    title: `${doc.planName} - ${doc.periodName} performance report`,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, color: ACCENT }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, color: '1F2937' }, paragraph: { spacing: { before: 200, after: 100 } } },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16 })] })],
        }),
      },
      children: [...cover, ...content],
    }],
  });
  return Packer.toBuffer(document);
}
