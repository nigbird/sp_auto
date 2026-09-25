/**
 * Shared rules for an activity's monthly breakdown (the Excel's "Target" +
 * Jul..Jun columns). Used by the owner's form, the server actions that save
 * and approve it, and the strategic plan's breakdown table, so all three
 * agree on what a valid breakdown is.
 *
 * Months are handled as "YYYY-MM" keys; the database stores them as the
 * first day of that month in UTC.
 */

export type TargetType = 'PERCENT' | 'NUMBER';

export interface BreakdownEntry {
  month: string; // "YYYY-MM"
  value: number;
}

export interface BreakdownInput {
  targetType: TargetType;
  annualTarget: number;
  entries: BreakdownEntry[];
  startDate: string | Date;
  endDate: string | Date;
}

export interface BreakdownValidation {
  valid: boolean;
  /** Problems with the breakdown as a whole. */
  formErrors: string[];
  /** Problems with one row, keyed by its index in `entries`. */
  rowErrors: Record<number, string>;
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthKey(date: string | Date): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthKeyToDate(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

/** "2026-07" → "Jul-26", matching the Excel column headers. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]}-${String(y).slice(-2)}`;
}

/** Every month key from start's month to end's month, inclusive. */
export function monthsBetween(start: string | Date, end: string | Date): string[] {
  const startKey = monthKey(start);
  const endKey = monthKey(end);
  const months: string[] = [];
  let [y, m] = startKey.split('-').map(Number);
  // Guard against absurd ranges so a bad date can't hang the UI.
  for (let i = 0; i < 240; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (key > endKey) break;
    months.push(key);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return months;
}

export function formatTargetValue(value: number, targetType: TargetType | null | undefined): string {
  const rounded = Math.round(value * 100) / 100;
  return targetType === 'PERCENT' ? `${rounded}%` : String(rounded);
}

export function validateBreakdown(input: BreakdownInput): BreakdownValidation {
  const formErrors: string[] = [];
  const rowErrors: Record<number, string> = {};
  const { targetType, annualTarget, entries } = input;

  if (targetType !== 'PERCENT' && targetType !== 'NUMBER') {
    formErrors.push('Choose whether the target is a percentage or a number.');
  }

  if (!Number.isFinite(annualTarget) || annualTarget <= 0) {
    formErrors.push('Annual target must be a number greater than 0.');
  } else if (targetType === 'PERCENT' && annualTarget > 100) {
    formErrors.push('A percentage annual target can\'t be more than 100%.');
  }

  if (entries.length === 0) {
    formErrors.push('Add at least one month — pick the month you will finish by and its target.');
  }

  const allowedMonths = new Set(monthsBetween(input.startDate, input.endDate));
  const firstAllowed = monthLabel(monthKey(input.startDate));
  const lastAllowed = monthLabel(monthKey(input.endDate));
  const seen = new Map<string, number>();

  entries.forEach((entry, index) => {
    if (!entry.month || !MONTH_KEY.test(entry.month)) {
      rowErrors[index] = 'Select a month.';
      return;
    }
    if (!allowedMonths.has(entry.month)) {
      rowErrors[index] = `${monthLabel(entry.month)} is outside the activity's dates (${firstAllowed} to ${lastAllowed}).`;
      return;
    }
    if (seen.has(entry.month)) {
      rowErrors[index] = `${monthLabel(entry.month)} is already used in row ${seen.get(entry.month)! + 1}.`;
      return;
    }
    seen.set(entry.month, index);

    if (!Number.isFinite(entry.value) || entry.value <= 0) {
      rowErrors[index] = 'Enter a value greater than 0.';
      return;
    }
    if (targetType === 'PERCENT' && entry.value > 100) {
      rowErrors[index] = 'A percentage can\'t be more than 100%.';
      return;
    }
    if (Number.isFinite(annualTarget) && annualTarget > 0 && entry.value > annualTarget + 1e-9) {
      rowErrors[index] = `This month's value can't be more than the annual target (${formatTargetValue(annualTarget, targetType)}).`;
    }
  });

  const hasRowErrors = Object.keys(rowErrors).length > 0;
  if (!hasRowErrors && formErrors.length === 0 && entries.length > 0) {
    const sorted = [...entries].sort((a, b) => a.month.localeCompare(b.month));
    if (targetType === 'NUMBER') {
      const total = sorted.reduce((sum, e) => sum + e.value, 0);
      if (Math.abs(total - annualTarget) > 1e-6) {
        formErrors.push(`Monthly values add up to ${formatTargetValue(total, 'NUMBER')}, but the annual target is ${formatTargetValue(annualTarget, 'NUMBER')}. They must match.`);
      }
    } else {
      // Percent values are "how far along by this month", so they can't go backwards
      // and the last one has to reach the annual target.
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].value < sorted[i - 1].value) {
          formErrors.push(`${monthLabel(sorted[i].month)} (${sorted[i].value}%) is lower than ${monthLabel(sorted[i - 1].month)} (${sorted[i - 1].value}%). Percent progress can't go down.`);
          break;
        }
      }
      const last = sorted[sorted.length - 1];
      if (Math.abs(last.value - annualTarget) > 1e-6) {
        formErrors.push(`The last month (${monthLabel(last.month)}) is ${last.value}%, but the annual target is ${annualTarget}%. The finishing month must reach the annual target.`);
      }
    }
  }

  return { valid: formErrors.length === 0 && Object.keys(rowErrors).length === 0, formErrors, rowErrors };
}

/**
 * How far along (0-100% of the annual target) the activity is planned to be
 * by the end of `month`. Number targets accumulate month by month; percent
 * targets already express progress, so the latest one at or before `month`
 * applies.
 */
export function plannedPercentAtMonth(
  targetType: TargetType,
  annualTarget: number,
  entries: BreakdownEntry[],
  month: string
): number {
  if (!annualTarget || annualTarget <= 0) return 0;
  const upTo = entries.filter(e => e.month <= month).sort((a, b) => a.month.localeCompare(b.month));
  if (upTo.length === 0) return 0;
  const reached = targetType === 'NUMBER'
    ? upTo.reduce((sum, e) => sum + e.value, 0)
    : upTo[upTo.length - 1].value;
  return Math.min(100, (reached / annualTarget) * 100);
}
