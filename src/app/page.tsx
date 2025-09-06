
import { getReportData } from "@/lib/data";
import { generateReportSummary } from "@/lib/utils";
import { ReportSummaryCards } from "@/components/reports/summary-cards";
import type { Pillar, Activity } from "@/lib/types";
import { DashboardClientLayout } from "@/components/dashboard/dashboard-client-layout";

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
  const departments = [...new Set(activities.map((a) => a.department))];

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>
      <ReportSummaryCards summary={summary} />
      <DashboardClientLayout 
        initialReportData={reportData}
        allActivities={activities}
        departments={departments}
      />
    </div>
  );
}
