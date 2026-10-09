"use client"

import * as React from "react";
import { format } from "date-fns";
import { AlertCircle, AlertTriangle, Check, CheckCircle2, ClipboardList, Hourglass, Info, List, Loader2, PencilLine, ShieldQuestion, ShieldX, TrendingDown, Undo2 } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Alert, AlertDescription } from "../ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "../permissions-provider";
import { getMyPeriodReports, submitPeriodReport } from "@/actions/period-reports";
import { isPeriodClosedForSubmissions } from "@/lib/reporting-period";
import { formatTargetValue, type TargetAggregation, type TargetType } from "@/lib/monthly-breakdown";
import { computeReportRow, formatRatio } from "@/lib/report-calculations";
import { ReportEvidence } from "../reports/report-evidence";
import { ReportActivityCell, ReportDrawer, ReportRow, ReportTh, useReportSelection } from "../reports/report-drawer";
import { DateRangeFilter, ListToolbar, Pagination, SearchBox, usePagination } from "../list-controls";
import { isRangeSet, matchesSearch, overlapsDateRange, type DateRangeValue } from "@/lib/list-filters";
import type { EvidenceMeta } from "@/actions/evidence";
import { EmptyState } from "@/components/empty-state";

export interface PeriodReportEntry {
  id: string;
  reportStatus: 'REQUESTED' | 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  planToDate: number | null;
  actualToDate: number | null;
  completionDate: string | null;
  comment: string | null;
  reasonForVariation: string | null;
  wayForward: string | null;
  escalationIssues: string | null;
  declineReason: string | null;
  submittedAt: string | null;
  evidence: EvidenceMeta[];
  reportingPeriod: { id: string; name: string; startDate: string; endDate: string; cutOffDate: string; status: 'OPEN' | 'CLOSED'; reportRequestMessage: string | null };
  activity: {
    id: string;
    title: string;
    deliverable: string | null;
    startDate: string;
    endDate: string;
    weight: number;
    countsTowardWeight: boolean;
    targetType: TargetType | null;
    targetAggregation: TargetAggregation;
    targetDirection: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
    annualTarget: number | null;
    monthlyTargets: { month: string; value: number }[];
    responsible: { name: string } | null;
    initiative: { title: string; objective: { statement: string; pillar: { title: string } } } | null;
  };
}

export function ReportStatusBadge({ status }: { status: PeriodReportEntry['reportStatus'] }) {
  switch (status) {
    case 'APPROVED': return <Badge variant="outline" className="gap-1 whitespace-nowrap border-emerald-500/30 bg-emerald-500/[0.07] font-medium text-emerald-700"><Check className="h-3 w-3" />Approved</Badge>;
    case 'SUBMITTED': return <Badge variant="outline" className="gap-1 whitespace-nowrap border-blue-500/25 bg-blue-500/[0.06] font-medium text-blue-700"><ShieldQuestion className="h-3 w-3" />Waiting for approval</Badge>;
    case 'RETURNED': return <Badge variant="outline" className="gap-1 whitespace-nowrap border-red-400/30 bg-red-500/[0.06] font-medium text-red-700"><ShieldX className="h-3 w-3" />Returned — needs changes</Badge>;
    default: return <Badge variant="outline" className="gap-1 whitespace-nowrap border-amber-500/30 bg-amber-500/[0.06] font-medium text-amber-700"><PencilLine className="h-3 w-3" />To fill in</Badge>;
  }
}

// ---------------------------------------------------------------------------
// Shared layout for the metrics row and narrative section — the editable
// form and the read-only summary are two states of the same visual structure,
// built from these same pieces, so they never look like separate UIs.
// ---------------------------------------------------------------------------

const FIELD_LABEL_CLASS = "block text-xs font-medium text-muted-foreground";

function MetricStatic({ children, tone }: { children: React.ReactNode; tone?: "danger" | "success" }) {
  return (
    <p className={cn(
      "text-[15px] font-semibold tabular-nums text-foreground",
      tone === "danger" && "text-red-700",
      tone === "success" && "text-emerald-700"
    )}>
      {children}
    </p>
  );
}

function NarrativeSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 border-t border-border/50 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Reporting details</p>
      {children}
    </div>
  );
}

function NarrativeField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {htmlFor ? <Label htmlFor={htmlFor} className={FIELD_LABEL_CLASS}>{label}</Label> : <p className={FIELD_LABEL_CLASS}>{label}</p>}
      {children}
    </div>
  );
}

/** The owner's blue columns for one activity in one period. */
function ReportForm({ entry, onSubmitted }: { entry: PeriodReportEntry; onSubmitted: () => Promise<void> }) {
  const { activity, reportingPeriod: period } = entry;
  const targetType = activity.targetType;
  const unit = targetType === 'PERCENT' ? '%' : '';
  const [actual, setActual] = React.useState(entry.actualToDate != null ? String(entry.actualToDate) : '');
  const [completionDate, setCompletionDate] = React.useState(entry.completionDate ? entry.completionDate.split('T')[0] : '');
  const [accomplished, setAccomplished] = React.useState(entry.comment ?? '');
  const [reason, setReason] = React.useState(entry.reasonForVariation ?? '');
  const [wayForward, setWayForward] = React.useState(entry.wayForward ?? '');
  const [escalation, setEscalation] = React.useState(entry.escalationIssues ?? '');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();

  const actualNumber = actual.trim() === '' ? null : Number(actual);
  const row = computeReportRow(
    { weight: activity.weight, countsTowardWeight: activity.countsTowardWeight, targetType, annualTarget: activity.annualTarget, targetAggregation: activity.targetAggregation, targetDirection: activity.targetDirection, monthlyTargets: activity.monthlyTargets },
    { actualToDate: actualNumber != null && Number.isFinite(actualNumber) ? actualNumber : null, completionDate: completionDate || null },
    period.endDate
  );
  const reachedTarget = activity.targetAggregation !== 'RECURRING' && actualNumber != null && (activity.annualTarget ?? 0) > 0 && actualNumber >= (activity.annualTarget ?? 0);

  const validate = () => {
    const next: Record<string, string> = {};
    if (actualNumber == null || !Number.isFinite(actualNumber)) next.actualToDate = 'Enter the actual achieved up to this period.';
    else if (actualNumber < 0) next.actualToDate = "Actual can't be negative.";
    else if (targetType === 'PERCENT' && actualNumber > 100) next.actualToDate = "A percentage can't be more than 100%.";
    if (reachedTarget && !completionDate) next.completionDate = 'The annual target is reached — enter the completion date.';
    if (completionDate && new Date(completionDate) > new Date()) next.completionDate = "Completion date can't be in the future.";
    if (row.isBehindPlan && !reason.trim()) next.reasonForVariation = 'Required — the actual is below the plan for this period.';
    if (row.isBehindPlan && !wayForward.trim()) next.wayForward = 'Required — the actual is below the plan for this period.';
    return next;
  };

  const handleSubmit = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setIsSaving(true);
    try {
      const result = await submitPeriodReport(entry.id, {
        actualToDate: actualNumber,
        completionDate: completionDate || null,
        accomplishedTasks: accomplished,
        reasonForVariation: reason,
        wayForward,
        escalationIssues: escalation,
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        toast({ title: "Couldn't submit the report", description: result.message, variant: "destructive" });
        return;
      }
      toast({ title: "Report submitted", description: `"${activity.title}" was sent for approval.` });
      await onSubmitted();
    } finally {
      setIsSaving(false);
    }
  };

  const fieldError = (key: string) => errors[key] && <p className="text-xs font-medium text-destructive">{errors[key]}</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <NarrativeField label="Plan up to the period">
          <MetricStatic>{formatTargetValue(row.planToDate, targetType)}</MetricStatic>
        </NarrativeField>
        <NarrativeField label={`Actual up to the period ${unit && `(${unit}) `}*`} htmlFor={`actual-${entry.id}`}>
          <Input id={`actual-${entry.id}`} type="number" min={0} step="any" value={actual} onChange={(e) => { setActual(e.target.value); setErrors(({ actualToDate, ...rest }) => rest); }} className={cn("h-9", errors.actualToDate && "border-destructive")} />
          {fieldError('actualToDate')}
        </NarrativeField>
        <NarrativeField label="%age Achiev't">
          <MetricStatic tone={row.planToDate > 0 ? (row.isBehindPlan ? "danger" : "success") : undefined}>
            {row.planToDate > 0 ? formatRatio(row.achievement) : 'No plan yet'}
          </MetricStatic>
        </NarrativeField>
        <NarrativeField label={`Completion date${reachedTarget ? ' *' : ''}`} htmlFor={`completion-${entry.id}`}>
          <Input id={`completion-${entry.id}`} type="date" value={completionDate} onChange={(e) => { setCompletionDate(e.target.value); setErrors(({ completionDate, ...rest }) => rest); }} className={cn("h-9", errors.completionDate && "border-destructive")} />
          {fieldError('completionDate')}
        </NarrativeField>
      </div>

      <NarrativeSection>
        <NarrativeField label="Accomplished tasks & key achievements (outputs) for the reporting period" htmlFor={`accomplished-${entry.id}`}>
          <Textarea id={`accomplished-${entry.id}`} rows={3} value={accomplished} onChange={(e) => setAccomplished(e.target.value)} />
          {fieldError('accomplishedTasks')}
        </NarrativeField>
        <div className="grid gap-4 sm:grid-cols-2">
          <NarrativeField label={`Reasons for variation${row.isBehindPlan ? ' *' : ''}`} htmlFor={`reason-${entry.id}`}>
            <Textarea id={`reason-${entry.id}`} rows={3} value={reason} onChange={(e) => { setReason(e.target.value); setErrors(({ reasonForVariation, ...rest }) => rest); }} className={cn(errors.reasonForVariation && "border-destructive")} placeholder={row.isBehindPlan ? 'Why is the actual below plan?' : undefined} />
            {fieldError('reasonForVariation')}
          </NarrativeField>
          <NarrativeField label={`The way forward${row.isBehindPlan ? ' *' : ''}`} htmlFor={`way-${entry.id}`}>
            <Textarea id={`way-${entry.id}`} rows={3} value={wayForward} onChange={(e) => { setWayForward(e.target.value); setErrors(({ wayForward, ...rest }) => rest); }} className={cn(errors.wayForward && "border-destructive")} placeholder={row.isBehindPlan ? 'What will be done to catch up?' : undefined} />
            {fieldError('wayForward')}
          </NarrativeField>
        </div>
        <NarrativeField label="Issues that need escalation" htmlFor={`escalation-${entry.id}`}>
          <Textarea id={`escalation-${entry.id}`} rows={2} value={escalation} onChange={(e) => setEscalation(e.target.value)} />
          {fieldError('escalationIssues')}
        </NarrativeField>
      </NarrativeSection>

      <ReportEvidence entryId={entry.id} files={entry.evidence ?? []} editable />
      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-4">
        <p className="text-xs text-muted-foreground">* required{row.isBehindPlan ? ' — reasons and the way forward are required because the actual is below plan.' : ''}</p>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit report
        </Button>
      </div>
    </div>
  );
}

/** A submitted or approved report, read-only. */
function ReportSummaryView({ entry }: { entry: PeriodReportEntry }) {
  const targetType = entry.activity.targetType;
  const row = computeReportRow(
    { weight: entry.activity.weight, countsTowardWeight: entry.activity.countsTowardWeight, targetType, annualTarget: entry.activity.annualTarget, targetAggregation: entry.activity.targetAggregation, targetDirection: entry.activity.targetDirection, monthlyTargets: entry.activity.monthlyTargets },
    { actualToDate: entry.actualToDate, completionDate: entry.completionDate },
    entry.reportingPeriod.endDate
  );
  const note = (label: string, value: React.ReactNode) => (
    <NarrativeField label={label}>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{value || '—'}</p>
    </NarrativeField>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <NarrativeField label="Plan up to the period">
          <MetricStatic>{formatTargetValue(row.planToDate, targetType)}</MetricStatic>
        </NarrativeField>
        <NarrativeField label="Actual up to the period">
          <MetricStatic>{entry.actualToDate != null ? formatTargetValue(entry.actualToDate, targetType) : '—'}</MetricStatic>
        </NarrativeField>
        <NarrativeField label="%age Achiev't">
          <MetricStatic tone={row.planToDate > 0 ? (row.isBehindPlan ? "danger" : "success") : undefined}>
            {row.planToDate > 0 ? formatRatio(row.achievement) : '—'}
          </MetricStatic>
        </NarrativeField>
        <NarrativeField label="Completion date">
          <MetricStatic>{entry.completionDate ? format(new Date(entry.completionDate), 'PP') : '—'}</MetricStatic>
        </NarrativeField>
      </div>

      <NarrativeSection>
        {note('Accomplished tasks & key achievements', entry.comment)}
        <div className="grid gap-4 sm:grid-cols-2">
          {note('Reasons for variation', entry.reasonForVariation)}
          {note('The way forward', entry.wayForward)}
        </div>
        {note('Issues that need escalation', entry.escalationIssues)}
      </NarrativeSection>

      <ReportEvidence entryId={entry.id} files={entry.evidence ?? []} />
    </div>
  );
}

/** The panel body for one report: the form while it can be filled in, otherwise the read-only summary. */
function ReportDetail({ entry, onChanged }: { entry: PeriodReportEntry; onChanged: () => Promise<void> }) {
  const closed = isPeriodClosedForSubmissions(entry.reportingPeriod);
  const { can } = usePermissions();
  const editable = can('my-reports:submit') && isEditableStatus(entry) && !closed;

  return (
    <div className="space-y-4">
      {entry.reportStatus === 'RETURNED' && entry.declineReason && (
        <Alert className="border-red-400/30 bg-red-500/[0.06] text-red-800 [&>svg]:text-red-600">
          <AlertCircle className="h-4 w-4" /><AlertDescription><span className="font-semibold">Returned by approver:</span> {entry.declineReason}</AlertDescription>
        </Alert>
      )}
      {editable
        ? <ReportForm key={entry.id} entry={entry} onSubmitted={onChanged} />
        : <>
            {closed && isEditableStatus(entry) && (
              <p className="text-sm text-destructive">This period is closed or past its cut-off date, so this report can no longer be submitted.</p>
            )}
            {(entry.reportStatus === 'SUBMITTED' || entry.reportStatus === 'APPROVED') && <ReportSummaryView entry={entry} />}
          </>}
    </div>
  );
}

/** One compact row per report; the numbers are the same ones the panel shows. */
function ReportListRow({ entry, selected, onOpen }: { entry: PeriodReportEntry; selected: boolean; onOpen: () => void }) {
  const row = approvedRow(entry);
  const t = entry.activity.targetType;
  const hasActual = entry.actualToDate != null;
  return (
    <ReportRow selected={selected} onOpen={onOpen} label={`Open report for ${entry.activity.title}`}>
      <ReportActivityCell entry={entry} />
      <td className="hidden w-24 px-4 py-3 text-right tabular-nums text-foreground/90 md:table-cell">{formatTargetValue(row.planToDate, t)}</td>
      <td className="hidden w-24 px-4 py-3 text-right tabular-nums text-foreground/90 md:table-cell">{hasActual ? formatTargetValue(entry.actualToDate!, t) : '—'}</td>
      <td className={cn("hidden w-24 px-4 py-3 text-right font-medium tabular-nums sm:table-cell", hasActual && row.planToDate > 0 ? (row.isBehindPlan ? "text-red-700" : "text-emerald-700") : "text-muted-foreground")}>
        {hasActual && row.planToDate > 0 ? formatRatio(row.achievement) : '—'}
      </td>
      <td className="w-px whitespace-nowrap px-4 py-3 text-right"><ReportStatusBadge status={entry.reportStatus} /></td>
    </ReportRow>
  );
}

const isEditableStatus = (e: PeriodReportEntry) => e.reportStatus === 'REQUESTED' || e.reportStatus === 'RETURNED';
const periodOpen = (e: PeriodReportEntry) => !isPeriodClosedForSubmissions(e.reportingPeriod);

function approvedRow(e: PeriodReportEntry) {
  const a = e.activity;
  return computeReportRow(
    { weight: a.weight, countsTowardWeight: a.countsTowardWeight, targetType: a.targetType, annualTarget: a.annualTarget, targetAggregation: a.targetAggregation, targetDirection: a.targetDirection, monthlyTargets: a.monthlyTargets },
    { actualToDate: e.actualToDate, completionDate: e.completionDate },
    e.reportingPeriod.endDate
  );
}

/** Approved, and the activity reported as finished (a completion date is required once the annual target is reached). */
const isCompletedAsPerTarget = (e: PeriodReportEntry) => e.reportStatus === 'APPROVED' && !!e.completionDate;

type ReportFilter = 'all' | 'toFill' | 'returned' | 'overdue' | 'waiting' | 'approved' | 'completed' | 'behind';

const ALL_PERIODS = 'all';

const REPORT_FILTERS: { id: ReportFilter; label: string; short: string; icon: React.ReactNode; test: (e: PeriodReportEntry) => boolean }[] = [
  { id: 'all', label: 'All reports', short: 'Requested from you', icon: <List className="h-3.5 w-3.5 text-muted-foreground" />, test: () => true },
  { id: 'toFill', label: 'Not started', short: 'To fill in before the cut-off', icon: <PencilLine className="h-3.5 w-3.5 text-amber-600" />, test: e => e.reportStatus === 'REQUESTED' && periodOpen(e) },
  { id: 'returned', label: 'Returned', short: 'Sent back — fix and resubmit', icon: <Undo2 className="h-3.5 w-3.5 text-red-600" />, test: e => e.reportStatus === 'RETURNED' && periodOpen(e) },
  { id: 'overdue', label: 'Overdue', short: 'Cut-off passed, not submitted', icon: <AlertTriangle className="h-3.5 w-3.5 text-red-600" />, test: e => isEditableStatus(e) && !periodOpen(e) },
  { id: 'waiting', label: 'Waiting for approval', short: 'Submitted, with an approver', icon: <Hourglass className="h-3.5 w-3.5 text-blue-600" />, test: e => e.reportStatus === 'SUBMITTED' },
  { id: 'approved', label: 'Approved', short: 'Counted on the plan', icon: <Check className="h-3.5 w-3.5 text-emerald-600" />, test: e => e.reportStatus === 'APPROVED' },
  { id: 'completed', label: 'Completed as per target', short: 'Approved and finished', icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />, test: isCompletedAsPerTarget },
  { id: 'behind', label: 'Behind plan', short: 'Approved, actual below plan', icon: <TrendingDown className="h-3.5 w-3.5 text-amber-600" />, test: e => e.reportStatus === 'APPROVED' && approvedRow(e).isBehindPlan },
];
/** Reporting → My Reports: every period report requested from the current user, newest period first. */
export function MyActivityReportList({ initialEntries }: { initialEntries?: PeriodReportEntry[] }) {
  // Server-rendered pages pass the first load in; the list only fetches itself to refresh after a submit.
  const [entries, setEntries] = React.useState<PeriodReportEntry[] | null>(initialEntries ?? null);
  const [filter, setFilter] = React.useState<ReportFilter>('all');

  const load = React.useCallback(async () => {
    setEntries(await getMyPeriodReports());
  }, []);

  React.useEffect(() => { if (!initialEntries) load(); }, [initialEntries, load]);

  const [query, setQuery] = React.useState('');
  const [range, setRange] = React.useState<DateRangeValue>({});
  const [periodId, setPeriodId] = React.useState(ALL_PERIODS);
  const narrowed = query.trim() !== '' || isRangeSet(range) || periodId !== ALL_PERIODS;
  // The reporting periods that actually have a report requested from this user, newest first.
  const periods = React.useMemo(() => {
    const map = new Map<string, PeriodReportEntry['reportingPeriod']>();
    for (const e of entries ?? []) map.set(e.reportingPeriod.id, e.reportingPeriod);
    return [...map.values()].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [entries]);
  // Search, dates and the reporting period narrow everything below, the category tiles included.
  const matching = React.useMemo(() => (entries ?? []).filter(e =>
    (periodId === ALL_PERIODS || e.reportingPeriod.id === periodId) &&
    overlapsDateRange(e.reportingPeriod.startDate, e.reportingPeriod.endDate, range) &&
    matchesSearch(query, e.activity.title, e.activity.initiative?.title, e.activity.deliverable, e.reportingPeriod.name)
  ), [entries, query, range, periodId]);
  const activeTest = REPORT_FILTERS.find(f => f.id === filter)!.test;
  const inCategory = React.useMemo(() => matching.filter(activeTest), [matching, activeTest]);
  const selection = useReportSelection(inCategory, entries ?? []);
  const pagination = usePagination(inCategory, `${filter}|${query}|${range.from}|${range.to}|${periodId}`);

  const { index: selectedIndex } = selection;
  const { pageSize, setPage } = pagination;
  React.useEffect(() => {
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / pageSize) + 1);
  }, [selectedIndex, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  if (entries == null) {
    return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports…</p>;
  }

  const counts = Object.fromEntries(REPORT_FILTERS.map(f => [f.id, matching.filter(e => f.test(e)).length])) as Record<ReportFilter, number>;
  const activeFilter = REPORT_FILTERS.find(f => f.id === filter)!;
  const shown = pagination.items;

  // Group this page's reports under their period.
  const byPeriod = new Map<string, PeriodReportEntry[]>();
  for (const e of shown) byPeriod.set(e.reportingPeriod.id, [...(byPeriod.get(e.reportingPeriod.id) ?? []), e]);
  const toFill = entries.filter(e => (e.reportStatus === 'REQUESTED' || e.reportStatus === 'RETURNED') && !isPeriodClosedForSubmissions(e.reportingPeriod)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">Period Reports</h2>
        {entries.length > 0 ? (
          <span className={cn("text-sm", toFill > 0 ? "text-primary" : "text-muted-foreground")}>
            · {toFill > 0 ? `${toFill} ${toFill === 1 ? 'report needs' : 'reports need'} to be filled in` : 'nothing waiting on you'}
          </span>
        ) : null}
      </div>
      {entries.length === 0 && (
        <EmptyState
          art="writing"
          title="No reports to write yet"
          description="When a reporting period opens and a report is requested for one of your activities, it will appear here for you to fill in."
          className="rounded-xl border border-dashed border-border/70 bg-card/60"
        />
      )}
      {entries.length > 0 && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/50 bg-border/50 sm:grid-cols-4" role="tablist" aria-label="Filter reports">
            {REPORT_FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "bg-card px-4 py-3.5 text-left transition-colors",
                  filter === f.id ? "bg-primary/[0.05]" : "hover:bg-muted/40"
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {f.icon}
                  {f.label}
                </span>
                <span className={cn("mt-2 block text-2xl font-bold leading-none tracking-tight", filter === f.id ? "text-primary" : "text-foreground")}>
                  {counts[f.id]}
                </span>
                <span className="mt-1.5 block text-xs text-muted-foreground">{f.short}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {entries.length > 0 && (
        <ListToolbar count={<>{narrowed && `${matching.length} of ${entries.length} match · `}Showing <span className="font-medium text-foreground">{activeFilter.label.toLowerCase()}</span> ({pagination.total}){filter !== 'all' && <> · <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setFilter('all')}>show all</button></>}</>}>
          <SearchBox value={query} onChange={setQuery} placeholder="Search activity, initiative or period" className="sm:w-80" />
          <Select value={periodId} onValueChange={setPeriodId}>
            <SelectTrigger className="h-9 w-full sm:w-64" aria-label="Reporting period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PERIODS}>All reporting periods</SelectItem>
              {periods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateRangeFilter value={range} onChange={setRange} label="Any dates" hint="Shows reports for periods that fall in this range." />
          {narrowed && <Button variant="ghost" className="h-9 px-3" onClick={() => { setQuery(''); setRange({}); setPeriodId(ALL_PERIODS); }}>Reset</Button>}
        </ListToolbar>
      )}
      {entries.length > 0 && pagination.total === 0 && (
        <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground">{narrowed ? 'No reports in this category match the search or dates.' : 'No reports in this category.'}</p></CardContent></Card>
      )}
      {Array.from(byPeriod.values()).map(periodEntries => {
        const period = periodEntries[0].reportingPeriod;
        return (
          <section key={period.id} className="space-y-3">
            <div className="flex items-center gap-1.5 border-b border-border/50 px-0.5 pb-2">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground">
                      {period.name}
                      <Info className="h-3 w-3 text-muted-foreground/60" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" className="max-w-xs space-y-1 text-xs">
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(period.startDate), 'PP')} – {format(new Date(period.endDate), 'PP')}
                    </p>
                    <p className="text-muted-foreground">Submit by {format(new Date(period.cutOffDate), 'PP')}</p>
                    {period.reportRequestMessage && (
                      <p className="whitespace-pre-wrap border-t pt-1 text-muted-foreground">{period.reportRequestMessage}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr>
                    <ReportTh>Activity</ReportTh>
                    <ReportTh className="hidden w-24 text-right md:table-cell">Plan</ReportTh>
                    <ReportTh className="hidden w-24 text-right md:table-cell">Actual</ReportTh>
                    <ReportTh className="hidden w-24 text-right sm:table-cell">Achiev't</ReportTh>
                    <ReportTh className="w-[13rem] text-right">Status</ReportTh>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {periodEntries.map(e => <ReportListRow key={e.id} entry={e} selected={selection.selectedId === e.id} onOpen={() => selection.open(e.id)} />)}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <Pagination state={pagination} noun="reports" />

      <ReportDrawer
        entry={selection.selected}
        open={selection.selected !== null}
        onOpenChange={o => { if (!o) selection.close(); }}
        badge={selection.selected && <ReportStatusBadge status={selection.selected.reportStatus} />}
        meta={selection.selected && <>Submit by {format(new Date(selection.selected.reportingPeriod.cutOffDate), 'PP')}</>}
        index={selection.index}
        count={selection.count}
        onPrev={selection.prev}
        onNext={selection.next}
      >
        {selection.selected && <ReportDetail entry={selection.selected} onChanged={load} />}
      </ReportDrawer>
    </div>
  );
}
