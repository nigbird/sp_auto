
'use server';
import { prisma } from './prisma';
import type { StrategicPlan, Pillar } from "./types";
import { getStrategicPlan } from '@/actions/strategic-plan';

export async function savePlan(planData: Omit<StrategicPlan, 'status' | 'id'>, status: 'draft' | 'published', planId?: string) {
    const planToSave = {
        planTitle: planData.planTitle,
        startYear: planData.startYear,
        endYear: planData.endYear,
        version: planData.version,
        status: status,
    };

    if (planId) {
        // Update existing plan
        const updatedPlan = await prisma.strategicPlan.update({
            where: { id: planId },
            data: planToSave,
        });
        // You might need to update pillars, objectives, etc. here as well
        // This is a simplified version.
        return updatedPlan;
    } else {
        // Create new plan
        const newPlan = await prisma.strategicPlan.create({
            data: {
                ...planToSave,
                pillars: {
                    create: planData.pillars.map(p => ({
                        title: p.title,
                        description: p.description,
                        objectives: {
                            create: p.objectives.map(o => ({
                                statement: o.statement,
                                initiatives: {
                                    create: o.initiatives.map(i => ({
                                        title: i.title,
                                        description: i.description,
                                        owner: i.owner,
                                        activities: {
                                            create: i.activities.map(a => ({
                                                title: a.title,
                                                description: a.description || '',
                                                department: a.department,
                                                responsible: a.responsible,
                                                startDate: new Date(a.startDate),
                                                endDate: new Date(a.endDate),
                                                status: 'Not Started',
                                                weight: a.weight,
                                                progress: 0,
                                                approvalStatus: 'Pending',
                                            }))
                                        }
                                    }))
                                }
                            }))
                        }
                    }))
                }
            },
        });
        return newPlan;
    }
}


export async function getSavedPlan(): Promise<StrategicPlan | null> {
    const plan = await getStrategicPlan();
    if (!plan) return null;

    const formattedPlan: StrategicPlan = {
        ...plan,
        status: plan.status as 'draft' | 'published',
        pillars: plan.pillars.map(p => ({
            ...p,
            objectives: p.objectives.map(o => ({
                ...o,
                initiatives: o.initiatives.map(i => ({
                    ...i,
                    activities: i.activities.map(a => ({
                        ...a,
                        kpis: [],
                        updates: []
                    }))
                }))
            }))
        }))
    };
    return formattedPlan;
}

export async function deletePlan() {
    const existingPlan = await prisma.strategicPlan.findFirst();
    if (existingPlan) {
        await prisma.strategicPlan.delete({ where: { id: existingPlan.id }});
    }
}
