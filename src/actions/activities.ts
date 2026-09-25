'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma';
import type { Activity } from '@/lib/types';
import { calculateActivityStatus, type StatusRule } from '@/lib/utils';
import type { ApprovalStatus, User } from '@prisma/client';
import { requireUser } from '@/lib/auth/session';
import { requirePermission, hasPermission } from '@/lib/auth/permissions-server';
import { ensurePeriodEntriesForActivity } from '@/actions/activity-plan-submissions';

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

async function assertValidDepartment(department: string | undefined): Promise<void> {
    if (!department) return;
    const match = await prisma.department.findUnique({ where: { name: department } });
    if (!match) {
        throw new Error(`"${department}" is not in the approved department list.`);
    }
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

export async function getActivities(strategicPlanId?: string, approvedOnly?: boolean): Promise<Activity[]> {
    await requireUser();

    const activities = await prisma.activity.findMany({
        where: {
            strategicPlanId: strategicPlanId,
            ...(approvedOnly ? { approvalStatus: 'APPROVED' as const } : {}),
        },
        include: {
            responsible: true,
            kpis: true,
            reportingPeriod: true,
            deliverables: true,
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
    const creator = await requirePermission('activities:create');

    if (!data.initiativeId) {
        throw new Error('An activity must be linked to an initiative.');
    }

    await assertValidDepartment(data.department);

    // Auto-approve when the creator can also approve activities (the same
    // authority, applied to their own submission); otherwise it's pending review.
    const approvalStatus: ApprovalStatus = (await hasPermission(creator.roleId, 'activities:edit')) ? 'APPROVED' : 'PENDING';

    const newActivity = await prisma.activity.create({
        data: {
            title: data.title,
            description: data.description,
            department: data.department,
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

    revalidatePath('/my-activity');
    return newActivity;
}


export async function updateActivity(activityId: string, data: Partial<Omit<Activity, 'id' | 'responsible' | 'kpis' | 'updates' | 'deliverables'>> & { responsible?: string, approvalStatus?: ApprovalStatus, reportingPeriodId?: string, kpi?: KpiInput, deliverables?: string[] }) {
    const user = await requireUser();

    const currentActivity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!currentActivity) throw new Error("Activity not found");

    // Editing arbitrary activities requires activities:edit — except an owner
    // fixing and resubmitting their own declined activity, which is normal
    // self-service and shouldn't require an elevated permission.
    const isOwnerResubmittingDeclined = currentActivity.responsibleId === user.id && currentActivity.approvalStatus === 'DECLINED';
    if (!isOwnerResubmittingDeclined && !(await hasPermission(user.roleId, 'activities:edit'))) {
        throw new Error("You don't have permission to edit this activity.");
    }

    await assertValidDepartment(data.department);

    const { kpi, deliverables, ...rest } = data;
    const activityData: any = { ...rest };
    if (data.startDate) activityData.startDate = new Date(data.startDate);
    if (data.endDate) activityData.endDate = new Date(data.endDate);
    if (data.responsible) {
        activityData.responsibleId = data.responsible;
        delete activityData.responsible;
    }

    // Explicitly set status if progress is changed
    if (data.progress !== undefined) {
        const rules = await getStatusRules();
        activityData.status = calculateActivityStatus({ ...currentActivity, progress: data.progress, endDate: new Date(currentActivity.endDate) }, rules);
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
        // that staff have already checked off from My Activity.
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

    revalidatePath('/my-activity');
    return updatedActivity;
}

// Progress-update submission/approval/decline moved to
// src/actions/activity-period-entries.ts (submitPeriodUpdate/approvePeriodEntry/
// declinePeriodEntry), which track plan-vs-actual per ReportingPeriod instead
// of a single flat progress value.