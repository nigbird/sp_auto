import { INITIATIVE_STATUS_LABEL, type DashboardMetrics } from "@/lib/dashboard-metrics";
import { InitiativeScatter } from "./charts";
import { InitiativesTable } from "./initiatives-table";
import { CARD, SectionCard, pct } from "./primitives";
import { cn } from "@/lib/utils";

/** The Excel's "Initiatives Summary (Detail)" sheet. */
export function InitiativesTab({ m }: { m: DashboardMetrics }) {
  const measured = m.initiatives.filter(i => i.summary.rollup.weightedPlan > 0 && i.summary.coverage.approved > 0);
  const avg = measured.length ? measured.reduce((s, i) => s + (i.summary.rollup.achievedResult ?? 0), 0) / measured.length : null;
  const withNotes = m.initiatives.filter(i => Object.values(i.narratives).some(list => list.length > 0)).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Initiatives" value={String(m.initiatives.length)} note={`${m.initiatives.filter(i => i.summary.rollup.weightedPlan > 0).length} with a plan this period`} />
        <MiniStat label="Measured this period" value={String(measured.length)} note={`average achievement ${pct(avg)}`} />
        <MiniStat label="Fully completed" value={`${m.initiativesCompleted}`} note={`${m.initiativesDue} due by the period end`} />
        <MiniStat label="With report notes" value={String(withNotes)} note="accomplishments, gaps, way forward or escalations" />
      </div>

      <SectionCard
        title="Achievement vs planned weight"
        description="Each bubble is an initiative with an approved report; bigger bubbles carry more total weight. Lines mark the 75% (on track) and 100% thresholds."
      >
        <InitiativeScatter
          points={measured.map(i => ({
            code: i.code,
            title: i.title,
            pillarCode: i.pillarCode,
            owner: i.owner,
            achieved: i.summary.rollup.achievedResult ?? 0,
            plannedWeight: i.summary.rollup.weightedPlan,
            totalWeight: i.summary.totalWeight,
            status: INITIATIVE_STATUS_LABEL[i.status],
          }))}
        />
      </SectionCard>

      <SectionCard title="All initiatives" description="Click a row for the accomplished tasks, reasons for variation, way forward and critical issues from approved reports.">
        <InitiativesTable initiatives={m.initiatives} />
      </SectionCard>
    </div>
  );
}

export function MiniStat({ label, value, note, className }: { label: string; value: string; note?: string; className?: string }) {
  return (
    <div className={cn(CARD, "p-5", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-[28px] font-bold leading-none tracking-tight">{value}</p>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
