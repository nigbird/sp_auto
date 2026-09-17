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
  revalidatePath('/settings/reporting-periods');
  return newPeriod;
}

export async function updateReportingPeriod(
  id: string,
  data: Partial<ReportingPeriodInput> & { status?: ReportingPeriodStatus }
) {
  await requireUser();

  const updateData: Record<string, unknown> = { ...data };
  if (data.startDate) updateData.startDate = new Date(data.startDate);
  if (data.endDate) updateData.endDate = new Date(data.endDate);
  if (data.cutOffDate) updateData.cutOffDate = new Date(data.cutOffDate);

  const updatedPeriod = await prisma.reportingPeriod.update({
    where: { id },
    data: updateData,
  });
  revalidatePath('/settings/reporting-periods');
  return updatedPeriod;
}

export async function deleteReportingPeriod(id: string) {
  await requireUser();

  await prisma.reportingPeriod.delete({ where: { id } });
  revalidatePath('/settings/reporting-periods');
}
