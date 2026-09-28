import { CheckCircle2, Clock3, Inbox, SendHorizontal } from "lucide-react";
import { getPlanApprovalOverview, type PlanStage } from "@/actions/plan-approvals";
import { getPendingActivityPlans } from "@/actions/activity-plan-submissions";
import { PlanApprovalList, type PendingActivityPlan } from "@/components/approvals/plan-approval-list";
import { NewActivityApprovalList, PlanActivityTracker } from "@/components/approvals/plan-activity-tracker";
import { PlanSelect } from "@/components/reports/plan-select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const WITH_OWNERS: PlanStage[] = ["requested", "drafting", "breakdownReturned", "activityReturned", "ownerDeclined"];

export default async function PlanApprovalsPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planParam } = await searchParams;
  const [overview, allPendingPlans] = await Promise.all([getPlanApprovalOverview(planParam), getPendingActivityPlans()]);

  const { activities } = overview;
  const inPlan = new Set(activities.map(a => a.id));
  const pendingPlans = (allPendingPlans as PendingActivityPlan[]).filter(p => inPlan.has(p.id));
  const newActivities = activities.filter(a => a.stage === "activityPending");
  const count = (stages: PlanStage[]) => activities.filter(a => stages.includes(a.stage)).length;

  const waiting = pendingPlans.length + newActivities.length;
  const withOwners = count(WITH_OWNERS);
  const notSent = count(["notSent"]);
  const approved = count(["approved"]);
  const defaultTab = pendingPlans.length > 0 ? "breakdowns" : newActivities.length > 0 ? "new" : "all";

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Plan Approvals</h1>
          <p className="text-muted-foreground">
            Approve new activities and their monthly breakdowns, and see where every activity in the plan stands.
          </p>
        </div>
        {overview.planId && overview.plans.length > 1 && (
          <PlanSelect plans={overview.plans} value={overview.planId} basePath="/plan/approvals" />
        )}
      </div>

      {overview.planId === null ? (
        <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground">There is no strategic plan yet.</p></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<Inbox className="h-4 w-4 text-blue-600" />} label="Waiting for your approval" value={waiting} note={`${pendingPlans.length} breakdowns · ${newActivities.length} new activities`} />
            <Stat icon={<Clock3 className="h-4 w-4 text-amber-600" />} label="With activity owners" value={withOwners} note="requested, being prepared or returned" />
            <Stat icon={<SendHorizontal className="h-4 w-4 text-muted-foreground" />} label="Breakdown request not sent" value={notSent} note="send it from the strategic plan" />
            <Stat icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Fully planned" value={approved} note={`of ${activities.length} activities, breakdown approved`} />
          </div>

          <Tabs defaultValue={defaultTab}>
            <TabsList>
              <TabsTrigger value="breakdowns">Breakdowns{pendingPlans.length > 0 ? ` (${pendingPlans.length})` : ""}</TabsTrigger>
              <TabsTrigger value="new">New activities{newActivities.length > 0 ? ` (${newActivities.length})` : ""}</TabsTrigger>
              <TabsTrigger value="all">All activities ({activities.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="breakdowns" className="mt-4">
              <PlanApprovalList plans={pendingPlans} />
            </TabsContent>
            <TabsContent value="new" className="mt-4">
              <NewActivityApprovalList activities={newActivities} />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <PlanActivityTracker activities={activities} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: number; note: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-5">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</p>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
