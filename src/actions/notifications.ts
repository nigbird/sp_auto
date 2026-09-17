
'use server'

import { prisma } from '@/lib/prisma';
import type { Notification } from '@/lib/types';
import { requireUser } from '@/lib/auth/session';

export async function getNotifications(): Promise<Notification[]> {
    await requireUser();

    return await prisma.notification.findMany({
        orderBy: {
            date: 'desc'
        }
    });
}
