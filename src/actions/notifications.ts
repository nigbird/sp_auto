
'use server'

import { prisma } from '@/lib/prisma';
import type { Notification } from '@/lib/types';
import { requireUser } from '@/lib/auth/session';
import { syncTimeBasedNotifications } from '@/lib/notification-sync';

export async function getNotifications(): Promise<Notification[]> {
    const user = await requireUser();

    await syncTimeBasedNotifications();

    return await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
    });
}

export async function markNotificationRead(id: string): Promise<void> {
    const user = await requireUser();
    await prisma.notification.updateMany({
        where: { id, userId: user.id },
        data: { read: true },
    });
}

export async function markAllNotificationsRead(): Promise<void> {
    const user = await requireUser();
    await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
    });
}
