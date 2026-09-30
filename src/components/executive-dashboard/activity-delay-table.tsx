"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FileSpreadsheet, FileText, Search, Upload, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_STATUS_ORDER,
  DELIVERY_STATE_LABEL,
  type ActivityDelayRow,
  type ActivityStatusLabel,
  type DeliveryState,
} from "@/lib/dashboard-metrics";
import {
  DELIVERY_ORDER,
  EMPTY_DELAY_FILTER,
  countBy,
  delayFilterToParams,
  describeDelayFilter,
  filterDelayRows,
  formatDays,
  groupDelayRows,
  type DelayTableFilter,
} from "@/lib/activity-delay-table";
import { STATUS_COLOR, shortDate } from "./primitives";
import { FilterChip } from "./initiatives-table";
import { Pagination, usePagination } from "../list-controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/components/permissions-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Radix Select can't use "" as a value.
const ALL_STREAMS = "__all__";

const ACTIVITY_STATUS_COLOR: Record<ActivityStatusLabel, string> = {
  "Completed As Per The Target": STATUS_COLOR.achieved,
  "In Good Progress": STATUS_COLOR.onTrack,
  "Not In Good Progress": STATUS_COLOR.behind,
  "Not Started": STATUS_COLOR.notStarted,
  "Awaiting report": STATUS_COLOR.awaiting,
  "No target": STATUS_COLOR.noTarget,
};

// Delivery is status too, so it borrows the same palette.
const DELIVERY_COLOR: Record<DeliveryState, string> = {
  overdue: STATUS_COLOR.notStarted,
  completedLate: STATUS_COLOR.behind,
  completedOnTime: STATUS_COLOR.achieved,
  notYetDue: STATUS_COLOR.noTarget,
  noDueDate: STATUS_COLOR.awaiting,
};

const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

/** Same look as StatusPill: tinted pill, coloured dot, ink text. */
function ActivityStatusPill({ status }: { status: ActivityStatusLabel }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium text-foreground/80"
      style={{ background: `${ACTIVITY_STATUS_COLOR[status]}1f` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACTIVITY_STATUS_COLOR[status] }} />
      {status}
    </span>
  );
}

function Days({ value, late }: { value: number | null; late: boolean }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("tabular-nums", late ? "font-semibold text-red-700 dark:text-red-400" : value < 0 ? "text-muted-foreground" : "")}>{formatDays(value)}</span>;
}

/**
 * The Excel's "Work Stream / Initiatives Assigned / # of Days Delayed / Major
 * Activities / # of Days Delayed" table in the dashboard's table style: one row
 * per work stream and initiative (worst delay), expanding to its activities.
 * Filterable by activity status, delivery, stream and text; exports as filtered.
 */
export function ActivityDelayTable({ rows, planId, periodId }: { rows: ActivityDelayRow[]; planId: string; periodId: string }) {
  const { can } = usePermissions();
  const canExport = can("reports:export") && (can("dashboard:view") || can("dashboard:view-own"));
  const [filter, setFilter] = useState<DelayTableFilter>(EMPTY_DELAY_FILTER);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const update = (patch: Partial<DelayTableFilter>) => setFilter(f => ({ ...f, ...patch }));

  const streams = useMemo(() => [...new Set(rows.map(r => r.stream))].sort((a, b) => a.localeCompare(b)), [rows]);
  // Each chip's count reflects the other filters, so it says how many rows it would show.
  const statusCounts = useMemo(() => countBy(filterDelayRows(rows, { ...filter, statuses: [] }), r => r.status, ACTIVITY_STATUS_ORDER), [rows, filter]);
  const deliveryCounts = useMemo(() => countBy(filterDelayRows(rows, { ...filter, deliveries: [] }), r => r.delivery, DELIVERY_ORDER), [rows, filter]);
  const visible = useMemo(() => filterDelayRows(rows, filter), [rows, filter]);
  // One line per work stream + initiative, as in the sheet.
  const groups = useMemo(() => groupDelayRows(visible).flatMap(s => s.initiatives.map(i => ({ ...i, stream: s.stream, key: `${s.stream}::${i.id}` }))), [visible]);
  const pagination = usePagination(groups, JSON.stringify(filter), 25);

  const isFiltered = filter.statuses.length + filter.deliveries.length > 0 || !!filter.stream || !!filter.search.trim();
  const exportQuery = delayFilterToParams(filter, new URLSearchParams({ plan: planId, period: periodId })).toString();
  const allCollapsed = groups.length > 0 && groups.every(g => collapsed.has(g.key));
  const toggleGroup = (key: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div>
      {/* Filters: one row, above the table — as in the initiatives table */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter.search}
            onChange={e => update({ search: e.target.value })}
            placeholder="Search activity, initiative or stream"
            className="h-9 w-64 rounded-xl border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Select value={filter.stream || ALL_STREAMS} onValueChange={v => update({ stream: v === ALL_STREAMS ? "" : v })}>
          <SelectTrigger className="h-9 w-[260px] gap-2 rounded-xl bg-background text-sm" aria-label="Work stream">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="All work streams" />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            <SelectItem value={ALL_STREAMS}>All work streams</SelectItem>
            {streams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {isFiltered && (
            <button type="button" onClick={() => setFilter(EMPTY_DELAY_FILTER)} className="h-9 rounded-xl px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map(g => g.key)))}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            {allCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5" /> : <ChevronsDownUp className="h-3.5 w-3.5" />}
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground">
                  <Upload className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{describeDelayFilter(filter)} · {visible.length} activities</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <a href={`/api/export/dashboard/activities?${exportQuery}`}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    <span className="flex flex-col"><span>Excel</span><span className="text-[11px] text-muted-foreground">As filtered, grouped by stream and initiative</span></span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/export/dashboard/activities?${exportQuery}&format=pdf`}>
                    <FileText className="mr-2 h-4 w-4" />
                    <span className="flex flex-col"><span>PDF</span><span className="text-[11px] text-muted-foreground">As filtered, landscape</span></span>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <FilterChip active={filter.statuses.length === 0} onClick={() => update({ statuses: [] })} label="All statuses" count={Object.values(statusCounts).reduce((s, n) => s + n, 0)} />
        {ACTIVITY_STATUS_ORDER.filter(s => statusCounts[s] > 0 || filter.statuses.includes(s)).map(s => (
          <FilterChip key={s} active={filter.statuses.includes(s)} onClick={() => update({ statuses: toggleIn(filter.statuses, s) })} label={s} count={statusCounts[s]} color={ACTIVITY_STATUS_COLOR[s]} />
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={filter.deliveries.length === 0} onClick={() => update({ deliveries: [] })} label="Any delivery" count={Object.values(deliveryCounts).reduce((s, n) => s + n, 0)} />
        {DELIVERY_ORDER.filter(d => deliveryCounts[d] > 0 || filter.deliveries.includes(d)).map(d => (
          <FilterChip key={d} active={filter.deliveries.includes(d)} onClick={() => update({ deliveries: toggleIn(filter.deliveries, d) })} label={DELIVERY_STATE_LABEL[d]} count={deliveryCounts[d]} color={DELIVERY_COLOR[d]} />
        ))}
      </div>

      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="w-8 px-2 pb-3" />
              <th className="px-2 pb-3 font-medium">Code</th>
              <th className="px-2 pb-3 font-medium">Initiative / major activity</th>
              <th className="px-2 pb-3 font-medium">Due</th>
              <th className="px-2 pb-3 text-right font-medium">Days delayed</th>
              <th className="px-2 pb-3 font-medium">Status</th>
              <th className="px-2 pb-3 font-medium">Delivery</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pagination.items.map(g => {
              const isOpen = !collapsed.has(g.key);
              const due = g.rows.reduce<string | null>((m, r) => (r.dueDate && (!m || r.dueDate > m) ? r.dueDate : m), null);
              const late = g.rows.filter(r => r.delivery === "overdue").length;
              const done = g.rows.filter(r => r.delivery === "completedOnTime" || r.delivery === "completedLate").length;
              return (
                <Fragment key={g.key}>
                  <tr className={cn("cursor-pointer transition hover:bg-muted/40", isOpen && "bg-muted/30")} onClick={() => toggleGroup(g.key)}>
                    <td className="px-2 py-3 text-muted-foreground">
                      <button type="button" aria-expanded={isOpen} aria-label={isOpen ? "Hide activities" : "Show activities"} className="rounded p-0.5 hover:bg-muted" onClick={e => { e.stopPropagation(); toggleGroup(g.key); }}>
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-xs text-muted-foreground">{g.code}</td>
                    <td className="max-w-[420px] px-2 py-3">
                      <p className="truncate font-medium" title={g.title}>{g.title}</p>
                      <p className="truncate text-xs text-muted-foreground" title={g.stream}>{g.stream} · {g.rows.length} activit{g.rows.length === 1 ? "y" : "ies"}</p>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-xs text-muted-foreground">{due ? shortDate(due) : "—"}</td>
                    <td className="px-2 py-3 text-right"><Days value={g.worstDelay} late={late > 0} /></td>
                    <td className="px-2 py-3" />
                    <td className="whitespace-nowrap px-2 py-3 text-xs">
                      {late > 0
                        ? <span className="font-semibold text-red-700 dark:text-red-400">{late} overdue</span>
                        : done === g.rows.length
                          ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">All completed</span>
                          : <span className="text-muted-foreground">{done ? `${done} of ${g.rows.length} completed` : "Not yet due"}</span>}
                    </td>
                  </tr>
                  {isOpen && g.rows.map(r => (
                    <tr key={r.id} className="bg-muted/20">
                      <td />
                      <td />
                      <td className="max-w-[420px] py-2.5 pl-4 pr-2">
                        <p className="text-sm leading-snug">{r.activity}</p>
                        {r.deliverable && <p className="mt-0.5 truncate text-xs text-muted-foreground" title={r.deliverable}>{r.deliverable}</p>}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-xs text-muted-foreground">
                        {r.dueDate ? shortDate(r.dueDate) : "—"}
                        {r.completionDate && <><br />Done {shortDate(r.completionDate)}</>}
                      </td>
                      <td className="px-2 py-2.5 text-right"><Days value={r.daysDelayed} late={(r.daysDelayed ?? 0) > 0 && r.delivery !== "completedOnTime"} /></td>
                      <td className="px-2 py-2.5"><ActivityStatusPill status={r.status} /></td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-xs">
                        <span className={cn(
                          r.delivery === "overdue" && "font-semibold text-red-700 dark:text-red-400",
                          r.delivery === "completedLate" && "font-semibold text-amber-700 dark:text-amber-400",
                          r.delivery === "completedOnTime" && "font-semibold text-emerald-700 dark:text-emerald-400",
                          (r.delivery === "notYetDue" || r.delivery === "noDueDate") && "text-muted-foreground",
                        )}>{DELIVERY_STATE_LABEL[r.delivery]}</span>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {groups.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-10 text-center text-sm text-muted-foreground">No activities match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-xs text-muted-foreground">
          Days delayed = completion date (or the period end, if still open) − due date; negative is days still to go. An initiative shows its worst activity.
        </p>
        <Pagination state={pagination} noun="initiatives" />
      </div>
    </div>
  );
}
