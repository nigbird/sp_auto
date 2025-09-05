
import { getReportData } from "@/lib/data";
import { generateReportSummary } from "@/lib/utils";
import { ReportSummaryCards } from "@/components/reports/summary-cards";
import { ActivityCharts } from "@/components/dashboard/activity-charts";
import type { Pillar, Activity } from "@/lib/types";
import { PillarTable } from "@/components/dashboard/pillar-table";

function extractActivitiesFromPillars(pillars: Pillar[]): Activity[] {
    const activities: Activity[] = [];
    pillars.forEach(pillar => {
        pillar.objectives.forEach(objective => {
            objective.initiatives.forEach(initiative => {
                activities.push(...initiative.activities);
            });
        });
    });
    return activities;
}

export default async function DashboardPage() {
  const reportData = await getReportData();
  const summary = generateReportSummary(reportData);
  const activities = extractActivitiesFromPillars(reportData);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>
      <ReportSummaryCards summary={summary} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <ActivityCharts activities={activities} />
        <PillarTable pillars={reportData} />
      </div>
    </div>
  );
}
