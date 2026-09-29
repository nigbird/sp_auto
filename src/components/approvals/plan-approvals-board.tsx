"use client";

import * as React from "react";
import { CheckCircle2, Clock3, Inbox, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanApprovalList, type PendingActivityPlan } from "@/components/approvals/plan-approval-list";
import { NewActivityApprovalList, PlanActivityTracker } from "@/components/approvals/plan-activity-tracker";
import type { PlanApprovalActivity, PlanStage } from "@/actions/plan-approvals";

type TabId = "breakdowns" | "new" | "all";

const WITH_OWNERS: PlanStage[] = ["requested", "drafting", "breakdownReturned", "activityReturned", "ownerDeclined"];

const STAT_TONE = {
  gold: "text-primary",
  neutral: "text-foreground",
  "muted-gold": "text-amber-700/80",
  green: "text-emerald-700",
} as const;

/** What the "All activities" tab should be pre-filtered to when a KPI tile is clicked. */
interface StagePreset {
  stage?: string;
  group?: PlanStage[];
  groupLabel?: string;
  nonce: number;
}

/**
 * The interactive part of Plan Approvals: the four KPI tiles double as
 * shortcuts into the tab/filter they summarize, same as the My Plan filter tiles.
 */
export function PlanApprovalsBoard({ activities, pendingPlans, newActivities, defaultTab }: {
  activities: PlanApprovalActivity[];
  pendingPlans: PendingActivityPlan[];
  newActivities: PlanApprovalActivity[];
  defaultTab: TabId;
}) {
  const [tab, setTab] = React.useState<TabId>(defaultTab);
  // Remounts PlanActivityTracker with a fresh preset when a KPI tile is clicked,
  // without resetting its filters on every ordinary tab switch.
  const [preset, setPreset] = React.useState<StagePreset>({ nonce: 0 });

  const goToWaiting = () => setTab(pendingPlans.length > 0 ? "breakdowns" : "new");
  const goToStage = (stage: PlanStage) => {
    setPreset(p => ({ stage, nonce: p.nonce + 1 }));
    setTab("all");
  };
  const goToGroup = (group: PlanStage[], groupLabel: string) => {
    setPreset(p => ({ group, groupLabel, nonce: p.nonce + 1 }));
    setTab("all");
  };

  const withOwners = activities.filter(a => WITH_OWNERS.includes(a.stage)).length;
  const notSent = activities.filter(a => a.stage === "notSent").length;
  const approved = activities.filter(a => a.stage === "approved").length;
  const waiting = pendingPlans.length + newActivities.length;

  return (
    <>
      <div className="flex flex-wrap overflow-hidden rounded-xl border border-border/50 bg-card sm:flex-nowrap">
        <Stat icon={<Inbox className="h-3.5 w-3.5" />} label="Waiting for your approval" value={waiting}
          note={`${pendingPlans.length} breakdowns · ${newActivities.length} new activities`} tone="gold" first onClick={goToWaiting} />
        <Stat icon={<Clock3 className="h-3.5 w-3.5" />} label="With activity owners" value={withOwners}
          note="requested, being prepared or returned" tone="neutral" onClick={() => goToGroup(WITH_OWNERS, "With activity owners")} />
        <Stat icon={<SendHorizontal className="h-3.5 w-3.5" />} label="Breakdown request not sent" value={notSent}
          note="send it from the strategic plan" tone="muted-gold" onClick={() => goToStage("notSent")} />
        <Stat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Fully planned" value={approved}
          note={`of ${activities.length} activities, breakdown approved`} tone="green" onClick={() => goToStage("approved")} />
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabId)}>
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
          <PlanActivityTracker
            key={preset.nonce}
            activities={activities}
            initialStage={preset.stage}
            initialStageGroup={preset.group}
            initialStageGroupLabel={preset.groupLabel}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Stat({ icon, label, value, note, tone, first, onClick }: {
  icon: React.ReactNode; label: string; value: number; note: string; tone: keyof typeof STAT_TONE; first?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={value === 0}
      className={cn(
        "min-w-[11rem] flex-1 basis-1/2 px-5 py-4 text-left transition-colors enabled:hover:bg-muted/40 disabled:cursor-default",
        !first && "border-l border-border/50"
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className={STAT_TONE[tone]}>{icon}</span>
        {label}
      </p>
      <p className={cn("mt-2 text-[28px] font-bold leading-none tracking-tight tabular-nums", STAT_TONE[tone])}>{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
    </button>
  );
}
