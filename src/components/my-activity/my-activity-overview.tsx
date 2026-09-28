"use client"

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle, ArrowRight, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, FileText, Hourglass, List,
  PencilLine, ShieldQuestion, ShieldX, TableProperties,
} from "lucide-react";
import type { Activity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isPeriodClosedForSubmissions } from "@/lib/reporting-period";
import { monthKey, monthsBetween, type TargetAggregation, type TargetType } from "@/lib/monthly-breakdown";
import { formatWeight } from "@/lib/report-calculations";
import { toggleDeliverableDelivered } from "@/actions/deliverables";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";
import { BreakdownStrip } from "./breakdown-editor";
import { DateRangeFilter, ListToolbar, Pagination, SearchBox, usePagination } from "../list-controls";
import { isRangeSet, matchesSearch, overlapsDateRange, type DateRangeValue } from "@/lib/list-filters";

/** The latest requested period report for an activity (from getMyPeriodReports). */
export interface LatestReport {
  id: string;
  activityId: string;
  reportStatus: 'REQUESTED' | 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  declineReason: string | null;
  reportingPeriod: { id: string; name: string; endDate: string; cutOffDate: string; status: 'OPEN' | 'CLOSED' };
}

type Step = { label: string; tone: 'done' | 'waiting' | 'todo' | 'problem' | 'none'; detail?: string | null };
type NextAction = 'breakdown' | 'report' | 'resubmit' | null;

export type OverviewFilter = 'all' | 'todo' | 'waiting' | 'behind' | 'completed';

const isRequestOpen = (a: Activity) => a.planRequestStatus === 'SENT' || a.planRequestStatus === 'ACCEPTED';
const isCompleted = (a: Activity) => a.status === 'Completed As Per Target' || a.progress >= 100;
const isOverdue = (a: Activity) => !isCompleted(a) && new Date(a.endDate) < new Date();
const isBehind = (a: Activity) => !isCompleted(a) && (isOverdue(a) || a.status === 'Delayed');
const reportIsOpen = (r: LatestReport) => !isPeriodClosedForSubmissions(r.reportingPeriod);

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
      return reportIsOpen(report)
        ? { label: `${period}: to submit by ${format(new Date(report.reportingPeriod.cutOffDate), "MMM d")}`, tone: 'todo' }
        : { label: `${period}: missed (period closed)`, tone: 'problem' };
  }
}

function nextAction(a: Activity, report: LatestReport | undefined): NextAction {
  if (a.approvalStatus === 'DECLINED') return 'resubmit';
  if (isRequestOpen(a) && (a.planSubmissionStatus == null || a.planSubmissionStatus === 'DECLINED')) return 'breakdown';
  if (report && (report.reportStatus === 'REQUESTED' || report.reportStatus === 'RETURNED') && reportIsOpen(report)) return 'report';
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
  const [deliverables, setDeliverables] = React.useState(activity.deliverables ?? []);
  const { toast } = useToast();

  const handleToggleDeliverable = async (id: string, delivered: boolean) => {
    setDeliverables(prev => prev.map(d => (d.id === id ? { ...d, isDelivered: delivered } : d)));
    try {
      await toggleDeliverableDelivered(id, delivered);
    } catch (err) {
      setDeliverables(prev => prev.map(d => (d.id === id ? { ...d, isDelivered: !delivered } : d)));
      toast({ title: "Couldn't update the deliverable", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  const action = nextAction(activity, report);
  // Finished steps stay quiet: a chip appears only while a step still needs something.
  const steps = [
    { name: "Activity", step: activityStep(activity) },
    { name: "Monthly breakdown", step: breakdownStep(activity) },
    { name: "Latest report", step: reportStep(report) },
  ].filter(({ name, step }) => (name === "Latest report" ? step.tone !== "none" && step.tone !== "done" : step.tone !== "done"));
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
              {format(new Date(activity.startDate), "PP")} – {format(new Date(activity.endDate), "PP")} · Weight {formatWeight(activity.weight)}
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
          {(steps.length > 0 || action !== null) && (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                {steps.map(({ name, step }) => <StepChip key={name} name={name} step={step} />)}
              </div>
              <ActionButton action={action} onOpenBreakdown={onOpenBreakdown} onEdit={() => onEdit(activity)} />
            </div>
          )}
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
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/** One concrete to-do line at the top of the tab, e.g. "79 reports to submit for New Period — due Nov 7". */
function TodoRow({ icon, text, action }: { icon: React.ReactNode; text: React.ReactNode; action: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <span className="flex items-center gap-2 text-sm">{icon}{text}</span>
      {action}
    </li>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const FILTERS: { id: OverviewFilter; label: string; short: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All activities', short: 'Assigned to you', icon: <List className="h-4 w-4 text-muted-foreground" /> },
  { id: 'todo', label: 'Needs your action', short: 'Breakdown or report to fill in', icon: <ClipboardList className="h-4 w-4 text-amber-600" /> },
  { id: 'waiting', label: 'Waiting for approval', short: 'With an approver', icon: <Hourglass className="h-4 w-4 text-blue-600" /> },
  { id: 'behind', label: 'Behind schedule', short: 'Delayed or overdue', icon: <AlertTriangle className="h-4 w-4 text-destructive" /> },
  { id: 'completed', label: 'Completed', short: 'Reported as done', icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
];

/**
 * The "My Activities" tab of My Plan: a short to-do list, then each activity
 * the user is responsible for and where it stands in the
 * plan → breakdown → report flow.
 */
export function MyActivityOverview({ activities, reports, initiativeTitles, onOpenBreakdown, onEdit }: {
  activities: Activity[];
  reports: LatestReport[];
  initiativeTitles: Map<string, string>;
  onOpenBreakdown: () => void;
  onEdit: (activity: Activity) => void;
}) {
  const [filter, setFilter] = React.useState<OverviewFilter>('all');
  const [query, setQuery] = React.useState('');
  const [range, setRange] = React.useState<DateRangeValue>({});

  const latestByActivity = React.useMemo(() => {
    // Reports arrive newest period first, so the first one per activity is the latest.
    const map = new Map<string, LatestReport>();
    reports.forEach(r => { if (!map.has(r.activityId)) map.set(r.activityId, r); });
    return map;
  }, [reports]);

  const groupsOf = React.useCallback((list: Activity[]) => {
    const report = (a: Activity) => latestByActivity.get(a.id);
    return {
      all: list,
      todo: list.filter(a => nextAction(a, report(a)) !== null),
      waiting: list.filter(a => isWaiting(a, report(a))),
      behind: list.filter(a => a.approvalStatus === 'APPROVED' && isBehind(a)),
      completed: list.filter(a => a.approvalStatus === 'APPROVED' && isCompleted(a)),
    } satisfies Record<OverviewFilter, Activity[]>;
  }, [latestByActivity]);

  // The to-do box always covers everything; the tiles and list follow the search and dates.
  const groups = React.useMemo(() => groupsOf(activities), [groupsOf, activities]);
  const visible = React.useMemo(
    () => activities.filter(a =>
      overlapsDateRange(a.startDate, a.endDate, range) &&
      matchesSearch(query, a.title, initiativeTitles.get(a.initiativeId), a.leadOwner, a.deliverable)),
    [activities, range, query, initiativeTitles]
  );
  const visibleGroups = React.useMemo(() => groupsOf(visible), [groupsOf, visible]);
  const narrowed = query.trim() !== '' || isRangeSet(range);
  const pagination = usePagination(visibleGroups[filter], `${filter}|${query}|${range.from}|${range.to}`);

  // The to-do list, broken down by what actually has to be done.
  const todos = React.useMemo(() => {
    const reportsByPeriod = new Map<string, { name: string; cutOff: string; count: number }>();
    let returnedReports = 0, breakdowns = 0, declined = 0;
    for (const a of groups.todo) {
      const action = nextAction(a, latestByActivity.get(a.id));
      if (action === 'resubmit') declined++;
      else if (action === 'breakdown') breakdowns++;
      else if (action === 'report') {
        const r = latestByActivity.get(a.id)!;
        if (r.reportStatus === 'RETURNED') returnedReports++;
        else {
          const p = reportsByPeriod.get(r.reportingPeriod.id) ?? { name: r.reportingPeriod.name, cutOff: r.reportingPeriod.cutOffDate, count: 0 };
          p.count++;
          reportsByPeriod.set(r.reportingPeriod.id, p);
        }
      }
    }
    return { reportsByPeriod: Array.from(reportsByPeriod.values()), returnedReports, breakdowns, declined };
  }, [groups.todo, latestByActivity]);

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">You aren't responsible for any activities in this plan.</p>
        </CardContent>
      </Card>
    );
  }

  const hasTodos = groups.todo.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-lg font-semibold">What you need to do</h2>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          {!hasTodos ? (
            <p className="flex items-center gap-2 px-6 pb-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> You're all caught up — nothing needs your action right now.
            </p>
          ) : (
            <ul className="divide-y">
              {todos.reportsByPeriod.map(p => (
                <TodoRow
                  key={p.name}
                  icon={<FileText className="h-4 w-4 text-amber-600" />}
                  text={<><span className="font-semibold">{plural(p.count, 'report', 'reports')}</span>&nbsp;to submit for {p.name} — due {format(new Date(p.cutOff), "MMM d, yyyy")}</>}
                  action={<Button size="sm" asChild><Link href="/reports/submit">Go to My Reports <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>}
                />
              ))}
              {todos.returnedReports > 0 && (
                <TodoRow
                  icon={<ShieldX className="h-4 w-4 text-destructive" />}
                  text={<><span className="font-semibold">{plural(todos.returnedReports, 'report was', 'reports were')}</span>&nbsp;returned — fix and resubmit</>}
                  action={<Button size="sm" variant="outline" asChild><Link href="/reports/submit">Go to My Reports</Link></Button>}
                />
              )}
              {todos.breakdowns > 0 && (
                <TodoRow
                  icon={<TableProperties className="h-4 w-4 text-amber-600" />}
                  text={<><span className="font-semibold">{plural(todos.breakdowns, 'monthly breakdown', 'monthly breakdowns')}</span>&nbsp;to fill in</>}
                  action={<Button size="sm" variant="outline" onClick={onOpenBreakdown}>Open Monthly Breakdown</Button>}
                />
              )}
              {todos.declined > 0 && (
                <TodoRow
                  icon={<PencilLine className="h-4 w-4 text-destructive" />}
                  text={<><span className="font-semibold">{plural(todos.declined, 'activity was', 'activities were')}</span>&nbsp;declined — edit and resubmit</>}
                  action={<Button size="sm" variant="outline" onClick={() => setFilter('todo')}>Show them</Button>}
                />
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" role="tablist" aria-label="Filter activities">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex flex-col rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/50",
                filter === f.id && "border-primary bg-primary/5 ring-1 ring-primary"
              )}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {f.label}
                {f.icon}
              </span>
              <span className="mt-2 text-3xl font-bold">{visibleGroups[f.id].length}</span>
              <span className="mt-1 text-xs text-muted-foreground">{f.short}</span>
            </button>
          ))}
        </div>
      </div>

      <ListToolbar count={narrowed ? `${visible.length} of ${activities.length} activities match` : undefined}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search activity, initiative or deliverable" />
        <DateRangeFilter value={range} onChange={setRange} label="Any dates" hint="Shows activities that run at any point in this range." />
        {narrowed && (
          <Button variant="ghost" className="h-10 px-3" onClick={() => { setQuery(''); setRange({}); }}>Reset</Button>
        )}
      </ListToolbar>

      <div className="space-y-4">
        {pagination.total === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">{narrowed ? 'No activities match the search or dates.' : 'No activities here.'}</p>
            </CardContent>
          </Card>
        ) : (
          pagination.items.map(a => (
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
        <Pagination state={pagination} noun="activities" />
      </div>
    </div>
  );
}
