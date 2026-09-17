export const DEADLINE_APPROACHING_DAYS = 7;

export type NotificationType =
  | 'UPDATE_APPROVED'
  | 'UPDATE_DECLINED'
  | 'ACTIVITY_ASSIGNED'
  | 'PERIOD_OPENED'
  | 'PERIOD_CLOSED'
  | 'DEADLINE_APPROACHING'
  | 'ACTIVITY_DELAYED'
  | 'EVIDENCE_MISSING';

export function isWithinDeadlineWindow(endDate: Date, now: Date = new Date()): boolean {
  const msUntilDeadline = endDate.getTime() - now.getTime();
  const daysUntilDeadline = msUntilDeadline / (1000 * 60 * 60 * 24);
  return daysUntilDeadline >= 0 && daysUntilDeadline <= DEADLINE_APPROACHING_DAYS;
}
