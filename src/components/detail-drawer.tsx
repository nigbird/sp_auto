"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

// ---------------------------------------------------------------------------
// List pages show items as compact rows; clicking one opens everything about
// it in this side panel, with previous/next to walk the list.
// ---------------------------------------------------------------------------

/** Column header cell, styled like the other list tables. */
export function TableHeadCell({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("h-10 px-4 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80", className)}>{children}</th>;
}

/** A clickable row: the whole row opens the item, and it's reachable by keyboard. */
export function ClickableRow({ selected, onOpen, label, children }: { selected?: boolean; onOpen: () => void; label: string; children: React.ReactNode }) {
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

/**
 * The side panel. `eyebrow` is the small line above the title, `badge` sits
 * next to the title, `description` goes under it and `footer` is pinned to the
 * bottom (actions such as Approve).
 */
export function DetailDrawer({ open, onOpenChange, eyebrow, title, badge, description, index, count, onPrev, onNext, footer, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  badge?: React.ReactNode;
  description?: React.ReactNode;
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
        <SheetHeader className="space-y-2 border-b border-border/60 px-6 pb-4 pt-5 text-left">
          <div className="flex min-h-7 items-center gap-2 pr-8 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">{eyebrow}</span>
            {count > 1 && index >= 0 && (
              <div className="ml-auto flex items-center gap-1">
                <span className="tabular-nums">{index + 1} of {count}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrev} disabled={index <= 0} aria-label="Previous">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNext} disabled={index >= count - 1} aria-label="Next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SheetTitle className="text-lg font-semibold leading-snug">{title}</SheetTitle>
            {badge}
          </div>
          <SheetDescription asChild>
            <div className="space-y-1 text-xs text-muted-foreground">{description}</div>
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-border/60 bg-background px-6 py-4">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Keeps a selected id plus previous/next over an ordered list. `all` lets the
 * panel stay on an item that just left the list (e.g. a report submitted
 * while viewing "Not started").
 */
export function useListSelection<T extends { id: string }>(list: T[], all: T[] = list) {
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
