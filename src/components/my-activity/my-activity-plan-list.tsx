"use client"

import * as React from "react"
import type { Activity, StrategicPlan } from "@/lib/types";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Check, ShieldQuestion, ShieldX, List, Mail, PlusCircle, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Alert, AlertDescription } from "../ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { getActivityBreakdown, submitActivityBreakdown, acceptPlanRequest, declinePlanRequest, proposeActivityWithBreakdown, type BreakdownActionResult } from "@/actions/activity-plan-submissions";
import { useToast } from "@/hooks/use-toast";
import { monthKey, monthsBetween, type TargetType } from "@/lib/monthly-breakdown";
import { BreakdownEditor, BreakdownStrip, breakdownDraftFrom, draftEntries, emptyBreakdownDraft, validateDraft, type BreakdownDraft } from "./breakdown-editor";

type BreakdownActivity = Activity & { monthlyTargets?: { month: string; value: number }[] };

const BreakdownStatusBadge = ({ activity }: { activity: Activity }) => {
  if (activity.planRequestStatus === 'SENT') {
    return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-500/10"><Mail className="h-3 w-3 mr-1" />Request received</Badge>;
  }
  if (activity.planRequestStatus === 'DECLINED') {
    return <Badge variant="destructive" title={activity.planRequestDeclineReason ?? undefined}><ShieldX className="h-3 w-3 mr-1" />You declined the request</Badge>;
  }
  switch (activity.planSubmissionStatus) {
    case 'APPROVED':
      return <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10"><Check className="h-3 w-3 mr-1" />Breakdown approved</Badge>;
    case 'PENDING':
      return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-500/10"><ShieldQuestion className="h-3 w-3 mr-1" />Waiting for approval</Badge>;
    case 'DECLINED':
      return <Badge variant="destructive"><ShieldX className="h-3 w-3 mr-1" />Returned — needs changes</Badge>;
    default:
      return <Badge variant="outline">Not filled in yet</Badge>;
  }
};

function useActionFeedback() {
  const { toast } = useToast();
  return (result: BreakdownActionResult, success: { title: string; description: string }) => {
    if (result.success) {
      toast(success);
      return true;
    }
    toast({ title: "Couldn't save", description: result.message, variant: "destructive" });
    return false;
  };
}

function PlanCard({ activity, initiativeTitle, onChanged }: { activity: Activity; initiativeTitle?: string; onChanged: () => Promise<void> | void }) {
  const [isOpen, setIsOpen] = React.useState(activity.planRequestStatus === 'SENT' || (activity.planRequestStatus === 'ACCEPTED' && (activity.planSubmissionStatus == null || activity.planSubmissionStatus === 'DECLINED')));
  const [details, setDetails] = React.useState<BreakdownActivity | null>(null);
  const [draft, setDraft] = React.useState<BreakdownDraft>(emptyBreakdownDraft());
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverErrors, setServerErrors] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [isDeclineRequestOpen, setIsDeclineRequestOpen] = React.useState(false);
  const [requestDeclineReason, setRequestDeclineReason] = React.useState("");
  const [declineReasonError, setDeclineReasonError] = React.useState<string | null>(null);
  const [isProposeOpen, setIsProposeOpen] = React.useState(false);
  const report = useActionFeedback();

  const isAccepted = activity.planRequestStatus === 'ACCEPTED';
  const isEditable = isAccepted && (activity.planSubmissionStatus == null || activity.planSubmissionStatus === 'DECLINED');

  // Load the saved breakdown when the card opens, and again whenever the
  // activity's status changes underneath it (after a submit/approval).
  React.useEffect(() => {
    if (!isOpen || !isAccepted) return;
    let cancelled = false;
    setIsLoading(true);
    getActivityBreakdown(activity.id).then((result) => {
      if (cancelled) return;
      setDetails(result);
      if (result) setDraft(breakdownDraftFrom(result));
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, isAccepted, activity.id, activity.planSubmissionStatus]);

  const handleSubmit = async () => {
    setShowErrors(true);
    setServerErrors([]);
    const validation = validateDraft(draft, activity.startDate, activity.endDate);
    if (!validation.valid) return;
    setIsBusy(true);
    try {
      const result = await submitActivityBreakdown(activity.id, {
        targetType: draft.targetType,
        annualTarget: Number(draft.annualTarget),
        entries: draftEntries(draft),
      });
      if (!result.success) setServerErrors(result.formErrors ?? [result.message]);
      if (report(result, { title: "Breakdown submitted", description: `"${activity.title}" was sent for approval.` })) {
        setShowErrors(false);
        await onChanged();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleAcceptRequest = async () => {
    setIsBusy(true);
    try {
      const result = await acceptPlanRequest(activity.id);
      if (report(result, { title: "Request accepted", description: `You can now fill in the monthly breakdown for "${activity.title}".` })) {
        setIsOpen(true);
        await onChanged();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (requestDeclineReason.trim() === "") {
      setDeclineReasonError("Please give a reason for declining.");
      return;
    }
    setIsBusy(true);
    try {
      const result = await declinePlanRequest(activity.id, requestDeclineReason);
      if (report(result, { title: "Request declined", description: `The breakdown request for "${activity.title}" was declined.` })) {
        setIsDeclineRequestOpen(false);
        setRequestDeclineReason("");
        await onChanged();
      }
    } finally {
      setIsBusy(false);
    }
  };

  const savedEntries = (details?.monthlyTargets ?? []).map(t => ({ month: monthKey(t.month), value: t.value }));

  return (
    <Card className="bg-card">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{activity.title}</h3>
              {activity.proposedByOwner && <Badge variant="secondary">Added by you</Badge>}
            </div>
            {initiativeTitle && <p className="text-xs text-muted-foreground">Initiative: {initiativeTitle}</p>}
            <p className="text-sm text-muted-foreground">
              {format(new Date(activity.startDate), "PP")} – {format(new Date(activity.endDate), "PP")}
            </p>
            {activity.deliverable && <p className="text-sm"><span className="font-medium">Deliverable:</span> {activity.deliverable}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <BreakdownStatusBadge activity={activity} />
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={isOpen ? "Collapse" : "Expand"}>
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {activity.planRequestStatus === 'SENT' && (
              <div className="space-y-3 rounded-lg border border-blue-500/50 p-4">
                <p className="text-sm font-medium">
                  You've been asked to fill in this activity's monthly breakdown. Accept to start, or decline if this activity shouldn't be yours.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="destructive" disabled={isBusy} onClick={() => { setDeclineReasonError(null); setIsDeclineRequestOpen(true); }}>Decline</Button>
                  <Button className="bg-green-600 hover:bg-green-700" disabled={isBusy} onClick={handleAcceptRequest}>Accept</Button>
                </div>
              </div>
            )}

            {activity.planRequestStatus === 'DECLINED' && (
              <p className="text-sm text-muted-foreground">
                You declined this request{activity.planRequestDeclineReason ? `: "${activity.planRequestDeclineReason}"` : ''}. Ask an approver to resend it if that was a mistake.
              </p>
            )}

            {isAccepted && isLoading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading breakdown…</p>}

            {isAccepted && !isLoading && activity.planSubmissionStatus === 'DECLINED' && activity.planDeclineReason && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription><span className="font-semibold">Returned by approver:</span> {activity.planDeclineReason}</AlertDescription>
              </Alert>
            )}

            {isAccepted && !isLoading && isEditable && (
              <>
                <BreakdownEditor
                  draft={draft}
                  onChange={setDraft}
                  startDate={activity.startDate}
                  endDate={activity.endDate}
                  showErrors={showErrors}
                  serverFormErrors={serverErrors}
                  disabled={isBusy}
                />
                <div className="flex flex-wrap justify-between gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsProposeOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add another activity
                  </Button>
                  <Button onClick={handleSubmit} disabled={isBusy}>
                    {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit for approval
                  </Button>
                </div>
              </>
            )}

            {isAccepted && !isLoading && !isEditable && details && details.targetType && details.annualTarget != null && (
              <div className="space-y-3">
                <p className="text-sm">
                  <span className="font-medium">Annual target:</span> {details.annualTarget}{details.targetType === 'PERCENT' ? '%' : ''} ({details.targetType === 'PERCENT' ? 'percent' : 'number'})
                </p>
                <BreakdownStrip months={monthsBetween(activity.startDate, activity.endDate)} entries={savedEntries} targetType={details.targetType as TargetType} annualTarget={details.annualTarget} />
                <div className="flex justify-start">
                  <Button type="button" variant="outline" onClick={() => setIsProposeOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add another activity
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={isDeclineRequestOpen} onOpenChange={setIsDeclineRequestOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this request</AlertDialogTitle>
            <AlertDialogDescription>
              Let the approver know why — e.g. this activity should be planned by someone else.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-1">
            <Textarea
              placeholder="Type your reason here..."
              value={requestDeclineReason}
              onChange={(e) => { setRequestDeclineReason(e.target.value); setDeclineReasonError(null); }}
            />
            {declineReasonError && <p className="text-sm font-medium text-destructive">{declineReasonError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {/* A plain button, not AlertDialogAction, so the dialog stays open when the reason is missing. */}
            <Button variant="destructive" onClick={handleDeclineRequest} disabled={isBusy}>Confirm decline</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProposeActivityDialog
        open={isProposeOpen}
        onOpenChange={setIsProposeOpen}
        sibling={activity}
        initiativeTitle={initiativeTitle}
        onCreated={onChanged}
      />
    </Card>
  );
}

function ProposeActivityDialog({ open, onOpenChange, sibling, initiativeTitle, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; sibling: Activity; initiativeTitle?: string; onCreated: () => Promise<void> | void }) {
  const toDateInput = (d: string | Date) => format(new Date(d), 'yyyy-MM-dd');
  const [title, setTitle] = React.useState("");
  const [deliverable, setDeliverable] = React.useState("");
  const [startDate, setStartDate] = React.useState(toDateInput(sibling.startDate));
  const [endDate, setEndDate] = React.useState(toDateInput(sibling.endDate));
  const [draft, setDraft] = React.useState<BreakdownDraft>(emptyBreakdownDraft());
  const [showErrors, setShowErrors] = React.useState(false);
  const [serverErrors, setServerErrors] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const report = useActionFeedback();

  React.useEffect(() => {
    if (!open) return;
    setTitle(""); setDeliverable(""); setDraft(emptyBreakdownDraft());
    setStartDate(toDateInput(sibling.startDate)); setEndDate(toDateInput(sibling.endDate));
    setShowErrors(false); setServerErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const datesValid = !!startDate && !!endDate && new Date(endDate) > new Date(startDate);
  const fieldErrors = {
    title: title.trim() ? null : "Activity title is required.",
    dates: !startDate || !endDate ? "Start and end dates are required." : !datesValid ? "End date must be after the start date." : null,
  };

  // If the dates change, drop months that are no longer inside them.
  React.useEffect(() => {
    if (!datesValid) return;
    const allowed = new Set(monthsBetween(startDate, endDate));
    setDraft(d => ({ ...d, rows: d.rows.map(r => r.month && !allowed.has(r.month) ? { ...r, month: '' } : r) }));
  }, [startDate, endDate, datesValid]);

  const handleSave = async () => {
    setShowErrors(true);
    setServerErrors([]);
    if (fieldErrors.title || fieldErrors.dates) return;
    if (!validateDraft(draft, startDate, endDate).valid) return;
    setIsSaving(true);
    try {
      const result = await proposeActivityWithBreakdown(sibling.id, {
        title, deliverable, startDate, endDate,
        targetType: draft.targetType,
        annualTarget: Number(draft.annualTarget),
        entries: draftEntries(draft),
      });
      if (!result.success) setServerErrors(result.formErrors ?? [result.message]);
      if (report(result, { title: "Activity added", description: `"${title.trim()}" and its breakdown were sent for approval.` })) {
        onOpenChange(false);
        await onCreated();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add another activity</DialogTitle>
          <DialogDescription>
            {initiativeTitle ? <>Under <span className="font-medium">{initiativeTitle}</span>. </> : null}
            It will be assigned to you and sent for approval together with its monthly breakdown. An approver can set its weight later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="new-activity-title">Activity title</Label>
            <Input id="new-activity-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Incorporate the segmentation criteria on the CBS" />
            {showErrors && fieldErrors.title && <p className="text-sm font-medium text-destructive">{fieldErrors.title}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-activity-deliverable">Deliverable</Label>
            <Textarea id="new-activity-deliverable" rows={2} value={deliverable} onChange={(e) => setDeliverable(e.target.value)} placeholder="e.g., Reports generated by customer segments" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="new-activity-start">Start date</Label>
              <Input id="new-activity-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-activity-end">End date</Label>
              <Input id="new-activity-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {showErrors && fieldErrors.dates && <p className="text-sm font-medium text-destructive">{fieldErrors.dates}</p>}
          <BreakdownEditor draft={draft} onChange={setDraft} startDate={startDate} endDate={endDate} showErrors={showErrors} serverFormErrors={serverErrors} disabled={isSaving} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add & submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The owner's side of the monthly breakdown: every activity they're
 * responsible for that has had a breakdown request sent, grouped by where it
 * stands, with accept/decline and the breakdown form inline.
 */
export function MyActivityPlanList({ activities, plan, onChanged }: { activities: Activity[]; plan?: StrategicPlan | null; onChanged: () => Promise<void> | void }) {
  const initiativeTitles = React.useMemo(() => {
    const map = new Map<string, string>();
    plan?.pillars.forEach(p => p.objectives.forEach(o => o.initiatives.forEach(i => map.set(i.id, i.title))));
    return map;
  }, [plan]);

  const actionable = activities.filter(a => a.planRequestStatus !== 'NOT_SENT');
  const waitingCount = activities.length - actionable.length;
  const needsAction = actionable.filter(a => a.planRequestStatus === 'SENT' || (a.planRequestStatus === 'ACCEPTED' && (a.planSubmissionStatus == null || a.planSubmissionStatus === 'DECLINED')));

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">You have no activities in this plan.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <List className="text-muted-foreground" />
        Monthly Breakdown ({actionable.length})
      </h2>
      <p className="text-sm text-muted-foreground">
        {needsAction.length > 0
          ? `${needsAction.length} ${needsAction.length === 1 ? 'activity needs' : 'activities need'} your breakdown.`
          : 'Nothing is waiting on you right now.'}
        {waitingCount > 0 && ` ${waitingCount} of your activities ${waitingCount === 1 ? "hasn't" : "haven't"} had a request sent yet.`}
      </p>
      {actionable.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No breakdown requests yet — they appear here once an approver sends them for the published plan.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {actionable.map((activity) => (
            <PlanCard key={activity.id} activity={activity} initiativeTitle={initiativeTitles.get(activity.initiativeId)} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}
