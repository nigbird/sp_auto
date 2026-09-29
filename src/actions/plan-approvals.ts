'use server'

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions-server';
import { monthKey, type TargetAggregation, type TargetType } from '@/lib/monthly-breakdown';

export type PlanApprovalResult = { success: true } | { success: false; message: string };

/** Where an activity stands on its way into the plan, from the activity and breakdown fields. */
export type PlanStage =
  | 'activityPending'   // new activity waiting for approval
  | 'activityReturned'  // new activity sent back
  | 'notSent'           // breakdown request not sent yet
  | 'requested'         // request sent, owner hasn't responded
  | 'ownerDeclined'     // owner declined the request
  | 'drafting'          // owner accepted, breakdown not submitted yet
  | 'breakdownPending'  // breakdown waiting for approval
  | 'breakdownReturned' // breakdown sent back
  | 'approved';         // breakdown approved: the activity is fully planned

export interface PlanApprovalActivity {
  id: string;
  title: string;
  leadOwner: string | null;
  department: string;
  responsible: string | null;
  startDate: string;
  endDate: string;
  weight: number;
  countsTowardWeight: boolean;
  initiative: string;
  objective: string;
  pillar: string;
  deliverable: string | null;
  proposedByOwner: boolean;
  stage: PlanStage;
  /** The reason given when the activity or its breakdown was returned or declined. */
  reason: string | null;
  updatedAt: string;
  // Detail view
  description: string | null;
  targetType: TargetType | null;
  annualTarget: number | null;
  targetAggregation: TargetAggregation;
  lowerIsBetter: boolean;
  /** Approved or submitted monthly targets, keyed by month ("2026-07"). */
  monthlyTargets: { month: string; value: number }[];
  planSubmittedAt: string | null;
  planApprovedAt: string | null;
}

export interface PlanApprovalOverview {
  plans: { id: string; name: string; version: string; status: string }[];
  planId: string | null;
  activities: PlanApprovalActivity[];
}

function stageOf(a: {
  approvalStatus: string;
  planRequestStatus: string;
  planSubmissionStatus: string | null;
}): PlanStage {
  if (a.approvalStatus === 'PENDING' && a.planSubmissionStatus !== 'PENDING') return 'activityPending';
  if (a.approvalStatus === 'DECLINED') return 'activityReturned';
  if (a.planSubmissionStatus === 'APPROVED') return 'approved';
  if (a.planSubmissionStatus === 'PENDING') return 'breakdownPending';
  if (a.planSubmissionStatus === 'DECLINED') return 'breakdownReturned';
  if (a.planRequestStatus === 'DECLINED') return 'ownerDeclined';
  if (a.planRequestStatus === 'ACCEPTED') return 'drafting';
  if (a.planRequestStatus === 'SENT') return 'requested';
  return 'notSent';
}

/** Every activity of one plan (default: the published plan) with its approval stage. */
export async function getPlanApprovalOverview(planId?: string): Promise<PlanApprovalOverview> {
  await requirePermission('plan-approvals:view');

  const plans = await prisma.strategicPlan.findMany({
    where: { isActive: true },
    select: { id: true, name: true, version: true, status: true },
    orderBy: { updatedAt: 'desc' },
  });
  const plan = plans.find(p => p.id === planId) ?? plans.find(p => p.status === 'PUBLISHED') ?? plans[0];
  if (!plan) return { plans, planId: null, activities: [] };

  const rows = await prisma.activity.findMany({
    where: { initiative: { objective: { pillar: { strategicPlanId: plan.id } } } },
    select: {
      id: true, title: true, leadOwner: true, department: true, startDate: true, endDate: true, weight: true, countsTowardWeight: true,
      deliverable: true, proposedByOwner: true, approvalStatus: true, declineReason: true,
      planRequestStatus: true, planRequestDeclineReason: true, planSubmissionStatus: true, planDeclineReason: true, updatedAt: true,
      description: true, targetType: true, annualTarget: true, targetAggregation: true, targetDirection: true,
      planSubmittedAt: true, planApprovedAt: true,
      monthlyTargets: { select: { month: true, value: true }, orderBy: { month: 'asc' } },
      responsible: { select: { name: true } },
      initiative: { select: { title: true, objective: { select: { statement: true, pillar: { select: { title: true } } } } } },
    },
    orderBy: [{ endDate: 'asc' }, { title: 'asc' }],
  });

  const activities = rows.map((a): PlanApprovalActivity => {
    const stage = stageOf(a);
    const reason =
      stage === 'activityReturned' ? a.declineReason
      : stage === 'breakdownReturned' ? a.planDeclineReason
      : stage === 'ownerDeclined' ? a.planRequestDeclineReason
      : null;
    return {
      id: a.id,
      title: a.title,
      leadOwner: a.leadOwner,
      department: a.department,
      responsible: a.responsible?.name ?? null,
      startDate: a.startDate.toISOString(),
      endDate: a.endDate.toISOString(),
      weight: a.weight,
      countsTowardWeight: a.countsTowardWeight,
      initiative: a.initiative.title,
      objective: a.initiative.objective.statement,
      pillar: a.initiative.objective.pillar.title,
      deliverable: a.deliverable,
      proposedByOwner: a.proposedByOwner,
      stage,
      reason: reason ?? null,
      updatedAt: a.updatedAt.toISOString(),
      description: a.description,
      targetType: a.targetType,
      annualTarget: a.annualTarget,
      targetAggregation: a.targetAggregation,
      lowerIsBetter: a.targetDirection === 'LOWER_IS_BETTER',
      monthlyTargets: a.monthlyTargets.map(t => ({ month: monthKey(t.month), value: t.value })),
      planSubmittedAt: a.planSubmittedAt?.toISOString() ?? null,
      planApprovedAt: a.planApprovedAt?.toISOString() ?? null,
    };
  });

  return { plans, planId: plan.id, activities };
}

function revalidate() {
  revalidatePath('/plan');
  revalidatePath('/plan/approvals');
  revalidatePath('/strategic-plan', 'layout');
}

/** Approves a new activity that someone without approval rights added to the plan. */
export async function approveNewActivity(activityId: string): Promise<PlanApprovalResult> {
  await requirePermission('plan-approvals:approve');
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, title: true, approvalStatus: true, responsibleId: true } });
  if (!activity) return { success: false, message: 'This activity no longer exists.' };
  if (activity.approvalStatus !== 'PENDING') return { success: false, message: "This activity isn't waiting for approval any more; it may already have been handled." };

  await prisma.activity.update({ where: { id: activityId }, data: { approvalStatus: 'APPROVED', declineReason: null } });
  await prisma.notification.create({
    data: { type: 'UPDATE_APPROVED', message: `Your new activity "${activity.title}" was approved.`, date: new Date(), read: false, userId: activity.responsibleId, activityId },
  });
  revalidate();
  return { success: true };
}

/** Sends a new activity back to its owner with a reason. */
export async function returnNewActivity(activityId: string, reason: string): Promise<PlanApprovalResult> {
  await requirePermission('plan-approvals:approve');
  const trimmed = (reason ?? '').trim();
  if (!trimmed) return { success: false, message: 'Please give a reason so the owner knows what to change.' };
  if (trimmed.length > 2000) return { success: false, message: 'The reason must be 2000 characters or less.' };

  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, title: true, approvalStatus: true, responsibleId: true } });
  if (!activity) return { success: false, message: 'This activity no longer exists.' };
  if (activity.approvalStatus !== 'PENDING') return { success: false, message: "This activity isn't waiting for approval any more; it may already have been handled." };

  await prisma.activity.update({ where: { id: activityId }, data: { approvalStatus: 'DECLINED', declineReason: trimmed } });
  await prisma.notification.create({
    data: { type: 'UPDATE_DECLINED', message: `Your new activity "${activity.title}" was returned: ${trimmed}`, date: new Date(), read: false, userId: activity.responsibleId, activityId },
  });
  revalidate();
  return { success: true };
}
