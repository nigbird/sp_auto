import type { KpiDirection } from '@prisma/client';

// The "approved configurable cap rule" from the operational requirements.
// This default is used when no configured value is supplied — the actual
// admin-configurable value lives in the AppConfig table (src/actions/app-config.ts)
// and is fetched by callers that display achievement (e.g. activity-details-dialog.tsx).
export const ACHIEVEMENT_CAP_PERCENT = 120;

export interface KpiLike {
  target: number | null;
  actual: number | null;
  hasTarget: boolean;
  direction: KpiDirection;
}

/**
 * achievement = actual / target (or the inverse for lower-is-better KPIs),
 * capped at capPercent. Returns null for no-target items, which are reported
 * separately and excluded from achievement denominators per the operational
 * rules, rather than reused elsewhere.
 */
export function calculateKpiAchievement(kpi: KpiLike, capPercent: number = ACHIEVEMENT_CAP_PERCENT): number | null {
  if (!kpi.hasTarget || kpi.target == null || kpi.actual == null) return null;

  if (kpi.direction === 'LOWER_IS_BETTER') {
    // Zero actual usage/cost/defects etc. is the best possible outcome for a
    // lower-is-better KPI — treat it as fully achieved rather than dividing by zero.
    if (kpi.actual === 0) return capPercent;
    const raw = (kpi.target / kpi.actual) * 100;
    return Number.isFinite(raw) ? Math.min(raw, capPercent) : null;
  }

  if (kpi.target === 0) return null;
  const raw = (kpi.actual / kpi.target) * 100;
  return Number.isFinite(raw) ? Math.min(raw, capPercent) : null;
}
