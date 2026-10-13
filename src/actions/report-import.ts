'use server'

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission, userCan } from '@/lib/auth/permissions-server';
import { recordAudit } from '@/lib/auth/audit';
import { formatTargetValue, monthKey, monthLabel, type TargetType } from '@/lib/monthly-breakdown';
import { REPORT_MONTH_UNKNOWN, type ImportIssue, type ParsedWorkbook } from '@/lib/plan-import/parse-workbook';
import { matchReportRows } from '@/lib/plan-import/match-report';
import { isYmd, periodProblems } from '@/lib/plan-import/period-checks';
import { importedReportValues } from '@/lib/plan-import/report-entry';
import { parseSafely, readUpload } from '@/lib/plan-import/upload';
import type { ImportPeriodSettings } from '@/lib/plan-import/write-plan';

/**
 * Importing a period's report from the cascaded workbook into a plan that
 * already exists — the Performance Report's "Import report". Each sheet row
 * is matched to its activity and saved as an approved report on a period
 * that ends in the month the sheet reports up to. Reports already submitted
 * or approved for that period are never overwritten.
 */

export type ReportRowOutcome = 'import' | 'unmatched' | 'no-breakdown' | 'already-reported' | 'below-previous';

export interface ReportImportRow {
  row: number;
  code: string;
  title: string;
  leadOwner: string;
  actual: string;
  outcome: ReportRowOutcome;
  note: string | null;
}

export interface ReportImportPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  /** Ends in the month the sheet reports up to, so it can take the report. */
  fits: boolean;
  approvedReports: number;
}

export interface ReportImportPreview {
  fileName: string;
  sheetName: string;
  throughMonth: string | null;
  periods: ReportImportPeriod[];
  /** Filled in for "create a new period"; null when the report month is unknown. */
  suggestedPeriod: ImportPeriodSettings | null;
  canCreatePeriod: boolean;
  rows: ReportImportRow[];
  issues: ImportIssue[];
}

export type ReportPreviewResult = { success: true; preview: ReportImportPreview } | { success: false; message: string };
export type ReportImportResult = { success: true; imported: number; periodId: string } | { success: false; message: string; problems?: string[] };

export interface ReportImportOptions {
  periodId?: string;
  newPeriod?: ImportPeriodSettings;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const CUT_OFF_DAYS = 10;

async function loadPlan(planId: string) {
  return prisma.strategicPlan.findUnique({
    where: { id: planId },
    include: {
      reportingPeriods: { orderBy: { startDate: 'asc' } },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { monthlyTargets: true, periodEntries: { include: { reportingPeriod: true } } },
      },
    },
  });
}
type LoadedPlan = NonNullable<Awaited<ReturnType<typeof loadPlan>>>;

/** What happens to each sheet row if the report goes to a period ending on `periodEnd` (`periodId` when it already exists). */
function evaluate(plan: LoadedPlan, parsed: ParsedWorkbook, periodEnd: Date | null, periodId: string | null) {
  return matchReportRows(parsed, plan.activities).map(({ sheet, activity, ownerChanged }) => {
    const report = sheet.report!;
    const base = { row: sheet.row, code: sheet.code, title: sheet.title, leadOwner: sheet.leadOwner };
    const targetType = (activity?.targetType ?? sheet.targetType) as TargetType | null;
    const actual = report.actualToDate != null ? formatTargetValue(report.actualToDate, targetType) : '—';
    const result = (outcome: ReportRowOutcome, note: string | null = null) => ({ ...base, actual, outcome, note, activity, report });

    if (!activity) return result('unmatched', 'No activity in this plan has this title and lead owner.');
    if (activity.planSubmissionStatus !== 'APPROVED' || activity.monthlyTargets.length === 0 || !(activity.annualTarget && activity.annualTarget > 0)) {
      return result('no-breakdown', "The activity has no approved monthly breakdown to measure the report against.");
    }
    const existing = periodId ? activity.periodEntries.find(e => e.reportingPeriodId === periodId) : undefined;
    if (existing && (existing.reportStatus === 'SUBMITTED' || existing.reportStatus === 'APPROVED')) {
      return result('already-reported', `Already ${existing.reportStatus === 'APPROVED' ? 'approved' : 'submitted'} for this period — kept as it is.`);
    }
    if (periodEnd && activity.targetAggregation === 'CUMULATIVE' && activity.targetDirection === 'HIGHER_IS_BETTER' && report.actualToDate != null) {
      // Actuals run up to the period's end, so one-off work can't go down from an earlier approved period.
      const previous = activity.periodEntries
        .filter(e => e.reportStatus === 'APPROVED' && e.actualToDate != null && e.reportingPeriod.endDate < periodEnd)
        .sort((a, b) => b.reportingPeriod.endDate.getTime() - a.reportingPeriod.endDate.getTime())[0];
      if (previous && report.actualToDate < previous.actualToDate!) {
        return result('below-previous', `Lower than the ${formatTargetValue(previous.actualToDate!, targetType)} approved for ${previous.reportingPeriod.name} — actuals are cumulative.`);
      }
    }
    return result('import', ownerChanged ? `Matched by title — the lead owner is now ${activity.leadOwner ?? 'not set'} in the app.` : null);
  });
}

function suggestPeriod(plan: LoadedPlan, parsed: ParsedWorkbook): ImportPeriodSettings | null {
  if (!parsed.reportThroughMonth) return null;
  const [y, m] = parsed.reportThroughMonth.split('-').map(Number);
  const end = new Date(Date.UTC(y, m, 0));
  // Start the day after the last period that ends before it, or at the plan's first month.
  const before = plan.reportingPeriods.filter(p => p.endDate < end).at(-1);
  const firstMonth = parsed.months[0] ?? parsed.reportThroughMonth;
  const start = before ? new Date(before.endDate.getTime() + 86400000) : new Date(`${firstMonth}-01T00:00:00Z`);
  const first = monthLabel(monthKey(start)), last = monthLabel(parsed.reportThroughMonth);
  return {
    name: first === last ? first : `${first} to ${last}`,
    startDate: ymd(start),
    endDate: ymd(end),
    cutOffDate: ymd(new Date(end.getTime() + CUT_OFF_DAYS * 86400000)),
  };
}

/** Step 1: read the workbook and show what would happen. Nothing is saved. */
export async function previewReportImport(formData: FormData): Promise<ReportPreviewResult> {
  const user = await requirePermission('report-approvals:approve');
  const upload = await readUpload(formData);
  if (!upload.ok) return { success: false, message: upload.message };
  const result = parseSafely(upload.buffer, String(formData.get('sheet') ?? ''));
  if (!result.ok) return { success: false, message: result.message };
  const parsed = result.parsed;
  if (parsed.counts.activities === 0) {
    return { success: false, message: parsed.issues.find(i => i.severity === 'error')?.message ?? 'No activities were found in this sheet.' };
  }
  if (parsed.counts.withReport === 0) {
    return { success: false, message: 'This sheet has no report to import — no row has an "Actual up to the reporting period".' };
  }

  const plan = await loadPlan(String(formData.get('planId') ?? ''));
  if (!plan) return { success: false, message: 'This plan no longer exists.' };

  const periods = plan.reportingPeriods.map(p => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    fits: !!parsed.reportThroughMonth && monthKey(p.endDate) === parsed.reportThroughMonth,
    approvedReports: plan.activities.filter(a => a.periodEntries.some(e => e.reportingPeriodId === p.id && e.reportStatus === 'APPROVED')).length,
  }));
  // periodId "new" = a period still to be created; none given = the first period that fits.
  const chosenId = String(formData.get('periodId') ?? '');
  const chosen = chosenId === 'new'
    ? undefined
    : plan.reportingPeriods.find(p => p.id === chosenId) ?? plan.reportingPeriods.find(p => periods.find(x => x.id === p.id)?.fits);
  const suggestedPeriod = suggestPeriod(plan, parsed);
  const periodEnd = chosen?.endDate ?? (suggestedPeriod ? new Date(suggestedPeriod.endDate) : null);

  const rows = evaluate(plan, parsed, periodEnd, chosen?.id ?? null).map(({ activity: _a, report: _r, ...row }) => row);
  return {
    success: true,
    preview: {
      fileName: upload.fileName,
      sheetName: parsed.sheetName,
      throughMonth: parsed.reportThroughMonth,
      periods,
      suggestedPeriod,
      canCreatePeriod: userCan(user, 'settings:manage'),
      rows,
      issues: parsed.issues.filter(i => i.topic === 'report'),
    },
  };
}

/** Step 2: re-read the workbook and save the reports, all in one transaction. */
export async function importPlanReport(formData: FormData): Promise<ReportImportResult> {
  const importer = await requirePermission('report-approvals:approve');

  let options: ReportImportOptions;
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
  if (!parsed.reportThroughMonth) return { success: false, message: REPORT_MONTH_UNKNOWN };
  const through = monthLabel(parsed.reportThroughMonth);

  const plan = await loadPlan(String(formData.get('planId') ?? ''));
  if (!plan) return { success: false, message: 'This plan no longer exists.' };

  // The period the report goes to: an existing one, or a new one to create.
  let periodEnd: Date;
  let periodId: string | null = null;
  const newPeriod = options.newPeriod;
  if (options.periodId) {
    const period = plan.reportingPeriods.find(p => p.id === options.periodId);
    if (!period) return { success: false, message: 'That reporting period no longer exists. Reload and pick another.' };
    if (monthKey(period.endDate) !== parsed.reportThroughMonth) {
      return { success: false, message: `"${period.name}" doesn't end in ${through}, the month the sheet reports up to.` };
    }
    periodEnd = period.endDate;
    periodId = period.id;
  } else if (newPeriod) {
    if (!userCan(importer, 'settings:manage')) return { success: false, message: "You don't have permission to create reporting periods. Pick an existing period." };
    const existing = plan.reportingPeriods.map(p => ({ name: p.name, startDate: ymd(p.startDate), endDate: ymd(p.endDate), cutOffDate: ymd(p.cutOffDate) }));
    const problems = periodProblems([newPeriod], existing);
    if (isYmd(newPeriod.endDate) && monthKey(newPeriod.endDate) !== parsed.reportThroughMonth) {
      problems.push(`The new period must end in ${through}, the month the sheet reports up to.`);
    }
    if (problems.length > 0) return { success: false, message: problems[0], problems };
    periodEnd = new Date(newPeriod.endDate);
  } else {
    return { success: false, message: 'Pick a reporting period for the report, or create one.' };
  }

  const toImport = evaluate(plan, parsed, periodEnd, periodId).filter(r => r.outcome === 'import');
  if (toImport.length === 0) return { success: false, message: 'Nothing to import — no row matched an activity that can take this report.' };

  const now = new Date();
  let savedPeriodId: string;
  try {
    savedPeriodId = await prisma.$transaction(async (tx) => {
      const period = periodId
        ? await tx.reportingPeriod.findUniqueOrThrow({ where: { id: periodId } })
        : await tx.reportingPeriod.create({
            data: {
              strategicPlanId: plan.id,
              name: newPeriod!.name.trim(),
              startDate: new Date(newPeriod!.startDate),
              endDate: new Date(newPeriod!.endDate),
              cutOffDate: new Date(newPeriod!.cutOffDate),
            },
          });
      // The import stands in for a report request, so the report pages list this period.
      if (!period.reportRequestSentAt) {
        await tx.reportingPeriod.update({
          where: { id: period.id },
          data: { reportRequestMessage: `Imported from ${upload.fileName}`, reportRequestSentAt: now, reportRequestSentById: importer.id },
        });
      }
      const statusRules = await tx.rule.findMany({ select: { status: true, min: true, max: true } });

      for (const { activity, report } of toImport) {
        const a = activity!;
        const values = importedReportValues(
          { ...a, targetType: a.targetType as TargetType | null, monthlyTargets: a.monthlyTargets },
          report, period.endDate, importer.id, now, statusRules
        );
        await tx.activityPeriodEntry.upsert({
          where: { activityId_reportingPeriodId: { activityId: a.id, reportingPeriodId: period.id } },
          create: { ...values.entry, activityId: a.id, reportingPeriodId: period.id },
          update: values.entry,
        });
        // Only move the activity's headline numbers forward if this is its latest approved period.
        const laterApproved = a.periodEntries.some(e => e.reportStatus === 'APPROVED' && e.reportingPeriod.endDate > period.endDate);
        if (!laterApproved) await tx.activity.update({ where: { id: a.id }, data: values.activity });
      }
      return period.id;
    }, { timeout: 120_000, maxWait: 10_000 });
  } catch (error) {
    console.error('Report import failed', error);
    return { success: false, message: 'The import failed because of a server error. Nothing was saved — please try again.' };
  }

  await recordAudit({
    action: 'REPORTS_IMPORTED', entityType: 'ReportingPeriod', entityId: savedPeriodId,
    summary: `Imported ${toImport.length} ${toImport.length === 1 ? 'report' : 'reports'} up to ${through} into "${plan.name}" from ${upload.fileName}`,
    metadata: { planId: plan.id, imported: toImport.length, newPeriod: newPeriod && !periodId ? newPeriod.name.trim() : null },
  });
  revalidatePath('/reports', 'layout');
  revalidatePath('/settings/reporting-periods');
  revalidatePath('/strategic-plan', 'layout');
  return { success: true, imported: toImport.length, periodId: savedPeriodId };
}
