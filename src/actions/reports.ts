'use server'

import { prisma } from '@/lib/prisma';
import type { Activity, Pillar, StrategicPlan, User } from '@/lib/types';
import { getStrategicPlanById } from './strategic-plan';
import { getActivities } from './activities';
import { getUsers } from './users';
import { listStrategicPlans } from './strategic-plan';

export interface ReportData {
    plans: StrategicPlan[];
    activities: Activity[];
    users: User[];
    pillars: Pillar[];
}

export async function getReportData(): Promise<ReportData> {
    const plans = await listStrategicPlans();
    const activities = await getActivities();
    const users = await getUsers();
    
    // A real app would have a way to select the active plan.
    // For now, we'll find the first published plan to generate a report.
    const publishedPlans = await prisma.strategicPlan.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
        take: 1
    });

    let pillars: Pillar[] = [];
    if (publishedPlans.length > 0) {
        const plan = await getStrategicPlanById(publishedPlans[0].id);
        if (plan) {
            pillars = plan.pillars.map(p => ({
                ...p,
                description: p.description || '',
                objectives: p.objectives.map(o => ({
                    ...o,
                    initiatives: o.initiatives.map(i => ({
                        ...i,
                        description: i.description || '',
                        owner: i.owner || '',
                        activities: i.activities.map(a => ({
                            ...a,
                            kpis: [],
                            updates: [],
                            pendingUpdate: a.pendingUpdate ? JSON.parse(a.pendingUpdate as string) : undefined
                        }))
                    }))
                }))
            }));
        }
    }

    return {
        plans: JSON.parse(JSON.stringify(plans)),
        activities: JSON.parse(JSON.stringify(activities)),
        users: JSON.parse(JSON.stringify(users)),
        pillars: pillars,
    };
}

    