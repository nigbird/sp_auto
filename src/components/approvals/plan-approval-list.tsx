"use client"

import * as React from "react"
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { approveActivityPlan, declineActivityPlan } from "@/actions/activity-plan-submissions";
import { useToast } from "@/hooks/use-toast";
import { monthKey, monthsBetween, type TargetAggregation, type TargetType } from "@/lib/monthly-breakdown";
import { BreakdownStrip } from "../my-activity/breakdown-editor";

export interface PendingActivityPlan {
  id: string;
  title: string;
  department: string;
  deliverable: string | null;
  startDate: string;
  endDate: string;
  weight: number;
  proposedByOwner: boolean;
  targetType: TargetType | null;
  targetAggregation: TargetAggregation;
  targetDirection: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  annualTarget: number | null;
  planSubmittedAt: string | null;
  responsible: { name: string } | null;
  monthlyTargets: { month: string; value: number }[];
  initiative: { title: string; objective: { statement: string; pillar: { title: string } } } | null;
}

export function PlanApprovalList({ plans: initialPlans }: { plans: PendingActivityPlan[] }) {
  const [plans, setPlans] = React.useState(initialPlans);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [declining, setDeclining] = React.useState<PendingActivityPlan | null>(null);
  const [declineReason, setDeclineReason] = React.useState("");
  const [declineError, setDeclineError] = React.useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => setPlans(initialPlans), [initialPlans]);

  const handleApprove = async (plan: PendingActivityPlan) => {
    setBusyId(plan.id);
    try {
      const result = await approveActivityPlan(plan.id);
      if (!result.success) {
        toast({ title: "Couldn't approve", description: result.message, variant: "destructive" });
        return;
      }
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      toast({ title: "Breakdown approved", description: `The monthly breakdown for "${plan.title}" is approved and now shows on the strategic plan.` });
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDecline = async () => {
    if (!declining) return;
    if (declineReason.trim() === "") {
      setDeclineError("Please give a reason so the owner knows what to change.");
      return;
    }
    setBusyId(declining.id);
    try {
      const result = await declineActivityPlan(declining.id, declineReason);
      if (!result.success) {
        setDeclineError(result.message);
        return;
      }
      setPlans((prev) => prev.filter((p) => p.id !== declining.id));
      toast({ title: "Breakdown returned", description: `"${declining.title}" was sent back to its owner.`, variant: "destructive" });
      setDeclining(null);
      setDeclineReason("");
    } finally {
      setBusyId(null);
    }
  };

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No monthly breakdowns are waiting for approval.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <Card key={plan.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{plan.title}</h3>
                {plan.proposedByOwner && <Badge variant="secondary" title="Added by the owner while filling in their breakdown. Approving the breakdown also approves the activity (weight 0 until you set one on the plan).">New activity from owner</Badge>}
              </div>
              {plan.initiative && (
                <p className="text-xs text-muted-foreground">
                  {plan.initiative.objective.pillar.title} → {plan.initiative.objective.statement} → {plan.initiative.title}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {plan.department} · {plan.responsible?.name ?? "Unassigned"} · {format(new Date(plan.startDate), "PP")} – {format(new Date(plan.endDate), "PP")}
              </p>
              {plan.deliverable && <p className="text-sm"><span className="font-medium">Deliverable:</span> {plan.deliverable}</p>}
            </div>
            <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-500/10 shrink-0">Pending approval</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.targetType && plan.annualTarget != null ? (
              <>
                <p className="text-sm">
                  <span className="font-medium">Annual target:</span> {plan.annualTarget}{plan.targetType === 'PERCENT' ? '%' : ''} ({plan.targetType === 'PERCENT' ? 'percent' : 'number'}, {plan.targetAggregation === 'RECURRING' ? 'same level every month' : 'months add up'}{plan.targetDirection === 'LOWER_IS_BETTER' ? ', lower is better' : ''})
                  {plan.planSubmittedAt && <span className="text-muted-foreground"> · submitted {format(new Date(plan.planSubmittedAt), "PPp")}</span>}
                </p>
                <BreakdownStrip
                  months={monthsBetween(plan.startDate, plan.endDate)}
                  entries={plan.monthlyTargets.map(t => ({ month: monthKey(t.month), value: t.value }))}
                  targetType={plan.targetType}
                  annualTarget={plan.annualTarget}
                  aggregation={plan.targetAggregation}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No breakdown values were saved.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="destructive" disabled={busyId === plan.id} onClick={() => { setDeclining(plan); setDeclineError(null); }}>Return</Button>
              <Button className="bg-green-600 hover:bg-green-700" disabled={busyId === plan.id} onClick={() => handleApprove(plan)}>
                {busyId === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={declining !== null} onOpenChange={(open) => { if (!open) setDeclining(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return this breakdown</AlertDialogTitle>
            <AlertDialogDescription>
              Tell the owner what to change. They'll see this reason and can edit and resubmit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-1">
            <Textarea
              placeholder="e.g., Move the finish month to Sep-26 to match the project plan."
              value={declineReason}
              onChange={(e) => { setDeclineReason(e.target.value); setDeclineError(null); }}
            />
            {declineError && <p className="text-sm font-medium text-destructive">{declineError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmDecline} disabled={busyId !== null}>Return to owner</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
