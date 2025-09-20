
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import type { StrategicPlan } from '@/lib/types';

export async function getStrategicPlan() {
    return await prisma.strategicPlan.findFirst({
        include: {
            pillars: {
                include: {
                    objectives: {
                        include: {
                            initiatives: {
                                include: {
                                    activities: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}
