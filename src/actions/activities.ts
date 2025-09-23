
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma';
import type { Activity } from '@/lib/types';
import { calculateActivityStatus } from '@/lib/utils';

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

export async function createActivity(data: Omit<Activity, 'id' | 'kpis' | 'updates' | 'progress' | 'approvalStatus'> & { initiativeId?: string, strategicPlanId: string }) {
    const newActivity = await prisma.activity.create({
        data: {
            title: data.title,
            description: data.description,
            department: data.department,
            responsibleId: data.responsible as string, // This needs to be the ID
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            weight: data.weight,
            initiativeId: data.initiativeId,
            strategicPlanId: data.strategicPlanId,
            progress: 0,
            status: 'Not Started',
            approvalStatus: 'PENDING'
        }
    });
    revalidatePath('/activities');
    revalidatePath('/my-activity');
    return newActivity;
}


export async function updateActivity(activityId: string, data: Partial<Omit<Activity, 'id'>>) {
    const updatedActivity = await prisma.activity.update({
        where: { id: activityId },
        data: {
            ...data,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            endDate: data.endDate ? new Date(data.endDate) : undefined,
            updatedAt: new Date()
        }
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
    // In a real app, you would get the user from the session
    const user = await prisma.user.findFirst();
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
            pendingUpdate: JSON.stringify(pendingUpdate)
        }
    });
    revalidatePath('/my-activity');
}

export async function approveActivityUpdate(activityId: string) {
    const activity = await prisma.activity.findUnique({ where: { id: activityId }});
    if (!activity || !activity.pendingUpdate) return;
    
    const pendingUpdate = JSON.parse(activity.pendingUpdate as string);

    // In a real app, you would log who made the update
    // const updater = await prisma.user.findUnique({ where: { id: pendingUpdate.userId }});

    const newStatus = calculateActivityStatus({ ...activity, progress: pendingUpdate.progress, endDate: new Date(activity.endDate) });
    
    await prisma.activity.update({
        where: { id: activityId },
        data: {
            progress: pendingUpdate.progress,
            status: newStatus,
            pendingUpdate: null,
            approvalStatus: 'APPROVED',
            updatedAt: new Date(),
            // In a real app, you'd properly handle updates history
        }
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
