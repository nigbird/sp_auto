
import { getActivities } from "@/lib/data";
import { MyActivitySummaryCards } from "@/components/my-activity/my-activity-summary-cards";
import { MyActivityTaskList } from "@/components/my-activity/my-activity-task-list";
import { CardDescription, CardTitle } from "@/components/ui/card";

export default async function MyActivityPage() {
  const allActivities = await getActivities();
  // For this example, we'll filter activities assigned to the current user (Admin User).
  // In a real application, this would be based on the logged-in user's identity.
  const myActivities = allActivities.filter(
    (activity) => activity.responsible === "Liam Johnson" || activity.responsible === "Olivia Smith"
  );
  
  const overdueActivities = myActivities.filter(a => a.status === 'Delayed');

  return (
    <div className="flex-1 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
        <p className="text-muted-foreground">
          Your personal dashboard for managing all assigned tasks and tracking performance.
        </p>
      </div>
      <MyActivitySummaryCards activities={myActivities} />
      <MyActivityTaskList title="Overdue" count={overdueActivities.length} activities={overdueActivities} />
    </div>
  );
}
