
'use server'

import { prisma } from '@/lib/prisma';
import type { Pillar } from '@/lib/types';
import { getStrategicPlan } from './strategic-plan';


export async function getReportData(): Promise<Pillar[]> {
    const plan = await getStrategicPlan();
    if (!plan) return [];

    const reportPillars: Pillar[] = plan.pillars.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        objectives: p.objectives.map(o => ({
            id: o.id,
            statement: o.statement,
            initiatives: o.initiatives.map(i => ({
                id: i.id,
                title: i.title,
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
