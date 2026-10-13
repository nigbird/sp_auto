import type { ImportActivity, ParsedWorkbook } from './parse-workbook';

/** A plan activity as the matcher sees it, in plan (sheet) order. */
export interface MatchableActivity {
  id: string;
  title: string;
  leadOwner: string | null;
}

export interface ReportMatch<A extends MatchableActivity> {
  sheet: ImportActivity;
  activity: A | null;
  /** Matched by title alone: the activity's lead owner was changed in the app since. */
  ownerChanged: boolean;
}

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Pairs each sheet row that has a report with the plan activity it reports
 * on. Activities don't keep the sheet's code, so a row matches by activity
 * title + lead owner; when several share both they pair up in sheet order,
 * the order the plan keeps them in. A row left over then matches by title
 * alone, but only when exactly one unclaimed activity has that title — an
 * activity whose lead owner was reassigned in the app.
 */
export function matchReportRows<A extends MatchableActivity>(parsed: ParsedWorkbook, planActivities: A[]): ReportMatch<A>[] {
  const group = (key: (a: A) => string) => {
    const map = new Map<string, A[]>();
    for (const a of planActivities) map.set(key(a), [...(map.get(key(a)) ?? []), a]);
    return map;
  };
  const byTitleAndOwner = group(a => `${norm(a.title)}|${norm(a.leadOwner)}`);
  const byTitle = group(a => norm(a.title));

  const rows = parsed.pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities)));
  const claimed = new Set<string>();
  const assigned = rows.map(sheet => {
    const activity = (byTitleAndOwner.get(`${norm(sheet.title)}|${norm(sheet.leadOwner)}`) ?? []).find(a => !claimed.has(a.id)) ?? null;
    if (activity) claimed.add(activity.id);
    return { sheet, activity, ownerChanged: false };
  });
  for (const match of assigned) {
    if (match.activity) continue;
    const free = (byTitle.get(norm(match.sheet.title)) ?? []).filter(a => !claimed.has(a.id));
    if (free.length === 1) {
      claimed.add(free[0].id);
      match.activity = free[0];
      match.ownerChanged = true;
    }
  }
  return assigned.filter(m => m.sheet.report);
}
