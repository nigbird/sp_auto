"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { cn, getInitiativeWeight, getObjectiveWeight, getPillarWeight } from "@/lib/utils";
import type { Activity, Initiative, Objective, Pillar } from "@/lib/types";
import { isRangeSet, matchesSearch, overlapsDateRange, type DateRangeValue } from "@/lib/list-filters";
import { formatTargetValue, monthKey, monthsBetween, type TargetType } from "@/lib/monthly-breakdown";
import { DateRangeFilter, ListToolbar, SearchBox } from "../list-controls";
import { ClickableRow, DetailDrawer, TableHeadCell, useListSelection } from "../detail-drawer";
import { BreakdownStrip } from "../my-activity/breakdown-editor";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

// ---------------------------------------------------------------------------
// Breakdown status — one label per activity, used for the badge and the filter.
// ---------------------------------------------------------------------------

type BreakdownState = "approved" | "pending" | "returned" | "requested" | "declined" | "notRequested";

const BREAKDOWN: Record<BreakdownState, { label: string; className: string }> = {
  approved: { label: "Approved", className: "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-700" },
  pending: { label: "Pending approval", className: "border-blue-500/25 bg-blue-500/[0.06] text-blue-700" },
  returned: { label: "Returned", className: "border-red-400/30 bg-red-500/[0.06] text-red-700" },
  requested: { label: "Requested", className: "border-amber-500/30 bg-amber-500/[0.06] text-amber-700" },
  declined: { label: "Request declined", className: "border-red-400/30 bg-red-500/[0.06] text-red-700" },
  notRequested: { label: "Not requested", className: "border-border/60 bg-muted/60 text-muted-foreground" },
};

function breakdownState(a: Activity): BreakdownState {
  if (a.planSubmissionStatus === "APPROVED") return "approved";
  if (a.planSubmissionStatus === "PENDING") return "pending";
  if (a.planSubmissionStatus === "DECLINED") return "returned";
  if (a.planRequestStatus === "SENT" || a.planRequestStatus === "ACCEPTED") return "requested";
  if (a.planRequestStatus === "DECLINED") return "declined";
  return "notRequested";
}

function BreakdownBadge({ activity }: { activity: Activity }) {
  const s = BREAKDOWN[breakdownState(activity)];
  return <Badge variant="outline" className={cn("whitespace-nowrap font-medium", s.className)}>{s.label}</Badge>;
}

// ---------------------------------------------------------------------------
// Activity helpers
// ---------------------------------------------------------------------------

const responsibleName = (a: Activity) => (a.responsible as { name?: string } | null)?.name ?? null;
const office = (a: Activity) => a.leadOwner || a.department || "—";

/** Imported activities keep the sheet's "Responsible / Collaborating Unit" text in the description. */
function splitDescription(a: Activity) {
  const collaborators = (a.description ?? "").match(/^Responsible \/ collaborating unit:\s*([\s\S]*)$/i)?.[1]?.trim();
  return { collaborators: collaborators || null, description: collaborators ? null : (a.description ?? "").trim() || null };
}

const span = (a: Activity) => {
  const s = new Date(a.startDate), e = new Date(a.endDate);
  return s.getFullYear() === e.getFullYear()
    ? `${format(s, "MMM")} – ${format(e, "MMM yyyy")}`
    : `${format(s, "MMM yyyy")} – ${format(e, "MMM yyyy")}`;
};

interface Located { activity: Activity; pillar: Pillar; objective: Objective; initiative: Initiative }

const ALL = "__all__";

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/**
 * The plan as one table: pillar, objective and initiative rows group the
 * activities and can be collapsed; each activity is a single row that opens
 * its full details in a side panel.
 */
export function PlanStructureView({ pillars, userNames }: { pillars: Pillar[]; userNames: Record<string, string> }) {
  const located = React.useMemo<Located[]>(() => pillars.flatMap(pillar => pillar.objectives.flatMap(objective =>
    objective.initiatives.flatMap(initiative => initiative.activities.map(activity => ({ activity, pillar, objective, initiative })))
  )), [pillars]);

  const [query, setQuery] = React.useState("");
  const [pillarId, setPillarId] = React.useState(ALL);
  const [owner, setOwner] = React.useState(ALL);
  const [breakdown, setBreakdown] = React.useState<BreakdownState | typeof ALL>(ALL);
  const [range, setRange] = React.useState<DateRangeValue>({});
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const owners = React.useMemo(() => [...new Set(located.map(l => office(l.activity)))].filter(o => o !== "—").sort(), [located]);

  const narrowed = query.trim() !== "" || pillarId !== ALL || owner !== ALL || breakdown !== ALL || isRangeSet(range);
  const reset = () => { setQuery(""); setPillarId(ALL); setOwner(ALL); setBreakdown(ALL); setRange({}); };

  const matching = React.useMemo(() => located.filter(({ activity: a, pillar, objective, initiative }) =>
    (pillarId === ALL || pillar.id === pillarId) &&
    (owner === ALL || office(a) === owner) &&
    (breakdown === ALL || breakdownState(a) === breakdown) &&
    overlapsDateRange(a.startDate, a.endDate, range) &&
    matchesSearch(query, a.title, a.deliverable, a.leadOwner, a.department, responsibleName(a), a.description, initiative.title, objective.statement, pillar.title)
  ), [located, query, pillarId, owner, breakdown, range]);
  const matchingIds = React.useMemo(() => new Set(matching.map(l => l.activity.id)), [matching]);

  const selection = useListSelection(matching.map(l => ({ id: l.activity.id, ...l })));
  const selected = selection.selected;

  // While filtering, everything that matches is shown; collapsing is for browsing the whole plan.
  const isOpen = (id: string) => narrowed || !collapsed.has(id);
  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allGroupIds = React.useMemo(() => pillars.flatMap(p => [p.id, ...p.objectives.flatMap(o => [o.id, ...o.initiatives.map(i => i.id)])]), [pillars]);
  const anyCollapsed = collapsed.size > 0;

  const approvedCount = located.filter(l => breakdownState(l.activity) === "approved").length;
  const stats = [
    { label: "Pillars", value: pillars.length },
    { label: "Objectives", value: pillars.reduce((n, p) => n + p.objectives.length, 0) },
    { label: "Initiatives", value: pillars.reduce((n, p) => n + p.objectives.reduce((m, o) => m + o.initiatives.length, 0), 0) },
    { label: "Activities", value: located.length },
    { label: "Breakdowns approved", value: `${approvedCount} / ${located.length}` },
  ];

  const ownerNames = (i: Initiative) => [i.owner?.name, ...(i.coOwners ?? []).map(id => userNames[id] ?? "Unknown user")].filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/50 bg-border/50 sm:grid-cols-5">
        {stats.map(s => (
          <div key={s.label} className="bg-card px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1.5 text-xl font-bold tabular-nums leading-none text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <ListToolbar count={narrowed ? `${matching.length} of ${located.length} activities match` : `${located.length} activities`}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search activity, owner, deliverable or initiative" className="sm:w-80" />
        <Select value={pillarId} onValueChange={setPillarId}>
          <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Pillar"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All pillars</SelectItem>
            {pillars.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Lead owner"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All lead owners</SelectItem>
            {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={breakdown} onValueChange={v => setBreakdown(v as BreakdownState | typeof ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Breakdown status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any breakdown status</SelectItem>
            {(Object.keys(BREAKDOWN) as BreakdownState[]).map(k => <SelectItem key={k} value={k}>{BREAKDOWN[k].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangeFilter value={range} onChange={setRange} label="Any dates" hint="Shows activities that run at any point in this range." />
        {narrowed && <Button variant="ghost" className="h-9 px-3" onClick={reset}>Reset</Button>}
        {!narrowed && (
          <Button variant="outline" className="h-9 gap-2" onClick={() => setCollapsed(anyCollapsed ? new Set() : new Set(allGroupIds))}>
            {anyCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
            {anyCollapsed ? "Expand all" : "Collapse all"}
          </Button>
        )}
      </ListToolbar>

      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
        <table className="w-full min-w-[720px] table-fixed text-sm">
          <thead>
            <tr>
              <TableHeadCell>Activity</TableHeadCell>
              <TableHeadCell className="hidden w-60 lg:table-cell">Lead / Owner</TableHeadCell>
              <TableHeadCell className="hidden w-44 md:table-cell">Period</TableHeadCell>
              <TableHeadCell className="w-20 text-right">Weight</TableHeadCell>
              <TableHeadCell className="w-40 text-right">Breakdown</TableHeadCell>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {matching.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{narrowed ? "No activities match the search or filters." : "This plan has no activities yet."}</td></tr>
            )}
            {pillars.map(pillar => {
              const pillarHits = matching.filter(l => l.pillar.id === pillar.id).length;
              if (narrowed && pillarHits === 0) return null;
              return (
                <React.Fragment key={pillar.id}>
                  <GroupRow depth={0} open={isOpen(pillar.id)} onToggle={() => toggle(pillar.id)} disabled={narrowed}
                    title={pillar.title} weight={getPillarWeight(pillar)} count={pillarHits} />
                  {isOpen(pillar.id) && pillar.objectives.map(objective => {
                    const objectiveHits = matching.filter(l => l.objective.id === objective.id).length;
                    if (narrowed && objectiveHits === 0) return null;
                    return (
                      <React.Fragment key={objective.id}>
                        <GroupRow depth={1} open={isOpen(objective.id)} onToggle={() => toggle(objective.id)} disabled={narrowed}
                          title={objective.statement || objective.title || ""} weight={getObjectiveWeight(objective)} count={objectiveHits} />
                        {isOpen(objective.id) && objective.initiatives.map(initiative => {
                          const activities = initiative.activities.filter(a => matchingIds.has(a.id));
                          if (narrowed && activities.length === 0) return null;
                          return (
                            <React.Fragment key={initiative.id}>
                              <GroupRow depth={2} open={isOpen(initiative.id)} onToggle={() => toggle(initiative.id)} disabled={narrowed}
                                title={initiative.title} subtitle={ownerNames(initiative) && `Owner: ${ownerNames(initiative)}`}
                                weight={getInitiativeWeight(initiative)} count={activities.length} />
                              {isOpen(initiative.id) && activities.map(a => (
                                <ClickableRow key={a.id} selected={selection.selectedId === a.id} onOpen={() => selection.open(a.id)} label={`Open ${a.title}`}>
                                  <td className="max-w-0 py-2.5 pl-16 pr-4">
                                    <p className="truncate font-medium text-foreground" title={a.title}>
                                      {a.title}
                                      {a.approvalStatus === "PENDING" && <span className="ml-2 text-xs font-normal text-muted-foreground">(awaiting approval)</span>}
                                    </p>
                                    {a.deliverable && <p className="truncate text-xs text-muted-foreground" title={a.deliverable}>{a.deliverable}</p>}
                                  </td>
                                  <td className="hidden max-w-0 px-4 py-2.5 lg:table-cell">
                                    <p className="truncate text-foreground/90" title={office(a)}>{office(a)}</p>
                                    <p className="truncate text-xs text-muted-foreground">{responsibleName(a) ?? "Unassigned"}</p>
                                  </td>
                                  <td className="hidden whitespace-nowrap px-4 py-2.5 text-muted-foreground md:table-cell">{span(a)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-foreground/90">{a.weight}%</td>
                                  <td className="px-4 py-2.5 text-right"><BreakdownBadge activity={a} /></td>
                                </ClickableRow>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <DetailDrawer
        open={selected !== null}
        onOpenChange={o => { if (!o) selection.close(); }}
        eyebrow={selected?.pillar.title}
        title={selected?.activity.title}
        badge={selected && <BreakdownBadge activity={selected.activity} />}
        description={selected && <p>{selected.objective.statement || selected.objective.title} → {selected.initiative.title}</p>}
        index={selection.index}
        count={selection.count}
        onPrev={selection.prev}
        onNext={selection.next}
      >
        {selected && <ActivityDetail activity={selected.activity} />}
      </DetailDrawer>
    </div>
  );
}

function GroupRow({ depth, open, onToggle, disabled, title, subtitle, weight, count }: {
  depth: 0 | 1 | 2;
  open: boolean;
  onToggle: () => void;
  disabled: boolean;
  title: string;
  subtitle?: string | false;
  weight: number;
  count: number;
}) {
  return (
    <tr className={cn(
      "border-t border-border/50",
      depth === 0 && "bg-muted/70",
      depth === 1 && "bg-muted/35",
      depth === 2 && "bg-muted/10"
    )}>
      <td colSpan={3} className="max-w-0 py-2 pr-4">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-expanded={open}
          className={cn("flex w-full min-w-0 items-start gap-2 text-left disabled:cursor-default", depth === 0 ? "pl-3" : depth === 1 ? "pl-7" : "pl-11")}
        >
          <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90", disabled && "opacity-40")} />
          <span className="min-w-0">
            <span className={cn(
              "block truncate",
              depth === 0 && "font-semibold text-foreground",
              depth === 1 && "font-medium text-foreground",
              depth === 2 && "font-medium text-foreground/90"
            )} title={title}>{title}</span>
            {subtitle && <span className="block truncate text-xs font-normal text-muted-foreground">{subtitle}</span>}
          </span>
        </button>
      </td>
      <td className={cn("px-4 py-2 text-right tabular-nums", depth === 0 ? "font-semibold" : "font-medium text-foreground/90")}>{weight.toFixed(1)}%</td>
      <td className="px-4 py-2 text-right text-xs text-muted-foreground">{count} {count === 1 ? "activity" : "activities"}</td>
      <td />
    </tr>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{children || "—"}</div>
    </div>
  );
}

/** Everything about one activity, shown in the side panel. */
function ActivityDetail({ activity: a }: { activity: Activity }) {
  const { collaborators, description } = splitDescription(a);
  const targetType = a.targetType as TargetType | null;
  const state = breakdownState(a);
  const hasBreakdown = !!targetType && a.annualTarget != null && (a.monthlyTargets?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lead / Owner">{a.leadOwner || a.department}</Field>
        <Field label="Responsible person">{responsibleName(a) ?? "Unassigned"}</Field>
        <Field label="Department">{a.department}</Field>
        <Field label="Weight">{a.weight}%</Field>
        <Field label="Start date">{format(new Date(a.startDate), "PP")}</Field>
        <Field label="End date">{format(new Date(a.endDate), "PP")}</Field>
        {collaborators && <Field label="Responsible / collaborating units" wide>{collaborators}</Field>}
        <Field label="Deliverable" wide>{a.deliverable}</Field>
        {description && <Field label="Description" wide>{description}</Field>}
      </div>

      <div className="space-y-3 border-t border-border/50 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">Monthly breakdown</p>
        {targetType && a.annualTarget != null && (
          <p className="text-sm">
            <span className="font-medium">Annual target:</span> {formatTargetValue(a.annualTarget, targetType)}
            <span className="text-muted-foreground">
              {" "}({targetType === "PERCENT" ? "percent" : "number"}, {a.targetAggregation === "RECURRING" ? "same level every month" : "months add up"}{a.targetDirection === "LOWER_IS_BETTER" ? ", lower is better" : ""})
            </span>
          </p>
        )}
        {hasBreakdown ? (
          <BreakdownStrip
            months={monthsBetween(a.startDate, a.endDate)}
            entries={(a.monthlyTargets ?? []).map(t => ({ month: monthKey(t.month), value: t.value }))}
            targetType={targetType!}
            annualTarget={a.annualTarget!}
            aggregation={a.targetAggregation}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {state === "notRequested" && "The breakdown hasn't been requested from the owner yet."}
            {state === "requested" && "Requested — waiting for the owner to fill in the monthly targets."}
            {state === "declined" && "The owner declined the breakdown request."}
            {(state === "pending" || state === "returned" || state === "approved") && "No monthly values were saved."}
          </p>
        )}
        {state !== "approved" && hasBreakdown && (
          <p className="text-xs text-muted-foreground">{BREAKDOWN[state].label} — these values count once an approver approves them.</p>
        )}
      </div>
    </div>
  );
}
