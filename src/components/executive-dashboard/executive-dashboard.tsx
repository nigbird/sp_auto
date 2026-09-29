import Link from "next/link";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Building2, CalendarClock, CheckCircle2, ClipboardCheck, Crown, Flag,
  Gauge as GaugeIcon, LayoutGrid, Layers, ListChecks, Sparkles, Target, TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardData, TrendPoint } from "@/lib/dashboard-data";
import { INITIATIVE_STATUS_ORDER, type DashboardMetrics, type DelayBucket, type Highlight, type InitiativeSummary, type PillarSummary } from "@/lib/dashboard-metrics";
import { DashboardFilters } from "./dashboard-filters";
import { TrendChart } from "./trend-chart";
import { PillarsTab } from "./tab-pillars";
import { InitiativesTab } from "./tab-initiatives";
import { DeliveryTab } from "./tab-delivery";
import { StreamsTab } from "./tab-streams";
import {
  CARD, DeltaChip, Gauge, STATUS_COLOR, SectionCard, StatusLabel, StatusPill, Tip, TipRow,
  initials, pct, pillarColor, shortDate, weightPct,
} from "./primitives";

const TZ = "Africa/Addis_Ababa";

export const DASHBOARD_TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "pillars", label: "Pillars & Objectives", icon: Layers },
  { id: "initiatives", label: "Initiatives", icon: ListChecks },
  { id: "delivery", label: "Delivery & Delays", icon: CalendarClock },
  { id: "streams", label: "Streams & Departments", icon: Building2 },
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number]["id"];

export function isDashboardTab(value: string | undefined): value is DashboardTab {
  return DASHBOARD_TABS.some(t => t.id === value);
}

export function ExecutiveDashboard({ data, tab = "overview" }: { data: DashboardData; tab?: DashboardTab }) {
  const greeting = <Greeting name={data.userName} today={data.today} />;

  if (data.state === "no-plan") {
    return (
      <div className="space-y-6">
        <TopBar left={greeting} />
        <EmptyState title="No strategic plan yet" body="Create or import a strategic plan to see its execution dashboard." href="/strategic-plan" cta="Go to Strategic Plans" />
      </div>
    );
  }

  const periodId = data.state === "ready" ? data.period.id : undefined;
  const filters = <DashboardFilters plans={data.plans} planId={data.plan.id} periods={data.periods} periodId={periodId} tab={tab} />;

  if (data.state === "no-period") {
    return (
      <div className="space-y-6">
        <TopBar left={greeting} right={filters} />
        <EmptyState title="No reporting period to show" body="Add a reporting period and send a report request. Results appear here as reports are approved." href="/settings/reporting-periods" cta="Reporting periods" />
      </div>
    );
  }

  const m = data.metrics;
  return (
    <div className="space-y-5">
      <TopBar
        left={
          <div>
            {greeting}
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {data.scope === "own" && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">My dashboard · only your activities</span>
              )}
              <span className="font-medium text-foreground">{data.plan.name}</span>
              <span aria-hidden>·</span>
              <span>As of {shortDate(data.period.endDate)}</span>
              {data.periodOpen && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  <CalendarClock className="h-3 w-3" /> In progress · approved reports so far
                </span>
              )}
            </p>
          </div>
        }
        right={filters}
      />

      <TabNav active={tab} planId={data.plan.id} periodId={data.period.id} />

      {tab === "overview" && <OverviewTab data={data} m={m} />}
      {tab === "pillars" && <PillarsTab m={m} />}
      {tab === "initiatives" && <InitiativesTab m={m} />}
      {tab === "delivery" && <DeliveryTab m={m} />}
      {tab === "streams" && <StreamsTab m={m} previous={data.previousMetrics} />}

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Every figure is cumulative from the start of the plan year to the end of the selected reporting period. Achievement = weighted actual ÷ weighted plan,
        from approved reports only; planned activities without an approved report count as zero. Delay penalty: −10% after 30 days late, −20% after 60, −50% after 90.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

function Greeting({ name, today }: { name: string; today: string }) {
  const date = new Date(today);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(date));
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name.trim().split(/\s+/)[0] || "there";
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{part}, {first}</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(date)}
      </p>
    </div>
  );
}

function TopBar({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      {left}
      {right}
    </div>
  );
}

function TabNav({ active, planId, periodId }: { active: DashboardTab; planId: string; periodId: string }) {
  return (
    <nav aria-label="Dashboard sections" className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="inline-flex min-w-max gap-1 rounded-2xl bg-muted/70 p-1">
        {DASHBOARD_TABS.map(t => {
          const Icon = t.icon;
          const on = t.id === active;
          const search = new URLSearchParams({ plan: planId, period: periodId, ...(t.id === "overview" ? {} : { tab: t.id }) });
          return (
            <Link
              key={t.id}
              href={`/?${search.toString()}`}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition",
                on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", on && "text-primary")} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function EmptyState({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className={cn(CARD, "flex flex-col items-center justify-center px-6 py-20 text-center")}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><GaugeIcon className="h-6 w-6" /></div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      <Link href={href} className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">{cta}</Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview (the Excel's "Overall DashBoard")
// ---------------------------------------------------------------------------

function OverviewTab({ data, m }: { data: Extract<DashboardData, { state: "ready" }>; m: DashboardMetrics }) {
  const previous = data.trend.length > 1 ? data.trend[data.trend.length - 2] : null;
  const current = data.trend[data.trend.length - 1];
  return (
    <div className="space-y-5">
      <KpiStrip m={m} previous={previous} current={current} periodEnd={data.period.endDate} />

      <div className="grid gap-5 lg:grid-cols-3">
        <TrendCard trend={data.trend} current={current} previous={previous} className="lg:col-span-2" />
        <StatusCard m={m} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HighlightCard label="Strongest pillar · period" icon={<Crown className="h-4 w-4" />} highlight={m.strongestPillarPeriod} pillar />
        <HighlightCard label="Strongest pillar · full year" icon={<Flag className="h-4 w-4" />} highlight={m.strongestPillarYear} pillar note="of the pillar's full-year weight" />
        <HighlightCard label="Strongest initiative · period" icon={<ArrowUpRight className="h-4 w-4" />} highlight={m.strongestInitiative} />
        <HighlightCard label="Weakest initiative · period" icon={<ArrowDownRight className="h-4 w-4" />} highlight={m.weakestInitiative} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <PillarList pillars={m.pillars} planId={data.plan.id} periodId={data.period.id} />
        <AttentionTable initiatives={m.initiatives} planId={data.plan.id} periodId={data.period.id} className="lg:col-span-2" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <StoryCard lines={m.story} />
        <IssuesSection issues={m.issues} />
      </div>
    </div>
  );
}

function KpiStrip({ m, previous, current, periodEnd }: { m: DashboardMetrics; previous: TrendPoint | null; current: TrendPoint; periodEnd: string }) {
  const { rollup, coverage, yearProgress } = m.overall;
  const diff = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? null : a - b);

  return (
    <section className={cn(CARD, "grid gap-x-8 gap-y-6 p-6 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]")}>
      <Kpi icon={<Flag className="h-3.5 w-3.5" />} label="Full-year progress" value={pct(yearProgress)} accent
        delta={<DeltaChip value={diff(current.yearProgress, previous?.yearProgress)} />} note="of total plan weight" />
      <Kpi icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Initiatives completed" value={`${m.initiativesCompleted}`} suffix={`/ ${m.initiatives.length}`}
        delta={<DeltaChip value={diff(current.initiativesCompleted, previous?.initiativesCompleted)} unit="count" />} note={`${m.initiativesDue} due by ${shortDate(periodEnd)}`} />
      <Kpi icon={<Target className="h-3.5 w-3.5" />} label="Objectives ≥ 80%" value={`${m.objectivesAtLeast80.count}`} suffix={`/ ${m.objectivesAtLeast80.of}`} note="with a target this period" />
      <Kpi icon={<ClipboardCheck className="h-3.5 w-3.5" />} label="Reports approved" value={`${coverage.approved}`} suffix={`/ ${coverage.planned}`}
        note={coverage.pending > 0 ? `${coverage.pending} awaiting approval` : coverage.missing > 0 ? `${coverage.missing} not yet approved` : "all planned activities reported"} />
      <div className="flex flex-col items-center justify-center sm:col-span-2 lg:col-span-1 lg:pl-6">
        <Tip content={<div className="space-y-1"><TipRow label="Weighted plan" value={weightPct(rollup.weightedPlan)} /><TipRow label="Weighted actual" value={weightPct(rollup.weightedActual)} /><TipRow label="After delays" value={pct(rollup.achievedWithDelay)} /></div>}>
          <Gauge value={rollup.weightedPlan > 0 ? rollup.achievedResult : null} label="Overall execution" caption={`${weightPct(rollup.weightedActual)} of ${weightPct(rollup.weightedPlan)} planned`} />
        </Tip>
        <DeltaChip value={diff(current.achieved, previous?.achieved)} className="mt-1" />
      </div>
    </section>
  );
}

function Kpi({ icon, label, value, suffix, delta, note, accent }: { icon: React.ReactNode; label: string; value: string; suffix?: string; delta?: React.ReactNode; note: string; accent?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
        <span className="text-muted-foreground/60">{icon}</span>
        {label}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className={cn("text-[32px] font-bold leading-none tracking-tight", accent ? "text-primary" : "text-foreground")}>{value}</span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {delta}
        <span className="text-xs text-muted-foreground">{note}</span>
      </div>
    </div>
  );
}

function TrendCard({ trend, current, previous, className }: { trend: TrendPoint[]; current: TrendPoint; previous: TrendPoint | null; className?: string }) {
  return (
    <section className={cn(CARD, "p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Execution trend</h2>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[28px] font-bold leading-none tracking-tight">{pct(current.achieved)}</span>
            <DeltaChip value={previous && current.achieved != null && previous.achieved != null ? current.achieved - previous.achieved : null} />
            {previous && <span className="text-xs text-muted-foreground">vs {previous.name}</span>}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{trend.length} reporting period{trend.length === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-4"><TrendChart points={trend} /></div>
    </section>
  );
}

function StatusCard({ m }: { m: DashboardMetrics }) {
  const total = m.initiatives.length;
  const dueActivities = (["onTime", "d1_30", "d31_60", "d61_90", "d90plus"] as DelayBucket[]).reduce((s, k) => s + m.activityDelays[k], 0);
  return (
    <section className={cn(CARD, "flex flex-col p-5 sm:p-6")}>
      <h2 className="text-[15px] font-semibold tracking-tight">Initiative status</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{total} initiatives this plan year</p>
      <ul className="mt-5 space-y-4">
        {INITIATIVE_STATUS_ORDER.filter(s => s !== "awaiting" || m.statusCounts.awaiting > 0).map(s => {
          const share = total ? m.statusCounts[s] / total : 0;
          return (
            <li key={s}>
              <div className="flex items-center justify-between text-sm">
                <StatusLabel status={s} className="text-sm text-foreground" />
                <span className="text-xs text-muted-foreground">{m.statusCounts[s]} · {pct(share, 0)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${share * 100}%`, background: STATUS_COLOR[s] }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto grid grid-cols-2 gap-4 border-t pt-4">
        <div>
          <p className="text-xl font-bold tracking-tight">{dueActivities ? pct(m.activityDelays.onTime / dueActivities, 0) : "—"}</p>
          <p className="text-[11px] text-muted-foreground">Due activities on time</p>
        </div>
        <div className="border-l pl-4">
          <p className="text-xl font-bold tracking-tight">{m.issues.length}</p>
          <p className="text-[11px] text-muted-foreground">Issues escalated</p>
        </div>
      </div>
    </section>
  );
}

function HighlightCard({ label, icon, highlight, pillar, note }: { label: string; icon: React.ReactNode; highlight: Highlight | null; pillar?: boolean; note?: string }) {
  return (
    <div className={cn(CARD, "flex flex-col p-5 transition hover:-translate-y-0.5")}>
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {label}
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </div>
      {highlight ? (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[26px] font-bold leading-none tracking-tight">{pct(highlight.value)}</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold">
              {pillar && <span className="h-2 w-2 rounded-[2px]" style={{ background: pillarColor(highlight.code) }} />}
              {highlight.code}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm" title={highlight.title}>{highlight.title}</p>
          {note && <p className="mt-auto pt-1 text-[11px] text-muted-foreground">{note}</p>}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nothing measured yet this period.</p>
      )}
    </div>
  );
}

function PillarList({ pillars, planId, periodId }: { pillars: PillarSummary[]; planId: string; periodId: string }) {
  return (
    <SectionCard
      title="Pillars"
      description="Achievement against the period plan"
      action={<Link href={`/?plan=${planId}&period=${periodId}&tab=pillars`} scroll={false} className="text-xs text-muted-foreground transition hover:text-foreground">View all</Link>}
    >
      <ul className="divide-y">
        {pillars.map(p => {
          const { rollup, yearProgress, totalWeight } = p.summary;
          const hasPlan = rollup.weightedPlan > 0;
          return (
            <li key={p.id}>
              <Tip
                className="-mx-2 rounded-xl px-2 py-3 transition hover:bg-muted/50"
                content={<div className="space-y-1"><TipRow label="Weight" value={weightPct(totalWeight)} /><TipRow label="Weighted plan" value={weightPct(rollup.weightedPlan)} /><TipRow label="Weighted actual" value={weightPct(rollup.weightedActual)} /><TipRow label="Full-year progress" value={pct(yearProgress)} /></div>}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: pillarColor(p.code) }}>{p.code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={p.title}>{p.title.replace(/^Pillar\s*\d+\s*:\s*/i, "")}</p>
                    <p className="text-xs text-muted-foreground">{p.initiatives} initiatives · {weightPct(totalWeight, 1)} weight</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold", !hasPlan && "font-normal text-muted-foreground")}>{hasPlan ? pct(rollup.achievedResult) : "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{hasPlan ? `${pct(yearProgress)} of year` : "no target"}</p>
                  </div>
                </div>
              </Tip>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function AttentionTable({ initiatives, planId, periodId, className }: { initiatives: InitiativeSummary[]; planId: string; periodId: string; className?: string }) {
  const rows = initiatives
    .filter(i => i.summary.rollup.weightedPlan > 0)
    .sort((a, b) => (a.summary.rollup.achievedResult ?? 0) - (b.summary.rollup.achievedResult ?? 0))
    .slice(0, 7);
  return (
    <SectionCard
      className={className}
      title="Initiatives to watch"
      description="Initiatives with a plan this period, weakest first"
      action={<Link href={`/?plan=${planId}&period=${periodId}&tab=initiatives`} scroll={false} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground">All initiatives <ArrowRight className="h-3 w-3" /></Link>}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No initiative has a plan for this period.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-2 pb-3 font-medium">Code</th>
                <th className="px-2 pb-3 font-medium">Initiative</th>
                <th className="px-2 pb-3 font-medium">Lead owner</th>
                <th className="px-2 pb-3 font-medium">Status</th>
                <th className="px-2 pb-3 text-right font-medium">Achieved</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(i => (
                <tr key={i.id} className="transition hover:bg-muted/40">
                  <td className="whitespace-nowrap px-2 py-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-[2px]" style={{ background: pillarColor(i.pillarCode) }} />{i.code}</span>
                  </td>
                  <td className="max-w-[260px] px-2 py-3">
                    <p className="truncate font-medium" title={i.title}>{i.title}</p>
                    <p className="text-xs text-muted-foreground">{i.pillarCode} · {i.objectiveCode} · {i.summary.coverage.approved}/{i.summary.coverage.planned} reports</p>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{initials(i.owner)}</span>
                      <span className="max-w-[170px] truncate text-xs" title={i.owner}>{i.owner}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3"><StatusPill status={i.status} /></td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-semibold">{pct(i.summary.rollup.achievedResult)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function StoryCard({ lines }: { lines: string[] }) {
  return (
    <section className={cn(CARD, "bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 sm:p-6")}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary"><Sparkles className="h-4 w-4" /></span>
        <h2 className="text-[15px] font-semibold tracking-tight">Story in brief</h2>
      </div>
      <ul className="mt-4 space-y-2.5">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IssuesSection({ issues }: { issues: DashboardMetrics["issues"] }) {
  return (
    <SectionCard title="Needs management attention" description="Escalations raised in approved reports">
      {issues.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" /> No escalations in approved reports.
        </div>
      ) : (
        <ul className="space-y-3">
          {issues.slice(0, 5).map(issue => (
            <li key={issue.activityId} className="rounded-2xl bg-muted/40 p-4">
              <div className="flex gap-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="line-clamp-3 text-sm leading-relaxed">{issue.text}</p>
                  <p className="mt-2 truncate text-xs text-muted-foreground" title={`${issue.activity} · ${issue.initiative} · ${issue.owner}`}>
                    {issue.initiativeCode} · {issue.activity} · {issue.owner}
                  </p>
                </div>
              </div>
            </li>
          ))}
          {issues.length > 5 && <li className="text-xs text-muted-foreground">+ {issues.length - 5} more in the Initiatives tab</li>}
        </ul>
      )}
    </SectionCard>
  );
}
