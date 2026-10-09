"use client"

import { Can } from "@/components/permissions-provider";
import * as React from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "../ui/card";
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
import { ReportActivityCell, ReportDrawer, ReportRow, ReportTh, useReportSelection } from "../reports/report-drawer";
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

function reportRow(entry: PeriodReportEntry) {
  const a = entry.activity;
  return computeReportRow(
    { weight: a.weight, countsTowardWeight: a.countsTowardWeight, targetType: a.targetType, annualTarget: a.annualTarget, targetAggregation: a.targetAggregation, targetDirection: a.targetDirection, monthlyTargets: a.monthlyTargets },
    { actualToDate: entry.actualToDate, completionDate: entry.completionDate },
    entry.reportingPeriod.endDate
  );
}

function PlanBadge({ behind }: { behind: boolean }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", behind ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-700" : "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-700")}>
      {behind ? 'Behind plan' : 'On plan'}
    </Badge>
  );
}

/** Everything the approver checks for one report, shown in the side panel. */
function ApprovalDetail({ entry }: { entry: PeriodReportEntry }) {
  const row = reportRow(entry);
  const t = entry.activity.targetType;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Plan up to the period">{formatTargetValue(row.planToDate, t)}</Field>
        <Field label="Actual up to the period">{entry.actualToDate != null ? formatTargetValue(entry.actualToDate, t) : null}</Field>
        <Field label="%age Achiev't">{formatRatio(row.achievement)}</Field>
        <Field label="Completion date">{entry.completionDate ? format(new Date(entry.completionDate), 'PP') : null}</Field>
      </div>
      <div className="space-y-4 border-t border-border/50 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Reporting details</p>
        <Field label="Accomplished tasks & key achievements">{entry.comment}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reasons for variation">{entry.reasonForVariation}</Field>
          <Field label="The way forward">{entry.wayForward}</Field>
        </div>
        <Field label="Issues that need escalation">{entry.escalationIssues}</Field>
      </div>
      <ReportEvidence entryId={entry.id} files={entry.evidence ?? []} />
      <div className="space-y-4 border-t border-border/50 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Calculated results</p>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Date delayed">{row.daysDelayed != null ? `${row.daysDelayed} days` : null}</Field>
          <Field label="%age Achiev't with delay">{formatRatio(row.achievementWithDelay)}</Field>
          <Field label="Status">{row.status}</Field>
          <Field label="Achieved result">{formatRatio(row.achievedResult)}</Field>
          <Field label="Weighted plan">{formatWeight(row.weightedPlan)}</Field>
          <Field label="Weighted actual">{formatWeight(row.weightedActual)}</Field>
          <Field label="Weighted actual with delay">{formatWeight(row.weightedActualWithDelay)}</Field>
        </div>
      </div>
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

  // After approving or returning, the panel moves on to the next waiting report.
  const matchingRef = React.useRef<PeriodReportEntry[]>([]);
  const pendingNext = React.useRef<string | null | undefined>(undefined);
  const queueNext = (id: string) => {
    const list = matchingRef.current;
    const i = list.findIndex(r => r.id === id);
    pendingNext.current = (list[i + 1] ?? list[i - 1])?.id ?? null;
  };

  const handleApprove = async (entry: PeriodReportEntry) => {
    setBusyId(entry.id);
    try {
      const result = await approvePeriodReport(entry.id);
      if (!result.success) {
        toast({ title: "Couldn't approve", description: result.message, variant: "destructive" });
        return;
      }
      queueNext(entry.id);
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
      queueNext(returning.id);
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
  matchingRef.current = matching;
  const selection = useReportSelection(matching);

  const { open: openReport, close: closeReport, index: selectedIndex } = selection;
  React.useEffect(() => {
    if (pendingNext.current === undefined) return;
    if (pendingNext.current) openReport(pendingNext.current); else closeReport();
    pendingNext.current = undefined;
  }, [reports]); // eslint-disable-line react-hooks/exhaustive-deps

  // Previous/next in the panel can cross a page boundary; keep the list on the open report's page.
  const { pageSize, setPage } = pagination;
  React.useEffect(() => {
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize) + 1);
  }, [selectedIndex, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {matching.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr>
                <ReportTh>Activity</ReportTh>
                <ReportTh className="hidden w-40 lg:table-cell">Owner</ReportTh>
                <ReportTh className="hidden w-36 md:table-cell">Period</ReportTh>
                <ReportTh className="hidden w-20 text-right md:table-cell">Plan</ReportTh>
                <ReportTh className="hidden w-20 text-right md:table-cell">Actual</ReportTh>
                <ReportTh className="hidden w-32 lg:table-cell">Submitted</ReportTh>
                <ReportTh className="w-32 text-right">Result</ReportTh>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {pagination.items.map(entry => {
                const row = reportRow(entry);
                const t = entry.activity.targetType;
                return (
                  <ReportRow key={entry.id} selected={selection.selectedId === entry.id} onOpen={() => selection.open(entry.id)} label={`Review report for ${entry.activity.title}`}>
                    <ReportActivityCell entry={entry} />
                    <td className="hidden truncate px-4 py-3 text-foreground/90 lg:table-cell">{entry.activity.responsible?.name ?? 'Unassigned'}</td>
                    <td className="hidden truncate px-4 py-3 text-muted-foreground md:table-cell">{entry.reportingPeriod.name}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-foreground/90 md:table-cell">{formatTargetValue(row.planToDate, t)}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-foreground/90 md:table-cell">{entry.actualToDate != null ? formatTargetValue(entry.actualToDate, t) : '—'}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{entry.submittedAt ? format(new Date(entry.submittedAt), 'PP') : '—'}</td>
                    <td className="px-4 py-3 text-right"><PlanBadge behind={row.isBehindPlan} /></td>
                  </ReportRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination state={pagination} noun="reports" />

      <ReportDrawer
        entry={selection.selected}
        open={selection.selected !== null}
        onOpenChange={o => { if (!o) selection.close(); }}
        badge={selection.selected && <PlanBadge behind={reportRow(selection.selected).isBehindPlan} />}
        meta={selection.selected && <>
          {selection.selected.activity.responsible?.name ?? 'Unassigned'} · Weight {formatWeight(selection.selected.activity.weight)}
          {selection.selected.submittedAt && ` · submitted ${format(new Date(selection.selected.submittedAt), 'PPp')}`}
        </>}
        index={selection.index}
        count={selection.count}
        onPrev={selection.prev}
        onNext={selection.next}
        footer={selection.selected && (
          <Can anyOf={["report-approvals:approve"]}>
            <div className="flex justify-end gap-2">
              <Button variant="destructive" disabled={busyId === selection.selected.id} onClick={() => { setReturning(selection.selected); setReasonError(null); }}>Return</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={busyId === selection.selected.id} onClick={() => selection.selected && handleApprove(selection.selected)}>
                {busyId === selection.selected.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Approve
              </Button>
            </div>
          </Can>
        )}
      >
        {selection.selected && <ApprovalDetail entry={selection.selected} />}
      </ReportDrawer>

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
