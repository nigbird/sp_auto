import Link from "next/link";
import {
  ArrowDownRight, ArrowUpRight, Building2, CalendarClock, CheckCircle2, ClipboardCheck, Crown,
  FileWarning, Flag, Gauge, Layers, ListChecks, Sparkles, Target, TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard-data";
import {
  DELAY_BUCKET_LABEL, INITIATIVE_STATUS_LABEL, INITIATIVE_STATUS_ORDER,
  type DashboardMetrics, type DelayBucket, type Highlight, type InitiativeStatus, type ObjectiveSummary, type PillarSummary, type StreamSummary,
} from "@/lib/dashboard-metrics";
import { DashboardFilters } from "./dashboard-filters";
import {
  MeterBar, RatingChip, STATUS_COLOR, SectionCard, StatusLabel, StatusStack, Tip, TipRow, pct, shortDate, weightPct,
} from "./primitives";

export function ExecutiveDashboard({ data }: { data: DashboardData }) {
  if (data.state === "no-plan") {
    return <EmptyState title="No strategic plan yet" body="Create or import a strategic plan to see its execution dashboard." href="/strategic-plan" cta="Go to Strategic Plan" />;
  }

  const header = (
    <DashboardHeader
      planName={data.plan.name}
      subtitle={data.state === "ready" ? `Performance as of ${shortDate(data.period.endDate)} · ${data.period.name}` : "No reporting period yet"}
      filters={<DashboardFilters plans={data.plans} planId={data.plan.id} periods={data.periods} periodId={data.state === "ready" ? data.period.id : undefined} />}
    />
  );

  if (data.state === "no-period") {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState title="No reporting period to show" body="Add a reporting period and send a report request. Results appear here as reports are approved." href="/settings/reporting-periods" cta="Reporting periods" />
      </div>
    );
  }

  const m = data.metrics;
  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-4 lg:grid-cols-12">
        <OverallHero m={m} className="lg:col-span-5" />
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
          <PillarHighlight label="Strongest pillar · this period" icon={<Crown className="h-4 w-4" />} highlight={m.strongestPillarPeriod} note="Achievement against the period plan" />
          <PillarHighlight label="Strongest pillar · full year" icon={<Flag className="h-4 w-4" />} highlight={m.strongestPillarYear} note="Weighted actual out of the pillar's full-year weight" />
          <KpiTile
            label="Initiatives fully completed"
            icon={<CheckCircle2 className="h-4 w-4" />}
            value={`${m.initiativesCompleted}`}
            suffix={`of ${m.initiatives.length}`}
            note={`${m.initiativesDue} planned to be complete by ${shortDate(data.period.endDate)}`}
            meter={m.initiativesDue > 0 ? Math.min(1, m.initiativesCompleted / m.initiativesDue) : null}
          />
          <KpiTile
            label="Objectives at 80% or more"
            icon={<Target className="h-4 w-4" />}
            value={`${m.objectivesAtLeast80.count}`}
            suffix={`of ${m.objectivesAtLeast80.of}`}
            note="Objectives with a target this period"
            meter={m.objectivesAtLeast80.of > 0 ? m.objectivesAtLeast80.count / m.objectivesAtLeast80.of : null}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StoryCard lines={m.story} className="lg:col-span-2" />
        <div className="grid gap-4">
          <InitiativeHighlight kind="strongest" highlight={m.strongestInitiative} />
          <InitiativeHighlight kind="weakest" highlight={m.weakestInitiative} />
        </div>
      </div>

      <PillarSection pillars={m.pillars} />

      <div className="grid gap-4 xl:grid-cols-5">
        <ObjectiveSection objectives={m.objectives} className="xl:col-span-3" />
        <div className="grid gap-4 xl:col-span-2">
          <StatusSection m={m} />
          <DelaySection m={m} />
        </div>
      </div>

      <StreamSection streams={m.streams} />

      <IssuesSection issues={m.issues} />

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Achievement = weighted actual ÷ weighted plan for the period, using approved reports only; planned activities without an approved report count as zero.
        Delay penalty: −10% after 30 days late, −20% after 60, −50% after 90. Ratings: Outstanding ≥ 90%, Very Good 80–89.9%, Good 70–79.9%, Fair 50–69.9%, Unsatisfactory below 50%.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header & empty state
// ---------------------------------------------------------------------------

function DashboardHeader({ planName, subtitle, filters }: { planName: string; subtitle: string; filters: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/[0.12] via-card to-card px-6 py-6 shadow-sm sm:px-8">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Strategic plan execution</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{planName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {filters}
      </div>
    </div>
  );
}

function EmptyState({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Gauge className="h-6 w-6" /></div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      <Link href={href} className="mt-5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">{cta}</Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Headline row
// ---------------------------------------------------------------------------

function OverallHero({ m, className }: { m: DashboardMetrics; className?: string }) {
  const { rollup, coverage, yearProgress, totalWeight } = m.overall;
  return (
    <section className={cn("relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm", className)}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Gauge className="h-4 w-4 text-primary" /> Overall execution
        </div>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-6xl font-bold leading-none tracking-tight">{pct(rollup.achievedResult)}</span>
          <span className="pb-1.5 text-sm text-muted-foreground">of the period plan</span>
        </div>
        <Tip
          className="mt-5"
          content={<div className="space-y-1"><TipRow label="Weighted plan" value={weightPct(rollup.weightedPlan)} /><TipRow label="Weighted actual" value={weightPct(rollup.weightedActual)} /><TipRow label="Achievement" value={pct(rollup.achievedResult)} /></div>}
        >
          <MeterBar value={rollup.achievedResult} className="h-3" />
        </Tip>

        <dl className="mt-6 grid grid-cols-3 gap-3 border-t pt-5">
          <Stat label="Weighted plan" value={weightPct(rollup.weightedPlan)} hint={`of ${weightPct(totalWeight, 0)} total`} />
          <Stat label="Weighted actual" value={weightPct(rollup.weightedActual)} hint={`${pct(yearProgress)} of the year`} />
          <Stat label="After delays" value={pct(rollup.achievedWithDelay)} hint="with delay penalty" />
        </dl>

        <div className="mt-5 flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5 text-xs">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{coverage.approved} of {coverage.planned}</span> planned activities have an approved report
            {coverage.pending > 0 && <> · {coverage.pending} awaiting approval</>}
          </span>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tracking-tight">{value}</dd>
      {hint && <dd className="text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function KpiTile({ label, icon, value, suffix, note, meter }: { label: string; icon: React.ReactNode; value: string; suffix?: string; note: string; meter: number | null }) {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <MeterBar value={meter} tone="soft" className="mt-auto" />
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function PillarHighlight({ label, icon, highlight, note }: { label: string; icon: React.ReactNode; highlight: Highlight | null; note: string }) {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </div>
      {highlight ? (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-sm font-bold text-primary">{highlight.code}</span>
            <span className="text-3xl font-bold tracking-tight">{pct(highlight.value)}</span>
          </div>
          <p className="mt-1 line-clamp-1 text-sm" title={highlight.title}>{highlight.title}</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No pillar has a target this period.</p>
      )}
      <p className="mt-auto pt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function StoryCard({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <section className={cn("relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.08] via-card to-card p-6 shadow-sm", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary"><Sparkles className="h-4 w-4" /></span>
        Story in brief
      </div>
      <ul className="mt-4 space-y-2.5">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InitiativeHighlight({ kind, highlight }: { kind: "strongest" | "weakest"; highlight: Highlight | null }) {
  const strong = kind === "strongest";
  const Icon = strong ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-4 w-4", strong ? "text-emerald-600" : "text-amber-600")} />
        {strong ? "Strongest initiative" : "Weakest initiative"} · this period
      </div>
      {highlight ? (
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="line-clamp-2 text-sm font-medium" title={highlight.title}>
            <span className="mr-1.5 text-muted-foreground">{highlight.code}</span>{highlight.title}
          </p>
          <span className="text-2xl font-bold tracking-tight">{pct(highlight.value)}</span>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{strong ? "No initiative has an approved report yet." : "Only one initiative has been measured so far."}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillars
// ---------------------------------------------------------------------------

function PillarSection({ pillars }: { pillars: PillarSummary[] }) {
  return (
    <SectionCard title="Pillar performance" description="Achievement against the period plan, full-year progress, and where each pillar's initiatives stand." icon={<Layers className="h-4 w-4" />}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pillars.map(p => <PillarTile key={p.id} pillar={p} />)}
      </div>
      <StatusLegend className="mt-5" />
    </SectionCard>
  );
}

function PillarTile({ pillar }: { pillar: PillarSummary }) {
  const { rollup, yearProgress, totalWeight, coverage } = pillar.summary;
  const hasPlan = rollup.weightedPlan > 0;
  return (
    <div className="group flex flex-col rounded-2xl border bg-background/60 p-5 transition hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-lg bg-primary/15 px-2 py-1 text-xs font-bold text-primary">{pillar.code}</span>
        <span className="text-xs text-muted-foreground">Weight {weightPct(totalWeight)}</span>
      </div>
      <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug" title={pillar.title}>{pillar.title}</h3>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-bold tracking-tight">{hasPlan ? pct(rollup.achievedResult) : "—"}</span>
        <span className="text-xs text-muted-foreground">{hasPlan ? "of period plan" : "No target this period"}</span>
      </div>
      <Tip
        className="mt-2"
        content={<div className="space-y-1"><TipRow label="Weighted plan" value={weightPct(rollup.weightedPlan)} /><TipRow label="Weighted actual" value={weightPct(rollup.weightedActual)} /><TipRow label="After delays" value={pct(rollup.achievedWithDelay)} /><TipRow label="Reports approved" value={`${coverage.approved} of ${coverage.planned}`} /></div>}
      >
        <MeterBar value={hasPlan ? rollup.achievedResult : null} />
      </Tip>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Full-year progress</span>
        <span className="font-medium">{pct(yearProgress)}</span>
      </div>
      <MeterBar value={yearProgress} tone="soft" className="mt-1.5 h-1.5" />

      <div className="mt-4 border-t pt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{pillar.initiatives} initiatives</span>
          <span>{pillar.objectives.length} objectives</span>
        </div>
        <Tip content={<StatusBreakdown counts={pillar.statusCounts} />}>
          <StatusStack counts={pillar.statusCounts} order={INITIATIVE_STATUS_ORDER} />
        </Tip>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {INITIATIVE_STATUS_ORDER.filter(s => pillar.statusCounts[s] > 0).map(s => (
            <span key={s} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
              {pillar.statusCounts[s]} {INITIATIVE_STATUS_LABEL[s].toLowerCase()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBreakdown({ counts }: { counts: Record<InitiativeStatus, number> }) {
  return (
    <div className="space-y-1">
      {INITIATIVE_STATUS_ORDER.map(s => <TipRow key={s} label={INITIATIVE_STATUS_LABEL[s]} value={String(counts[s])} />)}
    </div>
  );
}

function StatusLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-5 gap-y-2 border-t pt-4", className)}>
      {INITIATIVE_STATUS_ORDER.map(s => <StatusLabel key={s} status={s} />)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

function ObjectiveSection({ objectives, className }: { objectives: ObjectiveSummary[]; className?: string }) {
  return (
    <SectionCard className={className} title="Objective performance" description="Each objective's achievement against its period plan, grouped by pillar." icon={<Target className="h-4 w-4" />}>
      <ul className="space-y-1">
        {objectives.map((o, i) => {
          const { rollup, totalWeight, coverage } = o.summary;
          const hasPlan = rollup.weightedPlan > 0;
          const newPillar = i === 0 || objectives[i - 1].pillarCode !== o.pillarCode;
          return (
            <li key={o.id} className={cn(newPillar && i > 0 && "mt-3 border-t pt-3")}>
              <Tip
                className="rounded-xl px-2 py-2 transition hover:bg-muted/60"
                content={<div className="space-y-1"><TipRow label="Weight" value={weightPct(totalWeight)} /><TipRow label="Weighted plan" value={weightPct(rollup.weightedPlan)} /><TipRow label="Weighted actual" value={weightPct(rollup.weightedActual)} /><TipRow label="Reports approved" value={`${coverage.approved} of ${coverage.planned}`} /></div>}
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 shrink-0 text-xs font-semibold text-muted-foreground">{o.code}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm" title={o.statement}>{o.statement}</p>
                      <span className={cn("shrink-0 text-sm font-semibold", !hasPlan && "font-normal text-muted-foreground")}>
                        {hasPlan ? pct(rollup.achievedResult) : "No target"}
                      </span>
                    </div>
                    <MeterBar value={hasPlan ? rollup.achievedResult : null} className="mt-1.5 h-1.5" />
                  </div>
                  <span className="hidden w-8 shrink-0 text-right text-[11px] font-medium text-muted-foreground sm:block">{o.pillarCode}</span>
                </div>
              </Tip>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Initiative status & delays
// ---------------------------------------------------------------------------

function StatusSection({ m }: { m: DashboardMetrics }) {
  const total = m.initiatives.length;
  return (
    <SectionCard title="Initiative status" description="All initiatives, by their result this period." icon={<ListChecks className="h-4 w-4" />}>
      <Tip content={<StatusBreakdown counts={m.statusCounts} />}>
        <StatusStack counts={m.statusCounts} order={INITIATIVE_STATUS_ORDER} height="h-4" />
      </Tip>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {INITIATIVE_STATUS_ORDER.map(s => (
          <li key={s} className="flex items-center justify-between gap-2">
            <StatusLabel status={s} />
            <span className="text-sm font-semibold">
              {m.statusCounts[s]}
              <span className="ml-1 text-xs font-normal text-muted-foreground">{total ? pct(m.statusCounts[s] / total, 0) : ""}</span>
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

// "Not yet due" is shown as a note, not a bar: it would dwarf the delay counts that matter.
const DELAY_ORDER: DelayBucket[] = ["onTime", "d1_30", "d31_60", "d61_90", "d90plus"];

function DelaySection({ m }: { m: DashboardMetrics }) {
  return (
    <SectionCard title="Delays" description="Due items that finished late or are still open past their end date." icon={<CalendarClock className="h-4 w-4" />}>
      <div className="space-y-5">
        <DelayBars label="Initiatives" counts={m.initiativeDelays} />
        <DelayBars label="Activities" counts={m.activityDelays} />
      </div>
    </SectionCard>
  );
}

function DelayBars({ label, counts }: { label: string; counts: Record<DelayBucket, number> }) {
  const max = Math.max(1, ...DELAY_ORDER.map(k => counts[k]));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{counts.notElapsed} not yet due</span>
      </div>
      <div className="grid grid-cols-5 items-end gap-2">
        {DELAY_ORDER.map(k => (
          <Tip key={k} content={<TipRow label={DELAY_BUCKET_LABEL[k]} value={String(counts[k])} />} className="flex flex-col items-center">
            <span className="mb-1 text-xs font-semibold">{counts[k]}</span>
            <div className="flex h-16 w-full items-end rounded-md bg-muted/60">
              <div
                className={cn("w-full rounded-md transition-[height] duration-700", k === "onTime" ? "bg-primary/35" : "bg-primary")}
                style={{ height: `${(counts[k] / max) * 100}%`, minHeight: counts[k] > 0 ? 4 : 0 }}
              />
            </div>
            <span className="mt-1.5 text-center text-[10px] leading-tight text-muted-foreground">{DELAY_BUCKET_LABEL[k]}</span>
          </Tip>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Streams & departments
// ---------------------------------------------------------------------------

function StreamSection({ streams }: { streams: StreamSummary[] }) {
  return (
    <SectionCard title="Streams & departments" description="Ranked by achievement against their period plan (lead owner of each activity)." icon={<Building2 className="h-4 w-4" />}>
      {streams.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activities have a lead owner yet.</p>
      ) : (
        <ol className="divide-y">
          {streams.map((s, i) => {
            const { rollup, coverage, totalWeight } = s.summary;
            const hasPlan = rollup.weightedPlan > 0;
            return (
              <li key={s.name}>
                <Tip
                  className="rounded-xl px-2 py-3 transition hover:bg-muted/50"
                  content={<div className="space-y-1"><TipRow label="Weight" value={weightPct(totalWeight)} /><TipRow label="Weighted plan" value={weightPct(rollup.weightedPlan)} /><TipRow label="Weighted actual" value={weightPct(rollup.weightedActual)} /><TipRow label="After delays" value={pct(rollup.achievedWithDelay)} /><TipRow label="Activities completed" value={`${s.activitiesCompleted} of ${s.activitiesDue} due`} /></div>}
                >
                  <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 sm:grid-cols-[2rem_minmax(0,1.4fr)_minmax(0,1fr)_4rem_7.5rem]">
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", i < 3 && hasPlan ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={s.name}>{s.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>{s.initiatives} initiatives · {coverage.activities} activities</span>
                        {coverage.missing > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                            <FileWarning className="h-3 w-3" /> {coverage.missing} report{coverage.missing === 1 ? "" : "s"} not approved
                          </span>
                        )}
                      </p>
                    </div>
                    <MeterBar value={hasPlan ? rollup.achievedResult : null} className="hidden sm:block" />
                    <span className={cn("text-right text-sm font-semibold", !hasPlan && "font-normal text-muted-foreground")}>{hasPlan ? pct(rollup.achievedResult) : "—"}</span>
                    <div className="col-span-3 flex sm:col-span-1 sm:justify-end"><RatingChip rating={s.rating} /></div>
                  </div>
                </Tip>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

function IssuesSection({ issues }: { issues: DashboardMetrics["issues"] }) {
  return (
    <SectionCard title="Issues that need management attention" description="Escalations raised in approved reports for this period." icon={<TriangleAlert className="h-4 w-4" />}>
      {issues.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" /> No escalations in approved reports.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {issues.map(issue => (
            <li key={issue.activityId} className="rounded-xl border border-l-4 border-l-amber-500 bg-background/60 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{issue.text}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{issue.activity}</span>
                {" · "}{issue.initiativeCode} {issue.initiative}
                {" · "}{issue.owner}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
