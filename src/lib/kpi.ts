import type { KpiDirection } from '@prisma/client';

// The "approved configurable cap rule" from the operational requirements —
// a constant for now; making this admin-configurable (like the status Rules
// in src/actions/rules.ts) is a follow-up once there's a settings surface for it.
export const ACHIEVEMENT_CAP_PERCENT = 120;

export interface KpiLike {
  target: number | null;
  actual: number | null;
  hasTarget: boolean;
  direction: KpiDirection;
}

/**
 * achievement = actual / target (or the inverse for lower-is-better KPIs),
 * capped at ACHIEVEMENT_CAP_PERCENT. Returns null for no-target items, which
 * are reported separately and excluded from achievement denominators per the
 * operational rules, rather than reused elsewhere.
 */
export function calculateKpiAchievement(kpi: KpiLike): number | null {
  if (!kpi.hasTarget || kpi.target == null || kpi.actual == null) return null;

  if (kpi.direction === 'LOWER_IS_BETTER') {
    // Zero actual usage/cost/defects etc. is the best possible outcome for a
    // lower-is-better KPI — treat it as fully achieved rather than dividing by zero.
    if (kpi.actual === 0) return ACHIEVEMENT_CAP_PERCENT;
    const raw = (kpi.target / kpi.actual) * 100;
    return Number.isFinite(raw) ? Math.min(raw, ACHIEVEMENT_CAP_PERCENT) : null;
  }

  if (kpi.target === 0) return null;
  const raw = (kpi.actual / kpi.target) * 100;
  return Number.isFinite(raw) ? Math.min(raw, ACHIEVEMENT_CAP_PERCENT) : null;
}
