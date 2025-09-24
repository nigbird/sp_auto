

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma';
import type { Activity } from '@/lib/types';
import { calculateActivityStatus } from '@/lib/utils';
import type { ApprovalStatus, User } from '@prisma/client';

export async function getActivities(strategicPlanId?: string): Promise<Activity[]> {
    const activities = await prisma.activity.findMany({
        where: {
            strategicPlanId: strategicPlanId
        },
        include: {
            responsible: true
        },
        orderBy: {
            endDate: 'asc'
        }
    });

    const plainActivities = JSON.parse(JSON.stringify(activities));
    
    return plainActivities.map((a: any) => ({
        ...a,
        kpis: [],
        updates: [],
        pendingUpdate: a.pendingUpdate ? JSON.parse(a.pendingUpdate) : null,
    }));
}

export async function createActivity(data: Omit<Activity, 'id' | 'kpis' | 'updates' | 'progress' | 'approvalStatus' | 'responsible'> & { initiativeId?: string, strategicPlanId: string, responsible: string, userId: string }) {
    const creator = await prisma.user.findUnique({ where: { id: data.userId }});
    if (!creator) throw new Error("Creator not found");

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
            progress: 0,
            status: 'Not Started',
            approvalStatus: approvalStatus,
        }
    });
    revalidatePath('/activities');
    revalidatePath('/my-activity');
    return newActivity;
}


export async function updateActivity(activityId: string, data: Partial<Omit<Activity, 'id' | 'responsible' | 'kpis' | 'updates'>> & { responsible?: string, approvalStatus?: ApprovalStatus }) {
    const activityData: any = { ...data };
    if (data.startDate) activityData.startDate = new Date(data.startDate);
    if (data.endDate) activityData.endDate = new Date(data.endDate);
    if (data.responsible) activityData.responsibleId = data.responsible;
    
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

    revalidatePath('/activities');
    revalidatePath('/my-activity');
    return updatedActivity;
}

export async function submitActivityUpdate(activityId: string, progress: number, comment: string, userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }});
    if (!user) throw new Error("User not found");

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new Error("Activity not found");

    const pendingUpdate = {
        user: user.name,
        date: new Date(),
        comment,
        progress,
    };

    const updateData: any = {
        pendingUpdate: JSON.stringify(pendingUpdate),
        approvalStatus: 'PENDING'
    };

    // If this is the first update, transition the status from "Not Started"
    if (activity.status === 'Not Started') {
        const newStatus = calculateActivityStatus({ ...activity, progress });
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
    revalidatePath('/activities');
    revalidatePath('/my-activity');
}

export async function declineActivityUpdate(activityId: string, reason: string) {
    const activity = await prisma.activity.findUnique({ where: { id: activityId }});
    if (!activity) return;

    // If there is a pendingUpdate, it's a progress update being declined.
    // We clear the pending update and keep the activity approved.
    if (activity.pendingUpdate) {
         await prisma.activity.update({
            where: { id: activityId },
            data: {
                pendingUpdate: null,
                // The activity itself remains approved, only the update is declined.
                approvalStatus: 'APPROVED',
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

    revalidatePath('/activities');
    revalidatePath('/my-activity');
}
