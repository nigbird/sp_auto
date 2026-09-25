"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { REPORT_COLUMNS, REPORT_VIEWS, statusClass, type ColumnGroup, type ReportColumn } from "./performance-report-columns";

/** Plain, pre-computed report data: cells are strings in REPORT_COLUMNS order. */
export interface GridActivity { id: string; title: string; owner: string; cells: string[] | null; statusText: string }
export interface GridInitiative { id: string; title: string; rollup: string[]; rows: GridActivity[] }
export interface GridObjective { id: string; statement: string; initiatives: GridInitiative[] }
export interface GridPillar { id: string; title: string; objectives: GridObjective[] }

type View = ColumnGroup | 'all';

/**
 * The report table with column-group views, so each view fits on screen;
 * "All columns" keeps the full sheet layout and scrolls sideways. The header
 * and the activity column stay pinned while scrolling.
 */
export function PerformanceReportGrid({ pillars }: { pillars: GridPillar[] }) {
  const [view, setView] = useState<View>('progress');
  const columns = REPORT_COLUMNS
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => view === 'all' || column.group === view);
  const colSpan = columns.length + 1;

  return (
    <div className="space-y-3">
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
        <p className="text-xs text-muted-foreground">{REPORT_VIEWS.find(v => v.id === view)?.hint}</p>
      </div>

      <ScrollFrame resetKey={view}>
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b bg-primary px-3 py-2.5 text-left font-semibold text-primary-foreground">Major Activities</th>
              {columns.map(({ column }) => (
                <th key={column.label} className={cn(
                  "sticky top-0 z-20 border-b px-2 py-2.5 font-semibold text-primary-foreground",
                  column.owner ? "bg-sky-700" : "bg-primary",
                  column.kind === 'text' ? "text-left" : "text-center",
                  widthClass(column, view)
                )}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pillars.map(pillar => (
              <GroupRow key={pillar.id} colSpan={colSpan} className="bg-amber-400/80 font-semibold text-amber-950" title={pillar.title}>
                {pillar.objectives.map(objective => (
                  <GroupRow key={objective.id} colSpan={colSpan} className="bg-sky-200/70 font-medium text-sky-950 dark:bg-sky-900/50 dark:text-sky-100" title={objective.statement}>
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
    </div>
  );
}

function widthClass(c: ReportColumn, view: View) {
  if (c.kind === 'text') return view === 'all' ? 'min-w-[220px]' : 'min-w-[200px] w-1/4';
  if (c.kind === 'status') return 'min-w-[130px]';
  return 'min-w-[92px]';
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
      <div ref={ref} className="max-h-[70vh] overflow-auto rounded-md border">
        {children}
      </div>
      <div className={cn(
        "pointer-events-none absolute inset-y-px right-px w-10 rounded-r-md bg-gradient-to-l from-background to-transparent transition-opacity",
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
function GroupRow({ title, colSpan, className, children }: { title: string; colSpan: number; className: string; children: ReactNode }) {
  return (
    <>
      <tr className={className}><td colSpan={colSpan} className="border-b py-1.5"><div className="sticky left-0 w-max px-3">{title}</div></td></tr>
      {children}
    </>
  );
}

type IndexedColumn = { column: ReportColumn; index: number };

/** The initiative line (the Excel's (IV) columns — Σ weighted values and ratios), then its activities. */
function InitiativeRows({ initiative, columns }: { initiative: GridInitiative; columns: IndexedColumn[] }) {
  return (
    <>
      <tr className="bg-muted/60 font-medium">
        <td className="sticky left-0 z-10 border-b bg-muted px-3 py-1.5 italic">{initiative.title}</td>
        {columns.map(({ column, index }) => (
          <td key={column.label} className={cn(
            "border-b px-2 py-1.5",
            column.kind === 'num' && "text-right tabular-nums",
            column.kind === 'status' && statusClass(initiative.rollup[index])
          )}>
            {initiative.rollup[index]}
          </td>
        ))}
      </tr>
      {initiative.rows.map(activity => <ActivityRow key={activity.id} activity={activity} columns={columns} />)}
    </>
  );
}

function ActivityRow({ activity, columns }: { activity: GridActivity; columns: IndexedColumn[] }) {
  const name = (
    <td className="sticky left-0 z-10 border-b bg-background px-3 py-2 align-top">
      <div className="font-medium">{activity.title}</div>
      <div className="text-muted-foreground">{activity.owner}</div>
    </td>
  );

  if (!activity.cells) {
    return (
      <tr>
        {name}
        <td colSpan={columns.length} className="border-b px-3 py-2 italic text-muted-foreground">{activity.statusText}</td>
      </tr>
    );
  }

  const cells = activity.cells;
  return (
    <tr className="hover:bg-muted/30">
      {name}
      {columns.map(({ column, index }) => (
        <td key={column.label} className={cn(
          "border-b border-l px-2 py-2 align-top",
          column.owner && "bg-sky-500/5",
          column.kind === 'num' && "text-right tabular-nums",
          column.kind === 'text' && "whitespace-pre-wrap break-words",
          column.kind === 'status' && statusClass(cells[index])
        )}>
          {cells[index]}
        </td>
      ))}
    </tr>
  );
}
