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

/** What happens to a sheet row. Every row with an activity title gets one — none is dropped without a reason. */
export type ReportRowOutcome =
  | 'import' | 'no-actual' | 'invalid' | 'no-lead-owner' | 'unmatched' | 'duplicate'
  | 'no-breakdown' | 'already-reported' | 'below-previous' | 'own-activity';

/** A plan activity that no sheet row reports on, so it gets no report from this import. */
export interface ActivityNotInSheet {
  title: string;
  leadOwner: string;
}

export interface ReportImportRow {
  row: number;
  code: string;
  title: string;
  leadOwner: string;
  actual: string;
  /** The rest of what the row brings in, as read from the sheet. */
  completionDate: string | null;
  accomplishedTasks: string;
  reasonForVariation: string;
  wayForward: string;
  escalationIssues: string;
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
  /** Approved plan activities with no row in the sheet. */
  notInSheet: ActivityNotInSheet[];
  issues: ImportIssue[];
}

export type ReportPreviewResult = { success: true; preview: ReportImportPreview } | { success: false; message: string };
export type ReportImportResult =
  | { success: true; imported: number; skipped: number; skippedByOutcome: Partial<Record<ReportRowOutcome, number>>; notInSheet: number; periodId: string }
  | { success: false; message: string; problems?: string[] };

export interface ReportImportOptions {
  periodId?: string;
  newPeriod?: ImportPeriodSettings;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Short reason per outcome, for messages that summarise skipped rows. */
const OUTCOME_TEXT: Record<ReportRowOutcome, string> = {
  import: 'imported',
  'no-actual': 'no Actual entered',
  invalid: 'Actual not a valid number',
  'no-lead-owner': 'no Lead/ Owner',
  unmatched: 'not matched to a plan activity',
  duplicate: 'activity repeated in the sheet',
  'no-breakdown': 'no approved monthly breakdown or annual target',
  'already-reported': 'already submitted or approved for this period',
  'below-previous': 'lower than the last approved cumulative actual',
  'own-activity': 'your own activity',
};

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
const normKey = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function evaluate(plan: LoadedPlan, parsed: ParsedReport, periodEnd: Date | null, periodId: string | null, importerId: string) {
  const matches = matchReportRows(parsed.rows, plan.activities);
  const ownersByTitle = new Map<string, string[]>();
  for (const a of plan.activities) {
    const key = normKey(a.title);
    ownersByTitle.set(key, [...(ownersByTitle.get(key) ?? []), a.leadOwner || 'no lead owner']);
  }

  const rows = matches.map(({ sheet, activity, ownerChanged, duplicateOf }) => {
    const targetType = (activity?.targetType ?? null) as TargetType | null;
    const report = toImportReport(sheet, activity ? actualInTargetUnits(sheet, targetType) : sheet.actualRaw);
    const base = {
      row: sheet.row, code: sheet.code, title: sheet.title, leadOwner: sheet.leadOwner,
      completionDate: sheet.completionDate, accomplishedTasks: sheet.accomplishedTasks, reasonForVariation: sheet.reasonForVariation,
      wayForward: sheet.wayForward, escalationIssues: sheet.escalationIssues,
    };
    const actual = report.actualToDate != null ? formatTargetValue(report.actualToDate, targetType) : sheet.actualText ? `"${sheet.actualText.slice(0, 20)}"` : '—';
    const result = (outcome: ReportRowOutcome, note: string | null = null) => ({ ...base, actual, outcome, note, activity, report });
    const hasComments = !!(sheet.completionDate || sheet.accomplishedTasks || sheet.reasonForVariation || sheet.wayForward || sheet.escalationIssues);

    // The row itself: an actual that can be read, and a lead owner to match on.
    if (sheet.actualText) {
      return result('invalid', `The Actual "${sheet.actualText.slice(0, 40)}" isn't a number. Enter a number (0 if nothing was achieved yet) to import this row.`);
    }
    if (!sheet.hasReport) {
      if (!sheet.leadOwner && !activity) return result('no-actual', 'No Actual and no Lead/ Owner — if this is an activity, fill in both; if it is a heading or note row, it can be ignored.');
      return result('no-actual', `The Actual cell is empty, so there is no report to import${activity ? '' : " (and the row doesn't match an activity in this plan)"}. Enter a number — 0 if nothing was achieved yet${hasComments ? '. Its comments are not saved without an Actual' : ''}.`);
    }
    if (!activity) {
      if (duplicateOf) {
        return result('duplicate', `Row ${duplicateOf.row} already reports on this activity${duplicateOf.hasReport ? '' : ' (with an empty Actual)'}. Each activity can have only one row — remove or merge the repeated row.`);
      }
      if (!sheet.leadOwner) return result('no-lead-owner', 'The Lead/ Owner cell is empty, and more than one activity (or none) has this title — fill in the lead owner so the row can be matched.');
      const owners = ownersByTitle.get(normKey(sheet.title));
      if (owners?.length) {
        return result('unmatched', `An activity with this title exists under ${Array.from(new Set(owners)).join(', ')}, not "${sheet.leadOwner}". Correct the Lead/ Owner in the sheet.`);
      }
      return result('unmatched', 'No activity in this plan has this title. Check the title against the plan — it has to match word for word (spacing and capitals are ignored).');
    }
    if (activity.responsibleId === importerId) return result('own-activity', "You're responsible for this activity, so its report has to be submitted and approved by someone else.");
    if (report.actualToDate! < 0) return result('invalid', "The actual can't be negative.");
    if (targetType === 'PERCENT' && report.actualToDate! > 100) return result('invalid', "A percentage actual can't be more than 100%.");
    if (activity.planSubmissionStatus !== 'APPROVED') {
      return result('no-breakdown', `The activity's monthly breakdown is ${activity.planSubmissionStatus ? String(activity.planSubmissionStatus).toLowerCase().replace(/_/g, ' ') : 'not submitted'}, not approved — approve it first, then import again.`);
    }
    if (activity.monthlyTargets.length === 0) return result('no-breakdown', 'The activity has no monthly targets to measure the report against — add its monthly breakdown first.');
    if (!(activity.annualTarget && activity.annualTarget > 0)) return result('no-breakdown', 'The activity has no annual target (it is empty or 0) to measure the report against.');
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
    if (ownerChanged) {
      return result('import', sheet.leadOwner
        ? `Matched by title — the lead owner is now ${activity.leadOwner ?? 'not set'} in the app.`
        : `The Lead/ Owner cell is empty — matched by title to the only activity with it (${activity.leadOwner ?? 'no lead owner'}).`);
    }
    return result('import');
  });

  const matched = new Set(matches.map(m => m.activity?.id).filter(Boolean));
  const notInSheet: ActivityNotInSheet[] = plan.activities
    .filter(a => a.approvalStatus === 'APPROVED' && !matched.has(a.id))
    .map(a => ({ title: a.title, leadOwner: a.leadOwner || '—' }));
  return { rows, notInSheet };
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

  const evaluated = evaluate(plan, parsed, periodEnd, chosen?.id ?? null, user.id);
  const rows = evaluated.rows.map(({ activity: _a, report: _r, ...row }) => row);
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
      notInSheet: evaluated.notInSheet,
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

  const evaluated = evaluate(plan, parsed, periodEnd, periodId, importer.id);
  const toImport = evaluated.rows.filter(r => r.outcome === 'import');
  const skippedByOutcome: Partial<Record<ReportRowOutcome, number>> = {};
  for (const r of evaluated.rows) if (r.outcome !== 'import') skippedByOutcome[r.outcome] = (skippedByOutcome[r.outcome] ?? 0) + 1;
  const skipped = evaluated.rows.length - toImport.length;
  if (toImport.length === 0) {
    return {
      success: false,
      message: `Nothing to import — none of the ${evaluated.rows.length} rows can be imported. The preview lists the reason for each row.`,
      problems: [
        `Nothing to import — none of the ${evaluated.rows.length} rows can be imported:`,
        ...Object.entries(skippedByOutcome).map(([o, n]) => `${n} × ${OUTCOME_TEXT[o as ReportRowOutcome]}`),
      ],
    };
  }

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
    summary: `Imported ${toImport.length} ${toImport.length === 1 ? 'report' : 'reports'}${through ? ` up to ${through}` : ''} into "${plan.name}" from ${upload.fileName}${skipped ? `; ${skipped} ${skipped === 1 ? 'row' : 'rows'} skipped` : ''}`,
    metadata: {
      planId: plan.id,
      imported: toImport.length,
      skipped,
      skippedByOutcome,
      skippedRows: evaluated.rows.filter(r => r.outcome !== 'import').map(r => ({ row: r.row, title: r.title, outcome: r.outcome, note: r.note })),
      notInSheet: evaluated.notInSheet.length,
      newPeriod: newPeriod && !periodId ? newPeriod.name.trim() : null,
    },
  });
  revalidatePath('/reports', 'layout');
  revalidatePath('/settings/reporting-periods');
  revalidatePath('/strategic-plan', 'layout');
  return { success: true, imported: toImport.length, skipped, skippedByOutcome, notInSheet: evaluated.notInSheet.length, periodId: savedPeriodId };
}
