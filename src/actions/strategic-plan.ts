
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { StrategicPlan as StrategicPlanType } from '@/lib/types';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { getUsers } from './users';

const activitySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  weight: z.coerce.number().min(0, "Weight must be positive"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  department: z.string().min(1, "Department is required"),
  responsible: z.string().min(1, "Responsible person is required"),
  description: z.string().optional(),
});

const initiativeSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  owner: z.string().min(1, "Owner is required"),
  collaborators: z.array(z.string()).optional(),
  activities: z.array(activitySchema).min(1, "At least one activity is required."),
});

const objectiveSchema = z.object({
  id: z.string().optional(),
  statement: z.string().min(1, "Objective Statement is required"),
  initiatives: z.array(initiativeSchema).min(1, "At least one initiative is required."),
});

const pillarSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Pillar Title is required"),
  description: z.string().optional(),
  objectives: z.array(objectiveSchema).min(1, "At least one objective is required."),
});

const planSchema = z.object({
  name: z.string().min(1, "Plan Name is required"),
  startYear: z.coerce.number().min(2000),
  endYear: z.coerce.number().min(2000),
  version: z.string().min(1, "Version is required"),
  pillars: z.array(pillarSchema), // Simplified for server action
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
                orderBy: { createdAt: 'asc' },
                include: {
                    objectives: {
                        orderBy: { createdAt: 'asc' },
                        include: {
                            initiatives: {
                                orderBy: { createdAt: 'asc' },
                                include: {
                                    activities: {
                                        orderBy: { createdAt: 'asc' },
                                        include: {
                                            responsible: true,
                                        }
                                    },
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
    console.log('Received data for plan creation:', Object.fromEntries(formData));

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
        console.error("Zod validation failed:", validatedFields.error.flatten());
        throw new Error("Invalid form data.");
    }
    
    const { name, startYear, endYear, version } = validatedFields.data;

    try {
        const newPlan = await prisma.strategicPlan.create({
            data: {
                name,
                startYear,
                endYear,
                version,
                status
            }
        });

        for (const p of pillars) {
            await prisma.pillar.create({
                data: {
                    title: p.title,
                    description: p.description,
                    strategicPlanId: newPlan.id,
                    objectives: {
                        create: p.objectives.map((o: any) => ({
                            statement: o.statement,
                            initiatives: {
                                create: o.initiatives.map((i: any) => ({
                                    title: i.title,
                                    description: i.description,
                                    owner: i.owner,
                                    collaborators: i.collaborators,
                                    activities: {
                                        create: i.activities.map((a: any) => {
                                            if (!a.responsible) {
                                                throw new Error(`Responsible user ID is missing for activity: '${a.title}'.`);
                                            }
                                            return {
                                                title: a.title,
                                                description: a.description || '',
                                                department: a.department,
                                                responsibleId: a.responsible,
                                                startDate: new Date(a.startDate),
                                                endDate: new Date(a.endDate),
                                                status: 'Not Started',
                                                weight: Number(a.weight),
                                                progress: 0,
                                                approvalStatus: 'APPROVED',
                                                strategicPlanId: newPlan.id,
                                            }
                                        }),
                                    },
                                })),
                            },
                        })),
                    },
                }
            });
        }
    } catch (error) {
        console.error("Error during strategic plan creation:", error);
        // Re-throwing the original error is often more informative
        throw error;
    }


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
        return {
            success: false,
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }
    
    const { name, startYear, endYear, version } = validatedFields.data;

    try {
        const users = await getUsers();
        
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
                                        collaborators: i.collaborators,
                                        activities: {
                                            create: i.activities.map((a: any) => {
                                                const responsibleUser = users.find(u => u.name === a.responsible);
                                                let responsibleId = a.responsible;
                                                
                                                if (responsibleUser) {
                                                    responsibleId = responsibleUser.id;
                                                } else if (!users.find(u => u.id === a.responsible)) {
                                                     throw new Error(`User not found in database: '${a.responsible}'. Please ensure the name is correct.`);
                                                }

                                                return {
                                                    title: a.title,
                                                    description: a.description || '',
                                                    department: a.department,
                                                    responsibleId: responsibleId,
                                                    startDate: new Date(a.startDate),
                                                    endDate: new Date(a.endDate),
                                                    status: a.status || 'Not Started',
                                                    weight: Number(a.weight),
                                                    progress: Number(a.progress) || 0,
                                                    approvalStatus: a.approvalStatus || 'APPROVED',
                                                    strategicPlanId: id,
                                                }
                                            }),
                                        },
                                    })),
                                },
                            })),
                        },
                    })),
                },
            },
        });
    } catch (error) {
        console.error("Error during strategic plan update:", error);
        return {
            success: false,
            // A more specific error could be returned, but for now this is a safe fallback.
            errors: { _form: ["An unexpected error occurred while updating the plan."] }
        }
    }
    
    revalidatePath('/strategic-plan');
    revalidatePath(`/strategic-plan/${id}`);
    redirect(`/strategic-plan/${id}`);
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
    // Make sure to delete related records in the correct order if cascading delete is not set up
    const plan = await prisma.strategicPlan.findUnique({
        where: { id },
        include: { pillars: { include: { objectives: { include: { initiatives: { include: { activities: true }}}}}}}
    });

    if (plan) {
        // This is complex, for now we will rely on cascading delete in the DB
        // Or handle it manually. For this app, let's assume cascade is on.
    }
    
    await prisma.strategicPlan.delete({ where: { id } });

    revalidatePath('/strategic-plan');
    redirect('/strategic-plan');
}
