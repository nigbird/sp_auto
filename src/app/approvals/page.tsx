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

export default async function ApprovalsPage() {
  const [activities, userList, rules, plans, pendingPlans, initiatives] = await Promise.all([
    getActivities(),
    getUsers(),
    getRules(),
    listStrategicPlans(),
    getPendingActivityPlans(),
    getInitiativesForPlanRequests(),
  ]);

  const users = userList.map(u => ({ id: u.id, name: u.name }));
  const rulesTyped: Rule[] = rules;
  const statuses = rulesTyped.map(rule => rule.status);

  const publishedPlan = plans.find(p => p.status === 'PUBLISHED') ?? plans[0] ?? null;
  const strategicPlan = publishedPlan ? await getStrategicPlanById(publishedPlan.id) : null;

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
      </div>
      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities">Activities Approval</TabsTrigger>
          <TabsTrigger value="plans">Breakdown Approval{pendingPlans.length > 0 ? ` (${pendingPlans.length})` : ''}</TabsTrigger>
          <TabsTrigger value="send-plan-requests">Send Breakdown Requests</TabsTrigger>
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
