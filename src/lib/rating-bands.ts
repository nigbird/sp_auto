/**
 * Dashboard rating bands (the Excel's "Weighted Performance Range"), configurable
 * in Configuration → Performance Rules. Thresholds are the minimum achievement,
 * in percent, for each rating; anything below "fair" is Unsatisfactory.
 */

export interface RatingThresholds {
  outstanding: number;
  veryGood: number;
  good: number;
  fair: number;
}

/** The Excel legend: 90% & above, 80–89.9%, 70–79.9%, 50–69.9%, below 50%. */
export const DEFAULT_RATING_THRESHOLDS: RatingThresholds = { outstanding: 90, veryGood: 80, good: 70, fair: 50 };

export const RATING_THRESHOLD_FIELDS: { key: keyof RatingThresholds; label: string }[] = [
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'veryGood', label: 'Very Good' },
  { key: 'good', label: 'Good' },
  { key: 'fair', label: 'Fair' },
];

/** Returns an error message, or null when the thresholds are usable. */
export function validateRatingThresholds(t: RatingThresholds): string | null {
  for (const { key, label } of RATING_THRESHOLD_FIELDS) {
    const v = t[key];
    if (!Number.isFinite(v)) return `${label} needs a number.`;
    if (v <= 0 || v > 1000) return `${label} must be between 0 and 1000%.`;
  }
  if (!(t.outstanding > t.veryGood && t.veryGood > t.good && t.good > t.fair)) {
    return 'Each band must start above the next one: Outstanding > Very Good > Good > Fair.';
  }
  return null;
}

/** Reads a stored value, falling back to the defaults if it is missing or invalid. */
export function parseRatingThresholds(value: unknown): RatingThresholds {
  if (!value || typeof value !== 'object') return DEFAULT_RATING_THRESHOLDS;
  const v = value as Record<string, unknown>;
  const t: RatingThresholds = {
    outstanding: Number(v.outstanding),
    veryGood: Number(v.veryGood),
    good: Number(v.good),
    fair: Number(v.fair),
  };
  return validateRatingThresholds(t) ? DEFAULT_RATING_THRESHOLDS : t;
}

const fmt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** "Outstanding ≥ 90%, Very Good 80–90%, …" for footnotes. */
export function describeRatingBands(t: RatingThresholds): string {
  return `Outstanding ≥ ${fmt(t.outstanding)}, Very Good ${fmt(t.veryGood)}–${fmt(t.outstanding)}, Good ${fmt(t.good)}–${fmt(t.veryGood)}, Fair ${fmt(t.fair)}–${fmt(t.good)}, Unsatisfactory below ${fmt(t.fair)}`;
}
