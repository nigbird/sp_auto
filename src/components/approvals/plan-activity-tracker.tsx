"use client";

import { Can } from "@/components/permissions-provider";
import * as React from "react";
import { format } from "date-fns";
import { Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { BreakdownStrip } from "../my-activity/breakdown-editor";
import { formatTargetValue, monthsBetween } from "@/lib/monthly-breakdown";
import { useToast } from "@/hooks/use-toast";
import { DateRangeFilter, ListToolbar, Pagination, SearchBox, usePagination } from "../list-controls";
import { isRangeSet, matchesSearch, overlapsDateRange, type DateRangeValue } from "@/lib/list-filters";
import { cn } from "@/lib/utils";
import { formatWeight } from "@/lib/report-calculations";
import { approveNewActivity, returnNewActivity, type PlanApprovalActivity, type PlanStage } from "@/actions/plan-approvals";

export const STAGE_META: Record<PlanStage, { label: string; className: string }> = {
  activityPending: { label: "New activity · awaiting approval", className: "border-blue-500/25 text-blue-700 bg-blue-500/[0.06]" },
  breakdownPending: { label: "Breakdown awaiting approval", className: "border-blue-500/25 text-blue-700 bg-blue-500/[0.06]" },
  activityReturned: { label: "Activity returned", className: "border-red-400/30 text-red-700 bg-red-500/[0.06]" },
  breakdownReturned: { label: "Breakdown returned", className: "border-red-400/30 text-red-700 bg-red-500/[0.06]" },
  ownerDeclined: { label: "Owner declined request", className: "border-red-400/30 text-red-700 bg-red-500/[0.06]" },
  requested: { label: "Waiting for owner", className: "border-amber-500/30 text-amber-700 bg-amber-500/[0.06]" },
  drafting: { label: "Owner preparing breakdown", className: "border-amber-500/30 text-amber-700 bg-amber-500/[0.06]" },
  notSent: { label: "Request not sent", className: "border-border text-muted-foreground bg-muted/50" },
  approved: { label: "Approved", className: "border-emerald-500/30 text-emerald-700 bg-emerald-500/[0.07]" },
};

const STAGE_ORDER: PlanStage[] = ["activityPending", "breakdownPending", "activityReturned", "breakdownReturned", "ownerDeclined", "requested", "drafting", "notSent", "approved"];

export function StageBadge({ stage }: { stage: PlanStage }) {
  const meta = STAGE_META[stage];
  return <Badge variant="outline" className={cn("whitespace-nowrap font-medium", meta.className)}>{meta.label}</Badge>;
}

const ALL = "all";
const dateText = (iso: string) => format(new Date(iso), "d MMM yyyy");

/** Every activity in the plan with where it stands: activity approval, then its monthly breakdown. */
export function PlanActivityTracker({ activities, initialStage, initialStageGroup, initialStageGroupLabel }: {
  activities: PlanApprovalActivity[];
  initialStage?: string;
  /** For a KPI that spans several stages (e.g. "with activity owners") — no single Stage dropdown value can represent it, so it's tracked separately and shown as a removable chip. */
  initialStageGroup?: PlanStage[];
  initialStageGroupLabel?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [owner, setOwner] = React.useState(ALL);
  const [stage, setStage] = React.useState<string>(initialStage ?? ALL);
  const [groupFilter, setGroupFilter] = React.useState<PlanStage[] | null>(initialStageGroup ?? null);
  const [range, setRange] = React.useState<DateRangeValue>({});
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = activities.find(a => a.id === openId) ?? null;

  const owners = React.useMemo(() => [...new Set(activities.map(a => a.leadOwner || "Unassigned"))].sort(), [activities]);
  const stageCounts = React.useMemo(() => {
    const counts = new Map<PlanStage, number>();
    for (const a of activities) counts.set(a.stage, (counts.get(a.stage) ?? 0) + 1);
    return counts;
  }, [activities]);

  const rows = activities.filter(a =>
    (owner === ALL || (a.leadOwner || "Unassigned") === owner) &&
    (groupFilter ? groupFilter.includes(a.stage) : (stage === ALL || a.stage === stage)) &&
    overlapsDateRange(a.startDate, a.endDate, range) &&
    matchesSearch(query, a.title, a.initiative, a.responsible, a.leadOwner, a.deliverable)
  );
  const filtered = query.trim() !== "" || owner !== ALL || stage !== ALL || groupFilter !== null || isRangeSet(range);
  const pagination = usePagination(rows, `${query}|${owner}|${stage}|${groupFilter}|${range.from}|${range.to}`, 25);
  const resetAll = () => { setQuery(""); setOwner(ALL); setStage(ALL); setGroupFilter(null); setRange({}); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder="Search activity, initiative or person" />
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="h-9 w-full sm:w-64" aria-label="Lead owner"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All lead owners</SelectItem>
            {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={v => { setStage(v); setGroupFilter(null); }}>
          <SelectTrigger className="h-9 w-full sm:w-64" aria-label="Stage"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {STAGE_ORDER.filter(s => stageCounts.has(s)).map(s => (
              <SelectItem key={s} value={s}>{STAGE_META[s].label} ({stageCounts.get(s)})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangeFilter value={range} onChange={setRange} label="Any dates" hint="Shows activities that run at any point in this range." />
        {filtered && (
          <Button variant="ghost" onClick={resetAll} className="h-9 px-3">
            Reset <X className="ml-1.5 h-4 w-4" />
          </Button>
        )}
        <p className="ml-auto text-sm text-muted-foreground">{rows.length} of {activities.length} activities</p>
      </div>

      {groupFilter && (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.06] py-1 pl-3 pr-1.5 text-xs font-medium text-primary">
            Filter: {initialStageGroupLabel ?? "Custom stage group"}
            <button type="button" onClick={() => setGroupFilter(null)} aria-label="Clear this filter" className="rounded-full p-0.5 hover:bg-primary/10">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Activity</TableHead>
              <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Lead owner</TableHead>
              <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Responsible</TableHead>
              <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Timeline</TableHead>
              <TableHead className="h-10 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Weight</TableHead>
              <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Stage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No activities match these filters.</TableCell></TableRow>
            ) : pagination.items.map(a => (
              <TableRow key={a.id} onClick={() => setOpenId(a.id)} className="cursor-pointer border-border/50 hover:bg-muted/30">
                <TableCell className="max-w-[420px] py-4">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setOpenId(a.id); }}
                    className="text-left text-[15px] font-semibold leading-snug hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {a.title}
                  </button>
                  <p className="mt-1 text-xs text-muted-foreground/90">
                    <span className="text-muted-foreground/70">Initiative:</span> {a.initiative}
                  </p>
                </TableCell>
                <TableCell className="max-w-[220px] py-4 text-sm text-foreground/90">{a.leadOwner || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                <TableCell className="py-4 text-sm text-foreground/90">{a.responsible ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                <TableCell className="whitespace-nowrap py-4 text-sm text-foreground/90">{dateText(a.startDate)} – {dateText(a.endDate)}</TableCell>
                <TableCell className="py-4 text-right text-sm tabular-nums text-foreground/90">{a.countsTowardWeight ? formatWeight(a.weight) : <span className="text-muted-foreground" title="Duplicate: its weight counts under another lead owner">dup.</span>}</TableCell>
                <TableCell className="py-4">
                  <StageBadge stage={a.stage} />
                  {a.reason && <p className="mt-1 max-w-[260px] text-xs text-muted-foreground" title={a.reason}>“{a.reason.length > 90 ? `${a.reason.slice(0, 89)}…` : a.reason}”</p>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination state={pagination} noun="activities" />
      <p className="text-xs text-muted-foreground">Click an activity to see its full details and monthly breakdown.</p>

      <ActivityDetailSheet activity={open} onClose={() => setOpenId(null)} />
    </div>
  );
}

function DetailField({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm">{children || "—"}</dd>
    </div>
  );
}

/** Everything about one activity: where it sits in the plan, who owns it, its target and breakdown. */
function ActivityDetailSheet({ activity: a, onClose }: { activity: PlanApprovalActivity | null; onClose: () => void }) {
  return (
    <Sheet open={a !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {a && (
          <>
            <SheetHeader className="space-y-2 pr-6 text-left">
              <StageBadge stage={a.stage} />
              <SheetTitle className="text-lg leading-snug">{a.title}</SheetTitle>
              <SheetDescription>{a.leadOwner || a.department}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {a.reason && (
                <div className="rounded-md border border-red-300 bg-red-500/5 p-3 text-sm">
                  <p className="text-xs font-medium text-red-700">Reason given</p>
                  <p className="mt-1 whitespace-pre-wrap">{a.reason}</p>
                </div>
              )}

              <section>
                <h4 className="mb-2 text-sm font-semibold">Place in the plan</h4>
                <ol className="space-y-2 border-l-2 border-primary/30 pl-4 text-sm">
                  <li><span className="text-xs text-muted-foreground">Pillar</span><p>{a.pillar}</p></li>
                  <li><span className="text-xs text-muted-foreground">Objective</span><p>{a.objective}</p></li>
                  <li><span className="text-xs text-muted-foreground">Initiative</span><p className="font-medium">{a.initiative}</p></li>
                </ol>
              </section>

              <section>
                <h4 className="mb-2 text-sm font-semibold">Ownership and timing</h4>
                <dl className="grid grid-cols-2 gap-4">
                  <DetailField label="Lead owner">{a.leadOwner}</DetailField>
                  <DetailField label="Department">{a.department}</DetailField>
                  <DetailField label="Responsible">{a.responsible}</DetailField>
                  <DetailField label="Weight">{a.countsTowardWeight ? formatWeight(a.weight) : `${formatWeight(a.weight)} (duplicate, not counted)`}</DetailField>
                  <DetailField label="Start">{dateText(a.startDate)}</DetailField>
                  <DetailField label="End">{dateText(a.endDate)}</DetailField>
                  {a.deliverable && <DetailField label="Deliverable" wide>{a.deliverable}</DetailField>}
                  {a.description && <DetailField label="Description" wide>{a.description}</DetailField>}
                </dl>
              </section>

              <section>
                <h4 className="mb-2 text-sm font-semibold">Target and monthly breakdown</h4>
                {a.targetType && a.annualTarget != null ? (
                  <div className="space-y-3">
                    <dl className="grid grid-cols-2 gap-4">
                      <DetailField label="Annual target">{formatTargetValue(a.annualTarget, a.targetType)}</DetailField>
                      <DetailField label="How months combine">
                        {a.targetAggregation === "RECURRING" ? "Same level every month" : "Months add up"}{a.lowerIsBetter ? " · lower is better" : ""}
                      </DetailField>
                      <DetailField label="Submitted">{a.planSubmittedAt ? format(new Date(a.planSubmittedAt), "PPp") : null}</DetailField>
                      <DetailField label="Approved">{a.planApprovedAt ? format(new Date(a.planApprovedAt), "PPp") : null}</DetailField>
                    </dl>
                    <BreakdownStrip
                      months={monthsBetween(a.startDate, a.endDate)}
                      entries={a.monthlyTargets}
                      targetType={a.targetType}
                      annualTarget={a.annualTarget}
                      aggregation={a.targetAggregation}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No target or monthly breakdown has been submitted yet.</p>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** New activities waiting for approval, as cards like the breakdown and report approvals. */
export function NewActivityApprovalList({ activities: initial }: { activities: PlanApprovalActivity[] }) {
  const [items, setItems] = React.useState(initial);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [returning, setReturning] = React.useState<PlanApprovalActivity | null>(null);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const { toast } = useToast();

  React.useEffect(() => setItems(initial), [initial]);

  const handleApprove = async (a: PlanApprovalActivity) => {
    setBusyId(a.id);
    try {
      const result = await approveNewActivity(a.id);
      if (!result.success) {
        toast({ title: "Couldn't approve", description: result.message, variant: "destructive" });
        return;
      }
      setItems(prev => prev.filter(x => x.id !== a.id));
      toast({ title: "Activity approved", description: `"${a.title}" is now part of the plan. Its owner can fill in the monthly breakdown once the request is sent.` });
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
      const result = await returnNewActivity(returning.id, reason);
      if (!result.success) {
        setReasonError(result.message);
        return;
      }
      setItems(prev => prev.filter(x => x.id !== returning.id));
      toast({ title: "Activity returned", description: `"${returning.title}" was sent back to its owner.`, variant: "destructive" });
      setReturning(null);
      setReason("");
    } finally {
      setBusyId(null);
    }
  };

  const [query, setQuery] = React.useState("");
  const [range, setRange] = React.useState<DateRangeValue>({});
  const narrowed = query.trim() !== "" || isRangeSet(range);
  const matching = items.filter(a =>
    overlapsDateRange(a.startDate, a.endDate, range) &&
    matchesSearch(query, a.title, a.initiative, a.responsible, a.leadOwner, a.deliverable));
  const pagination = usePagination(matching, `${query}|${range.from}|${range.to}`);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No new activities are waiting for approval.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ListToolbar count={narrowed ? `${matching.length} of ${items.length} match` : `${items.length} waiting`}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search activity, owner or initiative" />
        <DateRangeFilter value={range} onChange={setRange} label="Any dates" hint="Shows activities that run at any point in this range." />
        {narrowed && <Button variant="ghost" className="h-10 px-3" onClick={() => { setQuery(""); setRange({}); }}>Reset</Button>}
      </ListToolbar>
      {matching.length === 0 && (
        <Card><CardContent className="pt-6"><p className="text-center text-muted-foreground">No waiting activities match the search or dates.</p></CardContent></Card>
      )}
      {pagination.items.map(a => (
        <Card key={a.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold">{a.title}</h3>
              <p className="text-xs text-muted-foreground">{a.pillar} → {a.objective} → {a.initiative}</p>
              <p className="text-sm text-muted-foreground">
                {a.leadOwner || a.department} · {a.responsible ?? "Unassigned"} · {dateText(a.startDate)} – {dateText(a.endDate)} · Weight {formatWeight(a.weight)}
              </p>
              {a.deliverable && <p className="text-sm"><span className="font-medium">Deliverable:</span> {a.deliverable}</p>}
            </div>
            <StageBadge stage={a.stage} />
          </CardHeader>
          <CardContent>
            <Can anyOf={["plan-approvals:approve"]}>
            <div className="flex justify-end gap-2">
              <Button variant="destructive" disabled={busyId === a.id} onClick={() => { setReturning(a); setReasonError(null); }}>Return</Button>
              <Button className="bg-green-600 hover:bg-green-700" disabled={busyId === a.id} onClick={() => handleApprove(a)}>
                {busyId === a.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Approve
              </Button>
            </div>
            </Can>
          </CardContent>
        </Card>
      ))}
      <Pagination state={pagination} noun="activities" />

      <AlertDialog open={returning !== null} onOpenChange={open => { if (!open) setReturning(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return this activity</AlertDialogTitle>
            <AlertDialogDescription>Tell the owner what to change. They'll see this reason in their notifications.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1 py-2">
            <Textarea value={reason} onChange={e => { setReason(e.target.value); setReasonError(null); }} placeholder="e.g., This duplicates activity 2.1.3 — please merge them." />
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
