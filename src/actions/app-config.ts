'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions-server';
import { recordAudit } from '@/lib/auth/audit';
import { DEFAULT_RATING_THRESHOLDS, parseRatingThresholds, validateRatingThresholds, type RatingThresholds } from '@/lib/rating-bands';

export async function getAppConfig() {
  await requireUser();

  return prisma.appConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

export async function updateAchievementCap(value: number) {
  await requirePermission('settings:manage');

  if (!Number.isFinite(value) || value < 100) {
    throw new Error("The achievement cap must be a number of at least 100.");
  }

  const before = await prisma.appConfig.findUnique({ where: { id: 'singleton' }, select: { achievementCapPercent: true } });
  const config = await prisma.appConfig.upsert({
    where: { id: 'singleton' },
    update: { achievementCapPercent: value },
    create: { id: 'singleton', achievementCapPercent: value },
  });
  if (before?.achievementCapPercent !== value) {
    await recordAudit({
      action: 'ACHIEVEMENT_CAP_UPDATED', entityType: 'AppConfig', entityId: 'singleton',
      summary: `Changed the achievement cap${before ? ` from ${before.achievementCapPercent}%` : ''} to ${value}%`,
      metadata: { from: before?.achievementCapPercent ?? null, to: value },
    });
  }
  revalidatePath('/settings/rules');
  return config;
}

/** The dashboard's rating thresholds (percent), or the Excel defaults when none are saved. */
export async function getRatingThresholds(): Promise<RatingThresholds> {
  await requireUser();
  const config = await prisma.appConfig.findUnique({ where: { id: 'singleton' }, select: { ratingBands: true } });
  return parseRatingThresholds(config?.ratingBands);
}

export async function updateRatingThresholds(input: RatingThresholds): Promise<RatingThresholds> {
  await requirePermission('settings:manage');
  const thresholds: RatingThresholds = {
    outstanding: Number(input.outstanding),
    veryGood: Number(input.veryGood),
    good: Number(input.good),
    fair: Number(input.fair),
  };
  const problem = validateRatingThresholds(thresholds);
  if (problem) throw new Error(problem);

  const before = await getRatingThresholds();
  await prisma.appConfig.upsert({
    where: { id: 'singleton' },
    update: { ratingBands: { ...thresholds } },
    create: { id: 'singleton', ratingBands: { ...thresholds } },
  });
  await recordAudit({
    action: 'RATING_THRESHOLDS_UPDATED', entityType: 'AppConfig', entityId: 'singleton',
    summary: `Changed rating thresholds to Outstanding ≥${thresholds.outstanding}%, Very good ≥${thresholds.veryGood}%, Good ≥${thresholds.good}%, Fair ≥${thresholds.fair}%`,
    metadata: { from: before, to: thresholds },
  });
  revalidatePath('/settings/rules');
  revalidatePath('/');
  return thresholds;
}

export async function resetRatingThresholds(): Promise<RatingThresholds> {
  await requirePermission('settings:manage');
  await prisma.appConfig.upsert({
    where: { id: 'singleton' },
    update: { ratingBands: Prisma.DbNull },
    create: { id: 'singleton' },
  });
  await recordAudit({
    action: 'RATING_THRESHOLDS_RESET', entityType: 'AppConfig', entityId: 'singleton',
    summary: 'Reset rating thresholds to the defaults', metadata: { to: DEFAULT_RATING_THRESHOLDS },
  });
  revalidatePath('/settings/rules');
  revalidatePath('/');
  return DEFAULT_RATING_THRESHOLDS;
}
