import { CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { DELAY_BUCKET_LABEL, type DashboardMetrics, type DelayBucket, type ListItem } from "@/lib/dashboard-metrics";
import { Donut, QuarterChart } from "./charts";
import { SectionCard, Tip, TipRow, pct } from "./primitives";
import { MiniStat } from "./tab-initiatives";
import { ActivityDelayTable } from "./activity-delay-table";

// Delivery state is status, so it wears the reserved status colours (with labels).
const STATE = { completed: "#0c6e3a", overdue: "#c0392b", open: "#a8a29a" };

/** "Initiatives Summary @GRAPH" and "Activity Summary @GRAPH". */
export function DeliveryTab({ m, planId, periodId }: { m: DashboardMetrics; planId: string; periodId: string }) {
  const dueActivities = sumDue(m.activityDelays);
  const onTime = dueActivities ? m.activityDelays.onTime / dueActivities : null;

  const initiativesOpen = m.initiatives.length - m.initiativesCompleted - m.initiativesOverdue;
  const activitiesOpen = m.activitiesTotal - m.activitiesCompleted - m.activitiesOverdue;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat
          label="Due initiatives completed"
          value={`${m.initiativesDue - m.initiativesOverdue} / ${m.initiativesDue}`}
          note={aheadNote(m.initiativesCompleted - (m.initiativesDue - m.initiativesOverdue), "due by the period end")}
        />
        <MiniStat
          label="Due activities completed"
          value={`${m.activitiesDue - m.activitiesOverdue} / ${m.activitiesDue}`}
          note={aheadNote(m.activitiesCompleted - (m.activitiesDue - m.activitiesOverdue), "due by the period end")}
        />
        <MiniStat label="Due activities on time" value={pct(onTime, 0)} note={`${m.activitiesOverdue} overdue, not yet completed`} />
        <MiniStat label="Activities without a target" value={String(m.activitiesWithoutTarget.length)} note={`of ${m.activitiesTotal} — can't be measured yet`} />
      </div>

      <SectionCard title={`Completion plan · ${m.fiscalYearLabel}`} description="Items expected to complete in each quarter (by their planned end) and how many are completed">
        <QuarterChart initiatives={m.initiativeQuarters} activities={m.activityQuarters} fiscalYear={m.fiscalYearLabel} />
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Initiative delivery" description="All initiatives, by where they stand at the period end">
          <Donut
            centerValue={String(m.initiatives.length)}
            centerLabel="initiatives"
            slices={[
              { key: "c", label: "Completed", value: m.initiativesCompleted, color: STATE.completed, display: String(m.initiativesCompleted) },
              { key: "o", label: "Overdue", sublabel: "past planned end, not completed", value: m.initiativesOverdue, color: STATE.overdue, display: String(m.initiativesOverdue) },
              { key: "n", label: "Not yet due", value: initiativesOpen, color: STATE.open, display: String(initiativesOpen) },
            ]}
          />
        </SectionCard>
        <SectionCard title="Activity delivery" description="All activities, by where they stand at the period end">
          <Donut
            centerValue={String(m.activitiesTotal)}
            centerLabel="activities"
            slices={[
              { key: "c", label: "Completed", value: m.activitiesCompleted, color: STATE.completed, display: String(m.activitiesCompleted) },
              { key: "o", label: "Overdue", sublabel: "past planned end, not completed", value: m.activitiesOverdue, color: STATE.overdue, display: String(m.activitiesOverdue) },
              { key: "n", label: "Not yet due", value: activitiesOpen, color: STATE.open, display: String(activitiesOpen) },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title="Delays" description="Due items that finished late, or are still open past their planned end, by how late">
        <div className="grid gap-8 lg:grid-cols-2">
          <DelayBars label="Initiatives" counts={m.initiativeDelays} />
          <DelayBars label="Activities" counts={m.activityDelays} />
        </div>
      </SectionCard>

      <SectionCard title="Activity delays" description="Every activity by work stream and initiative, with days delayed and status">
        <ActivityDelayTable rows={m.activityDelayRows} planId={planId} periodId={periodId} />
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Completed initiatives" description="Every activity with a target has met its full target">
          <ItemList items={m.completedInitiatives} empty="No initiative is fully completed yet." icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
        </SectionCard>
        <SectionCard title="Activities without a target" description="No approved monthly breakdown or annual target, so they can't be scored">
          <ItemList items={m.activitiesWithoutTarget} empty="Every activity has a target." icon={<CircleDashed className="h-4 w-4 text-muted-foreground" />} />
        </SectionCard>
      </div>
    </div>
  );
}

/** Completed items not yet due are shown as "ahead of schedule" rather than inflating the due count. */
function aheadNote(ahead: number, fallback: string) {
  return ahead > 0 ? `${fallback} · +${ahead} completed ahead of schedule` : fallback;
}

const DUE_BUCKETS: DelayBucket[] = ["onTime", "d1_30", "d31_60", "d61_90", "d90plus"];

function sumDue(counts: Record<DelayBucket, number>) {
  return DUE_BUCKETS.reduce((s, k) => s + counts[k], 0);
}

/** "Not yet due" is a note, not a bar: it would dwarf the delay counts that matter. */
export function DelayBars({ label, counts }: { label: string; counts: Record<DelayBucket, number> }) {
  const max = Math.max(1, ...DUE_BUCKETS.map(k => counts[k]));
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground">{sumDue(counts)} due · {counts.notElapsed} not yet due</span>
      </div>
      <div className="grid grid-cols-5 items-end gap-3">
        {DUE_BUCKETS.map(k => (
          <Tip key={k} content={<TipRow label={DELAY_BUCKET_LABEL[k]} value={String(counts[k])} />} className="flex flex-col items-center">
            <span className="mb-1 text-sm font-semibold">{counts[k]}</span>
            <div className="flex h-24 w-full items-end rounded-xl bg-muted/60">
              <div
                className={cn("w-full rounded-xl transition-[height] duration-700", k === "onTime" ? "bg-primary/35" : "bg-primary")}
                style={{ height: `${(counts[k] / max) * 100}%`, minHeight: counts[k] > 0 ? 6 : 0 }}
              />
            </div>
            <span className="mt-2 text-center text-[11px] leading-tight text-muted-foreground">{DELAY_BUCKET_LABEL[k]}</span>
          </Tip>
        ))}
      </div>
    </div>
  );
}

function ItemList({ items, empty, icon }: { items: ListItem[]; empty: string; icon: React.ReactNode }) {
  if (items.length === 0) return <p className="rounded-2xl bg-muted/40 px-4 py-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="max-h-[360px] divide-y overflow-y-auto pr-1">
      {items.map(item => (
        <li key={item.id} className="flex items-start gap-3 py-2.5">
          <span className="mt-0.5 shrink-0">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm" title={item.title}>{item.title}</p>
            <p className="truncate text-xs text-muted-foreground">{item.code} · {item.owner}{item.note ? ` · ${item.note}` : ""}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
