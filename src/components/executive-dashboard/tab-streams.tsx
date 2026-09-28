import { FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardMetrics, Rating } from "@/lib/dashboard-metrics";
import { describeRatingBands } from "@/lib/rating-bands";
import { StreamAchievementChart, StreamDeliveryChart } from "./charts";
import { DeltaChip, MeterBar, RatingChip, SectionCard, pct, weightPct } from "./primitives";
import { MiniStat } from "./tab-initiatives";

const RATING_ORDER: Rating[] = ["Outstanding", "Very Good", "Good", "Fair", "Unsatisfactory", "No Target"];

/** "Summary Streams & Department" and "Streams & Depart's Performance". */
export function StreamsTab({ m, previous }: { m: DashboardMetrics; previous: DashboardMetrics | null }) {
  const prevByName = new Map(previous?.streams.map(s => [s.name, s]) ?? []);
  const measured = m.streams.filter(s => s.score30 != null);
  const avgScore = measured.length ? measured.reduce((s, x) => s + (x.score30 ?? 0), 0) / measured.length : null;
  const ratingCounts = RATING_ORDER.map(r => ({ rating: r, count: m.streams.filter(s => s.rating === r).length })).filter(x => x.count > 0);
  const missingReports = m.streams.reduce((s, x) => s + x.summary.coverage.missing, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Streams & departments" value={String(m.streams.length)} note={`${measured.length} measured this period`} />
        <MiniStat label="Average score" value={avgScore == null ? "—" : `${avgScore.toFixed(1)} / 30`} note="achievement × 30, measured streams" />
        <MiniStat label="Rated Outstanding" value={String(m.streams.filter(s => s.rating === "Outstanding").length)} note={`${m.ratingThresholds.outstanding}% or more of their period plan`} />
        <MiniStat label="Reports not approved" value={String(missingReports)} note="planned activities counting as zero" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Achievement by stream" description={`Weighted actual ÷ weighted plan for the period; the line marks ${m.ratingThresholds.veryGood}% (Very Good)`}>
          <StreamAchievementChart
            marker={m.ratingThresholds.veryGood}
            data={m.streams.map(s => ({
              name: s.name,
              achieved: s.summary.rollup.weightedPlan > 0 && s.summary.coverage.approved > 0 ? s.summary.rollup.achievedResult : null,
              withDelay: s.summary.rollup.achievedWithDelay,
              plan: s.summary.rollup.weightedPlan,
              actual: s.summary.rollup.weightedActual,
              rating: s.rating,
            }))}
          />
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            {ratingCounts.map(({ rating, count }) => (
              <span key={rating} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <RatingChip rating={rating} /> × {count}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Activities due vs completed" description="By stream, as of the period end (the Excel's planned-vs-completed chart)">
          <StreamDeliveryChart data={m.streams.map(s => ({ name: s.name, due: s.activitiesDue, completed: s.activitiesCompleted }))} />
        </SectionCard>
      </div>

      <SectionCard title="Streams & departments performance" description="Every lead owner, ranked by achievement. Deviation = completed − due.">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-2 pb-3 font-medium">#</th>
                <th className="px-2 pb-3 font-medium">Stream / director</th>
                <th className="px-2 pb-3 text-right font-medium">Weight</th>
                <th className="px-2 pb-3 text-right font-medium">Plan</th>
                <th className="px-2 pb-3 text-right font-medium">Actual</th>
                <th className="w-40 px-2 pb-3 font-medium">Achievement</th>
                <th className="px-2 pb-3 text-right font-medium">After delays</th>
                <th className="px-2 pb-3 text-right font-medium">Score /30</th>
                <th className="px-2 pb-3 font-medium">Rating</th>
                <th className="px-2 pb-3 font-medium">vs last period</th>
                <th className="px-2 pb-3 text-center font-medium">Initiatives<br /><span className="normal-case tracking-normal">due · done · dev</span></th>
                <th className="px-2 pb-3 text-center font-medium">Activities<br /><span className="normal-case tracking-normal">due · done · dev</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {m.streams.map((s, i) => {
                const { rollup, totalWeight, coverage } = s.summary;
                const hasPlan = rollup.weightedPlan > 0 && coverage.approved > 0;
                const prev = prevByName.get(s.name);
                const prevHasPlan = prev && prev.summary.rollup.weightedPlan > 0 && prev.summary.coverage.approved > 0;
                return (
                  <tr key={s.name} className="transition hover:bg-muted/40">
                    <td className="px-2 py-3 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="max-w-[260px] px-2 py-3">
                      <p className="truncate font-medium" title={s.name}>{s.name}</p>
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        {s.initiatives} initiatives · {coverage.activities} activities · {coverage.planned} planned
                        {coverage.missing > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"><FileWarning className="h-3 w-3" />{coverage.missing}</span>
                        )}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{weightPct(totalWeight)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{weightPct(rollup.weightedPlan)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{weightPct(rollup.weightedActual)}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <MeterBar value={hasPlan ? rollup.achievedResult : null} className="h-1.5" />
                        <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{hasPlan ? pct(rollup.achievedResult) : "—"}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{hasPlan ? pct(rollup.achievedWithDelay) : "—"}</td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums">{s.score30 == null ? "—" : s.score30.toFixed(1)}</td>
                    <td className="px-2 py-3"><RatingChip rating={s.rating} /></td>
                    <td className="px-2 py-3">
                      {hasPlan && prevHasPlan ? <DeltaChip value={(rollup.achievedResult ?? 0) - (prev!.summary.rollup.achievedResult ?? 0)} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-3 text-center"><Triple due={s.initiativesDue} done={s.initiativesCompleted} /></td>
                    <td className="px-2 py-3 text-center"><Triple due={s.activitiesDue} done={s.activitiesCompleted} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Streams are the lead-owner offices on each activity. Score /30 = achievement × 30, as in the Excel. Ratings (set in Configuration): {describeRatingBands(m.ratingThresholds)}.
        </p>
      </SectionCard>
    </div>
  );
}

function Triple({ due, done }: { due: number; done: number }) {
  const dev = done - due;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums">
      <span>{due}</span><span className="text-muted-foreground">·</span>
      <span className="font-semibold">{done}</span><span className="text-muted-foreground">·</span>
      <span className={cn(dev < 0 ? "text-red-700 dark:text-red-400" : dev > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>{dev > 0 ? `+${dev}` : dev}</span>
    </span>
  );
}
