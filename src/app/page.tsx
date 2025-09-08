
import { getReportData } from "@/lib/data";
import type { Pillar, Activity } from "@/lib/types";
import { DepartmentalDashboard } from "@/components/dashboard/departmental-dashboard";

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
  const activities = extractActivitiesFromPillars(reportData);
  const departments = ["All", ...new Set(activities.map((a) => a.department))];

  return (
    <div className="flex-1 space-y-6">
      <DepartmentalDashboard 
        activities={activities}
        departments={departments}
      />
    </div>
  );
}
