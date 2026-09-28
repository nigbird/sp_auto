"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, FileSpreadsheet, FileText, Loader2, Upload } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { DashboardPeriodOption, DashboardPlanOption } from "@/lib/dashboard-data";

/** Plan and period pickers plus export. Changing a picker reloads the dashboard for that selection from the server. */
export function DashboardFilters({ plans, planId, periods, periodId, tab }: {
  plans: DashboardPlanOption[];
  planId?: string;
  periods: DashboardPeriodOption[];
  periodId?: string;
  /** The active dashboard tab, kept when the plan or period changes. */
  tab?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, tab: tab && tab !== "overview" ? tab : undefined })) if (v) search.set(k, v);
    startTransition(() => router.push(`/?${search.toString()}`));
  };

  const exportBase = planId ? `/api/export/plan/${planId}${periodId ? `?period=${periodId}` : ""}` : null;
  const dashboardQuery = new URLSearchParams({ ...(planId ? { plan: planId } : {}), ...(periodId ? { period: periodId } : {}) }).toString();
  const now = Date.now();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading" />}

      {plans.length > 1 && (
        <Select value={planId} onValueChange={id => go({ plan: id })}>
          <SelectTrigger className="h-10 w-[210px] rounded-xl border-border/70 bg-card shadow-sm" aria-label="Strategic plan">
            <SelectValue placeholder="Strategic plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · v{p.version}{p.status !== "PUBLISHED" ? " (draft)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {periods.length > 0 && (
        <Select value={periodId} onValueChange={id => go({ plan: planId, period: id })}>
          <SelectTrigger className="h-10 w-[230px] gap-2 rounded-xl border-border/70 bg-card shadow-sm" aria-label="Reporting period">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Reporting period" />
          </SelectTrigger>
          <SelectContent>
            {[...periods].reverse().map(p => {
              const open = new Date(p.endDate).getTime() > now;
              return (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {open ? " · in progress" : p.reportRequested ? "" : " · no reports requested"}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      {exportBase && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Upload className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Dashboard (all tabs, with charts)</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a href={`/api/export/dashboard?${dashboardQuery}`}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                <span className="flex flex-col"><span>Excel workbook</span><span className="text-[11px] text-muted-foreground">One sheet per tab, charts included</span></span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`/api/export/dashboard?${dashboardQuery}&format=pdf`}>
                <FileText className="mr-2 h-4 w-4" />
                <span className="flex flex-col"><span>PDF report</span><span className="text-[11px] text-muted-foreground">Every section with its charts</span></span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Plan</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a href={exportBase}><FileSpreadsheet className="mr-2 h-4 w-4" /> Cascaded plan workbook</a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
