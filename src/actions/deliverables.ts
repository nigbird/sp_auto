'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { requirePermission, userCan } from '@/lib/auth/permissions-server';

export async function getDeliverables(activityId: string) {
  await requireUser();

  return prisma.deliverable.findMany({
    where: { activityId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createDeliverable(activityId: string, title: string, description?: string, dueDate?: string) {
  await requirePermission('strategic-plan:edit');

  const trimmed = title.trim();
  if (!trimmed) throw new Error("Deliverable title is required.");

  const deliverable = await prisma.deliverable.create({
    data: {
      activityId,
      title: trimmed,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });
  revalidatePath('/plan');
  return deliverable;
}

/** The activity's responsible person ticks their own deliverables; plan editors can tick any. */
export async function toggleDeliverableDelivered(id: string, delivered: boolean) {
  const user = await requireUser();

  const existing = await prisma.deliverable.findUnique({ where: { id }, select: { activity: { select: { responsibleId: true } } } });
  if (!existing) throw new Error("This deliverable no longer exists.");
  const isOwner = existing.activity.responsibleId === user.id && userCan(user, 'my-plan:update');
  if (!isOwner && !userCan(user, 'strategic-plan:edit')) throw new Error("You don't have permission to do this.");

  const deliverable = await prisma.deliverable.update({
    where: { id },
    data: {
      isDelivered: delivered,
      deliveredDate: delivered ? new Date() : null,
    },
  });
  revalidatePath('/plan');
  return deliverable;
}

export async function deleteDeliverable(id: string) {
  await requirePermission('strategic-plan:edit');

  await prisma.deliverable.delete({ where: { id } });
  revalidatePath('/plan');
}
