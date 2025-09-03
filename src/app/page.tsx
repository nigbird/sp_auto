import { getActivities } from "@/lib/data";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { ActivityCharts } from "@/components/dashboard/activity-charts";
import { ActivityTable } from "@/components/dashboard/activity-table";

export default async function DashboardPage() {
  const activities = await getActivities();
  const users = ["Liam Johnson", "Olivia Smith", "Noah Williams", "Emma Brown", "Oliver Jones"];
  const departments = ["Marketing", "Sales", "Engineering", "Human Resources", "Support"];


  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>
      <SummaryCards activities={activities} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <ActivityCharts activities={activities} />
      </div>
      <ActivityTable activities={activities} users={users} departments={departments} />
    </div>
  );
}
