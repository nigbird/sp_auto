'use server'

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission, userCan } from '@/lib/auth/permissions-server';
import { recordAudit } from '@/lib/auth/audit';
import { formatTargetValue, monthKey, monthLabel, type TargetType } from '@/lib/monthly-breakdown';
import type { ImportIssue } from '@/lib/plan-import/parse-workbook';
import { matchReportRows } from '@/lib/plan-import/match-report';
import { actualInTargetUnits, parseReportWorkbook, toImportReport, type ParsedReport } from '@/lib/plan-import/parse-report';
import { isYmd, periodProblems } from '@/lib/plan-import/period-checks';
import { importedReportValues } from '@/lib/plan-import/report-entry';
import { readUpload } from '@/lib/plan-import/upload';
import type { ImportPeriodSettings } from '@/lib/plan-import/write-plan';

/**
 * Importing a period's report into a plan that already exists — the
 * Performance Report's "Import report". Reads the report template (or the
 * full cascaded sheet), matches each row to its activity and saves it as an
 * approved report on the chosen period. When the sheet shows the month it
 * reports up to, the period must end in that month. Reports already
 * submitted or approved for that period are never overwritten.
 */

export type ReportRowOutcome = 'import' | 'unmatched' | 'no-breakdown' | 'invalid' | 'already-reported' | 'below-previous' | 'own-activity';

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
  /** Null when the sheet doesn't show it (the report template) — then any period can take the report. */
  throughMonth: string | null;
  periods: ReportImportPeriod[];
  /** Filled in for "create a new period". */
  suggestedPeriod: ImportPeriodSettings;
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

function readReport(buffer: Buffer): ({ ok: true } & ParsedReport) | { ok: false; message: string } {
  try {
    const parsed = parseReportWorkbook(buffer);
    const error = parsed.issues.find(i => i.severity === 'error');
    return error ? { ok: false, message: error.message } : { ok: true, ...parsed };
  } catch (error) {
    console.error('Report import: could not read workbook', error);
    return { ok: false, message: "The file couldn't be read. Save it again as .xlsx and retry." };
  }
}
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

/**
 * What happens to each sheet row if the report goes to a period ending on `periodEnd` (`periodId` when it already exists).
 * Imported reports are saved as approved, so rows for the importer's own activities are left out:
 * like a single report, they need someone else to approve them.
 */
function evaluate(plan: LoadedPlan, parsed: ParsedReport, periodEnd: Date | null, periodId: string | null, importerId: string) {
  return matchReportRows(parsed.rows, plan.activities).map(({ sheet, activity, ownerChanged }) => {
    const targetType = (activity?.targetType ?? null) as TargetType | null;
    const report = toImportReport(sheet, activity ? actualInTargetUnits(sheet, targetType) : sheet.actualRaw);
    const base = { row: sheet.row, code: sheet.code, title: sheet.title, leadOwner: sheet.leadOwner };
    const actual = report.actualToDate != null ? formatTargetValue(report.actualToDate, targetType) : '—';
    const result = (outcome: ReportRowOutcome, note: string | null = null) => ({ ...base, actual, outcome, note, activity, report });

    if (!activity) return result('unmatched', 'No activity in this plan has this title and lead owner.');
    if (activity.responsibleId === importerId) return result('own-activity', "You're responsible for this activity, so its report has to be submitted and approved by someone else.");
    if (report.actualToDate! < 0) return result('invalid', "The actual can't be negative.");
    if (targetType === 'PERCENT' && report.actualToDate! > 100) return result('invalid', "A percentage actual can't be more than 100%.");
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

/** A new period ending in the sheet's month (or last month): from the day after the period before it, or the plan's first month. */
function suggestPeriod(plan: LoadedPlan, parsed: ParsedReport): ImportPeriodSettings {
  const now = new Date();
  const [y, m] = parsed.throughMonth ? parsed.throughMonth.split('-').map(Number) : [now.getUTCFullYear(), now.getUTCMonth()];
  let end = new Date(Date.UTC(y, m, 0));
  const before = plan.reportingPeriods.filter(p => p.endDate < end).at(-1);
  const planStart = plan.activities.reduce<Date | null>((min, a) => (!min || a.startDate < min ? a.startDate : min), null) ?? end;
  const start = before ? new Date(before.endDate.getTime() + 86400000) : new Date(Date.UTC(planStart.getUTCFullYear(), planStart.getUTCMonth(), 1));
  if (end < start) end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const first = monthLabel(monthKey(start)), last = monthLabel(monthKey(end));
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
  const parsed = readReport(upload.buffer);
  if (!parsed.ok) return { success: false, message: parsed.message };

  const plan = await loadPlan(String(formData.get('planId') ?? ''));
  if (!plan) return { success: false, message: 'This plan no longer exists.' };

  const periods = plan.reportingPeriods.map(p => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    fits: !parsed.throughMonth || monthKey(p.endDate) === parsed.throughMonth,
    approvedReports: plan.activities.filter(a => a.periodEntries.some(e => e.reportingPeriodId === p.id && e.reportStatus === 'APPROVED')).length,
  }));
  // periodId "new" = a period still to be created; none given = the first period that fits.
  const chosenId = String(formData.get('periodId') ?? '');
  const chosen = chosenId === 'new'
    ? undefined
    : plan.reportingPeriods.find(p => p.id === chosenId) ?? plan.reportingPeriods.find(p => periods.find(x => x.id === p.id)?.fits);
  const suggestedPeriod = suggestPeriod(plan, parsed);
  const periodEnd = chosen?.endDate ?? (suggestedPeriod ? new Date(suggestedPeriod.endDate) : null);

  const rows = evaluate(plan, parsed, periodEnd, chosen?.id ?? null, user.id).map(({ activity: _a, report: _r, ...row }) => row);
  return {
    success: true,
    preview: {
      fileName: upload.fileName,
      sheetName: parsed.sheetName,
      throughMonth: parsed.throughMonth,
      periods,
      suggestedPeriod,
      canCreatePeriod: userCan(user, 'settings:manage'),
      rows,
      issues: parsed.issues,
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
  const parsed = readReport(upload.buffer);
  if (!parsed.ok) return { success: false, message: parsed.message };
  const through = parsed.throughMonth ? monthLabel(parsed.throughMonth) : null;

  const plan = await loadPlan(String(formData.get('planId') ?? ''));
  if (!plan) return { success: false, message: 'This plan no longer exists.' };

  // The period the report goes to: an existing one, or a new one to create.
  let periodEnd: Date;
  let periodId: string | null = null;
  const newPeriod = options.newPeriod;
  if (options.periodId) {
    const period = plan.reportingPeriods.find(p => p.id === options.periodId);
    if (!period) return { success: false, message: 'That reporting period no longer exists. Reload and pick another.' };
    if (parsed.throughMonth && monthKey(period.endDate) !== parsed.throughMonth) {
      return { success: false, message: `"${period.name}" doesn't end in ${through}, the month the sheet reports up to.` };
    }
    periodEnd = period.endDate;
    periodId = period.id;
  } else if (newPeriod) {
    if (!userCan(importer, 'settings:manage')) return { success: false, message: "You don't have permission to create reporting periods. Pick an existing period." };
    const existing = plan.reportingPeriods.map(p => ({ name: p.name, startDate: ymd(p.startDate), endDate: ymd(p.endDate), cutOffDate: ymd(p.cutOffDate) }));
    const problems = periodProblems([newPeriod], existing);
    if (parsed.throughMonth && isYmd(newPeriod.endDate) && monthKey(newPeriod.endDate) !== parsed.throughMonth) {
      problems.push(`The new period must end in ${through}, the month the sheet reports up to.`);
    }
    if (problems.length > 0) return { success: false, message: problems[0], problems };
    periodEnd = new Date(newPeriod.endDate);
  } else {
    return { success: false, message: 'Pick a reporting period for the report, or create one.' };
  }

  const toImport = evaluate(plan, parsed, periodEnd, periodId, importer.id).filter(r => r.outcome === 'import');
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
    summary: `Imported ${toImport.length} ${toImport.length === 1 ? 'report' : 'reports'}${through ? ` up to ${through}` : ''} into "${plan.name}" from ${upload.fileName}`,
    metadata: { planId: plan.id, imported: toImport.length, newPeriod: newPeriod && !periodId ? newPeriod.name.trim() : null },
  });
  revalidatePath('/reports', 'layout');
  revalidatePath('/settings/reporting-periods');
  revalidatePath('/strategic-plan', 'layout');
  return { success: true, imported: toImport.length, periodId: savedPeriodId };
}
