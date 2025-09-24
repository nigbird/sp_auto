
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

    // The data is already in a good format, but if it were deeply nested or had circular references,
    // you might need to serialize and deserialize to ensure a plain object.
    // For this case, it's safe to return directly after casting.
    // Using JSON.parse(JSON.stringify(activities)) is a safe way to deep clone and remove non-serializable parts.
    const plainActivities = JSON.parse(JSON.stringify(activities));
    
    return plainActivities.map((a: any) => ({
        ...a,
        kpis: [],
        updates: [],
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
        if (creator.role === 'Administrator') {
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

export async function deleteActivity(activityId: string) {
    await prisma.activity.delete({ where: { id: activityId } });
    revalidatePath('/activities');
    revalidatePath('/my-activity');
}

export async function submitActivityUpdate(activityId: string, progress: number, comment: string, userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }});
    if (!user) throw new Error("User not found");

    const pendingUpdate = {
        user: user.name,
        date: new Date(),
        comment,
        progress,
    };

    await prisma.activity.update({
        where: { id: activityId },
        data: {
            pendingUpdate: JSON.stringify(pendingUpdate),
            approvalStatus: 'PENDING'
        }
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
    await prisma.activity.update({
        where: { id: activityId },
        data: {
            pendingUpdate: null,
            approvalStatus: 'DECLINED',
            declineReason: reason
        }
    });
    revalidatePath('/activities');
    revalidatePath('/my-activity');
}
