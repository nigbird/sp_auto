import { guardPage } from "@/lib/auth/page-guard";
import { CheckCircle2, Clock3, Inbox, SendHorizontal } from "lucide-react";
import { getPlanApprovalOverview, type PlanStage } from "@/actions/plan-approvals";
import { getPendingActivityPlans } from "@/actions/activity-plan-submissions";
import { PlanApprovalList, type PendingActivityPlan } from "@/components/approvals/plan-approval-list";
import { NewActivityApprovalList, PlanActivityTracker } from "@/components/approvals/plan-activity-tracker";
import { PlanSelect } from "@/components/reports/plan-select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const WITH_OWNERS: PlanStage[] = ["requested", "drafting", "breakdownReturned", "activityReturned", "ownerDeclined"];

export default async function PlanApprovalsPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { denied } = await guardPage('plan-approvals:view');
  if (denied) return denied;
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
        <>
          <div className="flex flex-wrap overflow-hidden rounded-xl border border-border/50 bg-card sm:flex-nowrap">
            <Stat icon={<Inbox className="h-3.5 w-3.5" />} label="Waiting for your approval" value={waiting} note={`${pendingPlans.length} breakdowns · ${newActivities.length} new activities`} tone="gold" first />
            <Stat icon={<Clock3 className="h-3.5 w-3.5" />} label="With activity owners" value={withOwners} note="requested, being prepared or returned" tone="neutral" />
            <Stat icon={<SendHorizontal className="h-3.5 w-3.5" />} label="Breakdown request not sent" value={notSent} note="send it from the strategic plan" tone="muted-gold" />
            <Stat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Fully planned" value={approved} note={`of ${activities.length} activities, breakdown approved`} tone="green" />
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

const STAT_TONE = {
  gold: "text-primary",
  neutral: "text-foreground",
  "muted-gold": "text-amber-700/80",
  green: "text-emerald-700",
} as const;

function Stat({ icon, label, value, note, tone, first }: {
  icon: React.ReactNode; label: string; value: number; note: string; tone: keyof typeof STAT_TONE; first?: boolean;
}) {
  return (
    <div className={cn("min-w-[11rem] flex-1 basis-1/2 px-5 py-4 sm:basis-0", !first && "border-l border-border/50")}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className={STAT_TONE[tone]}>{icon}</span>
        {label}
      </p>
      <p className={cn("mt-2 text-[28px] font-bold leading-none tracking-tight tabular-nums", STAT_TONE[tone])}>{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
