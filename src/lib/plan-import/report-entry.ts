import { computeReportRow, type ReportActivityInput } from '@/lib/report-calculations';
import { calculateActivityStatus, type StatusRule } from '@/lib/utils';
import type { ImportReport } from './parse-workbook';

export interface ReportedActivity extends ReportActivityInput {
  startDate: Date;
  endDate: Date;
}

/**
 * A sheet's report for one activity, as an approved report: the entry's
 * values, and what approving it does to the activity — the same values
 * approvePeriodReport leaves behind.
 */
export function importedReportValues(activity: ReportedActivity, report: ImportReport, periodEndDate: Date, importerId: string, now: Date, statusRules: StatusRule[]) {
  const completionDate = report.completionDate ? new Date(report.completionDate) : null;
  const row = computeReportRow(activity, { actualToDate: report.actualToDate, completionDate }, periodEndDate);
  const target = activity.annualTarget ?? 0;
  const progress = target > 0 && report.actualToDate != null ? Math.min(100, (report.actualToDate / target) * 100) : 0;
  return {
    entry: {
      reportStatus: 'APPROVED' as const,
      reportRequestedAt: now,
      planToDate: row.planToDate,
      actualToDate: report.actualToDate,
      completionDate,
      comment: report.accomplishedTasks || null,
      reasonForVariation: report.reasonForVariation || null,
      wayForward: report.wayForward || null,
      escalationIssues: report.escalationIssues || null,
      plannedProgress: row.completionShare != null ? Math.min(100, row.completionShare * 100) : 0,
      actualProgress: progress,
      approvalStatus: 'APPROVED' as const,
      declineReason: null,
      submittedById: importerId,
      submittedAt: now,
      approvedById: importerId,
      approvedAt: now,
    },
    activity: {
      progress,
      ...(report.actualToDate != null ? { status: calculateActivityStatus({ progress, startDate: activity.startDate, endDate: activity.endDate }, statusRules) } : {}),
      ...(completionDate ? { completionDate } : {}),
      ...(report.reasonForVariation ? { delayExplanation: report.reasonForVariation } : {}),
      ...(report.wayForward ? { recommendedAction: report.wayForward } : {}),
    },
  };
}
