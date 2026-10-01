"use client"

import { Can } from "@/components/permissions-provider";
import * as React from "react";
import { cn } from "@/lib/utils";
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
import { ReportEvidence } from "../reports/report-evidence";
import { DateRangeFilter, ListToolbar, Pagination, SearchBox, usePagination } from "../list-controls";
import { inDateRange, isRangeSet, matchesSearch, type DateRangeValue } from "@/lib/list-filters";
import { EmptyState } from "@/components/empty-state";

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 md:col-span-4" : undefined}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{children || '—'}</div>
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

  const [query, setQuery] = React.useState("");
  const [range, setRange] = React.useState<DateRangeValue>({});
  const narrowed = query.trim() !== "" || isRangeSet(range);
  const matching = reports.filter(e =>
    inDateRange(e.submittedAt, range) &&
    matchesSearch(query, e.activity.title, e.activity.responsible?.name, e.activity.initiative?.title, e.reportingPeriod.name));
  const pagination = usePagination(matching, `${query}|${range.from}|${range.to}`);

  if (reports.length === 0) {
    return (
      <EmptyState
        art="inbox"
        title="All caught up"
        description="No period reports are waiting for your approval."
        className="rounded-xl border border-dashed border-border/70 bg-card/60"
      />
    );
  }

  return (
    <div className="space-y-4">
      <ListToolbar count={narrowed ? `${matching.length} of ${reports.length} reports match` : `${reports.length} waiting`}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search activity, owner, initiative or period" className="sm:w-80" />
        <DateRangeFilter value={range} onChange={setRange} label="Any submission date" hint="Shows reports submitted in this range." />
        {narrowed && <Button variant="ghost" className="h-9 px-3" onClick={() => { setQuery(""); setRange({}); }}>Reset</Button>}
      </ListToolbar>
      {matching.length === 0 && (
        <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground">No waiting reports match the search or dates.</p></CardContent></Card>
      )}
      {pagination.items.map(entry => {
        const { activity, reportingPeriod: period } = entry;
        const row = computeReportRow(
          { weight: activity.weight, countsTowardWeight: activity.countsTowardWeight, targetType: activity.targetType, annualTarget: activity.annualTarget, targetAggregation: activity.targetAggregation, targetDirection: activity.targetDirection, monthlyTargets: activity.monthlyTargets },
          { actualToDate: entry.actualToDate, completionDate: entry.completionDate },
          period.endDate
        );
        const t = activity.targetType;
        return (
          <Card key={entry.id} className="rounded-xl border-border/50 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_4px_12px_-8px_rgba(16,24,40,0.06)]">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold leading-snug text-foreground">{activity.title}</h3>
                  <Badge variant="outline" className="border-border/60 bg-muted/60 font-medium text-muted-foreground">{period.name}</Badge>
                </div>
                {activity.initiative && <p className="text-xs text-muted-foreground/90">{activity.initiative.objective.pillar.title} → {activity.initiative.objective.statement} → {activity.initiative.title}</p>}
                <p className="text-xs text-muted-foreground/90">
                  {activity.responsible?.name ?? 'Unassigned'} · Target {activity.annualTarget != null ? formatTargetValue(activity.annualTarget, t) : '—'} · Weight {formatWeight(activity.weight)}
                  {entry.submittedAt && ` · submitted ${format(new Date(entry.submittedAt), 'PPp')}`}
                </p>
              </div>
              <Badge variant="outline" className={cn("whitespace-nowrap font-medium", row.isBehindPlan ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-700" : "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-700")}>
                {row.isBehindPlan ? 'Behind plan' : 'On plan'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4 sm:grid-cols-4">
                <Field label="Plan up to the period">{formatTargetValue(row.planToDate, t)}</Field>
                <Field label="Actual up to the period">{entry.actualToDate != null ? formatTargetValue(entry.actualToDate, t) : null}</Field>
                <Field label="Completion date">{entry.completionDate ? format(new Date(entry.completionDate), 'PP') : null}</Field>
                <Field label="Issues that need escalation">{entry.escalationIssues}</Field>
                <Field label="Accomplished tasks & key achievements" wide>{entry.comment}</Field>
                <div className="col-span-2"><Field label="Reasons for variation">{entry.reasonForVariation}</Field></div>
                <div className="col-span-2"><Field label="The way forward">{entry.wayForward}</Field></div>
              </div>
              <ReportEvidence entryId={entry.id} files={entry.evidence ?? []} />
              <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4 text-sm sm:grid-cols-4">
                <Field label="%age Achiev't">{formatRatio(row.achievement)}</Field>
                <Field label="Date delayed">{row.daysDelayed != null ? `${row.daysDelayed} days` : null}</Field>
                <Field label="%age Achiev't with delay">{formatRatio(row.achievementWithDelay)}</Field>
                <Field label="Status">{row.status}</Field>
                <Field label="Weighted plan">{formatWeight(row.weightedPlan)}</Field>
                <Field label="Weighted actual">{formatWeight(row.weightedActual)}</Field>
                <Field label="Weighted actual with delay">{formatWeight(row.weightedActualWithDelay)}</Field>
                <Field label="Achieved result">{formatRatio(row.achievedResult)}</Field>
              </div>
              <Can anyOf={["report-approvals:approve"]}>
              <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
                <Button variant="destructive" disabled={busyId === entry.id} onClick={() => { setReturning(entry); setReasonError(null); }}>Return</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={busyId === entry.id} onClick={() => handleApprove(entry)}>
                  {busyId === entry.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Approve
                </Button>
              </div>
              </Can>
            </CardContent>
          </Card>
        );
      })}
      <Pagination state={pagination} noun="reports" />

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
