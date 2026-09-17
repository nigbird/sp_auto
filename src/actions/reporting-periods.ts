'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
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
  await requireUser();

  const newPeriod = await prisma.reportingPeriod.create({
    data: {
      strategicPlanId,
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      cutOffDate: new Date(data.cutOffDate),
    },
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
  await requireUser();

  const before = await prisma.reportingPeriod.findUnique({ where: { id } });

  const updateData: Record<string, unknown> = { ...data };
  if (data.startDate) updateData.startDate = new Date(data.startDate);
  if (data.endDate) updateData.endDate = new Date(data.endDate);
  if (data.cutOffDate) updateData.cutOffDate = new Date(data.cutOffDate);

  const updatedPeriod = await prisma.reportingPeriod.update({
    where: { id },
    data: updateData,
  });

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
  await requireUser();

  await prisma.reportingPeriod.delete({ where: { id } });
  revalidatePath('/settings/reporting-periods');
}
