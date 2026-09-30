import {
  ACTIVITY_STATUS_ORDER,
  DELIVERY_STATE_LABEL,
  type ActivityDelayRow,
  type ActivityStatusLabel,
  type DeliveryState,
} from './dashboard-metrics';

/**
 * Filtering and grouping for the dashboard's activity-delay table (work stream →
 * initiative → activity), shared by the on-screen table and its export so the
 * download always matches what's shown.
 */

export const DELIVERY_ORDER: DeliveryState[] = ['overdue', 'completedLate', 'completedOnTime', 'notYetDue', 'noDueDate'];

export interface DelayTableFilter {
  /** Empty = every status. */
  statuses: ActivityStatusLabel[];
  /** Empty = every delivery state. */
  deliveries: DeliveryState[];
  /** Work stream (lead owner); empty = all. */
  stream: string;
  search: string;
}

export const EMPTY_DELAY_FILTER: DelayTableFilter = { statuses: [], deliveries: [], stream: '', search: '' };

export function filterDelayRows(rows: ActivityDelayRow[], f: DelayTableFilter): ActivityDelayRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter(r =>
    (f.statuses.length === 0 || f.statuses.includes(r.status)) &&
    (f.deliveries.length === 0 || f.deliveries.includes(r.delivery)) &&
    (!f.stream || r.stream === f.stream) &&
    (!q || [r.activity, r.initiative, r.stream, r.deliverable ?? '', r.initiativeCode].some(t => t.toLowerCase().includes(q)))
  );
}

export interface DelayInitiativeGroup {
  id: string;
  code: string;
  title: string;
  /** The worst (largest) days delayed among its activities shown — the initiative line's figure. */
  worstDelay: number | null;
  rows: ActivityDelayRow[];
}
export interface DelayStreamGroup { stream: string; initiatives: DelayInitiativeGroup[]; activities: number }

/** Rows are already sorted by stream then initiative code (see computeDashboard). */
export function groupDelayRows(rows: ActivityDelayRow[]): DelayStreamGroup[] {
  const streams: DelayStreamGroup[] = [];
  for (const r of rows) {
    let s = streams.find(x => x.stream === r.stream);
    if (!s) { s = { stream: r.stream, initiatives: [], activities: 0 }; streams.push(s); }
    let i = s.initiatives.find(x => x.id === r.initiativeId);
    if (!i) { i = { id: r.initiativeId, code: r.initiativeCode, title: r.initiative, worstDelay: null, rows: [] }; s.initiatives.push(i); }
    i.rows.push(r);
    if (r.daysDelayed != null) i.worstDelay = i.worstDelay == null ? r.daysDelayed : Math.max(i.worstDelay, r.daysDelayed);
    s.activities++;
  }
  return streams;
}

export function countBy<K extends string>(rows: ActivityDelayRow[], key: (r: ActivityDelayRow) => K, order: readonly K[]): Record<K, number> {
  const counts = Object.fromEntries(order.map(k => [k, 0])) as Record<K, number>;
  for (const r of rows) counts[key(r)] = (counts[key(r)] ?? 0) + 1;
  return counts;
}

// --- URL form, so the export link carries exactly the filters on screen ------------

export function delayFilterToParams(f: DelayTableFilter, params = new URLSearchParams()): URLSearchParams {
  if (f.statuses.length) params.set('status', f.statuses.join('|'));
  if (f.deliveries.length) params.set('delivery', f.deliveries.join('|'));
  if (f.stream) params.set('stream', f.stream);
  if (f.search.trim()) params.set('q', f.search.trim());
  return params;
}

export function delayFilterFromParams(params: URLSearchParams): DelayTableFilter {
  const list = <T extends string>(value: string | null, allowed: readonly T[]) =>
    (value ?? '').split('|').filter((v): v is T => (allowed as readonly string[]).includes(v));
  return {
    statuses: list(params.get('status'), ACTIVITY_STATUS_ORDER),
    deliveries: list(params.get('delivery'), DELIVERY_ORDER),
    stream: params.get('stream') ?? '',
    search: params.get('q') ?? '',
  };
}

/** "Status: Overdue, Not Started · Stream: …" — printed on exports so a filtered file says so. */
export function describeDelayFilter(f: DelayTableFilter): string {
  const parts: string[] = [];
  if (f.statuses.length) parts.push(`Status: ${f.statuses.join(', ')}`);
  if (f.deliveries.length) parts.push(`Delivery: ${f.deliveries.map(d => DELIVERY_STATE_LABEL[d]).join(', ')}`);
  if (f.stream) parts.push(`Work stream: ${f.stream}`);
  if (f.search.trim()) parts.push(`Search: "${f.search.trim()}"`);
  return parts.length ? parts.join(' · ') : 'All activities';
}

/** 89 → "89"; −212 → "−212"; null → "—". */
export function formatDays(days: number | null): string {
  if (days == null) return '—';
  return days < 0 ? `−${Math.abs(days)}` : String(days);
}
