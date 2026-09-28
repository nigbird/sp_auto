import sharp from 'sharp';
import { DELAY_BUCKET_LABEL, INITIATIVE_STATUS_LABEL, INITIATIVE_STATUS_ORDER, type DashboardMetrics, type DelayBucket } from '@/lib/dashboard-metrics';
import type { TrendPoint } from '@/lib/dashboard-data';
import { STATUS_COLOR, pillarColor } from '@/lib/dashboard-colors';
import {
  C, donutSvg, gaugeSvg, groupedBarsSvg, hBarsSvg, hPairsSvg, scatterSvg, stackedRowsSvg, statusBarsSvg, trendSvg, type ChartSvg,
} from './svg-charts';

export interface ChartImage { png: Buffer; width: number; height: number }

export type ChartKey =
  | 'gauge' | 'trend' | 'status'
  | 'contribution' | 'planActual' | 'pillarStatus'
  | 'scatter'
  | 'quartersInitiatives' | 'quartersActivities' | 'deliveryInitiatives' | 'deliveryActivities' | 'delays'
  | 'streamAchievement' | 'streamDelivery' | 'streamWorkload';

const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`);
const w = (v: number) => `${v.toFixed(2)}%`;
const strip = (s: string, word: string) => s.replace(new RegExp(`^${word}\\s*\\d+\\s*:?\\s*`, 'i'), '');

const DUE: DelayBucket[] = ['onTime', 'd1_30', 'd31_60', 'd61_90', 'd90plus'];
const STATE = { completed: '#0c6e3a', overdue: '#c0392b', open: '#a8a29a' };

/** Every chart the exports use, as SVG (sizes in CSS px). */
export function dashboardChartSvgs(m: DashboardMetrics, trend: TrendPoint[]): Record<ChartKey, ChartSvg> {
  const { rollup } = m.overall;
  const total = m.initiatives.length;

  return {
    gauge: gaugeSvg(rollup.weightedPlan > 0 ? rollup.achievedResult : null, 'Overall execution', `${w(rollup.weightedActual)} of ${w(rollup.weightedPlan)} planned`),
    trend: trendSvg(trend.map(t => ({ name: t.name, value: t.achieved })), 'Execution trend (achievement by period)'),
    status: statusBarsSvg(
      INITIATIVE_STATUS_ORDER.filter(s => s !== 'awaiting' || m.statusCounts.awaiting > 0).map(s => ({
        label: INITIATIVE_STATUS_LABEL[s], count: m.statusCounts[s], share: total ? m.statusCounts[s] / total : 0, color: STATUS_COLOR[s],
      })),
      'Initiative status'
    ),

    contribution: donutSvg(
      m.pillars.map(p => ({
        label: `${p.code} · ${strip(p.title, 'Pillar')}`,
        sub: `${w(p.summary.rollup.weightedActual)} actual of ${w(p.summary.rollup.weightedPlan)} planned`,
        value: p.summary.rollup.weightedActual,
        color: pillarColor(p.code),
        display: pct(p.summary.rollup.achievedResult, 0),
      })),
      { value: pct(rollup.achievedResult), label: 'overall execution' },
      'Contribution to overall achievement'
    ),
    planActual: groupedBarsSvg(
      m.pillars.map(p => p.code),
      [
        { name: 'Weighted plan', color: C.neutral, values: m.pillars.map(p => p.summary.rollup.weightedPlan), labels: m.pillars.map(() => '') },
        { name: 'Weighted actual', color: C.gold, values: m.pillars.map(p => p.summary.rollup.weightedActual), labels: m.pillars.map(p => (p.summary.rollup.weightedPlan > 0 ? pct(p.summary.rollup.achievedResult, 0) : '')) },
      ],
      'Plan vs actual by pillar (labels show achievement)',
      v => `${Math.round(v * 10) / 10}%`
    ),
    pillarStatus: stackedRowsSvg(
      m.pillars.map(p => ({
        label: `${p.code} · ${strip(p.title, 'Pillar')}`,
        note: `${p.initiatives} initiatives`,
        parts: INITIATIVE_STATUS_ORDER.map(s => ({ count: p.statusCounts[s], color: STATUS_COLOR[s] })),
      })),
      INITIATIVE_STATUS_ORDER.map(s => ({ label: INITIATIVE_STATUS_LABEL[s], color: STATUS_COLOR[s] })),
      'Initiative status by pillar'
    ),

    scatter: scatterSvg(
      m.initiatives
        .filter(i => i.summary.rollup.weightedPlan > 0 && i.summary.coverage.approved > 0)
        .map(i => ({ x: i.summary.rollup.achievedResult ?? 0, y: i.summary.rollup.weightedPlan, size: i.summary.totalWeight, label: i.code })),
      'Initiatives: achievement vs planned weight (bubble = total weight)'
    ),

    quartersInitiatives: quarterChart(m.initiativeQuarters, `Initiatives: expected vs completed by quarter · ${m.fiscalYearLabel}`),
    quartersActivities: quarterChart(m.activityQuarters, `Activities: expected vs completed by quarter · ${m.fiscalYearLabel}`),
    deliveryInitiatives: donutSvg(
      [
        { label: 'Completed', value: m.initiativesCompleted, color: STATE.completed, display: String(m.initiativesCompleted) },
        { label: 'Overdue', sub: 'past planned end, not completed', value: m.initiativesOverdue, color: STATE.overdue, display: String(m.initiativesOverdue) },
        { label: 'Not yet due', value: total - m.initiativesCompleted - m.initiativesOverdue, color: STATE.open, display: String(total - m.initiativesCompleted - m.initiativesOverdue) },
      ],
      { value: String(total), label: 'initiatives' },
      'Initiative delivery'
    ),
    deliveryActivities: donutSvg(
      [
        { label: 'Completed', value: m.activitiesCompleted, color: STATE.completed, display: String(m.activitiesCompleted) },
        { label: 'Overdue', sub: 'past planned end, not completed', value: m.activitiesOverdue, color: STATE.overdue, display: String(m.activitiesOverdue) },
        { label: 'Not yet due', value: m.activitiesTotal - m.activitiesCompleted - m.activitiesOverdue, color: STATE.open, display: String(m.activitiesTotal - m.activitiesCompleted - m.activitiesOverdue) },
      ],
      { value: String(m.activitiesTotal), label: 'activities' },
      'Activity delivery'
    ),
    delays: groupedBarsSvg(
      DUE.map(k => DELAY_BUCKET_LABEL[k]),
      [
        { name: 'Initiatives', color: '#b8862b', values: DUE.map(k => m.initiativeDelays[k]) },
        { name: 'Activities', color: '#2f6ea3', values: DUE.map(k => m.activityDelays[k]) },
      ],
      `Delays among due items (${m.initiativeDelays.notElapsed} initiatives and ${m.activityDelays.notElapsed} activities not yet due)`,
      v => String(v),
      true
    ),

    streamAchievement: hBarsSvg(
      m.streams
        .filter(s => s.summary.rollup.weightedPlan > 0 && s.summary.coverage.approved > 0)
        .map(s => ({ label: s.name, value: (s.summary.rollup.achievedResult ?? 0) * 100, text: pct(s.summary.rollup.achievedResult) })),
      `Achievement by stream (line = ${m.ratingThresholds.veryGood}% Very Good)`,
      m.ratingThresholds.veryGood
    ),
    streamDelivery: hPairsSvg(
      m.streams.filter(s => s.activitiesDue > 0 || s.activitiesCompleted > 0).map(s => ({ label: s.name, a: s.activitiesDue, b: s.activitiesCompleted })),
      ['Due by period end', 'Completed'],
      'Activities due vs completed by stream'
    ),
    streamWorkload: hPairsSvg(
      m.streams
        .filter(s => s.initiatives > 0 || s.summary.coverage.activities > 0)
        .sort((a, b) => b.summary.coverage.activities - a.summary.coverage.activities || b.initiatives - a.initiatives)
        .map(s => ({ label: s.name, a: s.initiatives, b: s.summary.coverage.activities })),
      ['Initiatives involved in', 'Activities led'],
      'Lead owner involvement: initiatives and activities',
      ['#b8862b', '#2f6ea3']
    ),
  };
}

function quarterChart(quarters: DashboardMetrics['initiativeQuarters'], title: string) {
  const shown = quarters.filter(q => q.key.startsWith('q') || q.expected > 0);
  return groupedBarsSvg(
    shown.map(q => q.label.split(' · ')[0]),
    [
      { name: 'Expected to complete', color: C.neutral, values: shown.map(q => q.expected) },
      { name: 'Completed', color: C.gold, values: shown.map(q => q.completed) },
    ],
    title,
    v => String(v),
    true
  );
}

/** Renders every chart to a 2× PNG (crisp in print and on high-DPI screens). */
export async function renderDashboardCharts(m: DashboardMetrics, trend: TrendPoint[]): Promise<Record<ChartKey, ChartImage>> {
  const svgs = dashboardChartSvgs(m, trend);
  const entries = await Promise.all(
    (Object.entries(svgs) as [ChartKey, ChartSvg][]).map(async ([key, chart]) => {
      const png = await sharp(Buffer.from(chart.svg), { density: 144 }).png().toBuffer();
      return [key, { png, width: chart.width, height: chart.height }] as const;
    })
  );
  return Object.fromEntries(entries) as Record<ChartKey, ChartImage>;
}
