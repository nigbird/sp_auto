import type { Prisma } from '@prisma/client';
import type { PlanFormValues } from '@/lib/plan-schema';

/**
 * Writes a validated plan tree to the database. Kept out of the server
 * actions file so it can be exercised directly (e.g. from a script) without
 * going through auth.
 */

type PlanPillar = PlanFormValues['pillars'][number];
type PlanObjective = PlanPillar['objectives'][number];
type PlanInitiative = PlanObjective['initiatives'][number];
type PlanActivity = PlanInitiative['activities'][number];

function initiativeData(i: PlanInitiative) {
    return {
        title: i.title.trim(),
        description: i.description ?? '',
        ownerId: i.owners[0],
        coOwners: i.owners.slice(1),
        collaborators: i.collaborators ?? [],
    };
}

function activityData(a: PlanActivity) {
    return {
        title: a.title.trim(),
        description: a.description ?? '',
        deliverable: a.deliverable?.trim() || null,
        department: a.department,
        responsibleId: a.responsible,
        startDate: new Date(a.startDate),
        endDate: new Date(a.endDate),
        weight: Number(a.weight),
    };
}

function newActivityData(a: PlanActivity, planId: string) {
    return {
        ...activityData(a),
        status: 'Not Started',
        progress: 0,
        approvalStatus: 'APPROVED' as const,
        strategicPlanId: planId,
    };
}

function newInitiativeData(i: PlanInitiative, planId: string) {
    return {
        ...initiativeData(i),
        activities: { create: i.activities.map(a => newActivityData(a, planId)) },
    };
}

function newObjectiveData(o: PlanObjective, planId: string) {
    return {
        statement: o.statement.trim(),
        initiatives: { create: o.initiatives.map(i => newInitiativeData(i, planId)) },
    };
}

export function newPillarData(p: PlanPillar, planId: string) {
    return {
        title: p.title.trim(),
        description: p.description ?? '',
        strategicPlanId: planId,
        objectives: { create: p.objectives.map(o => newObjectiveData(o, planId)) },
    };
}

/**
 * Brings the saved tree in line with the submitted one without recreating
 * records that still exist: items whose id is already saved are updated in
 * place, new ones are created, and ones the user removed are deleted. Keeping
 * ids stable is what preserves each activity's progress, evidence, plan
 * requests and monthly breakdown across edits.
 */
export async function syncPlanTree(tx: Prisma.TransactionClient, planId: string, pillars: PlanPillar[]) {
    const existing = await tx.pillar.findMany({
        where: { strategicPlanId: planId },
        include: { objectives: { include: { initiatives: { include: { activities: { select: { id: true } } } } } } },
    });

    const existingPillars = new Map(existing.map(p => [p.id, p]));
    const keptPillarIds = pillars.map(p => p.id).filter((id): id is string => !!id && existingPillars.has(id));
    await tx.pillar.deleteMany({ where: { strategicPlanId: planId, id: { notIn: keptPillarIds } } });

    for (const p of pillars) {
        const savedPillar = p.id ? existingPillars.get(p.id) : undefined;
        if (!savedPillar) {
            await tx.pillar.create({ data: newPillarData(p, planId) });
            continue;
        }
        await tx.pillar.update({ where: { id: savedPillar.id }, data: { title: p.title.trim(), description: p.description ?? '' } });

        const existingObjectives = new Map(savedPillar.objectives.map(o => [o.id, o]));
        const keptObjectiveIds = p.objectives.map(o => o.id).filter((id): id is string => !!id && existingObjectives.has(id));
        await tx.objective.deleteMany({ where: { pillarId: savedPillar.id, id: { notIn: keptObjectiveIds } } });

        for (const o of p.objectives) {
            const savedObjective = o.id ? existingObjectives.get(o.id) : undefined;
            if (!savedObjective) {
                await tx.objective.create({ data: { ...newObjectiveData(o, planId), pillarId: savedPillar.id } });
                continue;
            }
            await tx.objective.update({ where: { id: savedObjective.id }, data: { statement: o.statement.trim() } });

            const existingInitiatives = new Map(savedObjective.initiatives.map(i => [i.id, i]));
            const keptInitiativeIds = o.initiatives.map(i => i.id).filter((id): id is string => !!id && existingInitiatives.has(id));
            await tx.initiative.deleteMany({ where: { objectiveId: savedObjective.id, id: { notIn: keptInitiativeIds } } });

            for (const i of o.initiatives) {
                const savedInitiative = i.id ? existingInitiatives.get(i.id) : undefined;
                if (!savedInitiative) {
                    await tx.initiative.create({ data: { ...newInitiativeData(i, planId), objectiveId: savedObjective.id } });
                    continue;
                }
                await tx.initiative.update({ where: { id: savedInitiative.id }, data: initiativeData(i) });

                const existingActivityIds = new Set(savedInitiative.activities.map(a => a.id));
                const keptActivityIds = i.activities.map(a => a.id).filter((id): id is string => !!id && existingActivityIds.has(id));
                await tx.activity.deleteMany({ where: { initiativeId: savedInitiative.id, id: { notIn: keptActivityIds } } });

                for (const a of i.activities) {
                    if (a.id && existingActivityIds.has(a.id)) {
                        await tx.activity.update({ where: { id: a.id }, data: activityData(a) });
                    } else {
                        await tx.activity.create({ data: { ...newActivityData(a, planId), initiativeId: savedInitiative.id } });
                    }
                }
            }
        }
    }
}

