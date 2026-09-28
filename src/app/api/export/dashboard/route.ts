import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions-server';
import { loadDashboard } from '@/lib/dashboard-data';
import { renderDashboardCharts } from '@/lib/dashboard-export/dashboard-charts';
import { buildDashboardWorkbook } from '@/lib/dashboard-export/build-dashboard-workbook';
import { buildDashboardPdf } from '@/lib/dashboard-export/build-dashboard-pdf';

// sharp (chart rendering) needs the Node.js runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Downloads the executive dashboard for `?plan=<id>&period=<id>` (defaults as on
 * the dashboard). `?format=pdf` returns the PDF report; otherwise an Excel
 * workbook with one sheet per dashboard tab and the charts as images.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const allowed = (await hasPermission(user.roleId, 'reports:export')) || (await hasPermission(user.roleId, 'strategic-plan:view'));
  if (!allowed) {
    return NextResponse.json({ error: "You don't have permission to export the dashboard." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const data = await loadDashboard(params.get('plan') ?? undefined, params.get('period') ?? undefined);
  if (data.state !== 'ready') {
    return NextResponse.json({ error: data.state === 'no-plan' ? 'There is no strategic plan to export.' : 'This plan has no reporting period to export yet.' }, { status: 404 });
  }

  const asPdf = params.get('format') === 'pdf';
  const generatedAt = new Date();
  const charts = await renderDashboardCharts(data.metrics, data.trend);
  const buffer = asPdf ? buildDashboardPdf(data, charts, generatedAt) : buildDashboardWorkbook(data, charts, generatedAt);

  const safeName = `${data.plan.name} - Dashboard - ${data.period.name}`.replace(/[^\w\s.-]+/g, '').replace(/\s+/g, ' ').trim() || 'dashboard';
  const extension = asPdf ? 'pdf' : 'xlsx';

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': asPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}.${extension}"; filename*=UTF-8''${encodeURIComponent(safeName)}.${extension}`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
