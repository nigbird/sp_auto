import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { userCan } from '@/lib/auth/permissions-server';
import { recordAudit } from '@/lib/auth/audit';
import { buildPerformanceTree, describeFilters, filterPerformanceTree, filtersFromParams, isNarrowed } from '@/lib/performance-report';
import { buildPerformanceWorkbook } from '@/lib/performance-export/build-performance-workbook';

export const dynamic = 'force-dynamic';

/**
 * Downloads the performance report for `?period=<reportingPeriodId>` (or the
 * most recent period that had a report request) as a styled Excel workbook.
 * The report page's filters (`q`, `pillar`, `owner`, `report`, `result`,
 * `from`, `to`) narrow it the same way they narrow the page.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!(userCan(user, 'reports:export') && userCan(user, 'reports:view'))) {
    return NextResponse.json({ error: "You don't have permission to export this." }, { status: 403 });
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

  const search = request.nextUrl.searchParams;
  const requested = search.get('period');
  const period = requested
    ? await prisma.reportingPeriod.findFirst({ where: { id: requested, strategicPlanId: id } })
    : await prisma.reportingPeriod.findFirst({ where: { strategicPlanId: id, reportRequestSentAt: { not: null } }, orderBy: { endDate: 'desc' } });
  if (!period) {
    return NextResponse.json({ error: requested ? 'That reporting period does not belong to this plan.' : 'This plan has no reporting period to export yet.' }, { status: 404 });
  }

  const entries = await prisma.activityPeriodEntry.findMany({ where: { reportingPeriodId: period.id, reportStatus: { not: 'NOT_REQUESTED' } } });
  const filters = filtersFromParams(search);
  const pillars = filterPerformanceTree(buildPerformanceTree(plan.pillars, entries, period.endDate), filters);
  const filterText = describeFilters(filters, plan.pillars.find(p => p.id === filters.pillar)?.title);

  const generatedAt = new Date();
  const buffer = buildPerformanceWorkbook({ planName: plan.name, period, pillars, filters: filterText, generatedAt });

  const safeName = `${plan.name} - Performance Report - ${period.name}${isNarrowed(filters) ? ' (filtered)' : ''}`.replace(/[^\w\s().-]+/g, '').replace(/\s+/g, ' ').trim() || 'performance-report';
  await recordAudit({
    action: 'PERFORMANCE_REPORT_EXPORTED', entityType: 'StrategicPlan', entityId: plan.id,
    summary: `Exported the ${period.name} performance report for "${plan.name}" as Excel${filterText ? ` (filtered: ${filterText})` : ''}`,
    metadata: { format: 'xlsx', reportingPeriodId: period.id, filters: filterText || null },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}.xlsx"; filename*=UTF-8''${encodeURIComponent(safeName)}.xlsx`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
