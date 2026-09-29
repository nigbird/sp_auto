import { guardPage } from "@/lib/auth/page-guard";
import { getPlanApprovalOverview } from "@/actions/plan-approvals";
import { getPendingActivityPlans } from "@/actions/activity-plan-submissions";
import type { PendingActivityPlan } from "@/components/approvals/plan-approval-list";
import { PlanApprovalsBoard } from "@/components/approvals/plan-approvals-board";
import { PlanSelect } from "@/components/reports/plan-select";
import { Card, CardContent } from "@/components/ui/card";

export default async function PlanApprovalsPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { denied } = await guardPage('plan-approvals:view');
  if (denied) return denied;
  const { plan: planParam } = await searchParams;
  const [overview, allPendingPlans] = await Promise.all([getPlanApprovalOverview(planParam), getPendingActivityPlans()]);

  const { activities } = overview;
  const inPlan = new Set(activities.map(a => a.id));
  const pendingPlans = (allPendingPlans as PendingActivityPlan[]).filter(p => inPlan.has(p.id));
  const newActivities = activities.filter(a => a.stage === "activityPending");
  const defaultTab = pendingPlans.length > 0 ? "breakdowns" : newActivities.length > 0 ? "new" : "all";

  return (
    <div className="flex-1 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Plan Approvals</h1>
          <p className="text-sm text-muted-foreground">
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
        <PlanApprovalsBoard activities={activities} pendingPlans={pendingPlans} newActivities={newActivities} defaultTab={defaultTab} />
      )}
    </div>
  );
}
