import type { InitiativeStatus } from './dashboard-metrics';

/**
 * Dashboard colours shared by the on-screen charts and the PDF/Excel exports.
 * Both sets were checked with the dataviz palette validator (CVD separation,
 * contrast) in light and dark mode.
 */

/** Reserved for status; always shown with an icon or label, never colour alone. */
export const STATUS_COLOR: Record<InitiativeStatus, string> = {
  achieved: '#0c6e3a',
  onTrack: '#34a37a',
  behind: '#e8a33d',
  notStarted: '#c0392b',
  awaiting: '#d6cfc4',
  noTarget: '#a8a29a',
};

/** Pillar identity, in fixed order P1…P6. Colour follows the pillar, never its rank; a 7th+ pillar folds to grey. */
export const PILLAR_COLORS = ['#b8862b', '#2f6ea3', '#c0573e', '#2a9d8f', '#8a5aa8', '#5f8a2c'];

export function pillarColor(code: string): string {
  const index = Number(code.replace(/\D/g, '')) - 1;
  return PILLAR_COLORS[index] ?? '#9a948a';
}
