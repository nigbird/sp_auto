import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions-server';
import { buildPlanWorkbook } from '@/lib/plan-export/build-plan-workbook';
import { buildPerformancePdf } from '@/lib/plan-export/build-performance-pdf';

/**
 * Downloads a strategic plan as an Excel workbook in the cascaded-initiatives
 * layout, with the report columns filled from approved reports for
 * `?period=<reportingPeriodId>` (or the most recent period that had a report
 * request, when none is given). `?period=none` exports the plan only.
 * `?format=pdf` returns that period's performance report as a PDF instead.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const allowed = (await hasPermission(user.roleId, 'reports:export')) || (await hasPermission(user.roleId, 'strategic-plan:view'));
  if (!allowed) {
    return NextResponse.json({ error: "You don't have permission to export plans." }, { status: 403 });
  }

  const { id } = await params;
  const plan = await prisma.strategicPlan.findUnique({
    where: { id },
    include: {
      pillars: {
        orderBy: { createdAt: 'asc' },
        include: {
          objectives: {
            orderBy: { createdAt: 'asc' },
            include: {
              initiatives: {
                orderBy: { createdAt: 'asc' },
                include: {
                  activities: {
                    orderBy: { createdAt: 'asc' },
                    include: { responsible: { select: { name: true } }, monthlyTargets: { orderBy: { month: 'asc' } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  const requested = request.nextUrl.searchParams.get('period');
  const period = requested === 'none'
    ? null
    : requested
      ? await prisma.reportingPeriod.findFirst({ where: { id: requested, strategicPlanId: id } })
      : await prisma.reportingPeriod.findFirst({ where: { strategicPlanId: id, reportRequestSentAt: { not: null } }, orderBy: { endDate: 'desc' } });
  if (requested && requested !== 'none' && !period) {
    return NextResponse.json({ error: 'That reporting period does not belong to this plan.' }, { status: 404 });
  }
  const entries = period ? await prisma.activityPeriodEntry.findMany({ where: { reportingPeriodId: period.id } }) : [];

  const asPdf = request.nextUrl.searchParams.get('format') === 'pdf';
  const buffer = asPdf ? buildPerformancePdf(plan, period, entries) : buildPlanWorkbook(plan, period, entries);
  const safeName = `${plan.name} v${plan.version}${period ? ` - ${period.name}` : ''}${asPdf ? ' - performance report' : ''}`.replace(/[^\w\s.-]+/g, '').trim() || 'strategic-plan';
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
