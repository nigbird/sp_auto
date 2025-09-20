
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma';
import type { Activity } from '@/lib/types';
import { calculateActivityStatus } from '@/lib/utils';

export async function getActivities(): Promise<Activity[]> {
    const activities = await prisma.activity.findMany({
        orderBy: {
            endDate: 'asc'
        }
    });
    return activities.map(a => ({
        ...a,
        kpis: [],
        updates: [],
    }));
}

export async function createActivity(data: Omit<Activity, 'id' | 'kpis' | 'updates' | 'progress' | 'approvalStatus' | 'lastUpdated'>) {
    const newActivity = await prisma.activity.create({
        data: {
            ...data,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            progress: 0,
            approvalStatus: 'Pending'
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
            lastUpdated: new Date()
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
            approvalStatus: 'Approved',
            lastUpdated: new Date(),
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
            approvalStatus: 'Declined',
            declineReason: reason
        }
    });
    revalidatePath('/activities');
    revalidatePath('/my-activity');
}
