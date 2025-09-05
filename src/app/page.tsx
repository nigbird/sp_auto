import { getReportData } from "@/lib/data";
import { generateReportSummary } from "@/lib/utils";
import { ReportSummaryCards } from "@/components/reports/summary-cards";
import { ActivityCharts } from "@/components/dashboard/activity-charts";
import { ActivityTable } from "@/components/dashboard/activity-table";
import type { Activity } from "@/lib/types";

export default async function DashboardPage() {
  const reportData = await getReportData();
  const summary = generateReportSummary(reportData);
  
  // Extract flat activities list for other components
  const activities: Activity[] = reportData.flatMap(pillar => 
    pillar.objectives.flatMap(objective => 
      objective.initiatives.flatMap(initiative => initiative.activities)
    )
  );
  
  const users = ["Liam Johnson", "Olivia Smith", "Noah Williams", "Emma Brown", "Oliver Jones"];
  const departments = ["Marketing", "Sales", "Engineering", "Human Resources", "Support", "Finance"];

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>
      <ReportSummaryCards summary={summary} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <ActivityCharts activities={activities} />
      </div>
      <ActivityTable activities={activities} users={users} departments={departments} />
    </div>
  );
}
