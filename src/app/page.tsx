
import { getReportData } from "@/actions/reports";
import { getActivities } from "@/actions/activities";
import { getUsers } from "@/actions/users";
import { DashboardClientLayout } from "@/components/dashboard/dashboard-client-layout";
import { ReportSummaryCards } from "@/components/reports/summary-cards";
import { generateReportSummary } from "@/lib/utils";
import { DirectorsPerformance } from "@/components/dashboard/directors-performance";
import type { User } from "@/lib/types";

export default async function DashboardPage() {
  const reportData = await getReportData();
  const activities = await getActivities();
  const users = await getUsers();

  const departments = ["All", ...new Set(activities.map((a) => a.department).filter(d => d && d.toLowerCase() !== "all"))];
  
  const responsibleUsers = activities.reduce((acc: User[], activity) => {
    const responsible = activity.responsible as User;
    if (responsible && !acc.find(u => u.id === responsible.id)) {
      acc.push(responsible);
    }
    return acc;
  }, []);

  const summary = generateReportSummary(reportData.pillars);

  return (
    <div className="flex-1 space-y-6">
      <ReportSummaryCards summary={summary} />
      <DashboardClientLayout 
        initialReportData={reportData.pillars}
        allActivities={activities}
        departments={departments}
        users={responsibleUsers}
      />
      <DirectorsPerformance />
    </div>
  );
}
