"use client"

import * as React from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { approvePeriodReport, returnPeriodReport } from "@/actions/period-reports";
import { formatTargetValue } from "@/lib/monthly-breakdown";
import { computeReportRow, formatRatio, formatWeight } from "@/lib/report-calculations";
import type { PeriodReportEntry } from "../my-activity/my-activity-report-list";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 md:col-span-4" : undefined}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm whitespace-pre-wrap">{children || '—'}</div>
    </div>
  );
}

export function ReportApprovalList({ reports: initial }: { reports: PeriodReportEntry[] }) {
  const [reports, setReports] = React.useState(initial);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [returning, setReturning] = React.useState<PeriodReportEntry | null>(null);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => setReports(initial), [initial]);

  const handleApprove = async (entry: PeriodReportEntry) => {
    setBusyId(entry.id);
    try {
      const result = await approvePeriodReport(entry.id);
      if (!result.success) {
        toast({ title: "Couldn't approve", description: result.message, variant: "destructive" });
        return;
      }
      setReports(prev => prev.filter(r => r.id !== entry.id));
      toast({ title: "Report approved", description: `"${entry.activity.title}" — ${entry.reportingPeriod.name} now counts on the strategic plan.` });
    } finally {
      setBusyId(null);
    }
  };

  const handleReturn = async () => {
    if (!returning) return;
    if (!reason.trim()) {
      setReasonError("Please give a reason so the owner knows what to change.");
      return;
    }
    setBusyId(returning.id);
    try {
      const result = await returnPeriodReport(returning.id, reason);
      if (!result.success) {
        setReasonError(result.message);
        return;
      }
      setReports(prev => prev.filter(r => r.id !== returning.id));
      toast({ title: "Report returned", description: `"${returning.activity.title}" was sent back to its owner.`, variant: "destructive" });
      setReturning(null);
      setReason("");
    } finally {
      setBusyId(null);
    }
  };

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No period reports are waiting for approval.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map(entry => {
        const { activity, reportingPeriod: period } = entry;
        const row = computeReportRow(
          { weight: activity.weight, countsTowardWeight: activity.countsTowardWeight, targetType: activity.targetType, annualTarget: activity.annualTarget, targetAggregation: activity.targetAggregation, targetDirection: activity.targetDirection, monthlyTargets: activity.monthlyTargets },
          { actualToDate: entry.actualToDate, completionDate: entry.completionDate },
          period.endDate
        );
        const t = activity.targetType;
        return (
          <Card key={entry.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{activity.title}</h3>
                  <Badge variant="secondary">{period.name}</Badge>
                </div>
                {activity.initiative && <p className="text-xs text-muted-foreground">{activity.initiative.objective.pillar.title} → {activity.initiative.objective.statement} → {activity.initiative.title}</p>}
                <p className="text-sm text-muted-foreground">
                  {activity.responsible?.name ?? 'Unassigned'} · Target {activity.annualTarget != null ? formatTargetValue(activity.annualTarget, t) : '—'} · Weight {formatWeight(activity.weight)}
                  {entry.submittedAt && ` · submitted ${format(new Date(entry.submittedAt), 'PPp')}`}
                </p>
              </div>
              <Badge variant="outline" className={row.isBehindPlan ? "border-amber-500 text-amber-600 bg-amber-500/10" : "border-green-500 text-green-600 bg-green-500/10"}>
                {row.isBehindPlan ? 'Behind plan' : 'On plan'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-md border bg-sky-500/5 p-3">
                <Field label="Plan up to the period">{formatTargetValue(row.planToDate, t)}</Field>
                <Field label="Actual up to the period">{entry.actualToDate != null ? formatTargetValue(entry.actualToDate, t) : null}</Field>
                <Field label="Completion date">{entry.completionDate ? format(new Date(entry.completionDate), 'PP') : null}</Field>
                <Field label="Issues that need escalation">{entry.escalationIssues}</Field>
                <Field label="Accomplished tasks & key achievements" wide>{entry.comment}</Field>
                <div className="col-span-2"><Field label="Reasons for variation">{entry.reasonForVariation}</Field></div>
                <div className="col-span-2"><Field label="The way forward">{entry.wayForward}</Field></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Field label="%age Achiev't">{formatRatio(row.achievement)}</Field>
                <Field label="Date delayed">{row.daysDelayed != null ? `${row.daysDelayed} days` : null}</Field>
                <Field label="%age Achiev't with delay">{formatRatio(row.achievementWithDelay)}</Field>
                <Field label="Status">{row.status}</Field>
                <Field label="Weighted plan">{formatWeight(row.weightedPlan)}</Field>
                <Field label="Weighted actual">{formatWeight(row.weightedActual)}</Field>
                <Field label="Weighted actual with delay">{formatWeight(row.weightedActualWithDelay)}</Field>
                <Field label="Achieved result">{formatRatio(row.achievedResult)}</Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="destructive" disabled={busyId === entry.id} onClick={() => { setReturning(entry); setReasonError(null); }}>Return</Button>
                <Button className="bg-green-600 hover:bg-green-700" disabled={busyId === entry.id} onClick={() => handleApprove(entry)}>
                  {busyId === entry.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={returning !== null} onOpenChange={(open) => { if (!open) setReturning(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return this report</AlertDialogTitle>
            <AlertDialogDescription>Tell the owner what to change. They'll see this and can edit and resubmit before the cut-off date.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-1">
            <Textarea value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(null); }} placeholder="e.g., The actual doesn't match the evidence — please recheck." />
            {reasonError && <p className="text-sm font-medium text-destructive">{reasonError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleReturn} disabled={busyId !== null}>Return to owner</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
