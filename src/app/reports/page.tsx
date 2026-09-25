import { listStrategicPlans, getStrategicPlanById } from "@/actions/strategic-plan";
import { getPlanPerformance } from "@/actions/period-reports";
import { PerformanceReportTable, type PerformanceEntry, type PerformancePeriod } from "@/components/reports/performance-report-table";
import { PlanSelect } from "@/components/reports/plan-select";
import { ExportMenu } from "@/components/export-menu";
import { Card, CardContent } from "@/components/ui/card";

export default async function PerformanceReportsPage({ searchParams }: { searchParams: Promise<{ plan?: string; period?: string }> }) {
  const { plan: planParam, period: periodId } = await searchParams;
  const plans = await listStrategicPlans();
  const planId = (planParam && plans.find(p => p.id === planParam)?.id)
    ?? plans.find(p => p.status === "PUBLISHED")?.id
    ?? plans[0]?.id;

  const [plan, performance] = planId
    ? await Promise.all([getStrategicPlanById(planId), getPlanPerformance(planId, periodId)])
    : [null, null];
  const selectedPeriod = performance?.selected as { id: string; name: string } | null;

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Performance Report</h1>
          <p className="text-muted-foreground">
            Plan vs. actual for each reporting period, calculated from approved reports.
          </p>
        </div>
        {plan && (
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
              description: "Cascaded-initiatives layout with monthly targets and live report formulas.",
              href: selectedPeriod ? `/api/export/plan/${plan.id}?period=${selectedPeriod.id}` : undefined,
              disabled: !selectedPeriod,
            },
          ]} />
        )}
      </div>

      {plan && performance ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <PlanSelect plans={plans} value={plan.id} />
            <PerformanceReportTable
              planId={plan.id}
              pillars={plan.pillars}
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
