"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRangeValue } from "@/lib/list-filters";
import { formatRatio, formatWeight, rollUp, type ReportStatusLabel, type WeightedValues } from "@/lib/report-calculations";
import {
  filterPerformanceTree, filtersToParams, isNarrowed, treeActivities, REPORT_STATE_LABEL, RESULT_STATUSES,
  type FilterableActivity, type PerformanceFilters, type ReportState, type TreeInitiative, type TreePillar,
} from "@/lib/performance-report";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DateRangeFilter, ListToolbar, SearchBox } from "../list-controls";
import { REPORT_COLUMNS, REPORT_VIEWS, statusClass, type ColumnGroup, type ReportColumn } from "./performance-report-columns";

/** Plain, pre-computed report data: cells are strings in REPORT_COLUMNS order. */
export interface GridActivity extends FilterableActivity {
  id: string;
  cells: string[] | null;
  /** Weighted values from an approved report, so totals follow the filters. */
  weighted: WeightedValues | null;
  statusText: string;
}
export type GridPillar = TreePillar<GridActivity>;
type GridInitiative = TreeInitiative<GridActivity>;

type View = ColumnGroup | 'all';

const ALL = "__all__";
const pick = <T extends string>(v: string) => (v === ALL ? undefined : (v as T));
const weightedOf = (activities: GridActivity[]) => activities.map(a => a.weighted).filter((w): w is WeightedValues => w !== null);

/**
 * The report table with column-group views, so each view fits on screen;
 * "All columns" keeps the full sheet layout and scrolls sideways. The header
 * and the activity column stay pinned while scrolling. Filters narrow the
 * rows, and the totals and initiative lines follow them.
 */
export function PerformanceReportGrid({ pillars: allPillars, exportBase }: { pillars: GridPillar[]; exportBase: string | null }) {
  const [view, setView] = useState<View>('progress');
  const [query, setQuery] = useState('');
  const [pillarId, setPillarId] = useState(ALL);
  const [owner, setOwner] = useState(ALL);
  const [report, setReport] = useState(ALL);
  const [result, setResult] = useState(ALL);
  const [range, setRange] = useState<DateRangeValue>({});

  const filters: PerformanceFilters = { q: query, pillar: pick(pillarId), owner: pick(owner), report: pick<ReportState>(report), result: pick<ReportStatusLabel>(result), range };
  const narrowed = isNarrowed(filters);
  const reset = () => { setQuery(''); setPillarId(ALL); setOwner(ALL); setReport(ALL); setResult(ALL); setRange({}); };

  const pillars = useMemo(
    () => filterPerformanceTree(allPillars, { q: query, pillar: pick(pillarId), owner: pick(owner), report: pick<ReportState>(report), result: pick<ReportStatusLabel>(result), range }),
    [allPillars, query, pillarId, owner, report, result, range]
  );
  const all = useMemo(() => treeActivities(allPillars), [allPillars]);
  const shown = useMemo(() => treeActivities(pillars), [pillars]);
  const owners = useMemo(() => [...new Set(all.map(a => a.office))].filter(o => o !== '—').sort(), [all]);

  const approved = shown.filter(a => a.state === 'APPROVED').length;
  const total = rollUp(weightedOf(shown));

  const columns = REPORT_COLUMNS
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => view === 'all' || column.group === view);
  const colSpan = columns.length + 2; // activity + report status + data columns
  const exportHref = exportBase && narrowed ? `${exportBase}&${filtersToParams(filters).toString()}` : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap overflow-hidden rounded-xl border border-border/50 bg-card sm:flex-nowrap">
        <Stat label="Reports approved" value={`${approved} of ${shown.length}`} first />
        <Stat label="Weighted plan" value={formatWeight(total.weightedPlan)} />
        <Stat label="Weighted actual" value={formatWeight(total.weightedActual)} />
        <Stat label="Weighted actual with delay" value={formatWeight(total.weightedActualWithDelay)} />
        <Stat label="Achieved result" value={formatRatio(total.achievedResult)} sub={total.status} accent />
      </div>

      <ListToolbar count={narrowed ? `${shown.length} of ${all.length} activities match · totals are for these` : `${all.length} activities`}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search activity, owner, initiative or pillar" className="sm:w-80" />
        <Select value={pillarId} onValueChange={setPillarId}>
          <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Pillar"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All pillars</SelectItem>
            {allPillars.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Lead owner"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All lead owners</SelectItem>
            {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={report} onValueChange={setReport}>
          <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Report status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any report status</SelectItem>
            {(Object.keys(REPORT_STATE_LABEL) as ReportState[]).map(s => <SelectItem key={s} value={s}>{REPORT_STATE_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Activity result"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any result</SelectItem>
            {RESULT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangeFilter value={range} onChange={setRange} label="Any dates" hint="Shows activities that run at any point in this range." />
        {narrowed && <Button variant="ghost" className="h-9 px-3" onClick={reset}>Reset</Button>}
        {exportHref && (
          <Button asChild variant="outline" className="h-9 gap-2">
            <a href={exportHref}><FileSpreadsheet className="h-4 w-4 text-green-600" />Export filtered (Excel)</a>
          </Button>
        )}
      </ListToolbar>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Report columns" className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {REPORT_VIEWS.map(v => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === v.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" />Filled in by the activity owner</span>
          <span>{REPORT_VIEWS.find(v => v.id === view)?.hint}</span>
        </p>
      </div>

      {narrowed && shown.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">No activities match the search or filters.</p>
      ) : (
        <ScrollFrame resetKey={view}>
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className={cn(HEAD, "left-0 z-30 min-w-[300px] max-w-[380px] border-r text-left")}>Activity</th>
                <th className={cn(HEAD, "z-20 min-w-[150px] text-left")}>Report</th>
                {columns.map(({ column }) => (
                  <th key={column.label} className={cn(
                    HEAD,
                    "z-20 border-l",
                    column.kind === 'num' || column.kind === 'date' ? "text-right" : "text-left",
                    widthClass(column, view)
                  )}>
                    {column.owner && <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-sky-500 align-middle" title="Filled in by the activity owner" />}
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pillars.map(pillar => (
                <GroupRow key={pillar.id} colSpan={colSpan} className="bg-muted/70 font-semibold text-foreground" indent="pl-4" title={pillar.title}>
                  {pillar.objectives.map(objective => (
                    <GroupRow key={objective.id} colSpan={colSpan} className="bg-muted/35 font-medium text-foreground" indent="pl-8" title={objective.statement}>
                      {objective.initiatives.map(initiative => (
                        <InitiativeRows key={initiative.id} initiative={initiative} columns={columns} />
                      ))}
                    </GroupRow>
                  ))}
                </GroupRow>
              ))}
            </tbody>
          </table>
        </ScrollFrame>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent, first }: { label: string; value: string; sub?: string; accent?: boolean; first?: boolean }) {
  return (
    <div className={cn("min-w-[9rem] flex-1 basis-1/2 px-4 py-3.5 sm:basis-0", !first && "border-l border-border/50")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-2xl font-bold leading-none tracking-tight", accent ? "text-primary" : "text-foreground")}>{value}</p>
      {sub && <p className={cn("mt-1.5 text-xs font-medium", statusClass(sub))}>{sub}</p>}
    </div>
  );
}

/** Header cells: the app's table header (small uppercase muted labels), pinned while scrolling. */
const HEAD = "sticky top-0 h-11 border-b border-border/60 bg-card px-4 py-2 align-bottom text-[11px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/80";

/** Data cells: a light rule between columns so values line up under their heading. */
const CELL = "border-b border-l border-border/50 px-4";

/** Where an activity's report stands, as a pill like the plan page's breakdown status. */
const STATE_PILL: Record<string, string> = {
  APPROVED: "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-700",
  REQUESTED: "border-amber-500/30 bg-amber-500/[0.06] text-amber-700",
  SUBMITTED: "border-blue-500/25 bg-blue-500/[0.06] text-blue-700",
  RETURNED: "border-red-400/30 bg-red-500/[0.06] text-red-700",
};

function widthClass(c: ReportColumn, view: View) {
  if (c.kind === 'text') return view === 'all' ? 'min-w-[240px]' : 'min-w-[220px] w-1/4';
  if (c.kind === 'status') return 'min-w-[150px]';
  return 'min-w-[110px]';
}

/** Scrolls both ways (so the header can stay sticky) and fades the right edge while there is more to see. */
function ScrollFrame({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = 0;
    const update = () => setMore({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [resetKey]);

  return (
    <div className="relative">
      <div ref={ref} className="max-h-[70vh] overflow-auto rounded-xl border border-border/50 bg-card">
        {children}
      </div>
      <div className={cn(
        "pointer-events-none absolute inset-y-px right-px w-10 rounded-r-xl bg-gradient-to-l from-background to-transparent transition-opacity",
        more.right ? "opacity-100" : "opacity-0"
      )} />
      {more.right && !more.left && (
        <span className="pointer-events-none absolute bottom-3 right-4 rounded-full bg-foreground/80 px-2.5 py-1 text-[11px] font-medium text-background shadow">
          Scroll for more →
        </span>
      )}
    </div>
  );
}

// A pillar/objective title spans the row; the inner div sticks left so it stays in view while scrolling.
function GroupRow({ title, colSpan, className, indent, children }: { title: string; colSpan: number; className: string; indent: string; children: ReactNode }) {
  return (
    <>
      <tr className={className}><td colSpan={colSpan} className="border-b border-border/50 py-2"><div className={cn("sticky left-0 w-max pr-4", indent)}>{title}</div></td></tr>
      {children}
    </>
  );
}

type IndexedColumn = { column: ReportColumn; index: number };

/** The initiative line (the Excel's (IV) columns — Σ weighted values and ratios over the rows shown), then its activities. */
function InitiativeRows({ initiative, columns }: { initiative: GridInitiative; columns: IndexedColumn[] }) {
  const rollup = rollUp(weightedOf(initiative.activities));
  const approved = initiative.activities.filter(a => a.state === 'APPROVED').length;
  return (
    <>
      <tr className="font-medium text-foreground/90">
        <td className="sticky left-0 z-10 border-b border-r border-border/50 bg-card py-2 pl-12 pr-4">{initiative.title}</td>
        <td className="whitespace-nowrap border-b border-border/50 px-4 py-2 text-xs font-normal text-muted-foreground">{approved} of {initiative.activities.length} approved</td>
        {columns.map(({ column }) => {
          const value = column.rollup?.(rollup) ?? '';
          return (
            <td key={column.label} className={cn(
              CELL, "py-2",
              column.kind === 'num' && "text-right tabular-nums",
              column.kind === 'status' && statusClass(value)
            )}>
              {value}
            </td>
          );
        })}
      </tr>
      {initiative.activities.map(activity => <ActivityRow key={activity.id} activity={activity} columns={columns} />)}
    </>
  );
}

/**
 * One activity: its report status in its own column, then a cell per report
 * column. Until the report is approved the cells show a faint dash, so it is
 * clear at a glance which activities have values.
 */
function ActivityRow({ activity, columns }: { activity: GridActivity; columns: IndexedColumn[] }) {
  const cells = activity.cells;
  return (
    <tr>
      <td className="sticky left-0 z-10 max-w-[380px] border-b border-r border-border/50 bg-card py-2.5 pl-16 pr-4 align-top">
        <div className="text-foreground">{activity.title}</div>
        {activity.owner && <div className="mt-0.5 text-xs text-muted-foreground">{activity.owner}</div>}
      </td>
      <td className="border-b border-border/50 px-4 py-2.5 align-top">
        <Badge variant="outline" className={cn("whitespace-nowrap font-medium", STATE_PILL[activity.state] ?? "border-border/60 bg-muted/60 text-muted-foreground")}>{activity.statusText}</Badge>
      </td>
      {columns.map(({ column, index }) => {
        const value = cells?.[index] ?? '';
        const empty = value === '' || value === '—';
        return (
          <td key={column.label} className={cn(
            CELL, "py-2.5 align-top text-foreground/90",
            (column.kind === 'num' || column.kind === 'date') && "whitespace-nowrap text-right tabular-nums",
            column.kind === 'text' && "whitespace-pre-wrap break-words",
            column.kind === 'status' && statusClass(value)
          )}>
            {empty ? <span className="text-muted-foreground/40" aria-label="No value">—</span> : value}
          </td>
        );
      })}
    </tr>
  );
}
