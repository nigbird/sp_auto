
'use server'

import { prisma } from '@/lib/prisma';
import type { Notification } from '@/lib/types';

export async function getNotifications(): Promise<Notification[]> {
    return await prisma.notification.findMany({
        orderBy: {
            date: 'desc'
        }
    });
}
