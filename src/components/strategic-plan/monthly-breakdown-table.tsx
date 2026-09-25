import type { Pillar } from "@/lib/types";
import { formatTargetValue, monthKey, monthLabel, monthsBetween, type TargetType } from "@/lib/monthly-breakdown";

/**
 * The plan's monthly breakdown, laid out like the Excel: one row per activity
 * under its pillar / objective / initiative headings, with Deliverable,
 * Start, End, annual Target and a column per month. Only breakdowns an
 * approver has approved are shown.
 */
export function MonthlyBreakdownTable({ pillars }: { pillars: Pillar[] }) {
  const approved = pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities)))
    .filter(a => a.planSubmissionStatus === 'APPROVED' && a.targetType && a.annualTarget != null);

  if (approved.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No monthly breakdowns have been approved yet. Each activity appears here once its owner fills in the breakdown and an approver approves it.
      </p>
    );
  }

  const first = approved.reduce((min, a) => monthKey(a.startDate) < min ? monthKey(a.startDate) : min, monthKey(approved[0].startDate));
  const last = approved.reduce((max, a) => monthKey(a.endDate) > max ? monthKey(a.endDate) : max, monthKey(approved[0].endDate));
  const months = monthsBetween(`${first}-01T00:00:00Z`, `${last}-01T00:00:00Z`);
  const fixedColumns = 5;
  const colSpan = fixedColumns + months.length;
  const approvedIds = new Set(approved.map(a => a.id));

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="sticky left-0 z-10 bg-primary px-3 py-2 text-left font-semibold min-w-[240px]">Major Activities</th>
            <th className="px-3 py-2 text-left font-semibold min-w-[200px]">Deliverables</th>
            <th className="px-2 py-2 font-semibold whitespace-nowrap">Start Date</th>
            <th className="px-2 py-2 font-semibold whitespace-nowrap">End Date</th>
            <th className="px-2 py-2 font-semibold whitespace-nowrap">Target</th>
            {months.map(m => <th key={m} className="px-2 py-2 font-semibold whitespace-nowrap">{monthLabel(m)}</th>)}
          </tr>
        </thead>
        <tbody>
          {pillars
            .filter(pillar => pillar.objectives.some(o => o.initiatives.some(i => i.activities.some(a => approvedIds.has(a.id)))))
            .map(pillar => <PillarRows key={pillar.id} pillar={pillar} approvedIds={approvedIds} months={months} colSpan={colSpan} />)}
        </tbody>
      </table>
    </div>
  );
}

function PillarRows({ pillar, approvedIds, months, colSpan }: { pillar: Pillar; approvedIds: Set<string>; months: string[]; colSpan: number }) {
  return (
    <>
      <tr className="bg-amber-400/80 text-amber-950">
        <td colSpan={colSpan} className="sticky left-0 px-3 py-1.5 font-semibold">{pillar.title}</td>
      </tr>
      {pillar.objectives.map(objective => {
        const initiatives = objective.initiatives.filter(i => i.activities.some(a => approvedIds.has(a.id)));
        if (initiatives.length === 0) return null;
        return (
          <ObjectiveRows key={objective.id} statement={objective.statement} initiatives={initiatives} approvedIds={approvedIds} months={months} colSpan={colSpan} />
        );
      })}
    </>
  );
}

function ObjectiveRows({ statement, initiatives, approvedIds, months, colSpan }: { statement: string; initiatives: Pillar['objectives'][number]['initiatives']; approvedIds: Set<string>; months: string[]; colSpan: number }) {
  return (
    <>
      <tr className="bg-sky-200/70 text-sky-950 dark:bg-sky-900/50 dark:text-sky-100">
        <td colSpan={colSpan} className="sticky left-0 px-3 py-1.5 font-medium">{statement}</td>
      </tr>
      {initiatives.map(initiative => (
        <InitiativeRows key={initiative.id} title={initiative.title} activities={initiative.activities.filter(a => approvedIds.has(a.id))} months={months} colSpan={colSpan} />
      ))}
    </>
  );
}

function InitiativeRows({ title, activities, months, colSpan }: { title: string; activities: Pillar['objectives'][number]['initiatives'][number]['activities']; months: string[]; colSpan: number }) {
  return (
    <>
      <tr className="bg-muted/60">
        <td colSpan={colSpan} className="sticky left-0 px-3 py-1 italic text-muted-foreground">{title}</td>
      </tr>
      {activities.map(activity => {
        const targetType = activity.targetType as TargetType;
        const byMonth = new Map((activity.monthlyTargets ?? []).map(t => [monthKey(t.month), t.value]));
        return (
          <tr key={activity.id} className="border-t">
            <td className="sticky left-0 z-10 bg-background px-3 py-2 align-top">
              <div className="font-medium">{activity.title}</div>
              <div className="text-muted-foreground">{(activity.responsible as { name?: string })?.name}</div>
            </td>
            <td className="px-3 py-2 align-top">{activity.deliverable ?? '—'}</td>
            <td className="px-2 py-2 text-center whitespace-nowrap align-top">{monthLabel(monthKey(activity.startDate))}</td>
            <td className="px-2 py-2 text-center whitespace-nowrap align-top">{monthLabel(monthKey(activity.endDate))}</td>
            <td className="px-2 py-2 text-right font-semibold whitespace-nowrap align-top">{formatTargetValue(activity.annualTarget!, targetType)}</td>
            {months.map(m => {
              const value = byMonth.get(m);
              return (
                <td key={m} className="px-2 py-2 text-center whitespace-nowrap align-top border-l">
                  {value != null ? formatTargetValue(value, targetType) : ''}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
