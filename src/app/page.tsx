
import { getReportData } from "@/actions/reports";
import { getActivities } from "@/actions/activities";
import { getUsers } from "@/actions/users";
import { DashboardClientLayout } from "@/components/dashboard/dashboard-client-layout";
import { generateReportSummary } from "@/lib/utils";
import { DirectorsPerformance } from "@/components/dashboard/directors-performance";
import type { User, StrategicPlan, Activity } from "@/lib/types";
import { listStrategicPlans } from "@/actions/strategic-plan";

export default async function DashboardPage() {
  const reportData = await getReportData();
  
  const allPlans: StrategicPlan[] = await listStrategicPlans();
  const initialPlan = allPlans.find(p => p.status === 'PUBLISHED') || allPlans[0] || null;
  
  const activities: Activity[] = initialPlan ? await getActivities(initialPlan.id) : [];
  
  const users = await getUsers();

  const departments = ["All", ...new Set(activities.map((a) => a.department).filter(d => d && d.toLowerCase() !== "all"))];
  
  const responsibleUsers = activities.reduce((acc: User[], activity) => {
    const responsible = activity.responsible as User;
    if (responsible && !acc.find(u => u.id === responsible.id)) {
      acc.push(responsible);
    }
    return acc;
  }, []);

  return (
    <div className="flex-1 space-y-6">
      <DashboardClientLayout 
        initialPillars={reportData.pillars}
        initialActivities={activities}
        allPlans={allPlans}
        initialPlanId={initialPlan?.id}
        departments={departments}
        users={responsibleUsers}
      />
      <DirectorsPerformance />
    </div>
  );
}
