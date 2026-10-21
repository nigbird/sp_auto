'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions-server';
import { changedFields, recordAudit } from '@/lib/auth/audit';
import type { ReportingPeriodStatus } from '@prisma/client';

export interface ReportingPeriodInput {
  name: string;
  startDate: string;
  endDate: string;
  cutOffDate: string;
}

export async function getReportingPeriods(strategicPlanId: string) {
  await requireUser();

  return prisma.reportingPeriod.findMany({
    where: { strategicPlanId },
    orderBy: { startDate: 'asc' },
  });
}

export async function createReportingPeriod(strategicPlanId: string, data: ReportingPeriodInput) {
  await requirePermission('settings:manage');

  const newPeriod = await prisma.reportingPeriod.create({
    data: {
      strategicPlanId,
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      cutOffDate: new Date(data.cutOffDate),
    },
  });
  await recordAudit({
    action: 'REPORTING_PERIOD_CREATED', entityType: 'ReportingPeriod', entityId: newPeriod.id,
    summary: `Created reporting period "${newPeriod.name}"`,
    metadata: { strategicPlanId, startDate: data.startDate, endDate: data.endDate, cutOffDate: data.cutOffDate },
  });

  // No activities can be tied to a brand-new period yet, so there's no other
  // natural audience — notify whoever holds a role with settings access
  // (i.e. the people who manage periods/plans).
  const roleIdsWithSettingsAccess = await prisma.rolePermission.findMany({
    where: { permission: 'settings:view' },
    select: { roleId: true },
  });
  const managers = await prisma.user.findMany({
    where: { status: 'ACTIVE', roleId: { in: roleIdsWithSettingsAccess.map((r) => r.roleId) } },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: managers.map((m) => ({
      type: 'PERIOD_OPENED',
      message: `Reporting period "${newPeriod.name}" is now open.`,
      date: new Date(),
      read: false,
      userId: m.id,
      reportingPeriodId: newPeriod.id,
    })),
  });

  revalidatePath('/settings/reporting-periods');
  return newPeriod;
}

export async function updateReportingPeriod(
  id: string,
  data: Partial<ReportingPeriodInput> & { status?: ReportingPeriodStatus }
) {
  await requirePermission('settings:manage');

  const before = await prisma.reportingPeriod.findUnique({ where: { id: String(id) } });

  // Field by field, never a spread of `data`: a crafted request could otherwise
  // move the period to another plan or overwrite its report-request record.
  const updateData: { name?: string; startDate?: Date; endDate?: Date; cutOffDate?: Date; status?: ReportingPeriodStatus } = {};
  if (data?.name !== undefined) {
    const name = String(data.name).trim();
    if (!name || name.length > 100) throw new Error('Give the period a name of at most 100 characters.');
    updateData.name = name;
  }
  for (const field of ['startDate', 'endDate', 'cutOffDate'] as const) {
    if (!data?.[field]) continue;
    const date = new Date(data[field]!);
    if (Number.isNaN(date.getTime())) throw new Error('One of the dates is not valid.');
    updateData[field] = date;
  }
  if (data?.status !== undefined) {
    if (data.status !== 'OPEN' && data.status !== 'CLOSED') throw new Error('Unknown period status.');
    updateData.status = data.status;
  }

  const updatedPeriod = await prisma.reportingPeriod.update({
    where: { id },
    data: updateData,
  });
  const changes = before ? changedFields(before, updateData) : {};
  if (Object.keys(changes).length > 0) {
    await recordAudit({
      action: 'REPORTING_PERIOD_UPDATED', entityType: 'ReportingPeriod', entityId: id,
      summary: changes.status
        ? `Changed reporting period "${updatedPeriod.name}" status to ${updatedPeriod.status.toLowerCase()}`
        : `Edited reporting period "${updatedPeriod.name}" (${Object.keys(changes).join(', ')})`,
      metadata: { changes },
    });
  }

  if (before && before.status !== 'CLOSED' && updatedPeriod.status === 'CLOSED') {
    const activities = await prisma.activity.findMany({
      where: { reportingPeriodId: id },
      select: { responsibleId: true },
    });
    const responsibleIds = [...new Set(activities.map((a) => a.responsibleId))];
    await prisma.notification.createMany({
      data: responsibleIds.map((userId) => ({
        type: 'PERIOD_CLOSED',
        message: `The reporting period "${updatedPeriod.name}" has been closed — updates can no longer be submitted for it.`,
        date: new Date(),
        read: false,
        userId,
        reportingPeriodId: updatedPeriod.id,
      })),
    });
  }

  revalidatePath('/settings/reporting-periods');
  return updatedPeriod;
}

export async function deleteReportingPeriod(id: string) {
  await requirePermission('settings:manage');

  const period = await prisma.reportingPeriod.delete({ where: { id } });
  await recordAudit({
    action: 'REPORTING_PERIOD_DELETED', entityType: 'ReportingPeriod', entityId: id,
    summary: `Deleted reporting period "${period.name}"`, metadata: { strategicPlanId: period.strategicPlanId },
  });
  revalidatePath('/settings/reporting-periods');
}
