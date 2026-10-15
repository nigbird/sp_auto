import type { ReportingPeriod } from './types';

type PeriodLike = Pick<ReportingPeriod, 'cutOffDate'>;
type StatusedPeriodLike = Pick<ReportingPeriod, 'status' | 'cutOffDate'>;

/** True once "now" is past the period's cut-off date, regardless of its stored status — evaluated live wherever it's called, no scheduled job needed. */
export function isCutOffPassed(period: PeriodLike): boolean {
  return new Date(period.cutOffDate).getTime() < Date.now();
}

/**
 * A period stops accepting submissions only when an admin closes it. The
 * cut-off date is a deadline, not a lock: reports sent after it are still
 * accepted, they're just shown as overdue (see isReportOverdue).
 */
export function isPeriodClosedForSubmissions(period: StatusedPeriodLike | null | undefined): boolean {
  if (!period) return false;
  return period.status === 'CLOSED';
}

/** A requested or returned report whose period's cut-off has passed — still submittable while the period is open, but late. */
export function isReportOverdue(entry: { reportStatus: string; reportingPeriod: PeriodLike }): boolean {
  return (entry.reportStatus === 'REQUESTED' || entry.reportStatus === 'RETURNED') && isCutOffPassed(entry.reportingPeriod);
}

/** A report submitted after its period's cut-off date. */
export function wasSubmittedLate(submittedAt: string | Date | null | undefined, period: PeriodLike): boolean {
  return !!submittedAt && new Date(submittedAt).getTime() > new Date(period.cutOffDate).getTime();
}
