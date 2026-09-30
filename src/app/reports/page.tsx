import { userCan } from "@/lib/auth/permissions-server";
import { guardPage } from "@/lib/auth/page-guard";
import { listStrategicPlans, getStrategicPlanById } from "@/actions/strategic-plan";
import { getPlanPerformance } from "@/actions/period-reports";
import { PerformanceReportTable, type PerformanceEntry, type PerformancePeriod } from "@/components/reports/performance-report-table";
import { PlanSelect } from "@/components/reports/plan-select";
import { ExportMenu } from "@/components/export-menu";
import { Card, CardContent } from "@/components/ui/card";

export default async function PerformanceReportsPage({ searchParams }: { searchParams: Promise<{ plan?: string; period?: string }> }) {
  const { user, denied } = await guardPage('reports:view', 'reports:view-own');
  if (denied) return denied;
  const { plan: planParam, period: periodId } = await searchParams;
  const plans = await listStrategicPlans();
  const planId = (planParam && plans.find(p => p.id === planParam)?.id)
    ?? plans.find(p => p.status === "PUBLISHED")?.id
    ?? plans[0]?.id;

  const [plan, performance] = planId
    ? await Promise.all([getStrategicPlanById(planId), getPlanPerformance(planId, periodId)])
    : [null, null];
  const selectedPeriod = performance?.selected as { id: string; name: string } | null;
  // Personal view: keep only the user's own activities, and the pillars/objectives/initiatives they sit in.
  const ownOnly = performance?.scope === "own";
  const pillars = !plan ? [] : !ownOnly ? plan.pillars : plan.pillars
    .map(p => ({ ...p, objectives: p.objectives
      .map(o => ({ ...o, initiatives: o.initiatives
        .map(i => ({ ...i, activities: i.activities.filter(a => (a.responsible as { id?: string } | null)?.id === user.id) }))
        .filter(i => i.activities.length > 0) }))
      .filter(o => o.initiatives.length > 0) }))
    .filter(p => p.objectives.length > 0);

  return (
    <div className="flex-1 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Performance Report</h1>
          <p className="text-sm text-muted-foreground">
            {ownOnly ? "Plan vs. actual for your activities, by reporting period." : "Plan vs. actual by reporting period."}
          </p>
        </div>
        {plan && !ownOnly && userCan(user, "reports:export") && (
          <ExportMenu options={[
            {
              kind: "pdf",
              label: selectedPeriod ? `${selectedPeriod.name} performance report (PDF)` : "Performance report (PDF)",
              description: selectedPeriod ? "Totals, pillar/objective/initiative results and every activity's report." : "Send a report request first — there is no period to report on yet.",
              href: selectedPeriod ? `/api/export/plan/${plan.id}?period=${selectedPeriod.id}&format=pdf` : undefined,
              disabled: !selectedPeriod,
            },
            {
              kind: "excel",
              label: selectedPeriod ? `Plan & ${selectedPeriod.name} report (Excel)` : "Plan & report (Excel)",
              description: "Plan with monthly targets and report values.",
              href: selectedPeriod ? `/api/export/plan/${plan.id}?period=${selectedPeriod.id}` : undefined,
              disabled: !selectedPeriod,
            },
          ]} />
        )}
      </div>

      {plan && performance ? (
        <Card className="rounded-xl border-border/50 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_4px_12px_-8px_rgba(16,24,40,0.06)]">
          <CardContent className="space-y-4 pt-6">
            <PlanSelect plans={plans} value={plan.id} />
            <PerformanceReportTable
              planId={plan.id}
              pillars={pillars}
              periods={performance.periods as PerformancePeriod[]}
              selected={performance.selected as PerformancePeriod | null}
              entries={performance.entries as PerformanceEntry[]}
            />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">There is no strategic plan yet. Create or import one under Planning → Strategic Plans.</p>
      )}
    </div>
  );
}
