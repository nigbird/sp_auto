
'use server';

import { publicUserSelect } from '@/lib/user-select';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { StrategicPlan as StrategicPlanType } from '@/lib/types';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions-server';
import { validateWeightReconciliation } from '@/lib/utils';
import { planFormSchema, zodIssuesToPlanIssues, type PlanFormValues, type PlanIssue } from '@/lib/plan-schema';
import { newPillarData, syncPlanTree } from '@/lib/plan-sync';

type PlanPillar = PlanFormValues['pillars'][number];
type PlanInitiative = PlanPillar['objectives'][number]['initiatives'][number];
type PlanActivity = PlanInitiative['activities'][number];

/**
 * What the create/update actions hand back when they can't save. Returned
 * rather than thrown: Next.js replaces thrown server-action messages with a
 * generic one in production, so a thrown error would hide the actual reason.
 */
export interface SavePlanFailure {
    success: false;
    message: string;
    issues: PlanIssue[];
}

function failure(message: string, issues: PlanIssue[] = []): SavePlanFailure {
    return { success: false, message, issues };
}

function forEachActivity(pillars: PlanPillar[], fn: (a: PlanActivity, path: string) => void) {
    pillars.forEach((p, pi) => p.objectives.forEach((o, oi) => o.initiatives.forEach((i, ii) => i.activities.forEach((a, ai) =>
        fn(a, `pillars.${pi}.objectives.${oi}.initiatives.${ii}.activities.${ai}`)
    ))));
}

function forEachInitiative(pillars: PlanPillar[], fn: (i: PlanInitiative, path: string) => void) {
    pillars.forEach((p, pi) => p.objectives.forEach((o, oi) => o.initiatives.forEach((i, ii) =>
        fn(i, `pillars.${pi}.objectives.${oi}.initiatives.${ii}`)
    )));
}

/**
 * Parses and checks a submitted plan: the shared schema first, then the
 * things only the server can know (departments and people that actually
 * exist), then — for publishing — the 100% weight rule.
 */
async function validatePlanSubmission(formData: FormData): Promise<{ ok: true; data: PlanFormValues; status: 'DRAFT' | 'PUBLISHED' } | { ok: false; result: SavePlanFailure }> {
    const status = formData.get('status') === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';

    let pillars: unknown;
    try {
        pillars = JSON.parse(String(formData.get('pillars') ?? '[]'));
    } catch {
        return { ok: false, result: failure('The plan data could not be read. Please reload the page and try again.') };
    }

    const parsed = planFormSchema.safeParse({
        name: formData.get('name'),
        startYear: formData.get('startYear'),
        endYear: formData.get('endYear'),
        version: formData.get('version'),
        pillars,
    });
    if (!parsed.success) {
        const issues = zodIssuesToPlanIssues(parsed.error);
        return { ok: false, result: failure(`The plan has ${issues.length} problem${issues.length === 1 ? '' : 's'} to fix.`, issues) };
    }
    const data = parsed.data;
    const issues: PlanIssue[] = [];

    const validDepartments = new Set((await prisma.department.findMany({ select: { name: true } })).map(d => d.name));
    const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map(u => u.id));

    forEachActivity(data.pillars, (a, path) => {
        if (!validDepartments.has(a.department)) {
            issues.push({ path: `${path}.department`, message: `"${a.department}" is not in the department list. Pick a department from the list.` });
        }
        if (!userIds.has(a.responsible)) {
            issues.push({ path: `${path}.responsible`, message: 'The selected responsible person no longer exists. Pick someone else.' });
        }
    });
    forEachInitiative(data.pillars, (i, path) => {
        if (i.owners.some(id => !userIds.has(id))) {
            issues.push({ path: `${path}.owners`, message: 'One of the selected owners no longer exists. Remove them and pick again.' });
        }
        if (new Set(i.owners).size !== i.owners.length) {
            issues.push({ path: `${path}.owners`, message: 'The same person is selected as owner more than once.' });
        }
    });

    if (issues.length > 0) {
        return { ok: false, result: failure(`The plan has ${issues.length} problem${issues.length === 1 ? '' : 's'} to fix.`, issues) };
    }

    if (status === 'PUBLISHED') {
        const reconciliation = validateWeightReconciliation(data.pillars);
        if (!reconciliation.valid) {
            return { ok: false, result: failure(`Cannot publish: ${reconciliation.issues.join(' ')}`, reconciliation.issues.map(message => ({ path: '_weight', message }))) };
        }
    }

    return { ok: true, data, status };
}

const TRANSACTION_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

export async function listStrategicPlans() {
    await requireUser();

    return await prisma.strategicPlan.findMany({
        orderBy: {
            updatedAt: 'desc',
        },
    });
}

export async function getStrategicPlanById(id: string) {
    await requireUser();

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
                                    owner: { select: publicUserSelect },
                                    activities: {
                                        orderBy: { createdAt: 'asc' },
                                        include: {
                                            responsible: { select: publicUserSelect },
                                            monthlyTargets: { orderBy: { month: 'asc' } },
                                        }
                                    },
                                    milestones: {
                                        orderBy: { targetDate: 'asc' },
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

export async function createStrategicPlan(formData: FormData): Promise<SavePlanFailure | void> {
    await requirePermission('strategic-plan:edit');

    const validation = await validatePlanSubmission(formData);
    if (!validation.ok) return validation.result;
    const { data, status } = validation;

    try {
        await prisma.$transaction(async (tx) => {
            const plan = await tx.strategicPlan.create({
                data: { name: data.name.trim(), startYear: data.startYear, endYear: data.endYear, version: data.version.trim(), status },
            });
            for (const p of data.pillars) {
                await tx.pillar.create({ data: newPillarData(p, plan.id) });
            }
        }, TRANSACTION_OPTIONS);
    } catch (error) {
        console.error("Error during strategic plan creation:", error);
        return failure("The plan couldn't be saved because of a server error. Nothing was saved — please try again.");
    }

    revalidatePath('/strategic-plan');
    redirect('/strategic-plan');
}


export async function updateStrategicPlan(id: string, formData: FormData): Promise<SavePlanFailure | void> {
    await requirePermission('strategic-plan:edit');

    const existingPlan = await prisma.strategicPlan.findUnique({ where: { id }, select: { id: true } });
    if (!existingPlan) return failure("This plan no longer exists. It may have been deleted.");

    const validation = await validatePlanSubmission(formData);
    if (!validation.ok) return validation.result;
    const { data, status } = validation;

    try {
        await prisma.$transaction(async (tx) => {
            await tx.strategicPlan.update({
                where: { id },
                data: { name: data.name.trim(), startYear: data.startYear, endYear: data.endYear, version: data.version.trim(), status },
            });
            await syncPlanTree(tx, id, data.pillars);
        }, TRANSACTION_OPTIONS);
    } catch (error) {
        console.error("Error during strategic plan update:", error);
        return failure("The plan couldn't be saved because of a server error. Your changes were not applied — please try again.");
    }

    revalidatePath('/strategic-plan');
    revalidatePath(`/strategic-plan/${id}`);
    redirect(`/strategic-plan/${id}`);
}


export async function publishStrategicPlan(id: string) {
    await requirePermission('strategic-plan:edit');

    const plan = await getStrategicPlanById(id);
    if (!plan) throw new Error("Strategic plan not found.");

    const reconciliation = validateWeightReconciliation(plan.pillars);
    if (!reconciliation.valid) {
        throw new Error(`Cannot publish: ${reconciliation.issues.join(' ')}`);
    }

    await prisma.strategicPlan.update({
        where: { id },
        data: { status: 'PUBLISHED' },
    });
    revalidatePath('/strategic-plan');
    revalidatePath(`/strategic-plan/${id}`);
}

export async function deleteStrategicPlan(id: string) {
    await requirePermission('strategic-plan:edit');

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
