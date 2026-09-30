import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { userCan } from '@/lib/auth/permissions-server';
import { loadDashboard } from '@/lib/dashboard-data';
import { delayFilterFromParams, describeDelayFilter, filterDelayRows } from '@/lib/activity-delay-table';
import { buildActivityDelayPdf, buildActivityDelayWorkbook } from '@/lib/dashboard-export/activity-delay-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The dashboard's activity-delay table for `?plan=&period=`, filtered exactly as
 * on screen (`status`, `delivery`, `stream`, `q`). `?format=pdf` for a PDF,
 * otherwise Excel.
 */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const canView = userCan(user, 'dashboard:view', 'dashboard:view-own');
  if (!canView || !userCan(user, 'reports:export')) {
    return NextResponse.json({ error: "You don't have permission to export this." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  // loadDashboard limits a dashboard:view-own user to their own activities.
  const data = await loadDashboard(params.get('plan') ?? undefined, params.get('period') ?? undefined);
  if (data.state !== 'ready') {
    return NextResponse.json({ error: data.state === 'no-plan' ? 'There is no strategic plan to export.' : 'This plan has no reporting period yet.' }, { status: 404 });
  }

  const filter = delayFilterFromParams(params);
  const rows = filterDelayRows(data.metrics.activityDelayRows, filter);
  const asOf = new Date(data.period.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const subtitle = `${data.plan.name} · As of ${asOf} (${data.period.name})`;
  const asPdf = params.get('format') === 'pdf';
  const buffer = asPdf
    ? buildActivityDelayPdf(rows, 'Activity delays', subtitle, describeDelayFilter(filter))
    : buildActivityDelayWorkbook(rows, subtitle, describeDelayFilter(filter));

  const safeName = `${data.plan.name} - Activity delays - ${data.period.name}`.replace(/[^\w\s.-]+/g, '').replace(/\s+/g, ' ').trim() || 'activity-delays';
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
