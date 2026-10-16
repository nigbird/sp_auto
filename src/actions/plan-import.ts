'use server'

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions-server';
import { recordAudit } from '@/lib/auth/audit';
import { REPORT_MONTH_UNKNOWN, type ParsedWorkbook } from '@/lib/plan-import/parse-workbook';
import { isYmd, periodProblems } from '@/lib/plan-import/period-checks';
import { parseSafely, readUpload } from '@/lib/plan-import/upload';
import { writeImportedPlan, type ImportPeriodSettings } from '@/lib/plan-import/write-plan';
import { monthKey, monthLabel } from '@/lib/monthly-breakdown';

export interface LeadOwnerMapping {
  userId: string;
}

export interface PlanImportOptions {
  name: string;
  version: string;
  startYear: number;
  endYear: number;
  /** Excel "Lead/ Owner (Activity)" title → the app user who holds that office. */
  leadOwners: Record<string, LeadOwnerMapping>;
  /** Import the sheet's monthly values as already-approved breakdowns. */
  importBreakdowns: boolean;
  /** Reporting periods to create with the plan. */
  periods?: ImportPeriodSettings[];
  /** Save the sheet's report (the "up to the reporting period" columns) as approved reports on the period ending in its month. */
  importReport?: boolean;
}

/** Problems with the periods to create, and the one the sheet's report goes to. */
function checkPeriods(periods: ImportPeriodSettings[], parsed: ParsedWorkbook, importReport: boolean): { problems: string[]; reportPeriodIndex: number | null } {
  const problems = periodProblems(periods);
  if (!importReport || parsed.counts.withReport === 0) return { problems, reportPeriodIndex: null };
  if (!parsed.reportThroughMonth) {
    problems.push(`${REPORT_MONTH_UNKNOWN} Turn off the report import.`);
    return { problems, reportPeriodIndex: null };
  }
  const index = periods.findIndex(p => isYmd(p.endDate) && monthKey(p.endDate) === parsed.reportThroughMonth);
  if (index < 0) problems.push(`The sheet's report runs to ${monthLabel(parsed.reportThroughMonth)} — add a reporting period that ends in ${monthLabel(parsed.reportThroughMonth)}, or turn off the report import.`);
  return { problems, reportPeriodIndex: index >= 0 ? index : null };
}

export type PreviewResult = { success: true; preview: ParsedWorkbook } | { success: false; message: string };
export type ImportResult = { success: true; planId: string } | { success: false; message: string; problems?: string[] };

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
 * mapped to the user who holds it. Everything is written in one transaction —
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
  }

  const periods = Array.isArray(options.periods) ? options.periods : [];
  const periodCheck = checkPeriods(periods, parsed, !!options.importReport);
  problems.push(...periodCheck.problems);

  if (problems.length > 0) {
    return { success: false, message: problems.length === 1 ? problems[0] : `${problems.length} things need fixing before the import can run.`, problems };
  }

  const sourceName = upload.fileName;
  let planId: string;
  try {
    planId = await prisma.$transaction(
      (tx) => writeImportedPlan(tx, parsed, {
        name, version, startYear, endYear, leadOwners: options.leadOwners, importBreakdowns: !!options.importBreakdowns,
        periods, reportPeriodIndex: periodCheck.reportPeriodIndex, sourceName,
      }, importer.id),
      { timeout: 120_000, maxWait: 10_000 }
    );
  } catch (error) {
    console.error('Plan import failed', error);
    return { success: false, message: 'The import failed because of a server error. Nothing was saved — please try again.' };
  }

  await recordAudit({
    action: 'PLAN_IMPORTED', entityType: 'StrategicPlan', entityId: planId,
    summary: `Imported plan "${name}" (${version}) from ${sourceName}`,
    metadata: { startYear, endYear, leadOwners: parsed.leadOwners.length, importBreakdowns: !!options.importBreakdowns, warnings: parsed.issues.length,
      periods: periods.map(p => p.name.trim()),
      reportPeriod: periodCheck.reportPeriodIndex != null ? periods[periodCheck.reportPeriodIndex].name.trim() : null },
  });
  revalidatePath('/strategic-plan');
  return { success: true, planId };
}
