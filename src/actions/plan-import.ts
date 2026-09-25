'use server'

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions-server';
import { parseStrategicPlanWorkbook, type ImportActivity, type ParsedWorkbook } from '@/lib/plan-import/parse-workbook';
import { monthKeyToDate } from '@/lib/monthly-breakdown';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface LeadOwnerMapping {
  userId: string;
  department: string;
}

export interface PlanImportOptions {
  name: string;
  version: string;
  startYear: number;
  endYear: number;
  /** Excel "Lead/ Owner (Activity)" title → the app user and department it stands for. */
  leadOwners: Record<string, LeadOwnerMapping>;
  /** Import the sheet's monthly values as already-approved breakdowns. */
  importBreakdowns: boolean;
}

export type PreviewResult = { success: true; preview: ParsedWorkbook } | { success: false; message: string };
export type ImportResult = { success: true; planId: string } | { success: false; message: string; problems?: string[] };

async function readUpload(formData: FormData): Promise<{ ok: true; buffer: Buffer } | { ok: false; message: string }> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose an Excel file (.xlsx) to import.' };
  if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) return { ok: false, message: `"${file.name}" isn't an Excel file. Upload the .xlsx workbook.` };
  if (file.size > MAX_FILE_BYTES) return { ok: false, message: 'The file is larger than 10 MB. Remove unused sheets and try again.' };
  return { ok: true, buffer: Buffer.from(await file.arrayBuffer()) };
}

function parseSafely(buffer: Buffer, sheet?: string): { ok: true; parsed: ParsedWorkbook } | { ok: false; message: string } {
  try {
    return { ok: true, parsed: parseStrategicPlanWorkbook(buffer, sheet || undefined) };
  } catch (error) {
    console.error('Plan import: could not read workbook', error);
    return { ok: false, message: "The file couldn't be read as an Excel workbook. Save it again as .xlsx and retry." };
  }
}

/** Step 1: read the workbook and show what would be imported. Nothing is saved. */
export async function previewPlanImport(formData: FormData): Promise<PreviewResult> {
  await requirePermission('strategic-plan:edit');
  const upload = await readUpload(formData);
  if (!upload.ok) return { success: false, message: upload.message };
  const result = parseSafely(upload.buffer, String(formData.get('sheet') ?? ''));
  if (!result.ok) return { success: false, message: result.message };
  return { success: true, preview: JSON.parse(JSON.stringify(result.parsed)) };
}

/**
 * Step 2: re-read the same workbook on the server (so what's saved is exactly
 * what the sheet says) and create the plan as a DRAFT, with every lead owner
 * mapped to a user and department. Everything is written in one transaction —
 * a failure leaves nothing half-imported.
 */
export async function importStrategicPlan(formData: FormData): Promise<ImportResult> {
  const importer = await requirePermission('strategic-plan:edit');

  let options: PlanImportOptions;
  try {
    options = JSON.parse(String(formData.get('options') ?? ''));
  } catch {
    return { success: false, message: 'The import settings were incomplete. Reload the page and try again.' };
  }

  const upload = await readUpload(formData);
  if (!upload.ok) return { success: false, message: upload.message };
  const result = parseSafely(upload.buffer, String(formData.get('sheet') ?? ''));
  if (!result.ok) return { success: false, message: result.message };
  const parsed = result.parsed;

  const problems: string[] = [];
  const blocking = parsed.issues.filter(i => i.severity === 'error');
  for (const issue of blocking) problems.push(`${issue.row ? `Row ${issue.row}: ` : ''}${issue.message}`);

  const name = (options.name ?? '').trim();
  const version = (options.version ?? '').trim();
  if (!name) problems.push('Give the plan a name.');
  if (!version) problems.push('Give the plan a version.');
  const startYear = Number(options.startYear);
  const endYear = Number(options.endYear);
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) problems.push('Start year must be a year between 2000 and 2100.');
  if (!Number.isInteger(endYear) || endYear < 2000 || endYear > 2100) problems.push('End year must be a year between 2000 and 2100.');
  else if (endYear < startYear) problems.push('End year must be the same as or after the start year.');

  const users = new Set((await prisma.user.findMany({ select: { id: true } })).map(u => u.id));
  for (const title of parsed.leadOwners) {
    const mapping = options.leadOwners?.[title];
    if (!mapping?.userId) problems.push(`Pick the user for "${title}".`);
    else if (!users.has(mapping.userId)) problems.push(`The user picked for "${title}" no longer exists.`);
    if (!mapping?.department?.trim()) problems.push(`Pick or enter the department for "${title}".`);
  }

  if (problems.length > 0) {
    return { success: false, message: problems.length === 1 ? problems[0] : `${problems.length} things need fixing before the import can run.`, problems };
  }

  const departmentNames = Array.from(new Set(parsed.leadOwners.map(t => options.leadOwners[t].department.trim())));
  const map = (title: string) => ({ userId: options.leadOwners[title].userId, department: options.leadOwners[title].department.trim() });

  // Codes that appear more than once are one activity carried by several leads.
  const codeCounts = new Map<string, number>();
  parsed.pillars.forEach(p => p.objectives.forEach(o => o.initiatives.forEach(i => i.activities.forEach(a => codeCounts.set(a.code, (codeCounts.get(a.code) ?? 0) + 1)))));

  const now = new Date();
  let planId: string;
  try {
    planId = await prisma.$transaction(async (tx) => {
      for (const dept of departmentNames) {
        await tx.department.upsert({ where: { name: dept }, update: {}, create: { name: dept } });
      }

      const plan = await tx.strategicPlan.create({ data: { name, version, startYear, endYear, status: 'DRAFT' } });

      const activityData = (a: ImportActivity) => {
        const owner = map(a.leadOwner);
        const withBreakdown = options.importBreakdowns && !a.breakdownProblem;
        return {
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
        const pillar = await tx.pillar.create({ data: { title: p.title, description: '', strategicPlanId: plan.id } });
        for (const o of p.objectives) {
          const objective = await tx.objective.create({ data: { statement: o.statement, pillarId: pillar.id } });
          for (const i of o.initiatives) {
            // The initiative's owners are the users leading its activities, in sheet order.
            const owners = Array.from(new Set(i.activities.map(a => map(a.leadOwner).userId)));
            await tx.initiative.create({
              data: {
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
    }, { timeout: 120_000, maxWait: 10_000 });
  } catch (error) {
    console.error('Plan import failed', error);
    return { success: false, message: 'The import failed because of a server error. Nothing was saved — please try again.' };
  }

  revalidatePath('/strategic-plan');
  return { success: true, planId };
}
