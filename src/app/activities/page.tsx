
import { getActivities, getRules } from "@/lib/data";
import { ActivityTable } from "@/components/dashboard/activity-table";
import type { Rule } from "@/lib/types";

export default async function ActivitiesPage() {
  const activities = await getActivities();
  const users = ["Liam Johnson", "Olivia Smith", "Noah Williams", "Emma Brown", "Oliver Jones"];
  const departments = ["Marketing", "Sales", "Engineering", "Human Resources", "Support", "Finance"];
  const rules: Rule[] = await getRules();
  const statuses = rules.map(rule => rule.status);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
      </div>
      <ActivityTable activities={activities} users={users} departments={departments} statuses={statuses} />
    </div>
  );
}
