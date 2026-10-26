import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { guardPage } from "@/lib/auth/page-guard";
import { listStrategicPlans } from "@/actions/strategic-plan";
import { getReportSummaryPage } from "@/actions/report-summary";
import { PlanSelect } from "@/components/reports/plan-select";
import { ReportSummaryEditor, type SummaryPageData } from "@/components/reports/report-summary-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export default async function ReportSummaryPage({ searchParams }: { searchParams: Promise<{ plan?: string; period?: string }> }) {
  const { denied } = await guardPage('reports:view');
  if (denied) return denied;
  const { plan: planParam, period: periodId } = await searchParams;
  const plans = await listStrategicPlans();
  const planId = (planParam && plans.find(p => p.id === planParam)?.id)
    ?? plans.find(p => p.status === "PUBLISHED")?.id
    ?? plans[0]?.id;
  const data = planId ? (await getReportSummaryPage(planId, periodId)) as SummaryPageData : null;

  return (
    <div className="flex-1 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Report Summary</h1>
          <p className="text-sm text-muted-foreground">
            A written summary of the period&apos;s approved reports, generated from the figures and owners&apos; comments. Edit it here, then export it.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/reports${planId ? `?plan=${planId}${data?.selected ? `&period=${data.selected.id}` : ""}` : ""}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Performance report
          </Link>
        </Button>
      </div>

      {planId && data ? (
        <Card className="rounded-xl border-border/50 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_4px_12px_-8px_rgba(16,24,40,0.06)]">
          <CardContent className="space-y-4 pt-6">
            <PlanSelect plans={plans} value={planId} basePath="/reports/summary" />
            <ReportSummaryEditor planId={planId} data={data} />
          </CardContent>
        </Card>
      ) : (
        <EmptyState art="chart" title="No strategic plan yet" description="Create or import a plan first; the summary is written from its approved reports." action={{ href: "/strategic-plan", label: "Go to Strategic Plans" }} className="rounded-xl border border-dashed border-border/70 bg-card/60" />
      )}
    </div>
  );
}
