'use server'

import { publicUserSelect } from '@/lib/user-select';
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma';
import type { Activity } from '@/lib/types';
import { calculateActivityStatus, type StatusRule } from '@/lib/utils';
import type { ApprovalStatus, User } from '@prisma/client';
import { requireUser } from '@/lib/auth/session';
import { requirePermission, hasPermission, userCan } from '@/lib/auth/permissions-server';
import { changedFields, recordAudit } from '@/lib/auth/audit';
import { ensurePeriodEntriesForActivity } from '@/lib/period-entries';

/** The live, admin-configurable status thresholds from Settings > Rules. */
async function getStatusRules(): Promise<StatusRule[]> {
    return prisma.rule.findMany({ select: { status: true, min: true, max: true } });
}

export interface KpiInput {
    name: string;
    unit?: string | null;
    target?: number | null;
    actual?: number | null;
    hasTarget?: boolean;
    direction?: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
}

function buildKpiData(kpi: KpiInput) {
    return {
        name: kpi.name,
        unit: kpi.unit || null,
        target: kpi.hasTarget === false ? null : kpi.target ?? null,
        actual: kpi.actual ?? null,
        hasTarget: kpi.hasTarget ?? true,
        direction: kpi.direction ?? 'HIGHER_IS_BETTER' as const,
    };
}

export async function getActivities(strategicPlanId?: string, approvedOnly?: boolean, responsibleId?: string): Promise<Activity[]> {
    const user = await requireUser();
    // Without a plan-wide view permission, people only ever get their own activities.
    if (!userCan(user, 'dashboard:view', 'strategic-plan:view', 'plan-approvals:view', 'reports:view')) {
        if (!userCan(user, 'my-plan:view')) throw new Error("You don't have permission to do this.");
        responsibleId = user.id;
    }

    const activities = await prisma.activity.findMany({
        where: {
            strategicPlanId: strategicPlanId,
            ...(responsibleId ? { responsibleId } : {}),
            ...(approvedOnly ? { approvalStatus: 'APPROVED' as const } : {}),
        },
        include: {
            responsible: { select: publicUserSelect },
            kpis: true,
            reportingPeriod: true,
            deliverables: true,
            monthlyTargets: { orderBy: { month: 'asc' } },
        },
        orderBy: {
            endDate: 'asc'
        }
    });

    const plainActivities = JSON.parse(JSON.stringify(activities));

    return plainActivities.map((a: any) => ({
        ...a,
        kpis: a.kpis ?? [],
        deliverables: a.deliverables ?? [],
        updates: [],
        pendingUpdate: a.pendingUpdate ? JSON.parse(a.pendingUpdate) : null,
    }));
}

export async function createActivity(data: Omit<Activity, 'id' | 'kpis' | 'updates' | 'progress' | 'approvalStatus' | 'responsible' | 'deliverables'> & { initiativeId: string, strategicPlanId: string, responsible: string, userId?: string, reportingPeriodId?: string, kpi?: KpiInput, deliverables?: string[] }) {
    // The creator is always the authenticated caller — a client-supplied userId
    // is never trusted for the auto-approval decision below.
    const creator = await requirePermission('strategic-plan:edit');

    if (!data.initiativeId) {
        throw new Error('An activity must be linked to an initiative.');
    }

    // Auto-approve when the creator can also approve activities (the same
    // authority, applied to their own submission); otherwise it's pending review.
    const approvalStatus: ApprovalStatus = (await hasPermission(creator.roleId, 'plan-approvals:approve')) ? 'APPROVED' : 'PENDING';

    const newActivity = await prisma.activity.create({
        data: {
            title: data.title,
            description: data.description,
            leadOwner: data.leadOwner?.trim() || null,
            responsibleId: data.responsible, // This is already the ID
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            weight: data.weight,
            initiativeId: data.initiativeId,
            strategicPlanId: data.strategicPlanId,
            reportingPeriodId: data.reportingPeriodId || null,
            progress: 0,
            status: 'Not Started',
            approvalStatus: approvalStatus,
            kpis: data.kpi && data.kpi.name ? { create: [buildKpiData(data.kpi)] } : undefined,
            deliverables: data.deliverables && data.deliverables.length > 0
                ? { create: data.deliverables.filter(t => t.trim()).map(title => ({ title: title.trim() })) }
                : undefined,
        }
    });

    await ensurePeriodEntriesForActivity(newActivity.id);
    await recordAudit({
        action: 'ACTIVITY_CREATED', entityType: 'Activity', entityId: newActivity.id,
        summary: `Created activity "${newActivity.title}"${approvalStatus === 'PENDING' ? ' (pending approval)' : ''}`,
        metadata: { strategicPlanId: data.strategicPlanId, initiativeId: data.initiativeId, responsibleId: data.responsible, weight: data.weight, leadOwner: data.leadOwner ?? null },
    });

    if (data.responsible !== creator.id) {
        await prisma.notification.create({
            data: {
                type: 'ACTIVITY_ASSIGNED',
                message: `You've been assigned a new activity: "${newActivity.title}".`,
                date: new Date(),
                read: false,
                userId: data.responsible,
                activityId: newActivity.id,
            },
        });
    }

    revalidatePath('/plan');
    return newActivity;
}


export async function updateActivity(activityId: string, data: Partial<Omit<Activity, 'id' | 'responsible' | 'kpis' | 'updates' | 'deliverables'>> & { responsible?: string, approvalStatus?: ApprovalStatus, reportingPeriodId?: string, kpi?: KpiInput, deliverables?: string[] }) {
    const user = await requireUser();

    const currentActivity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!currentActivity) throw new Error("Activity not found");

    // Editing arbitrary activities needs plan edit or approval rights — except an owner
    // fixing and resubmitting their own declined activity, which is normal
    // self-service and shouldn't require an elevated permission.
    const isOwnerResubmittingDeclined = currentActivity.responsibleId === user.id && currentActivity.approvalStatus === 'DECLINED';
    const isEditor = userCan(user, 'strategic-plan:edit', 'plan-approvals:approve');
    if (!isOwnerResubmittingDeclined && !isEditor) {
        throw new Error("You don't have permission to edit this activity.");
    }

    // Copied field by field, never spread: a server action accepts whatever JSON
    // the caller sends. An owner fixing a returned activity may change its content
    // only, and it always goes back for approval. Who it belongs to, where it sits
    // in the plan, its weight, progress and approval are for plan editors.
    const { kpi, deliverables } = data;
    const activityData: Record<string, unknown> = {};
    if (data.title !== undefined) {
        const title = String(data.title).trim();
        if (title.length < 3 || title.length > 500) throw new Error('The title must be between 3 and 500 characters.');
        activityData.title = title;
    }
    if (data.description !== undefined) activityData.description = data.description == null ? null : String(data.description).slice(0, 5000);
    for (const field of ['startDate', 'endDate'] as const) {
        if (!data[field]) continue;
        const date = new Date(data[field] as string | Date);
        if (Number.isNaN(date.getTime())) throw new Error('One of the dates is not valid.');
        activityData[field] = date;
    }

    if (isEditor) {
        if (data.responsible) {
            if (!(await prisma.user.findUnique({ where: { id: String(data.responsible) }, select: { id: true } }))) throw new Error('The selected person no longer exists.');
            activityData.responsibleId = String(data.responsible);
        }
        if (data.weight !== undefined) {
            const weight = Number(data.weight);
            if (!Number.isFinite(weight) || weight < 0 || weight > 100) throw new Error('Weight must be between 0 and 100.');
            activityData.weight = weight;
        }
        if (data.progress !== undefined) {
            const progress = Number(data.progress);
            if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw new Error('Progress must be between 0 and 100.');
            activityData.progress = progress;
        }
        const initiativeId = (data as { initiativeId?: string }).initiativeId;
        if (initiativeId && initiativeId !== currentActivity.initiativeId) {
            // Only within the same plan.
            const initiative = await prisma.initiative.findUnique({ where: { id: String(initiativeId) }, select: { objective: { select: { pillar: { select: { strategicPlanId: true } } } } } });
            if (initiative?.objective.pillar.strategicPlanId !== currentActivity.strategicPlanId) throw new Error('The selected initiative is not part of this plan.');
            activityData.initiativeId = String(initiativeId);
        }
        if (data.reportingPeriodId !== undefined) {
            if (data.reportingPeriodId) {
                const period = await prisma.reportingPeriod.findUnique({ where: { id: String(data.reportingPeriodId) }, select: { strategicPlanId: true } });
                if (period?.strategicPlanId !== currentActivity.strategicPlanId) throw new Error('The selected reporting period is not part of this plan.');
            }
            activityData.reportingPeriodId = data.reportingPeriodId || null;
        }
    }

    if (data.approvalStatus !== undefined) {
        const status = data.approvalStatus;
        if (status !== 'PENDING' && status !== 'APPROVED' && status !== 'DECLINED') throw new Error('Unknown approval status.');
        if (status !== 'PENDING') {
            // Approving or returning is a reviewer's decision, and never on your own activity.
            if (!userCan(user, 'plan-approvals:approve')) throw new Error("You don't have permission to approve activities.");
            if (currentActivity.responsibleId === user.id) throw new Error("You're responsible for this activity, so someone else has to approve it.");
        }
        activityData.approvalStatus = status;
    }
    if (!isEditor) activityData.approvalStatus = 'PENDING';

    // Explicitly set status if progress is changed
    if (activityData.progress !== undefined) {
        const rules = await getStatusRules();
        activityData.status = calculateActivityStatus({ ...currentActivity, progress: activityData.progress as number, endDate: new Date(currentActivity.endDate) }, rules);
    }

    activityData.updatedAt = new Date();

    const updatedActivity = await prisma.activity.update({
        where: { id: activityId },
        data: activityData
    });

    if (data.startDate || data.endDate) {
        await ensurePeriodEntriesForActivity(activityId);
    }

    if (kpi !== undefined) {
        const existingKpi = await prisma.kpi.findFirst({ where: { activityId } });
        if (existingKpi) {
            await prisma.kpi.update({ where: { id: existingKpi.id }, data: buildKpiData(kpi) });
        } else if (kpi.name) {
            await prisma.kpi.create({ data: { ...buildKpiData(kpi), activityId } });
        }
    }

    if (deliverables !== undefined) {
        // Reconcile by title rather than delete-and-recreate, so an edit to
        // the activity doesn't wipe out isDelivered/deliveredDate on rows
        // that staff have already checked off from My Plan.
        const existingDeliverables = await prisma.deliverable.findMany({ where: { activityId } });
        const incomingTitles = deliverables.map(t => t.trim()).filter(Boolean);
        const existingTitles = new Set(existingDeliverables.map(d => d.title));

        const toDelete = existingDeliverables.filter(d => !incomingTitles.includes(d.title));
        if (toDelete.length > 0) {
            await prisma.deliverable.deleteMany({ where: { id: { in: toDelete.map(d => d.id) } } });
        }

        const toCreate = incomingTitles.filter(t => !existingTitles.has(t));
        if (toCreate.length > 0) {
            await prisma.deliverable.createMany({ data: toCreate.map(title => ({ activityId, title })) });
        }
    }

    const { updatedAt: _updatedAt, ...changedData } = activityData;
    await recordAudit({
        action: 'ACTIVITY_UPDATED', entityType: 'Activity', entityId: activityId,
        summary: `Edited activity "${updatedActivity.title}"${isOwnerResubmittingDeclined ? ' (owner resubmitting after it was returned)' : ''}`,
        metadata: {
            changes: changedFields(currentActivity, changedData),
            ...(kpi !== undefined ? { kpi } : {}),
            ...(deliverables !== undefined ? { deliverables } : {}),
        },
    });

    revalidatePath('/plan');
    return updatedActivity;
}

// Progress-update submission/approval/decline moved to
// src/actions/activity-period-entries.ts (submitPeriodUpdate/approvePeriodEntry/
// declinePeriodEntry), which track plan-vs-actual per ReportingPeriod instead
// of a single flat progress value.