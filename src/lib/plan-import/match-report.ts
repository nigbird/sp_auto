/** A plan activity as the matcher sees it, in plan (sheet) order. */
export interface MatchableActivity {
  id: string;
  title: string;
  leadOwner: string | null;
}

/** A sheet row as the matcher sees it, in sheet order. */
export interface MatchableRow {
  title: string;
  leadOwner: string;
  hasReport: boolean;
}

export interface ReportMatch<R, A> {
  sheet: R;
  activity: A | null;
  /** Matched by title alone: the activity's lead owner was changed in the app since. */
  ownerChanged: boolean;
  /**
   * Unmatched because earlier rows already took every activity with this
   * title and lead owner — the sheet repeats the activity. The earlier row.
   */
  duplicateOf: R | null;
}

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Pairs each sheet row with the plan activity it reports on. Activities
 * don't keep the sheet's code, so a row matches by activity title + lead
 * owner; when several share both they pair up in sheet order, the order the
 * plan keeps them in. A row left over then matches by title alone, but only
 * when exactly one unclaimed activity has that title — an activity whose
 * lead owner was reassigned in the app.
 *
 * Every row comes back, with or without a report, so the caller can say
 * why each one is or isn't imported.
 */
export function matchReportRows<R extends MatchableRow, A extends MatchableActivity>(rows: R[], planActivities: A[]): ReportMatch<R, A>[] {
  const group = (key: (a: A) => string) => {
    const map = new Map<string, A[]>();
    for (const a of planActivities) map.set(key(a), [...(map.get(key(a)) ?? []), a]);
    return map;
  };
  const byTitleAndOwner = group(a => `${norm(a.title)}|${norm(a.leadOwner)}`);
  const byTitle = group(a => norm(a.title));

  const claimedBy = new Map<string, R>();
  const assigned: ReportMatch<R, A>[] = rows.map(sheet => {
    const activity = (byTitleAndOwner.get(`${norm(sheet.title)}|${norm(sheet.leadOwner)}`) ?? []).find(a => !claimedBy.has(a.id)) ?? null;
    if (activity) claimedBy.set(activity.id, sheet);
    return { sheet, activity, ownerChanged: false, duplicateOf: null };
  });
  for (const match of assigned) {
    if (match.activity) continue;
    const free = (byTitle.get(norm(match.sheet.title)) ?? []).filter(a => !claimedBy.has(a.id));
    if (free.length === 1) {
      claimedBy.set(free[0].id, match.sheet);
      match.activity = free[0];
      match.ownerChanged = true;
      continue;
    }
    // Activities with this title and owner exist, but earlier rows took them all.
    const taken = byTitleAndOwner.get(`${norm(match.sheet.title)}|${norm(match.sheet.leadOwner)}`) ?? [];
    if (taken.length > 0) match.duplicateOf = claimedBy.get(taken[taken.length - 1].id) ?? null;
  }
  return assigned;
}
