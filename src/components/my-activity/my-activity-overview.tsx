"use client"

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle, ArrowRight, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronUp, ClipboardList,
  FileText, Hourglass, List, Paperclip, ShieldQuestion, ShieldX, X,
} from "lucide-react";
import type { Activity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isPeriodClosedForSubmissions } from "@/lib/reporting-period";
import { monthKey, monthsBetween, type TargetAggregation, type TargetType } from "@/lib/monthly-breakdown";
import { getEvidenceList, uploadEvidence, deleteEvidence, type EvidenceMeta } from "@/actions/evidence";
import { toggleDeliverableDelivered } from "@/actions/deliverables";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";
import { BreakdownStrip } from "./breakdown-editor";

/** The latest requested period report for an activity (from getMyPeriodReports). */
export interface LatestReport {
  id: string;
  activityId: string;
  reportStatus: 'REQUESTED' | 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  declineReason: string | null;
  reportingPeriod: { name: string; endDate: string; cutOffDate: string; status: 'OPEN' | 'CLOSED' };
}

type Step = { label: string; tone: 'done' | 'waiting' | 'todo' | 'problem' | 'none'; detail?: string | null };
type NextAction = 'breakdown' | 'report' | 'resubmit' | null;

export type OverviewFilter = 'todo' | 'waiting' | 'behind' | 'completed' | 'all';

const isRequestOpen = (a: Activity) => a.planRequestStatus === 'SENT' || a.planRequestStatus === 'ACCEPTED';
const isCompleted = (a: Activity) => a.status === 'Completed As Per Target' || a.progress >= 100;
const isOverdue = (a: Activity) => !isCompleted(a) && new Date(a.endDate) < new Date();
const isBehind = (a: Activity) => !isCompleted(a) && (isOverdue(a) || a.status === 'Delayed');

function activityStep(a: Activity): Step {
  if (a.approvalStatus === 'APPROVED') return { label: 'Approved', tone: 'done' };
  if (a.approvalStatus === 'DECLINED') return { label: 'Declined', tone: 'problem', detail: a.declineReason };
  return { label: 'Waiting for approval', tone: 'waiting' };
}

function breakdownStep(a: Activity): Step {
  if (a.planSubmissionStatus === 'APPROVED') return { label: 'Approved', tone: 'done' };
  if (a.planSubmissionStatus === 'PENDING') return { label: 'Waiting for approval', tone: 'waiting' };
  if (a.planSubmissionStatus === 'DECLINED') return { label: 'Returned — needs changes', tone: 'problem', detail: a.planDeclineReason };
  if (isRequestOpen(a)) return { label: 'To fill in', tone: 'todo' };
  if (a.planRequestStatus === 'DECLINED') return { label: 'Request declined', tone: 'problem', detail: a.planRequestDeclineReason };
  return { label: 'Not requested yet', tone: 'none' };
}

function reportStep(report: LatestReport | undefined): Step {
  if (!report) return { label: 'None requested yet', tone: 'none' };
  const period = report.reportingPeriod.name;
  switch (report.reportStatus) {
    case 'APPROVED': return { label: `${period}: approved`, tone: 'done' };
    case 'SUBMITTED': return { label: `${period}: waiting for approval`, tone: 'waiting' };
    case 'RETURNED': return { label: `${period}: returned`, tone: 'problem', detail: report.declineReason };
    default:
      return isPeriodClosedForSubmissions(report.reportingPeriod)
        ? { label: `${period}: missed (period closed)`, tone: 'problem' }
        : { label: `${period}: to submit by ${format(new Date(report.reportingPeriod.cutOffDate), "MMM d")}`, tone: 'todo' };
  }
}

function nextAction(a: Activity, report: LatestReport | undefined): NextAction {
  if (a.approvalStatus === 'DECLINED') return 'resubmit';
  if (isRequestOpen(a) && (a.planSubmissionStatus == null || a.planSubmissionStatus === 'DECLINED')) return 'breakdown';
  if (report && (report.reportStatus === 'RETURNED' || (report.reportStatus === 'REQUESTED' && !isPeriodClosedForSubmissions(report.reportingPeriod)))) return 'report';
  return null;
}

const isWaiting = (a: Activity, report: LatestReport | undefined) =>
  a.approvalStatus === 'PENDING' || a.planSubmissionStatus === 'PENDING' || report?.reportStatus === 'SUBMITTED';

const TONE_CLASS: Record<Step['tone'], string> = {
  done: 'border-green-500 text-green-700 bg-green-500/10',
  waiting: 'border-blue-500 text-blue-700 bg-blue-500/10',
  todo: 'border-amber-500 text-amber-700 bg-amber-500/10',
  problem: 'border-destructive text-destructive bg-destructive/10',
  none: 'text-muted-foreground',
};

const TONE_ICON: Record<Step['tone'], React.ReactNode> = {
  done: <Check className="h-3 w-3" />,
  waiting: <ShieldQuestion className="h-3 w-3" />,
  todo: <CalendarClock className="h-3 w-3" />,
  problem: <ShieldX className="h-3 w-3" />,
  none: null,
};

function StepChip({ name, step }: { name: string; step: Step }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{name}</p>
      <Badge variant="outline" className={cn("gap-1 font-normal", TONE_CLASS[step.tone])} title={step.detail ?? undefined}>
        {TONE_ICON[step.tone]}{step.label}
      </Badge>
    </div>
  );
}

function StatusBadge({ activity }: { activity: Activity }) {
  if (activity.approvalStatus !== 'APPROVED') return null;
  if (isCompleted(activity)) return <Badge variant="outline" className="border-green-500 text-green-700 bg-green-500/10">Completed</Badge>;
  if (isOverdue(activity)) return <Badge variant="destructive">Overdue</Badge>;
  if (activity.status === 'Delayed') return <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10">Delayed</Badge>;
  if (activity.status === 'On Track') return <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-500/10">On Track</Badge>;
  return <Badge variant="outline">Not Started</Badge>;
}

function ActionButton({ action, onOpenBreakdown, onEdit }: { action: NextAction; onOpenBreakdown: () => void; onEdit: () => void }) {
  if (action === 'breakdown') return <Button size="sm" onClick={onOpenBreakdown}>Fill in breakdown <ArrowRight className="ml-1 h-4 w-4" /></Button>;
  if (action === 'report') return <Button size="sm" asChild><Link href="/reports/submit">Submit report <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>;
  if (action === 'resubmit') return <Button size="sm" variant="outline" onClick={onEdit}>Edit & resubmit</Button>;
  return null;
}

function ActivityCard({ activity, initiativeTitle, report, onOpenBreakdown, onEdit }: {
  activity: Activity;
  initiativeTitle?: string;
  report?: LatestReport;
  onOpenBreakdown: () => void;
  onEdit: (activity: Activity) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [evidence, setEvidence] = React.useState<EvidenceMeta[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);
  const [deliverables, setDeliverables] = React.useState(activity.deliverables ?? []);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) getEvidenceList(activity.id).then(setEvidence);
  }, [isOpen, activity.id]);

  const showError = (err: unknown, fallback: string) =>
    toast({ title: "Something went wrong", description: err instanceof Error ? err.message : fallback, variant: "destructive" });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await uploadEvidence(activity.id, formData);
      setEvidence(await getEvidenceList(activity.id));
    } catch (err) {
      showError(err, 'Failed to upload file.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveEvidence = async (id: string) => {
    await deleteEvidence(id);
    setEvidence(prev => prev.filter(ev => ev.id !== id));
  };

  const handleToggleDeliverable = async (id: string, delivered: boolean) => {
    setDeliverables(prev => prev.map(d => (d.id === id ? { ...d, isDelivered: delivered } : d)));
    try {
      await toggleDeliverableDelivered(id, delivered);
    } catch (err) {
      setDeliverables(prev => prev.map(d => (d.id === id ? { ...d, isDelivered: !delivered } : d)));
      showError(err, 'Failed to update deliverable.');
    }
  };

  const action = nextAction(activity, report);
  const monthlyTargets = (activity.monthlyTargets ?? []).map(t => ({ month: monthKey(t.month), value: t.value }));
  const hasBreakdown = activity.targetType && activity.annualTarget != null && monthlyTargets.length > 0;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{activity.title}</h3>
              <StatusBadge activity={activity} />
            </div>
            {initiativeTitle && <p className="text-xs text-muted-foreground">Initiative: {initiativeTitle}</p>}
            <p className="text-sm text-muted-foreground">
              {format(new Date(activity.startDate), "PP")} – {format(new Date(activity.endDate), "PP")} · Weight {activity.weight}%
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-bold">{Math.round(activity.progress)}%</p>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={isOpen ? "Collapse" : "Expand"}>
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={activity.progress} className="h-2" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
              <StepChip name="1. Activity" step={activityStep(activity)} />
              <StepChip name="2. Monthly breakdown" step={breakdownStep(activity)} />
              <StepChip name="3. Latest report" step={reportStep(report)} />
            </div>
            <ActionButton action={action} onOpenBreakdown={onOpenBreakdown} onEdit={() => onEdit(activity)} />
          </div>
        </CardContent>
        <CollapsibleContent>
          <CardContent className="space-y-4 border-t pt-4">
            {activity.approvalStatus === 'DECLINED' && activity.declineReason && (
              <p className="text-sm text-destructive"><span className="font-medium">Declined:</span> {activity.declineReason}</p>
            )}
            {activity.deliverable && <p className="text-sm"><span className="font-medium">Deliverable:</span> {activity.deliverable}</p>}

            {hasBreakdown ? (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Annual target:</span> {activity.annualTarget}{activity.targetType === 'PERCENT' ? '%' : ''}
                </p>
                <BreakdownStrip
                  months={monthsBetween(activity.startDate, activity.endDate)}
                  entries={monthlyTargets}
                  targetType={activity.targetType as TargetType}
                  annualTarget={activity.annualTarget!}
                  aggregation={(activity.targetAggregation ?? 'CUMULATIVE') as TargetAggregation}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No monthly breakdown yet.</p>
            )}

            {deliverables.length > 0 && (
              <div className="space-y-2 rounded-lg border p-4">
                <Label>Deliverables</Label>
                <ul className="space-y-2">
                  {deliverables.map(d => (
                    <li key={d.id} className="flex items-center gap-2">
                      <Checkbox checked={d.isDelivered} onCheckedChange={checked => handleToggleDeliverable(d.id, checked === true)} />
                      <span className={cn("text-sm", d.isDelivered && "text-muted-foreground line-through")}>{d.title}</span>
                      {d.dueDate && <span className="text-xs text-muted-foreground">(due {format(new Date(d.dueDate), "PP")})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-4">
              <Label htmlFor={`evidence-${activity.id}`}>Supporting evidence</Label>
              <Input id={`evidence-${activity.id}`} type="file" onChange={handleUpload} disabled={isUploading} />
              {evidence.length > 0 && (
                <ul className="space-y-1">
                  {evidence.map(ev => (
                    <li key={ev.id} className="flex items-center justify-between rounded-md border px-2 py-1 text-sm">
                      <a href={`/api/evidence/${ev.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        <Paperclip className="h-3 w-3" /> {ev.fileName}
                      </a>
                      <Button size="icon" variant="ghost" onClick={() => handleRemoveEvidence(ev.id)} aria-label={`Remove ${ev.fileName}`}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

const FILTERS: { id: OverviewFilter; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'todo', label: 'Needs your action', hint: 'Breakdowns and reports to fill in', icon: <ClipboardList className="h-4 w-4 text-amber-600" /> },
  { id: 'waiting', label: 'Waiting for approval', hint: 'Submitted, with an approver', icon: <Hourglass className="h-4 w-4 text-blue-600" /> },
  { id: 'behind', label: 'Behind schedule', hint: 'Delayed or past the end date', icon: <AlertTriangle className="h-4 w-4 text-destructive" /> },
  { id: 'completed', label: 'Completed', hint: 'Reported as done', icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
  { id: 'all', label: 'All my activities', hint: 'Everything assigned to you', icon: <List className="h-4 w-4 text-muted-foreground" /> },
];

/**
 * The "My Activities" tab of My Plan: each activity the user is responsible
 * for, where it stands in the plan → breakdown → report flow, and the one
 * thing (if any) they need to do next.
 */
export function MyActivityOverview({ activities, reports, initiativeTitles, onOpenBreakdown, onEdit }: {
  activities: Activity[];
  reports: LatestReport[];
  initiativeTitles: Map<string, string>;
  onOpenBreakdown: () => void;
  onEdit: (activity: Activity) => void;
}) {
  const latestByActivity = React.useMemo(() => {
    // Reports arrive newest period first, so the first one per activity is the latest.
    const map = new Map<string, LatestReport>();
    reports.forEach(r => { if (!map.has(r.activityId)) map.set(r.activityId, r); });
    return map;
  }, [reports]);

  const groups = React.useMemo(() => {
    const report = (a: Activity) => latestByActivity.get(a.id);
    return {
      todo: activities.filter(a => nextAction(a, report(a)) !== null),
      waiting: activities.filter(a => isWaiting(a, report(a))),
      behind: activities.filter(a => a.approvalStatus === 'APPROVED' && isBehind(a)),
      completed: activities.filter(a => a.approvalStatus === 'APPROVED' && isCompleted(a)),
      all: activities,
    } satisfies Record<OverviewFilter, Activity[]>;
  }, [activities, latestByActivity]);

  const [filter, setFilter] = React.useState<OverviewFilter | null>(null);
  // Start on "Needs your action" when there is something to do, otherwise show everything.
  const activeFilter = filter ?? (groups.todo.length > 0 ? 'todo' : 'all');
  const shown = groups[activeFilter];
  const activeMeta = FILTERS.find(f => f.id === activeFilter)!;

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">You aren't responsible for any activities in this plan.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50",
              activeFilter === f.id && "border-primary ring-1 ring-primary"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{f.label}</p>
              {f.icon}
            </div>
            <p className="mt-2 text-2xl font-bold">{groups[f.id].length}</p>
            <p className="text-xs text-muted-foreground">{f.hint}</p>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          {activeMeta.icon} {activeMeta.label} ({shown.length})
        </h2>
        {shown.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                {activeFilter === 'todo' ? "You're all caught up — nothing needs your action right now." : "No activities here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          shown.map(a => (
            <ActivityCard
              key={a.id}
              activity={a}
              initiativeTitle={initiativeTitles.get(a.initiativeId)}
              report={latestByActivity.get(a.id)}
              onOpenBreakdown={onOpenBreakdown}
              onEdit={onEdit}
            />
          ))
        )}
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" /> Progress comes from your approved period reports (Reporting → My Reports).
        </p>
      </div>
    </div>
  );
}
