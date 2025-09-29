
import { getActivities } from "@/actions/activities";
import { getRules } from "@/actions/rules";
import { getUsers } from "@/actions/users";
import { ActivityTable } from "@/components/dashboard/activity-table";
import type { Rule } from "@/lib/types";

export default async function ActivitiesPage() {
  const activities = await getActivities();
  const userList = await getUsers();
  const users = userList.map(u => ({ id: u.id, name: u.name }));
  const rules: Rule[] = await getRules();
  const statuses = rules.map(rule => rule.status);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
      </div>
      <ActivityTable activities={activities} users={users} statuses={statuses} />
    </div>
  );
}
