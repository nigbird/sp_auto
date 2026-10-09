"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { formatTargetValue } from "@/lib/monthly-breakdown";
import type { PeriodReportEntry } from "../my-activity/my-activity-report-list";

// ---------------------------------------------------------------------------
// The report pages list activities as compact rows; clicking one opens its
// full report in this side panel, with previous/next to walk the list.
// ---------------------------------------------------------------------------

/** Column header cell, styled like the other list tables. */
export function ReportTh({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("h-10 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80", className)}>{children}</th>;
}

/** A clickable report row: the whole row opens the report, and it's reachable by keyboard. */
export function ReportRow({ selected, onOpen, label, children }: { selected?: boolean; onOpen: () => void; label: string; children: React.ReactNode }) {
  return (
    <tr
      tabIndex={0}
      role="button"
      aria-label={label}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className={cn(
        "group cursor-pointer border-t border-border/50 align-middle transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40",
        selected && "bg-primary/[0.05] hover:bg-primary/[0.05]"
      )}
    >
      {children}
      <td className="w-8 pr-3 text-right">
        <ChevronRight className="inline h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </td>
    </tr>
  );
}

/** Activity title with its initiative underneath, truncated to one line each. */
export function ReportActivityCell({ entry }: { entry: PeriodReportEntry }) {
  const { activity } = entry;
  return (
    <td className="max-w-0 px-4 py-3">
      <p className="truncate font-medium text-foreground" title={activity.title}>{activity.title}</p>
      {activity.initiative && (
        <p className="truncate text-xs text-muted-foreground" title={activity.initiative.title}>{activity.initiative.title}</p>
      )}
    </td>
  );
}

/**
 * The side panel. `position` is "3 of 12" style navigation; `badge` sits next
 * to the title; `footer` is pinned to the bottom (actions such as Approve).
 */
export function ReportDrawer({ entry, open, onOpenChange, badge, meta, index, count, onPrev, onNext, footer, children }: {
  entry: PeriodReportEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge?: React.ReactNode;
  /** Extra line under the dates, e.g. owner and submission time. */
  meta?: React.ReactNode;
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl">
        {entry && (
          <>
            <SheetHeader className="space-y-2 border-b border-border/60 px-6 pb-4 pt-5 text-left">
              <div className="flex items-center gap-2 pr-8 text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider">{entry.reportingPeriod.name}</span>
                {count > 1 && (
                  <div className="ml-auto flex items-center gap-1">
                    <span className="tabular-nums">{index + 1} of {count}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrev} disabled={index <= 0} aria-label="Previous report">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNext} disabled={index >= count - 1} aria-label="Next report">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SheetTitle className="text-lg font-semibold leading-snug">{entry.activity.title}</SheetTitle>
                {badge}
              </div>
              <SheetDescription asChild>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {entry.activity.initiative && (
                    <p>{entry.activity.initiative.objective.pillar.title} → {entry.activity.initiative.objective.statement} → {entry.activity.initiative.title}</p>
                  )}
                  <p>
                    {format(new Date(entry.activity.startDate), "PP")} – {format(new Date(entry.activity.endDate), "PP")} · Target {entry.activity.annualTarget != null ? formatTargetValue(entry.activity.annualTarget, entry.activity.targetType) : "—"}
                  </p>
                  {meta && <p>{meta}</p>}
                  {entry.activity.deliverable && (
                    <p className="pt-1 text-sm text-foreground"><span className="font-medium text-foreground/80">Deliverable:</span> {entry.activity.deliverable}</p>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="border-t border-border/60 bg-background px-6 py-4">{footer}</div>}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Keeps a selected report id plus previous/next over an ordered list. `all`
 * lets the panel stay on a report that just left the list (e.g. submitted
 * while viewing "Not started").
 */
export function useReportSelection(list: PeriodReportEntry[], all: PeriodReportEntry[] = list) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const index = selectedId ? list.findIndex(e => e.id === selectedId) : -1;
  return {
    selectedId,
    selected: index >= 0 ? list[index] : all.find(e => e.id === selectedId) ?? null,
    index,
    count: list.length,
    open: (id: string) => setSelectedId(id),
    close: () => setSelectedId(null),
    prev: () => { if (index > 0) setSelectedId(list[index - 1].id); },
    next: () => { if (index >= 0 && index < list.length - 1) setSelectedId(list[index + 1].id); },
  };
}
