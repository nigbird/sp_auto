'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma';
import type { Activity } from '@/lib/types';
import { calculateActivityStatus } from '@/lib/utils';
import { isPeriodClosedForSubmissions } from '@/lib/reporting-period';
import type { ApprovalStatus, User } from '@prisma/client';
import { requireUser } from '@/lib/auth/session';

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

export async function getActivities(strategicPlanId?: string): Promise<Activity[]> {
    await requireUser();

    const activities = await prisma.activity.findMany({
        where: {
            strategicPlanId: strategicPlanId
        },
        include: {
            responsible: true,
            kpis: true,
            reportingPeriod: true,
        },
        orderBy: {
            endDate: 'asc'
        }
    });

    const plainActivities = JSON.parse(JSON.stringify(activities));

    return plainActivities.map((a: any) => ({
        ...a,
        kpis: a.kpis ?? [],
        updates: [],
        pendingUpdate: a.pendingUpdate ? JSON.parse(a.pendingUpdate) : null,
    }));
}

export async function createActivity(data: Omit<Activity, 'id' | 'kpis' | 'updates' | 'progress' | 'approvalStatus' | 'responsible'> & { initiativeId?: string, strategicPlanId: string, responsible: string, userId?: string, reportingPeriodId?: string, kpi?: KpiInput }) {
    // The creator is always the authenticated caller — a client-supplied userId
    // is never trusted for the auto-approval decision below.
    const creator = await requireUser();

    let approvalStatus: ApprovalStatus = 'PENDING';

    // If linked to an initiative, it's from a plan and auto-approved.
    if (data.initiativeId) {
        approvalStatus = 'APPROVED';
    } else {
        // If created manually, check the role.
        if (creator.role === 'ADMINISTRATOR') {
            approvalStatus = 'APPROVED';
        } else {
            approvalStatus = 'PENDING';
        }
    }

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
        }
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

    revalidatePath('/activities');
    revalidatePath('/my-activity');
    return newActivity;
}


export async function updateActivity(activityId: string, data: Partial<Omit<Activity, 'id' | 'responsible' | 'kpis' | 'updates'>> & { responsible?: string, approvalStatus?: ApprovalStatus, reportingPeriodId?: string, kpi?: KpiInput }) {
    await requireUser();

    const { kpi, ...rest } = data;
    const activityData: any = { ...rest };
    if (data.startDate) activityData.startDate = new Date(data.startDate);
    if (data.endDate) activityData.endDate = new Date(data.endDate);
    if (data.responsible) {
        activityData.responsibleId = data.responsible;
        delete activityData.responsible;
    }

    // Explicitly set status if progress is changed
    if (data.progress !== undefined) {
        const currentActivity = await prisma.activity.findUnique({ where: { id: activityId }});
        if (currentActivity) {
            activityData.status = calculateActivityStatus({ ...currentActivity, progress: data.progress, endDate: new Date(currentActivity.endDate) });
        }
    }

    activityData.updatedAt = new Date();

    const updatedActivity = await prisma.activity.update({
        where: { id: activityId },
        data: activityData
    });

    if (kpi !== undefined) {
        const existingKpi = await prisma.kpi.findFirst({ where: { activityId } });
        if (existingKpi) {
            await prisma.kpi.update({ where: { id: existingKpi.id }, data: buildKpiData(kpi) });
        } else if (kpi.name) {
            await prisma.kpi.create({ data: { ...buildKpiData(kpi), activityId } });
        }
    }

    revalidatePath('/activities');
    revalidatePath('/my-activity');
    return updatedActivity;
}

export async function submitActivityUpdate(activityId: string, progress: number, comment: string, userId?: string, completionDate?: string, delayExplanation?: string, recommendedAction?: string) {
    // The submitting user is always the authenticated caller, not the passed userId.
    const user = await requireUser();

    const activity = await prisma.activity.findUnique({ where: { id: activityId }, include: { reportingPeriod: true } });
    if (!activity) throw new Error("Activity not found");

    if (isPeriodClosedForSubmissions(activity.reportingPeriod)) {
        const period = activity.reportingPeriod!;
        const reason = period.status === 'CLOSED'
            ? 'has been closed by an administrator'
            : `passed its cut-off date (${period.cutOffDate.toLocaleDateString()})`;
        throw new Error(`Cannot submit an update: the reporting period "${period.name}" ${reason}.`);
    }

    if (progress >= 100) {
        if (!completionDate) {
            throw new Error("Completing this activity requires a completion date.");
        }
        const evidenceCount = await prisma.evidence.count({ where: { activityId } });
        if (evidenceCount === 0) {
            throw new Error("Completing this activity requires at least one piece of supporting evidence to be attached first.");
        }
    }

    const projectedStatus = calculateActivityStatus({ ...activity, progress });
    if (projectedStatus === 'Delayed' || projectedStatus === 'Overdue') {
        if (!delayExplanation?.trim() || !recommendedAction?.trim()) {
            throw new Error("Reporting underperformance requires both an explanation and a recommended action.");
        }
    }

    const pendingUpdate = {
        user: user.name,
        date: new Date(),
        comment,
        progress,
        completionDate: completionDate || undefined,
        delayExplanation: delayExplanation || undefined,
        recommendedAction: recommendedAction || undefined,
    };

    const updateData: any = {
        pendingUpdate: JSON.stringify(pendingUpdate),
        approvalStatus: 'PENDING'
    };

    // If this is the first update, transition the status from "Not Started"
    if (activity.status === 'Not Started' && progress > 0) {
        const newStatus = projectedStatus;
        if (newStatus !== 'Not Started') {
            updateData.status = newStatus;
        }
    }

    await prisma.activity.update({
        where: { id: activityId },
        data: updateData
    });

    revalidatePath('/my-activity');
}

export async function approveActivityUpdate(activityId: string) {
    await requireUser();

    const activity = await prisma.activity.findUnique({ where: { id: activityId }});
    if (!activity) return;

    let updateData: any = {};

    if (activity.pendingUpdate) {
        const pendingUpdate = JSON.parse(activity.pendingUpdate as string);
        const newStatus = calculateActivityStatus({ ...activity, progress: pendingUpdate.progress, endDate: new Date(activity.endDate) });
        
        updateData = {
            progress: pendingUpdate.progress,
            status: newStatus,
            pendingUpdate: null,
            approvalStatus: 'APPROVED',
            declineReason: null,
            updatedAt: new Date(),
            ...(pendingUpdate.completionDate ? { completionDate: new Date(pendingUpdate.completionDate) } : {}),
            ...(pendingUpdate.delayExplanation ? { delayExplanation: pendingUpdate.delayExplanation } : {}),
            ...(pendingUpdate.recommendedAction ? { recommendedAction: pendingUpdate.recommendedAction } : {}),
        };
    } else {
        // This is for approving a newly created activity that has no pending update yet.
        updateData = {
             approvalStatus: 'APPROVED',
             declineReason: null,
        }
    }
    
    await prisma.activity.update({
        where: { id: activityId },
        data: updateData
    });

    await prisma.notification.create({
        data: {
            type: 'UPDATE_APPROVED',
            message: `Your update for "${activity.title}" was approved.`,
            date: new Date(),
            read: false,
            userId: activity.responsibleId,
            activityId: activity.id,
        },
    });

    revalidatePath('/activities');
    revalidatePath('/my-activity');
}

export async function declineActivityUpdate(activityId: string, reason: string) {
    await requireUser();

    const activity = await prisma.activity.findUnique({ where: { id: activityId }});
    if (!activity) return;

    // If there is a pendingUpdate, it's a progress update being declined.
    // We clear the pending update and set approvalStatus to 'DECLINED'.
    if (activity.pendingUpdate) {
         await prisma.activity.update({
            where: { id: activityId },
            data: {
                pendingUpdate: null,
                approvalStatus: 'DECLINED',
                declineReason: reason, 
            }
        });
    } else {
        // If there's no pending update, it's a new activity creation being declined.
        await prisma.activity.update({
            where: { id: activityId },
            data: {
                approvalStatus: 'DECLINED',
                declineReason: reason
            }
        });
    }

    await prisma.notification.create({
        data: {
            type: 'UPDATE_DECLINED',
            message: `Your update for "${activity.title}" was returned: ${reason}`,
            date: new Date(),
            read: false,
            userId: activity.responsibleId,
            activityId: activity.id,
        },
    });

    revalidatePath('/activities');
    revalidatePath('/my-activity');
}