import type { ImportPeriodSettings } from './write-plan';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const isYmd = (d: string | undefined | null): d is string => !!d && YMD.test(d) && !Number.isNaN(new Date(d).getTime());

/**
 * What's wrong with a set of reporting periods for one plan: missing or
 * repeated names, bad dates, and overlaps (a day belongs to one period only).
 * `existing` are periods already saved, checked against but not reported on
 * their own.
 */
export function periodProblems(periods: ImportPeriodSettings[], existing: ImportPeriodSettings[] = []): string[] {
  const problems: string[] = [];
  const names = new Set(existing.map(p => p.name.trim().toLowerCase()));
  periods.forEach((p, i) => {
    const label = p.name?.trim() ? `"${p.name.trim()}"` : `Period ${i + 1}`;
    if (!p.name?.trim()) problems.push(`Give period ${i + 1} a name.`);
    else if (names.has(p.name.trim().toLowerCase())) problems.push(`A period named ${label} already exists — names must be different.`);
    names.add((p.name ?? '').trim().toLowerCase());
    if (![p.startDate, p.endDate, p.cutOffDate].every(isYmd)) problems.push(`${label}: start, end and cut-off dates are all required.`);
    else if (p.endDate < p.startDate) problems.push(`${label}: the end date can't be before the start date.`);
    else if (p.cutOffDate < p.endDate) problems.push(`${label}: the cut-off date can't be before the end date — owners report after the period ends.`);
  });
  const all = [...existing.map(p => ({ ...p, saved: true })), ...periods.map(p => ({ ...p, saved: false }))]
    .filter(p => isYmd(p.startDate) && isYmd(p.endDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (let i = 1; i < all.length; i++) {
    if ((all[i].saved && all[i - 1].saved) || all[i].startDate > all[i - 1].endDate) continue;
    problems.push(`"${all[i - 1].name.trim()}" and "${all[i].name.trim()}" overlap — each day can belong to one period only.`);
  }
  return problems;
}
