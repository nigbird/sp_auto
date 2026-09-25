import { getActivities } from "@/actions/activities";
import { getRules } from "@/actions/rules";
import { getUsers } from "@/actions/users";
import { listStrategicPlans, getStrategicPlanById } from "@/actions/strategic-plan";
import { getPendingActivityPlans, getInitiativesForPlanRequests } from "@/actions/activity-plan-submissions";
import { ActivityTable } from "@/components/dashboard/activity-table";
import { PlanApprovalList, type PendingActivityPlan } from "@/components/approvals/plan-approval-list";
import { SendPlanRequestsList, type InitiativeForPlanRequest } from "@/components/approvals/send-plan-requests-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Rule } from "@/lib/types";

export default async function PlanApprovalsPage() {
  const plans = await listStrategicPlans();
  const publishedPlan = plans.find(p => p.status === 'PUBLISHED') ?? plans[0] ?? null;

  const [activities, userList, rules, strategicPlan, pendingPlans, initiatives] = await Promise.all([
    getActivities(publishedPlan?.id),
    getUsers(),
    getRules(),
    publishedPlan ? getStrategicPlanById(publishedPlan.id) : null,
    getPendingActivityPlans(),
    getInitiativesForPlanRequests(),
  ]);

  const users = userList.map(u => ({ id: u.id, name: u.name }));
  const rulesTyped: Rule[] = rules;
  const statuses = rulesTyped.map(rule => rule.status);

  return (
    <div className="flex-1 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Plan Approvals</h1>
        <p className="text-muted-foreground">
          Review new activities and their monthly breakdowns, and request breakdowns from activity owners.
        </p>
      </div>
      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="plans">Breakdowns{pendingPlans.length > 0 ? ` (${pendingPlans.length})` : ''}</TabsTrigger>
          <TabsTrigger value="send-plan-requests">Request Breakdowns</TabsTrigger>
        </TabsList>
        <TabsContent value="activities">
          <ActivityTable activities={activities} users={users} statuses={statuses} strategicPlan={strategicPlan} />
        </TabsContent>
        <TabsContent value="plans">
          <PlanApprovalList plans={pendingPlans as unknown as PendingActivityPlan[]} />
        </TabsContent>
        <TabsContent value="send-plan-requests">
          <SendPlanRequestsList initiatives={initiatives as unknown as InitiativeForPlanRequest[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
