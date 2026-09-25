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

/**
 * CUMULATIVE: each month is the portion done that month and the months add up
 * to the target (Excel =SUM). RECURRING: each month is a level to hold, e.g.
 * "keep the ratio at 80%" (Excel =MAX).
 */
export type TargetAggregation = 'CUMULATIVE' | 'RECURRING';

export interface BreakdownEntry {
  month: string; // "YYYY-MM"
  value: number;
}

export interface BreakdownInput {
  targetType: TargetType;
  aggregation?: TargetAggregation;
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
  const aggregation = input.aggregation ?? 'CUMULATIVE';

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
    if (aggregation === 'CUMULATIVE' && Number.isFinite(annualTarget) && annualTarget > 0 && entry.value > annualTarget + 1e-9) {
      rowErrors[index] = `This month's value can't be more than the annual target (${formatTargetValue(annualTarget, targetType)}).`;
    }
  });

  // Cumulative months are portions of the target, so they must add up to it.
  // Recurring months are levels to hold, so there is nothing to add up.
  const hasRowErrors = Object.keys(rowErrors).length > 0;
  if (aggregation === 'CUMULATIVE' && !hasRowErrors && formErrors.length === 0 && entries.length > 0) {
    const total = entries.reduce((sum, e) => sum + e.value, 0);
    if (Math.abs(total - annualTarget) > 1e-6) {
      formErrors.push(`Monthly values add up to ${formatTargetValue(total, targetType)}, but the annual target is ${formatTargetValue(annualTarget, targetType)}. They must match.`);
    }
  }

  return { valid: formErrors.length === 0 && Object.keys(rowErrors).length === 0, formErrors, rowErrors };
}

/**
 * The Excel's "Plan up to the reporting period", in the target's own units:
 * the sum of the months up to and including `month` for cumulative targets
 * (=SUM), the highest of them for recurring ones (=MAX).
 */
export function planUpToMonth(entries: BreakdownEntry[], month: string, aggregation: TargetAggregation = 'CUMULATIVE'): number {
  const upTo = entries.filter(e => e.month <= month).map(e => e.value);
  if (upTo.length === 0) return 0;
  return aggregation === 'RECURRING' ? Math.max(...upTo) : upTo.reduce((sum, v) => sum + v, 0);
}

/** planUpToMonth as a share (0-100%) of the annual target. */
export function plannedPercentAtMonth(
  _targetType: TargetType,
  annualTarget: number,
  entries: BreakdownEntry[],
  month: string,
  aggregation: TargetAggregation = 'CUMULATIVE'
): number {
  if (!annualTarget || annualTarget <= 0) return 0;
  return Math.min(100, (planUpToMonth(entries, month, aggregation) / annualTarget) * 100);
}

/** End of the last month that has a planned value — the date the owner committed to finish by. */
export function plannedFinishDate(entries: BreakdownEntry[]): Date | null {
  const planned = entries.filter(e => e.value > 0).map(e => e.month).sort();
  if (planned.length === 0) return null;
  const [y, m] = planned[planned.length - 1].split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this month
}
