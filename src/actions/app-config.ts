'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';

export async function getAppConfig() {
  await requireUser();

  return prisma.appConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

export async function updateAchievementCap(value: number) {
  await requireUser();

  if (!Number.isFinite(value) || value < 100) {
    throw new Error("The achievement cap must be a number of at least 100.");
  }

  const config = await prisma.appConfig.upsert({
    where: { id: 'singleton' },
    update: { achievementCapPercent: value },
    create: { id: 'singleton', achievementCapPercent: value },
  });
  revalidatePath('/settings/rules');
  return config;
}
