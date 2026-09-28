/** Shared list filtering: a text search and an inclusive date range (dates as "yyyy-MM-dd", either end optional). */

export interface DateRangeValue { from?: string; to?: string }

export const isRangeSet = (r: DateRangeValue) => !!(r.from || r.to);

const startOfDay = (ymd: string) => new Date(`${ymd}T00:00:00`).getTime();
const endOfDay = (ymd: string) => new Date(`${ymd}T23:59:59.999`).getTime();
const time = (d: string | Date | null | undefined) => (d == null ? NaN : new Date(d).getTime());

/** A single date falls inside the range. Items without a date only pass when no range is set. */
export function inDateRange(date: string | Date | null | undefined, r: DateRangeValue): boolean {
  if (!isRangeSet(r)) return true;
  const t = time(date);
  if (!Number.isFinite(t)) return false;
  if (r.from && t < startOfDay(r.from)) return false;
  if (r.to && t > endOfDay(r.to)) return false;
  return true;
}

/** A span (e.g. an activity's start–end) overlaps the range at any point. */
export function overlapsDateRange(start: string | Date | null | undefined, end: string | Date | null | undefined, r: DateRangeValue): boolean {
  if (!isRangeSet(r)) return true;
  const s = time(start), e = time(end ?? start);
  if (!Number.isFinite(s) && !Number.isFinite(e)) return false;
  const lo = Number.isFinite(s) ? s : e, hi = Number.isFinite(e) ? e : s;
  if (r.from && hi < startOfDay(r.from)) return false;
  if (r.to && lo > endOfDay(r.to)) return false;
  return true;
}

/** Every word of the query appears in at least one of the fields (case-insensitive). */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.filter(Boolean).join(' \u0000 ').toLowerCase();
  return words.every(w => haystack.includes(w));
}
