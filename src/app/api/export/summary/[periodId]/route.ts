import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { forbiddenResponse, userCan } from '@/lib/auth/permissions-server';
import { recordAudit } from '@/lib/auth/audit';
import { loadSummarySource, loadSummaryTables } from '@/lib/report-summary-data';
import { buildSummaryDocx } from '@/lib/summary-export/build-summary-docx';
import { buildSummaryPdf } from '@/lib/summary-export/build-summary-pdf';
import type { SummaryDocument } from '@/lib/summary-export/summary-document';

export const dynamic = 'force-dynamic';

/**
 * Downloads a reporting period's report summary, as edited on the summary
 * page, as a Word document (`?format=docx`, the default, so it can be edited
 * further) or a PDF (`?format=pdf`). Each section's tables are filled from the
 * current approved reports and the dashboard's figures.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ periodId: string }> }) {
  const user = await requireUser();
  if (!(userCan(user, 'reports:export') && userCan(user, 'reports:view'))) {
    return forbiddenResponse(['reports:view', 'reports:export']);
  }

  const { periodId } = await params;
  const source = await loadSummarySource(periodId);
  if (!source) return NextResponse.json({ error: 'Reporting period not found' }, { status: 404 });
  if (!source.summary || source.summary.sections.length === 0) {
    return NextResponse.json({ error: 'No summary has been generated for this period yet.' }, { status: 404 });
  }

  const asPdf = request.nextUrl.searchParams.get('format') === 'pdf';
  const doc: SummaryDocument = {
    planName: source.plan.name,
    planVersion: source.plan.version,
    periodName: source.period.name,
    periodEndDate: source.period.endDate,
    sections: source.summary.sections,
    tables: (await loadSummaryTables(source)).tables,
  };
  const buffer = asPdf ? buildSummaryPdf(doc) : await buildSummaryDocx(doc);
  const extension = asPdf ? 'pdf' : 'docx';
  const safeName = `${source.plan.name} - ${source.period.name} - report summary`.replace(/[^\w\s.-]+/g, '').trim() || 'report-summary';

  await recordAudit({
    action: 'REPORT_SUMMARY_EXPORTED', entityType: 'ReportingPeriod', entityId: periodId,
    summary: `Exported the ${source.period.name} report summary as ${asPdf ? 'PDF' : 'Word'}`,
    metadata: { format: extension },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': asPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeName}.${extension}"; filename*=UTF-8''${encodeURIComponent(safeName)}.${extension}`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
