import type { Prisma } from '@prisma/client';
import { monthKeyToDate } from '@/lib/monthly-breakdown';
import type { ImportActivity, ParsedWorkbook } from './parse-workbook';

export interface ImportPlanSettings {
  name: string;
  version: string;
  startYear: number;
  endYear: number;
  leadOwners: Record<string, { userId: string; department: string }>;
  importBreakdowns: boolean;
}

/**
 * Writes a parsed, already-validated workbook as a new DRAFT plan. Kept out
 * of the server action so it can be run inside any transaction (including a
 * test one that's rolled back).
 */
export async function writeImportedPlan(tx: Prisma.TransactionClient, parsed: ParsedWorkbook, options: ImportPlanSettings, importerId: string): Promise<string> {
  const { name, version, startYear, endYear } = options;
  const departmentNames = Array.from(new Set(parsed.leadOwners.map(t => options.leadOwners[t].department.trim())));
  const map = (title: string) => ({ userId: options.leadOwners[title].userId, department: options.leadOwners[title].department.trim() });

  // Codes that appear more than once are one activity carried by several leads.
  const codeCounts = new Map<string, number>();
  parsed.pillars.forEach(p => p.objectives.forEach(o => o.initiatives.forEach(i => i.activities.forEach(a => codeCounts.set(a.code, (codeCounts.get(a.code) ?? 0) + 1)))));
  const now = new Date();
  // Rows created in one statement share a timestamp, and the plan is shown in
  // createdAt order — so give every row its own, increasing one, in sheet order.
  let sequence = 0;
  const nextCreatedAt = () => new Date(now.getTime() + sequence++);
  const importer = { id: importerId };

  for (const dept of departmentNames) {
    await tx.department.upsert({ where: { name: dept }, update: {}, create: { name: dept } });
  }

  const plan = await tx.strategicPlan.create({ data: { name, version, startYear, endYear, status: 'DRAFT' } });

  const activityData = (a: ImportActivity) => {
    const owner = map(a.leadOwner);
    const withBreakdown = options.importBreakdowns && !a.breakdownProblem;
    return {
      createdAt: nextCreatedAt(),
      title: a.title,
      description: a.collaborators ? `Responsible / collaborating unit: ${a.collaborators}` : '',
      deliverable: a.deliverable || null,
      department: owner.department,
      responsibleId: owner.userId,
      startDate: new Date(a.startDate),
      endDate: new Date(a.endDate),
      status: 'Not Started',
      weight: a.weight,
      progress: 0,
      approvalStatus: 'APPROVED' as const,
      strategicPlanId: plan.id,
      countsTowardWeight: a.countsTowardWeight,
      duplicateGroupId: (codeCounts.get(a.code) ?? 0) > 1 ? `${plan.id}:${a.code}` : null,
      // Keep the sheet's target settings even when the months can't be
      // imported, so the owner's breakdown form starts from them.
      targetType: a.targetType,
      annualTarget: a.annualTarget,
      targetAggregation: a.aggregation,
      targetDirection: a.direction,
      ...(withBreakdown ? {
        planRequestStatus: 'ACCEPTED' as const,
        planRequestSentAt: now,
        planRequestSentById: importer.id,
        planRequestRespondedAt: now,
        planSubmissionStatus: 'APPROVED' as const,
        planSubmittedById: importer.id,
        planSubmittedAt: now,
        planApprovedById: importer.id,
        planApprovedAt: now,
        monthlyTargets: { create: a.monthly.map(m => ({ month: monthKeyToDate(m.month), value: m.value })) },
      } : {}),
    };
  };

  for (const p of parsed.pillars) {
    const pillar = await tx.pillar.create({ data: { createdAt: nextCreatedAt(), title: p.title, description: '', strategicPlanId: plan.id } });
    for (const o of p.objectives) {
      const objective = await tx.objective.create({ data: { createdAt: nextCreatedAt(), statement: o.statement, pillarId: pillar.id } });
      for (const i of o.initiatives) {
        // The initiative's owners are the users leading its activities, in sheet order.
        const owners = Array.from(new Set(i.activities.map(a => map(a.leadOwner).userId)));
        await tx.initiative.create({
          data: {
            createdAt: nextCreatedAt(),
            title: i.title,
            description: '',
            ownerId: owners[0],
            coOwners: owners.slice(1),
            collaborators: [],
            objectiveId: objective.id,
            activities: { create: i.activities.map(activityData) },
          },
        });
      }
    }
  }
  return plan.id;
}
