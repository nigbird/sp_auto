
import { getReportData } from "@/actions/reports";
import { getActivities } from "@/actions/activities";
import { DashboardClientLayout } from "@/components/dashboard/dashboard-client-layout";
import { ReportSummaryCards } from "@/components/reports/summary-cards";
import { generateReportSummary } from "@/lib/utils";
import { DirectorsPerformance } from "@/components/dashboard/directors-performance";

export default async function DashboardPage() {
  const reportData = await getReportData();
  const activities = await getActivities();
  const departments = ["All", ...new Set(activities.map((a) => a.department))];
  const summary = generateReportSummary(reportData);

  return (
    <div className="flex-1 space-y-6">
      <ReportSummaryCards summary={summary} />
      <DashboardClientLayout 
        initialReportData={reportData}
        allActivities={activities}
        departments={departments}
      />
      <DirectorsPerformance />
    </div>
  );
}
