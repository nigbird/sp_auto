'use server'

import { prisma } from '@/lib/prisma';
import type { Activity, Pillar, StrategicPlan, User, ReportingPeriod } from '@/lib/types';
import { getStrategicPlanById } from './strategic-plan';
import { getActivities } from './activities';
import { getUsers } from './users';
import { listStrategicPlans } from './strategic-plan';
import { requireUser } from '@/lib/auth/session';

export interface ReportData {
    plans: StrategicPlan[];
    activities: Activity[];
    users: User[];
    pillars: Pillar[];
    reportingPeriods: ReportingPeriod[];
}

export async function getReportData(approvedOnly?: boolean): Promise<ReportData> {
    await requireUser();

    const plans = await listStrategicPlans();
    const activities = await getActivities(undefined, approvedOnly);
    const users = await getUsers();
    const reportingPeriods = await prisma.reportingPeriod.findMany({ orderBy: { startDate: 'asc' } });

    const allPillars = await prisma.pillar.findMany({
        include: {
            objectives: {
                include: {
                    initiatives: {
                        include: {
                            owner: true,
                            activities: {
                                where: approvedOnly ? { approvalStatus: 'APPROVED' } : undefined,
                                include: {
                                    responsible: true,
                                    kpis: true,
                                    deliverables: true,
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
                activities: i.activities.map(a => ({
                    ...a,
                    kpis: a.kpis ?? [],
                    deliverables: a.deliverables ?? [],
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
        reportingPeriods: JSON.parse(JSON.stringify(reportingPeriods)),
    };
}
