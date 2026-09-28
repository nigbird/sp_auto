import type { DashboardData } from '@/lib/dashboard-data';
import { DELAY_BUCKET_LABEL, INITIATIVE_STATUS_LABEL, INITIATIVE_STATUS_ORDER, streamTotals, type DelayBucket, type Summary } from '@/lib/dashboard-metrics';
import { describeRatingBands } from '@/lib/rating-bands';
import type { ChartImage, ChartKey } from './dashboard-charts';
import { SheetBuilder, writeStyledWorkbook, type StyleRole, type StyledCell } from './xlsx-styling';

type Ready = Extract<DashboardData, { state: 'ready' }>;

const num = (v: number | null | undefined): number | string => (v == null || !Number.isFinite(v) ? '—' : v);
const strip = (s: string, word: string) => s.replace(new RegExp(`^${word}\\s*\\d+\\s*:?\\s*`, 'i'), '');
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const cell = (v: number | string | null | undefined, role: StyleRole): StyledCell => ({ v: v ?? '—', role });

/** Plan/actual/achievement columns for a summary, styled for a normal, group or total row. */
function summaryCells(s: Summary, kind: 'row' | 'group' | 'total'): StyledCell[] {
  const hasPlan = s.rollup.weightedPlan > 0;
  const W: StyleRole = kind === 'group' ? 'groupWeight' : kind === 'total' ? 'totalWeight' : 'weight';
  const P: StyleRole = kind === 'group' ? 'groupPct' : kind === 'total' ? 'totalPct' : 'pct';
  return [
    cell(s.totalWeight, W),
    cell(s.rollup.weightedPlan, W),
    cell(s.rollup.weightedActual, W),
    cell(hasPlan ? num(s.rollup.achievedResult) : '—', P),
    cell(hasPlan ? num(s.rollup.achievedWithDelay) : '—', P),
    cell(num(s.yearProgress), P),
    cell(num(s.planShareOfTotal), P),
  ];
}

export function buildDashboardWorkbook(data: Ready, charts: Record<ChartKey, ChartImage>, generatedAt = new Date()): Buffer {
  const m = data.metrics;
  const asOf = day(data.period.endDate);
  const subtitle = `${data.plan.name} · As of ${asOf} (${data.period.name}) · Generated ${generatedAt.toLocaleString('en-GB', { timeZone: 'Africa/Addis_Ababa' })}`;
  const chart = (key: ChartKey, name: string) => ({ ...charts[key], name });

  // --- Overview -------------------------------------------------------------
  const ov = new SheetBuilder('Overview', [46, 16, 3, 62, 6, 4, 52]);
  ov.showGrid = false;
  ov.row([{ v: 'Strategic Plan Execution Dashboard', role: 'title' }]);
  ov.row([{ v: subtitle, role: 'subtitle' }]);
  ov.blank();
  ov.row([{ v: 'Headline figures', role: 'section' }]);
  const { rollup, coverage, yearProgress, totalWeight } = m.overall;
  const kpis: [string, StyledCell][] = [
    ['Overall execution (achievement vs period plan)', cell(rollup.weightedPlan > 0 ? num(rollup.achievedResult) : '—', 'kpiPct')],
    ['After delay penalties', cell(rollup.weightedPlan > 0 ? num(rollup.achievedWithDelay) : '—', 'kpiPct')],
    ['Weighted plan for the period', cell(rollup.weightedPlan, 'kpiWeight')],
    ['Weighted actual for the period', cell(rollup.weightedActual, 'kpiWeight')],
    ['Full-year progress (of total plan weight)', cell(num(yearProgress), 'kpiPct')],
    ['Total plan weight', cell(totalWeight, 'kpiWeight')],
    ['Initiatives fully completed', cell(`${m.initiativesCompleted} of ${m.initiatives.length}`, 'kpi')],
    ['Initiatives due by the period end', cell(m.initiativesDue, 'kpi')],
    ['Objectives at 80% or more', cell(`${m.objectivesAtLeast80.count} of ${m.objectivesAtLeast80.of}`, 'kpi')],
    ['Planned activities with an approved report', cell(`${coverage.approved} of ${coverage.planned}`, 'kpi')],
    ['Reports awaiting approval', cell(coverage.pending, 'kpi')],
  ];
  for (const [label, value] of kpis) ov.row([{ v: label, role: 'label' }, value]);
  ov.blank();

  ov.row([{ v: 'Highlights', role: 'section' }]);
  ov.row(['', 'Result', '', 'Name'], 'header');
  const highlights: [string, typeof m.strongestPillarPeriod][] = [
    ['Strongest pillar · this period', m.strongestPillarPeriod],
    ['Strongest pillar · full year', m.strongestPillarYear],
    ['Weakest pillar · this period', m.weakestPillarPeriod],
    ['Strongest initiative · this period', m.strongestInitiative],
    ['Weakest initiative · this period', m.weakestInitiative],
  ];
  for (const [label, h] of highlights) ov.row([cell(label, 'text'), cell(h ? h.value : '—', 'pct'), cell('', 'text'), cell(h ? `${h.code} · ${h.title}` : '—', 'wrap')]);
  ov.blank();

  ov.row([{ v: 'Initiative status', role: 'section' }]);
  ov.row(['Status', 'Initiatives', '', 'Share'], 'header');
  for (const s of INITIATIVE_STATUS_ORDER) ov.row([cell(INITIATIVE_STATUS_LABEL[s], 'text'), cell(m.statusCounts[s], 'int'), cell('', 'text'), cell(m.initiatives.length ? m.statusCounts[s] / m.initiatives.length : 0, 'pct')]);
  ov.blank();

  ov.row([{ v: 'Execution trend', role: 'section' }]);
  ov.row(['Reporting period', 'Achievement', '', 'After delays · full year · reports approved'], 'header');
  for (const t of data.trend) {
    ov.row([cell(`${t.name} (to ${day(t.endDate)})`, 'text'), cell(num(t.achieved), 'pct'), cell('', 'text'), cell(`${t.achievedWithDelay == null ? '—' : `${(t.achievedWithDelay * 100).toFixed(1)}%`} · ${t.yearProgress == null ? '—' : `${(t.yearProgress * 100).toFixed(1)}%`} · ${t.approved} of ${t.planned}`, 'text')]);
  }
  ov.blank();

  ov.row([{ v: 'Story in brief', role: 'section' }]);
  for (const line of m.story) { const r = ov.row([cell(line, 'wrap')]); ov.merge(r, 0, 4); ov.rowHeights.set(r, 30); }
  ov.blank();

  ov.row([{ v: 'Issues that need management attention', role: 'section' }]);
  if (m.issues.length === 0) ov.row([cell('No escalations in approved reports.', 'text')]);
  for (const issue of m.issues) {
    const r = ov.row([cell(issue.text, 'wrap'), '', '', cell(`${issue.initiativeCode} · ${issue.activity} · ${issue.owner}`, 'wrap')]);
    ov.merge(r, 0, 2);
    ov.rowHeights.set(r, 45);
  }
  ov.stackImages([chart('gauge', 'Overall execution'), chart('trend', 'Execution trend'), chart('status', 'Initiative status')], 6, 3, 0.75);

  // --- Pillars & Objectives ---------------------------------------------------
  const po = new SheetBuilder('Pillars & Objectives', [8, 52, 11, 11, 11, 13, 13, 11, 12, 10, 10, 10, 10, 10, 10, 3]);
  po.row([{ v: 'Pillar & Objective Performance', role: 'title' }]);
  po.row([{ v: subtitle, role: 'subtitle' }]);
  po.blank();
  const statusHeads = INITIATIVE_STATUS_ORDER.map(s => INITIATIVE_STATUS_LABEL[s]);
  const poHeader = po.row(['Code', 'Pillar / objective', 'Total weight', 'Weighted plan', 'Weighted actual', 'Achievement', 'After delays', 'Full year', 'Plan share of weight', ...statusHeads], 'header');
  po.rowHeights.set(poHeader, 42);
  po.freezeRows = poHeader + 1;
  const statusCells = (counts: Record<string, number>, role: StyleRole) => INITIATIVE_STATUS_ORDER.map(s => cell(counts[s], role));
  for (const p of m.pillars) {
    po.row([cell(p.code, 'group'), cell(strip(p.title, 'Pillar'), 'group'), ...summaryCells(p.summary, 'group'), ...statusCells(p.statusCounts, 'groupInt')]);
    for (const o of p.objectives) {
      po.row([cell(o.code, 'text'), cell(strip(o.statement, 'Objective'), 'text'), ...summaryCells(o.summary, 'row'), ...statusCells(o.statusCounts, 'int')]);
    }
  }
  po.row([cell('', 'total'), cell('Overall', 'total'), ...summaryCells(m.overall, 'total'), ...statusCells(m.statusCounts, 'totalInt')]);
  po.blank();
  po.row([{ v: 'Weights are % of the whole plan. Achievement = weighted actual ÷ weighted plan for the period (approved reports only). Full year = weighted actual ÷ total weight. Status columns count initiatives.', role: 'label' }]);
  po.stackImages([chart('contribution', 'Contribution to overall achievement'), chart('planActual', 'Plan vs actual by pillar'), chart('pillarStatus', 'Initiative status by pillar')], 16, poHeader, 0.75);

  // --- Initiatives ------------------------------------------------------------
  const ini = new SheetBuilder('Initiatives', [9, 6, 6, 46, 32, 12, 12, 9, 10, 10, 10, 11, 11, 11, 10, 20, 14, 14, 11, 48, 42, 42, 42]);
  ini.row([{ v: 'Initiatives Summary', role: 'title' }]);
  ini.row([{ v: subtitle, role: 'subtitle' }]);
  ini.blank();
  // The chart sits above the table so the wide narrative columns stay readable.
  const tableStart = ini.stackImages([chart('scatter', 'Achievement vs planned weight')], 0, 3, 0.8) + 1;
  while (ini.rows.length < tableStart) ini.blank();
  const iniHeader = ini.row([
    'Code', 'Pillar', 'Objective', 'Initiative', 'Lead owner', 'Start', 'End', 'Activities', 'Total weight', 'Planned weight', 'Attained weight',
    'Achievement', 'After delays', 'Full year', 'Reports approved', 'Status (period)', 'Overall', 'Rating', 'Delay',
    'Accomplished tasks', 'Reasons for variation / gap', 'Recommendations / way forward', 'Critical issues for management',
  ], 'header');
  ini.rowHeights.set(iniHeader, 42);
  const notes = (items: { text: string; activity: string }[]) => items.map(i => `• ${i.text} (${i.activity})`).join('\n');
  for (const i of m.initiatives) {
    const s = i.summary, hasPlan = s.rollup.weightedPlan > 0;
    ini.row([
      cell(i.code, 'text'), cell(i.pillarCode, 'text'), cell(i.objectiveCode, 'text'), cell(i.title, 'wrap'), cell(i.owner, 'wrap'),
      cell(day(i.startDate), 'text'), cell(day(i.dueDate), 'text'), cell(i.activities, 'int'),
      cell(s.totalWeight, 'weight'), cell(s.rollup.weightedPlan, 'weight'), cell(s.rollup.weightedActual, 'weight'),
      cell(hasPlan ? num(s.rollup.achievedResult) : '—', 'pct'), cell(hasPlan ? num(s.rollup.achievedWithDelay) : '—', 'pct'), cell(num(s.yearProgress), 'pct'),
      cell(hasPlan ? `${s.coverage.approved} of ${s.coverage.planned}` : '—', 'text'),
      cell(INITIATIVE_STATUS_LABEL[i.status], 'text'), cell(i.completed ? 'Completed' : 'Not completed', 'text'), cell(i.rating, 'text'),
      cell(i.delay ? DELAY_BUCKET_LABEL[i.delay] : '—', 'text'),
      cell(notes(i.narratives.accomplished), 'wrap'), cell(notes(i.narratives.variation), 'wrap'), cell(notes(i.narratives.wayForward), 'wrap'), cell(notes(i.narratives.escalation), 'wrap'),
    ]);
  }
  ini.autoFilter = `A${iniHeader + 1}:W${iniHeader + 1 + m.initiatives.length}`;
  ini.blank();
  ini.row([{ v: `Ratings (Configuration): ${describeRatingBands(m.ratingThresholds)}. Narratives come from approved reports this period.`, role: 'label' }]);

  // --- Delivery & Delays --------------------------------------------------------
  const dl = new SheetBuilder('Delivery & Delays', [26, 13, 13, 13, 4, 13, 13, 13, 3]);
  dl.row([{ v: 'Delivery & Delays', role: 'title' }]);
  dl.row([{ v: subtitle, role: 'subtitle' }]);
  dl.blank();
  dl.row([{ v: `Completion plan · ${m.fiscalYearLabel}`, role: 'section' }]);
  const qHeader = dl.row(['Due in', 'Initiatives expected', 'Completed', 'Rate', '', 'Activities expected', 'Completed', 'Rate'], 'header');
  dl.rowHeights.set(qHeader, 30);
  m.initiativeQuarters.forEach((q, k) => {
    const a = m.activityQuarters[k];
    dl.row([cell(q.label, 'text'), cell(q.expected, 'int'), cell(q.completed, 'int'), cell(q.expected ? q.completed / q.expected : '—', 'pct'), '', cell(a.expected, 'int'), cell(a.completed, 'int'), cell(a.expected ? a.completed / a.expected : '—', 'pct')]);
  });
  dl.blank();

  dl.row([{ v: 'Where items stand at the period end', role: 'section' }]);
  dl.row(['', 'Initiatives', '', '', '', 'Activities'], 'header');
  const standing: [string, number, number][] = [
    ['Completed', m.initiativesCompleted, m.activitiesCompleted],
    ['Due by the period end', m.initiativesDue, m.activitiesDue],
    ['Overdue (due, not completed)', m.initiativesOverdue, m.activitiesOverdue],
    ['Not yet due', m.initiativeDelays.notElapsed, m.activityDelays.notElapsed],
    ['Total', m.initiatives.length, m.activitiesTotal],
  ];
  for (const [label, a, b] of standing) dl.row([cell(label, 'text'), cell(a, 'int'), '', '', '', cell(b, 'int')]);
  dl.blank();

  dl.row([{ v: 'Delays among due items', role: 'section' }]);
  dl.row(['How late', 'Initiatives', '', '', '', 'Activities'], 'header');
  const due: DelayBucket[] = ['onTime', 'd1_30', 'd31_60', 'd61_90', 'd90plus'];
  for (const k of due) dl.row([cell(DELAY_BUCKET_LABEL[k], 'text'), cell(m.initiativeDelays[k], 'int'), '', '', '', cell(m.activityDelays[k], 'int')]);
  dl.blank();

  dl.row([{ v: 'Completed initiatives', role: 'section' }]);
  dl.row(['Code', 'Initiative', '', '', '', 'Lead owner'], 'header');
  if (m.completedInitiatives.length === 0) dl.row([cell('None yet.', 'text')]);
  for (const c of m.completedInitiatives) { const r = dl.row([cell(c.code, 'text'), cell(c.title, 'text'), '', '', '', cell(c.owner, 'text')]); dl.merge(r, 1, 4); }
  dl.blank();

  dl.row([{ v: 'Activities without a target', role: 'section' }]);
  dl.row(['Initiative', 'Activity', '', '', '', 'Lead owner', 'Why'], 'header');
  for (const a of m.activitiesWithoutTarget) { const r = dl.row([cell(a.code, 'text'), cell(a.title, 'text'), '', '', '', cell(a.owner, 'text'), cell(a.note, 'text')]); dl.merge(r, 1, 4); }
  dl.stackImages([
    chart('quartersInitiatives', 'Initiatives by quarter'), chart('quartersActivities', 'Activities by quarter'),
    chart('deliveryInitiatives', 'Initiative delivery'), chart('deliveryActivities', 'Activity delivery'), chart('delays', 'Delays'),
  ], 9, 3, 0.75);

  // --- Streams & Departments ------------------------------------------------------
  const prevByName = new Map(data.previousMetrics?.streams.map(s => [s.name, s]) ?? []);
  const st = new SheetBuilder('Streams & Departments', [5, 42, 10, 10, 10, 11, 11, 11, 12, 12, 9, 15, 12, 9, 9, 9, 9, 9, 9, 11, 3]);
  st.row([{ v: 'Streams & Departments Performance', role: 'title' }]);
  st.row([{ v: subtitle, role: 'subtitle' }]);
  st.blank();
  const stHeader = st.row([
    '#', 'Stream / director', 'Initiatives', 'Activities', 'Planned activities', 'Total weight', 'Weighted plan', 'Weighted actual',
    'Achievement', 'After delays', 'Score /30', 'Rating', 'vs last period', 'Initiatives due', 'Initiatives done', 'Deviation',
    'Activities due', 'Activities done', 'Deviation', 'Reports not approved',
  ], 'header');
  st.rowHeights.set(stHeader, 42);
  st.freezeRows = stHeader + 1;
  m.streams.forEach((s, k) => {
    const hasPlan = s.summary.rollup.weightedPlan > 0 && s.summary.coverage.approved > 0;
    const prev = prevByName.get(s.name);
    const prevHas = prev && prev.summary.rollup.weightedPlan > 0 && prev.summary.coverage.approved > 0;
    const delta = hasPlan && prevHas ? (s.summary.rollup.achievedResult ?? 0) - (prev!.summary.rollup.achievedResult ?? 0) : null;
    st.row([
      cell(k + 1, 'int'), cell(s.name, 'text'), cell(s.initiatives, 'int'), cell(s.summary.coverage.activities, 'int'), cell(s.summary.coverage.planned, 'int'),
      cell(s.summary.totalWeight, 'weight'), cell(s.summary.rollup.weightedPlan, 'weight'), cell(s.summary.rollup.weightedActual, 'weight'),
      cell(hasPlan ? num(s.summary.rollup.achievedResult) : '—', 'pct'), cell(hasPlan ? num(s.summary.rollup.achievedWithDelay) : '—', 'pct'),
      cell(s.score30 == null ? '—' : s.score30, 'score'), cell(s.rating, 'text'), cell(delta == null ? '—' : delta, 'pct'),
      cell(s.initiativesDue, 'int'), cell(s.initiativesCompleted, 'int'), cell(s.initiativesCompleted - s.initiativesDue, 'int'),
      cell(s.activitiesDue, 'int'), cell(s.activitiesCompleted, 'int'), cell(s.activitiesCompleted - s.activitiesDue, 'int'),
      cell(s.summary.coverage.missing, 'int'),
    ]);
  });
  st.autoFilter = `A${stHeader + 1}:T${stHeader + 1 + m.streams.length}`;
  // The Excel's totals: an initiative shared by several lead owners counts once per owner "with duplication".
  const totals = streamTotals(m);
  const totalRow = (label: string, values: (number | '')[]) =>
    st.row([cell('', 'total'), cell(label, 'total'), ...values.map(v => cell(v, 'totalInt')), ...Array.from({ length: 20 - 2 - values.length }, () => cell('', 'total'))]);
  totalRow('Total, with duplication', [totals.initiativesWithDuplication, totals.activities, totals.activitiesPlanned]);
  totalRow('Total, without duplication', [totals.initiativesWithoutDuplication, totals.activities, '']);
  totalRow('Duplicated (shared initiatives)', [totals.initiativesDuplicated, 0, '']);
  st.blank();
  st.row([{ v: `Score /30 = achievement × 30. Ratings (Configuration): ${describeRatingBands(m.ratingThresholds)}. "vs last period" is the change in achievement since ${data.previousMetrics ? 'the previous reporting period' : '— (no previous period)'}.`, role: 'label' }]);
  st.stackImages([
    chart('streamWorkload', 'Lead owner involvement'), chart('streamAchievement', 'Achievement by stream'), chart('streamDelivery', 'Activities due vs completed'),
  ], 21, stHeader, 0.75);

  return writeStyledWorkbook([ov, po, ini, dl, st]);
}
