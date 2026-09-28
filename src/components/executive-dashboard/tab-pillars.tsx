import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { INITIATIVE_STATUS_LABEL, INITIATIVE_STATUS_ORDER, type DashboardMetrics, type InitiativeStatus, type Summary } from "@/lib/dashboard-metrics";
import { Donut, PlanActualBars } from "./charts";
import { MeterBar, STATUS_COLOR, SectionCard, StatusLabel, StatusStack, Tip, TipRow, pct, pillarColor, weightPct } from "./primitives";

const stripPrefix = (s: string, word: string) => s.replace(new RegExp(`^${word}\\s*\\d+\\s*:?\\s*`, "i"), "");

/** "Pillar Achievement", "Objective Level Achievement" and "Pillar & Objective Level Achi't" sheets. */
export function PillarsTab({ m }: { m: DashboardMetrics }) {
  const totalActual = m.overall.rollup.weightedActual;
  const totalWeight = m.overall.totalWeight;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Contribution to overall achievement" description="Each pillar's share of the plan's weighted actual this period">
          <Donut
            centerValue={pct(m.overall.rollup.achievedResult)}
            centerLabel="overall execution"
            emptyText="No approved actuals yet this period."
            slices={m.pillars.map(p => ({
              key: p.id,
              label: `${p.code} · ${stripPrefix(p.title, "Pillar")}`,
              sublabel: `${weightPct(p.summary.rollup.weightedActual)} actual of ${weightPct(p.summary.rollup.weightedPlan)} planned`,
              value: p.summary.rollup.weightedActual,
              color: pillarColor(p.code),
              display: pct(p.summary.rollup.achievedResult, 0),
              tip: [
                ["Weighted actual", weightPct(p.summary.rollup.weightedActual)],
                ["Share of total actual", totalActual > 0 ? pct(p.summary.rollup.weightedActual / totalActual) : "—"],
                ["Achievement", pct(p.summary.rollup.achievedResult)],
              ],
            }))}
          />
        </SectionCard>

        <SectionCard title="Plan vs actual by pillar" description="Weighted plan and weighted actual for the period; labels show achievement">
          <PlanActualBars
            data={m.pillars.map(p => ({
              code: p.code,
              title: stripPrefix(p.title, "Pillar"),
              plan: p.summary.rollup.weightedPlan,
              actual: p.summary.rollup.weightedActual,
              achieved: p.summary.rollup.weightedPlan > 0 ? p.summary.rollup.achievedResult : null,
            }))}
          />
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Full-year weight by pillar" description="Each pillar's share of the whole plan (100%)">
          <Donut
            centerValue={weightPct(totalWeight, 0)}
            centerLabel="total plan weight"
            slices={m.pillars.map(p => ({
              key: p.id,
              label: `${p.code} · ${stripPrefix(p.title, "Pillar")}`,
              sublabel: `${pct(p.summary.yearProgress)} achieved of the year`,
              value: p.summary.totalWeight,
              color: pillarColor(p.code),
              display: weightPct(p.summary.totalWeight, 1),
              tip: [["Weight", weightPct(p.summary.totalWeight)], ["Full-year progress", pct(p.summary.yearProgress)], ["Initiatives", String(p.initiatives)]],
            }))}
          />
        </SectionCard>

        <SectionCard title="Initiative status by pillar" description="Where each pillar's initiatives stand this period">
          <ul className="space-y-4">
            {m.pillars.map(p => (
              <li key={p.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: pillarColor(p.code) }} />
                    <span className="font-semibold">{p.code}</span>
                    <span className="truncate text-muted-foreground" title={p.title}>{stripPrefix(p.title, "Pillar")}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{p.initiatives} initiatives</span>
                </div>
                <Tip content={<StatusRows counts={p.statusCounts} />}>
                  <StatusStack counts={p.statusCounts} order={INITIATIVE_STATUS_ORDER} height="h-3" />
                </Tip>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4">
            {INITIATIVE_STATUS_ORDER.map(s => <StatusLabel key={s} status={s} />)}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Pillar & objective performance" description="Status columns count initiatives.">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-2 pb-3 font-medium">Pillar / objective</th>
                <th className="px-2 pb-3 text-right font-medium">Weight</th>
                <th className="px-2 pb-3 text-right font-medium">Plan</th>
                <th className="px-2 pb-3 text-right font-medium">Actual</th>
                <th className="w-40 px-2 pb-3 font-medium">Achievement</th>
                <th className="px-2 pb-3 text-right font-medium">Full year</th>
                {INITIATIVE_STATUS_ORDER.map(s => (
                  <th key={s} className="px-1 pb-3 text-center font-medium" title={INITIATIVE_STATUS_LABEL[s]}>
                    <span className="mx-auto block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                    <span className="sr-only">{INITIATIVE_STATUS_LABEL[s]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.pillars.map(p => (
                <Fragment key={p.id}>
                  <Row
                    className="bg-muted/50 font-semibold"
                    label={<span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: pillarColor(p.code) }} />{p.code} · {stripPrefix(p.title, "Pillar")}</span>}
                    summary={p.summary}
                    counts={p.statusCounts}
                  />
                  {p.objectives.map(o => (
                    <Row
                      key={o.id}
                      label={<span className="pl-5 font-normal"><span className="mr-1.5 text-xs text-muted-foreground">{o.code}</span>{stripPrefix(o.statement, "Objective")}</span>}
                      summary={o.summary}
                      counts={o.statusCounts}
                    />
                  ))}
                </Fragment>
              ))}
              <Row className="border-t-2 font-bold" label="Overall" summary={m.overall} counts={m.statusCounts} />
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Plan and actual are weighted (% of the whole plan) for the period. Full year = weighted actual ÷ total weight. Hover the coloured dots for status names.
        </p>
      </SectionCard>
    </div>
  );
}

function StatusRows({ counts }: { counts: Record<InitiativeStatus, number> }) {
  return <div className="space-y-1">{INITIATIVE_STATUS_ORDER.map(s => <TipRow key={s} label={INITIATIVE_STATUS_LABEL[s]} value={String(counts[s])} />)}</div>;
}

function Row({ label, summary, counts, className }: { label: React.ReactNode; summary: Summary; counts: Record<InitiativeStatus, number>; className?: string }) {
  const { rollup, totalWeight, yearProgress } = summary;
  const hasPlan = rollup.weightedPlan > 0;
  return (
    <tr className={cn("border-b last:border-b-0", className)}>
      <td className="max-w-[360px] truncate px-2 py-2.5">{label}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{weightPct(totalWeight)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{weightPct(rollup.weightedPlan)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{weightPct(rollup.weightedActual)}</td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2">
          <MeterBar value={hasPlan ? rollup.achievedResult : null} className="h-1.5" />
          <span className="w-12 shrink-0 text-right tabular-nums">{hasPlan ? pct(rollup.achievedResult) : "—"}</span>
        </div>
      </td>
      <td className="px-2 py-2.5 text-right tabular-nums">{pct(yearProgress)}</td>
      {INITIATIVE_STATUS_ORDER.map(s => (
        <td key={s} className={cn("px-1 py-2.5 text-center tabular-nums", counts[s] === 0 && "text-muted-foreground/50")}>{counts[s]}</td>
      ))}
    </tr>
  );
}
