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
    
    const allPillars = await prisma.pillar.findMany({
        include: {
            objectives: {
                include: {
                    initiatives: {
                        include: {
                            activities: {
                                include: {
                                    responsible: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const pillars = allPillars.map(p => ({
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


    return {
        plans: JSON.parse(JSON.stringify(plans)),
        activities: JSON.parse(JSON.stringify(activities)),
        users: JSON.parse(JSON.stringify(users)),
        pillars: JSON.parse(JSON.stringify(pillars)),
    };
}
