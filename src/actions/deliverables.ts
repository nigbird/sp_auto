'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';

export async function getDeliverables(activityId: string) {
  await requireUser();

  return prisma.deliverable.findMany({
    where: { activityId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createDeliverable(activityId: string, title: string, description?: string, dueDate?: string) {
  await requireUser();

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
  revalidatePath('/my-activity');
  return deliverable;
}

export async function toggleDeliverableDelivered(id: string, delivered: boolean) {
  await requireUser();

  const deliverable = await prisma.deliverable.update({
    where: { id },
    data: {
      isDelivered: delivered,
      deliveredDate: delivered ? new Date() : null,
    },
  });
  revalidatePath('/my-activity');
  return deliverable;
}

export async function deleteDeliverable(id: string) {
  await requireUser();

  await prisma.deliverable.delete({ where: { id } });
  revalidatePath('/my-activity');
}
