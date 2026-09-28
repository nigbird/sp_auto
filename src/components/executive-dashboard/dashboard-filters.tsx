"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardPeriodOption, DashboardPlanOption } from "@/lib/dashboard-data";

/** Plan and period pickers. Changing either reloads the dashboard for that selection from the server. */
export function DashboardFilters({ plans, planId, periods, periodId }: {
  plans: DashboardPlanOption[];
  planId?: string;
  periods: DashboardPeriodOption[];
  periodId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
    startTransition(() => router.push(`/?${search.toString()}`));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading" />}
      {plans.length > 1 && (
        <Select value={planId} onValueChange={id => go({ plan: id })}>
          <SelectTrigger className="h-9 w-[220px] rounded-full bg-background/80 backdrop-blur" aria-label="Strategic plan">
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
          <SelectTrigger className="h-9 w-[200px] rounded-full bg-background/80 backdrop-blur" aria-label="Reporting period">
            <SelectValue placeholder="Reporting period" />
          </SelectTrigger>
          <SelectContent>
            {[...periods].reverse().map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}{p.reportRequested ? "" : " · no reports requested"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
