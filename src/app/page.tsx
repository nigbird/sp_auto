
import { getReportData, getActivities } from "@/lib/data";
import { DepartmentalDashboard } from "@/components/dashboard/departmental-dashboard";

export default async function DashboardPage() {
  const reportData = await getReportData();
  const activities = await getActivities();
  const departments = ["All", ...new Set(activities.map((a) => a.department))];

  return (
    <div className="flex-1 space-y-6">
      <DepartmentalDashboard 
        activities={activities}
        departments={departments}
        pillars={reportData}
      />
    </div>
  );
}
