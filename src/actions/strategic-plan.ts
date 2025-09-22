
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { StrategicPlan as StrategicPlanType } from '@/lib/types';
import { z } from 'zod';
import { redirect } from 'next/navigation';

const planSchema = z.object({
  name: z.string().min(1, "Plan Name is required"),
  startYear: z.coerce.number().min(2000),
  endYear: z.coerce.number().min(2000),
  version: z.string().min(1, "Version is required"),
  pillars: z.array(z.any()), // Simplified for server action
});


export async function listStrategicPlans() {
    return await prisma.strategicPlan.findMany({
        orderBy: {
            updatedAt: 'desc',
        },
    });
}

export async function getStrategicPlanById(id: string) {
    const plan = await prisma.strategicPlan.findUnique({
        where: { id },
        include: {
            pillars: {
                include: {
                    objectives: {
                        include: {
                            initiatives: {
                                include: {
                                    activities: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!plan) {
        return null;
    }
    
    // Convert dates to string to avoid serialization issues
    const plainPlan = JSON.parse(JSON.stringify(plan));
    return plainPlan as StrategicPlanType;
}

export async function createStrategicPlan(formData: FormData) {
    const data = Object.fromEntries(formData);
    const pillars = JSON.parse(data.pillars as string);
    const status = data.status as 'DRAFT' | 'PUBLISHED';

    const validatedFields = planSchema.safeParse({
        name: data.name,
        startYear: data.startYear,
        endYear: data.endYear,
        version: data.version,
        pillars: pillars,
    });
    
    if (!validatedFields.success) {
        console.error(validatedFields.error);
        throw new Error("Invalid form data.");
    }
    
    const { name, startYear, endYear, version } = validatedFields.data;

    await prisma.strategicPlan.create({
        data: {
            name,
            startYear,
            endYear,
            version,
            status,
            pillars: {
                create: pillars.map((p: any) => ({
                    title: p.title,
                    description: p.description,
                    objectives: {
                        create: p.objectives.map((o: any) => ({
                            statement: o.statement,
                            initiatives: {
                                create: o.initiatives.map((i: any) => ({
                                    title: i.title,
                                    description: i.description,
                                    owner: i.owner,
                                    activities: {
                                        create: i.activities.map((a: any) => ({
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
                                        })),
                                    },
                                })),
                            },
                        })),
                    },
                })),
            },
        },
    });

    revalidatePath('/strategic-plan');
    redirect('/strategic-plan');
}


export async function updateStrategicPlan(id: string, formData: FormData) {
    const data = Object.fromEntries(formData);
    const pillars = JSON.parse(data.pillars as string);
    const status = data.status as 'DRAFT' | 'PUBLISHED';

    const validatedFields = planSchema.safeParse({
        name: data.name,
        startYear: data.startYear,
        endYear: data.endYear,
        version: data.version,
        pillars: pillars,
    });

    if (!validatedFields.success) {
        console.error(validatedFields.error);
        throw new Error("Invalid form data for update.");
    }
    
    const { name, startYear, endYear, version } = validatedFields.data;

    // In a real scenario, you'd do a deep comparison and update/create/delete
    // nested entities. For simplicity, we'll delete and re-create pillars.
    await prisma.pillar.deleteMany({ where: { strategicPlanId: id }});

    await prisma.strategicPlan.update({
        where: { id },
        data: {
            name,
            startYear,
            endYear,
            version,
            status,
            pillars: {
                create: pillars.map((p: any) => ({
                    title: p.title,
                    description: p.description,
                    objectives: {
                        create: p.objectives.map((o: any) => ({
                            statement: o.statement,
                            initiatives: {
                                create: o.initiatives.map((i: any) => ({
                                    title: i.title,
                                    description: i.description,
                                    owner: i.owner,
                                    activities: {
                                        create: i.activities.map((a: any) => ({
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
                                        })),
                                    },
                                })),
                            },
                        })),
                    },
                })),
            },
        },
    });
    
    revalidatePath('/strategic-plan');
    revalidatePath(`/strategic-plan/${id}`);
    redirect('/strategic-plan');
}


export async function publishStrategicPlan(id: string) {
    await prisma.strategicPlan.update({
        where: { id },
        data: { status: 'PUBLISHED' },
    });
    revalidatePath('/strategic-plan');
    revalidatePath(`/strategic-plan/${id}`);
}

export async function deleteStrategicPlan(id: string) {
    await prisma.strategicPlan.delete({ where: { id } });
    revalidatePath('/strategic-plan');
    redirect('/strategic-plan');
}
