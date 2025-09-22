
'use server'

import { prisma } from '@/lib/prisma';
import type { Pillar, StrategicPlan } from '@/lib/types';
import { getStrategicPlanById } from './strategic-plan';


export async function getReportData(): Promise<Pillar[]> {
    // A real app would have a way to select the active plan.
    // For now, we'll find the first published plan to generate a report.
    const plans = await prisma.strategicPlan.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
        take: 1
    });

    if (plans.length === 0) return [];
    
    const plan = await getStrategicPlanById(plans[0].id);

    if (!plan) return [];

    const reportPillars: Pillar[] = plan.pillars.map(p => ({
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

    // This is where you would calculate weights if they are not stored in the DB
    // For now, we assume weights are part of the activity records.
    return reportPillars;
}
