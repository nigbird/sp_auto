
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
            responsible: true,
            updateHistory: {
                orderBy: {
                    date: 'desc'
                }
            }
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
    }));
}

export async function createActivity(data: Omit<Activity, 'id' | 'kpis' | 'updates' | 'progress' | 'approvalStatus' | 'responsible' | 'updateHistory'> & { initiativeId?: string, strategicPlanId: string, responsible: string, userId: string }) {
    const creator = await prisma.user.findUnique({ where: { id: data.userId }});
    if (!creator) throw new Error("Creator not found");

    let approvalStatus: ApprovalStatus = 'PENDING';

    if (data.initiativeId) {
        approvalStatus = 'APPROVED';
    } else {
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
            responsibleId: data.responsible,
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


export async function updateActivity(activityId: string, data: Partial<Omit<Activity, 'id' | 'responsible' | 'kpis' | 'updates' | 'updateHistory'>> & { responsible?: string, approvalStatus?: ApprovalStatus }) {
    const activityData: any = { ...data };
    if (data.startDate) activityData.startDate = new Date(data.startDate);
    if (data.endDate) activityData.endDate = new Date(data.endDate);
    if (data.responsible) activityData.responsibleId = data.responsible;
    
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

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new Error("Activity not found");

    const newStatus = calculateActivityStatus({ ...activity, progress });

    await prisma.updateHistory.create({
        data: {
            activityId,
            userId,
            progress,
            comment,
            status: newStatus,
            approvalState: 'PENDING',
        }
    });

    await prisma.activity.update({
        where: { id: activityId },
        data: {
            approvalStatus: 'PENDING'
        }
    });

    revalidatePath('/my-activity');
    revalidatePath('/activities');
}

export async function approveActivityUpdate(activityId: string) {
    const latestUpdate = await prisma.updateHistory.findFirst({
        where: { activityId, approvalState: 'PENDING' },
        orderBy: { date: 'desc' }
    });
    
    let updateData: any = {
        approvalStatus: 'APPROVED',
        declineReason: null,
    };

    if (latestUpdate) {
        updateData = {
            ...updateData,
            progress: latestUpdate.progress,
            status: latestUpdate.status,
            updatedAt: new Date(),
        };

        await prisma.updateHistory.update({
            where: { id: latestUpdate.id },
            data: { approvalState: 'APPROVED' }
        });
    }

    await prisma.activity.update({
        where: { id: activityId },
        data: updateData
    });

    revalidatePath('/activities');
    revalidatePath('/my-activity');
}

export async function declineActivityUpdate(activityId: string, reason: string) {
    const latestUpdate = await prisma.updateHistory.findFirst({
        where: { activityId, approvalState: 'PENDING' },
        orderBy: { date: 'desc' }
    });

    if (latestUpdate) {
        await prisma.updateHistory.update({
            where: { id: latestUpdate.id },
            data: { approvalState: 'DECLINED' }
        });
    }
    
    await prisma.activity.update({
        where: { id: activityId },
        data: {
            approvalStatus: 'DECLINED', // This status is on the activity itself
            declineReason: reason
        }
    });

    revalidatePath('/activities');
    revalidatePath('/my-activity');
}
