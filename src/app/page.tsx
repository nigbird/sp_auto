
import { getReportData, getActivities } from "@/lib/data";
import { DepartmentalDashboard } from "@/components/dashboard/departmental-dashboard";
import { ReportSummaryCards } from "@/components/reports/summary-cards";
import { generateReportSummary } from "@/lib/utils";

export default async function DashboardPage() {
  const reportData = await getReportData();
  const activities = await getActivities();
  const departments = ["All", ...new Set(activities.map((a) => a.department))];
  const summary = generateReportSummary(reportData);

  return (
    <div className="flex-1 space-y-6">
      <ReportSummaryCards summary={summary} />
      <DepartmentalDashboard 
        activities={activities}
        departments={departments}
        pillars={reportData}
      />
    </div>
  );
}
