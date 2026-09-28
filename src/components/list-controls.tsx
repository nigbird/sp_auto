"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isRangeSet, type DateRangeValue } from "@/lib/list-filters";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function SearchBox({ value, onChange, placeholder = "Search", className }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="pl-9 pr-8" aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date range
// ---------------------------------------------------------------------------

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/** Quick ranges. The fiscal year runs July to June, so its quarters are the calendar quarters. */
function presets(today = new Date()): { label: string; range: DateRangeValue }[] {
  const y = today.getFullYear(), m = today.getMonth();
  const qStart = Math.floor(m / 3) * 3;
  const fyStart = m >= 6 ? y : y - 1;
  return [
    { label: "This month", range: { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) } },
    { label: "This quarter", range: { from: ymd(new Date(y, qStart, 1)), to: ymd(new Date(y, qStart + 3, 0)) } },
    { label: "Next 30 days", range: { from: ymd(today), to: ymd(new Date(y, m, today.getDate() + 30)) } },
    { label: `Fiscal year ${fyStart}/${String(fyStart + 1).slice(2)}`, range: { from: ymd(new Date(fyStart, 6, 1)), to: ymd(new Date(fyStart + 1, 5, 30)) } },
  ];
}

const rangeText = (r: DateRangeValue) => {
  const f = (s: string) => format(new Date(`${s}T00:00:00`), "d MMM yyyy");
  if (r.from && r.to) return `${f(r.from)} – ${f(r.to)}`;
  if (r.from) return `From ${f(r.from)}`;
  if (r.to) return `Until ${f(r.to)}`;
  return "";
};

/**
 * A date-range filter: a button showing the current range, and a popover with
 * quick ranges and from/to dates. `label` says what the dates apply to.
 */
export function DateRangeFilter({ value, onChange, label = "Any date", hint, className }: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  label?: string;
  /** What the range is matched against, e.g. "Activities running at any point in this range". */
  hint?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const set = isRangeSet(value);
  const invalid = !!(value.from && value.to && value.from > value.to);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-10 justify-start gap-2 font-normal", set && "border-primary/60 bg-primary/5", className)}>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className={cn("truncate", !set && "text-muted-foreground")}>{set ? rangeText(value) : label}</span>
          {set && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear dates"
              onClick={e => { e.stopPropagation(); onChange({}); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange({}); } }}
              className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-4">
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        <div className="flex flex-wrap gap-1.5">
          {presets().map(p => (
            <Button key={p.label} type="button" size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => { onChange(p.range); setOpen(false); }}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="range-from" className="text-xs">From</Label>
            <Input id="range-from" type="date" value={value.from ?? ""} max={value.to} onChange={e => onChange({ ...value, from: e.target.value || undefined })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="range-to" className="text-xs">To</Label>
            <Input id="range-to" type="date" value={value.to ?? ""} min={value.from} onChange={e => onChange({ ...value, to: e.target.value || undefined })} />
          </div>
        </div>
        {invalid && <p className="text-xs font-medium text-destructive">The start date is after the end date.</p>}
        <div className="flex justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})} disabled={!set}>Clear</Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const PAGE_SIZES = [10, 25, 50, 100];

export interface PaginationState<T> {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  items: T[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

/**
 * Pages a list. Goes back to page 1 whenever `resetKey` changes (pass the
 * current filters), and never points past the last page.
 */
export function usePagination<T>(all: T[], resetKey = "", initialPageSize = 10): PaginationState<T> {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSizeState] = React.useState(initialPageSize);

  React.useEffect(() => { setPage(1); }, [resetKey]);

  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  const current = Math.min(page, pageCount);
  const items = React.useMemo(() => all.slice((current - 1) * pageSize, current * pageSize), [all, current, pageSize]);

  return {
    page: current,
    pageSize,
    pageCount,
    total: all.length,
    items,
    setPage: p => setPage(Math.max(1, Math.min(p, pageCount))),
    setPageSize: size => { setPageSizeState(size); setPage(1); },
  };
}

/** Page numbers with gaps: 1 … 4 5 6 … 12 */
function pageList(page: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter(p => p >= 1 && p <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => { if (i > 0 && p - sorted[i - 1] > 1) out.push("gap"); out.push(p); });
  return out;
}

export function Pagination<T>({ state, noun = "items", className }: { state: PaginationState<T>; noun?: string; className?: string }) {
  const { page, pageSize, pageCount, total, setPage, setPageSize } = state;
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className={cn("flex flex-wrap items-center justify-between gap-3 text-sm", className)}>
      <p className="text-muted-foreground">
        Showing <span className="font-medium text-foreground">{first}–{last}</span> of <span className="font-medium text-foreground">{total}</span> {noun}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Per page</span>
          <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[72px]" aria-label="Items per page"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pageList(page, pageCount).map((p, i) =>
              p === "gap" ? (
                <span key={`gap-${i}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "ghost"}
                  size="sm"
                  className="h-8 min-w-8 px-2 tabular-nums"
                  onClick={() => setPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Page ${p}`}
                >
                  {p}
                </Button>
              )
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(page + 1)} disabled={page === pageCount} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}

/** Filters row: controls on the left, an optional result count on the right. */
export function ListToolbar({ children, count, className }: { children: React.ReactNode; count?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
      {count != null && <p className="ml-auto text-sm text-muted-foreground">{count}</p>}
    </div>
  );
}
