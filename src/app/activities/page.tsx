
import { getActivities } from "@/lib/data";
import { ActivityTable } from "@/components/dashboard/activity-table";

export default async function ActivitiesPage() {
  const activities = await getActivities();
  const users = ["Liam Johnson", "Olivia Smith", "Noah Williams", "Emma Brown", "Oliver Jones"];
  const departments = ["Marketing", "Sales", "Engineering", "Human Resources", "Support", "Finance"];

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
      </div>
      <ActivityTable activities={activities} users={users} departments={departments} />
    </div>
  );
}
