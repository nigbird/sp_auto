"use client"

import * as React from "react";
import { format } from "date-fns";
import { AlertCircle, Check, ClipboardList, Loader2, ShieldQuestion, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Alert, AlertDescription } from "../ui/alert";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getMyPeriodReports, submitPeriodReport } from "@/actions/period-reports";
import { isPeriodClosedForSubmissions } from "@/lib/reporting-period";
import { formatTargetValue, type TargetAggregation, type TargetType } from "@/lib/monthly-breakdown";
import { computeReportRow, formatRatio } from "@/lib/report-calculations";

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
    case 'APPROVED': return <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
    case 'SUBMITTED': return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-500/10"><ShieldQuestion className="h-3 w-3 mr-1" />Waiting for approval</Badge>;
    case 'RETURNED': return <Badge variant="destructive"><ShieldX className="h-3 w-3 mr-1" />Returned — needs changes</Badge>;
    default: return <Badge variant="outline">To fill in</Badge>;
  }
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <Label>Plan up to the reporting period</Label>
          <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3 text-sm font-semibold">{formatTargetValue(row.planToDate, targetType)}</div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`actual-${entry.id}`}>Actual up to the reporting period {unit && `(${unit})`} *</Label>
          <Input id={`actual-${entry.id}`} type="number" min={0} step="any" value={actual} onChange={(e) => { setActual(e.target.value); setErrors(({ actualToDate, ...rest }) => rest); }} className={cn(errors.actualToDate && "border-destructive")} />
          {fieldError('actualToDate')}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`completion-${entry.id}`}>Completion date {reachedTarget && '*'}</Label>
          <Input id={`completion-${entry.id}`} type="date" value={completionDate} onChange={(e) => { setCompletionDate(e.target.value); setErrors(({ completionDate, ...rest }) => rest); }} className={cn(errors.completionDate && "border-destructive")} />
          {fieldError('completionDate')}
        </div>
        <div className="space-y-1">
          <Label>%age Achiev&apos;t</Label>
          <div className={cn("flex h-10 items-center rounded-md border px-3 text-sm font-semibold", row.isBehindPlan ? "text-destructive" : "text-green-600")}>
            {row.planToDate > 0 ? formatRatio(row.achievement) : 'No plan for this period yet'}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`accomplished-${entry.id}`}>Accomplished tasks &amp; key achievements (outputs) for the reporting period</Label>
        <Textarea id={`accomplished-${entry.id}`} rows={3} value={accomplished} onChange={(e) => setAccomplished(e.target.value)} />
        {fieldError('accomplishedTasks')}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor={`reason-${entry.id}`}>Reasons for variation {row.isBehindPlan && '*'}</Label>
          <Textarea id={`reason-${entry.id}`} rows={3} value={reason} onChange={(e) => { setReason(e.target.value); setErrors(({ reasonForVariation, ...rest }) => rest); }} className={cn(errors.reasonForVariation && "border-destructive")} placeholder={row.isBehindPlan ? 'Why is the actual below plan?' : undefined} />
          {fieldError('reasonForVariation')}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`way-${entry.id}`}>The way forward {row.isBehindPlan && '*'}</Label>
          <Textarea id={`way-${entry.id}`} rows={3} value={wayForward} onChange={(e) => { setWayForward(e.target.value); setErrors(({ wayForward, ...rest }) => rest); }} className={cn(errors.wayForward && "border-destructive")} placeholder={row.isBehindPlan ? 'What will be done to catch up?' : undefined} />
          {fieldError('wayForward')}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`escalation-${entry.id}`}>Issues that need escalation</Label>
        <Textarea id={`escalation-${entry.id}`} rows={2} value={escalation} onChange={(e) => setEscalation(e.target.value)} />
        {fieldError('escalationIssues')}
      </div>
      <div className="flex items-center justify-between gap-2">
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
  const item = (label: string, value: React.ReactNode) => (
    <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm whitespace-pre-wrap">{value || '—'}</p></div>
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {item('Plan up to the period', formatTargetValue(row.planToDate, targetType))}
      {item('Actual up to the period', entry.actualToDate != null ? formatTargetValue(entry.actualToDate, targetType) : null)}
      {item("%age Achiev't", formatRatio(row.achievement))}
      {item('Completion date', entry.completionDate ? format(new Date(entry.completionDate), 'PP') : null)}
      <div className="col-span-2 md:col-span-4">{item('Accomplished tasks & key achievements', entry.comment)}</div>
      <div className="col-span-2">{item('Reasons for variation', entry.reasonForVariation)}</div>
      <div className="col-span-2">{item('The way forward', entry.wayForward)}</div>
      <div className="col-span-2 md:col-span-4">{item('Issues that need escalation', entry.escalationIssues)}</div>
    </div>
  );
}

function ReportCard({ entry, onChanged }: { entry: PeriodReportEntry; onChanged: () => Promise<void> }) {
  const { activity, reportingPeriod: period } = entry;
  const closed = isPeriodClosedForSubmissions(period);
  const editable = (entry.reportStatus === 'REQUESTED' || entry.reportStatus === 'RETURNED') && !closed;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="space-y-1">
          <h3 className="font-semibold">{activity.title}</h3>
          {activity.initiative && <p className="text-xs text-muted-foreground">{activity.initiative.objective.pillar.title} → {activity.initiative.title}</p>}
          <p className="text-xs text-muted-foreground">
            {format(new Date(activity.startDate), 'PP')} – {format(new Date(activity.endDate), 'PP')} · Target {activity.annualTarget != null ? formatTargetValue(activity.annualTarget, activity.targetType) : '—'}
          </p>
          {activity.deliverable && <p className="text-sm"><span className="font-medium">Deliverable:</span> {activity.deliverable}</p>}
        </div>
        <ReportStatusBadge status={entry.reportStatus} />
      </CardHeader>
      <CardContent className="space-y-4">
        {entry.reportStatus === 'RETURNED' && entry.declineReason && (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription><span className="font-semibold">Returned by approver:</span> {entry.declineReason}</AlertDescription></Alert>
        )}
        {editable
          ? <ReportForm entry={entry} onSubmitted={onChanged} />
          : <>
              {closed && (entry.reportStatus === 'REQUESTED' || entry.reportStatus === 'RETURNED') && (
                <p className="text-sm text-destructive">This period is closed or past its cut-off date, so this report can no longer be submitted.</p>
              )}
              {(entry.reportStatus === 'SUBMITTED' || entry.reportStatus === 'APPROVED') && <ReportSummaryView entry={entry} />}
            </>}
      </CardContent>
    </Card>
  );
}

/** Reporting → My Reports: every period report requested from the current user, newest period first. */
export function MyActivityReportList({ initialEntries }: { initialEntries?: PeriodReportEntry[] }) {
  // Server-rendered pages pass the first load in; the list only fetches itself to refresh after a submit.
  const [entries, setEntries] = React.useState<PeriodReportEntry[] | null>(initialEntries ?? null);

  const load = React.useCallback(async () => {
    setEntries(await getMyPeriodReports());
  }, []);

  React.useEffect(() => { if (!initialEntries) load(); }, [initialEntries, load]);

  if (entries == null) {
    return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports…</p>;
  }

  const byPeriod = new Map<string, PeriodReportEntry[]>();
  for (const e of entries) byPeriod.set(e.reportingPeriod.id, [...(byPeriod.get(e.reportingPeriod.id) ?? []), e]);
  const toFill = entries.filter(e => (e.reportStatus === 'REQUESTED' || e.reportStatus === 'RETURNED') && !isPeriodClosedForSubmissions(e.reportingPeriod)).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-xl font-bold"><ClipboardList className="text-muted-foreground" /> Period Reports</h2>
        <p className="text-sm text-muted-foreground">
          {entries.length === 0
            ? 'No reports have been requested from you yet. They appear here when a reporting period is opened for reporting.'
            : toFill > 0 ? `${toFill} ${toFill === 1 ? 'report needs' : 'reports need'} to be filled in.` : 'Nothing is waiting on you right now.'}
        </p>
      </div>
      {Array.from(byPeriod.values()).map(periodEntries => {
        const period = periodEntries[0].reportingPeriod;
        return (
          <section key={period.id} className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-semibold">{period.name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(period.startDate), 'PP')} – {format(new Date(period.endDate), 'PP')} · Submit by {format(new Date(period.cutOffDate), 'PP')}
              </p>
              {period.reportRequestMessage && <p className="mt-1 text-sm whitespace-pre-wrap">{period.reportRequestMessage}</p>}
            </div>
            {periodEntries.map(e => <ReportCard key={e.id} entry={e} onChanged={load} />)}
          </section>
        );
      })}
    </div>
  );
}
