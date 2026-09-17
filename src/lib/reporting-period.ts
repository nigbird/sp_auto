import type { ReportingPeriod } from './types';

type PeriodLike = Pick<ReportingPeriod, 'cutOffDate'>;
type StatusedPeriodLike = Pick<ReportingPeriod, 'status' | 'cutOffDate'>;

/** True once "now" is past the period's cut-off date, regardless of its stored status — evaluated live wherever it's called, no scheduled job needed. */
export function isCutOffPassed(period: PeriodLike): boolean {
  return new Date(period.cutOffDate).getTime() < Date.now();
}

/**
 * A period stops accepting new performance-update submissions once it's
 * either manually closed or its cut-off date has passed, whichever comes
 * first. Manual close lets an admin end a period early; the cut-off date is
 * the automatic backstop so nothing has to remember to close it on time.
 */
export function isPeriodClosedForSubmissions(period: StatusedPeriodLike | null | undefined): boolean {
  if (!period) return false;
  return period.status === 'CLOSED' || isCutOffPassed(period);
}
