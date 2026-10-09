"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { inDateRange, isRangeSet, matchesSearch, type DateRangeValue } from "@/lib/list-filters";
import { DateRangeFilter, ListToolbar, Pagination, SearchBox, usePagination } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlanRowActions } from "./plan-row-actions";

export interface PlanListRow {
  id: string;
  name: string;
  version: string;
  startYear: number;
  endYear: number;
  status: string;
  isActive: boolean;
  updatedAt: Date | string;
}

const ALL = "all";
const STATUSES = [
  { value: ALL, label: "All statuses" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "INACTIVE", label: "Deactivated" },
];

function matchesStatus(plan: PlanListRow, status: string) {
  if (status === ALL) return true;
  if (status === "INACTIVE") return !plan.isActive;
  return plan.isActive && plan.status === status;
}

export function PlanListTable({ plans, currentPlanId }: { plans: PlanListRow[]; currentPlanId?: string }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState(ALL);
  const [range, setRange] = React.useState<DateRangeValue>({});

  const narrowed = query.trim() !== "" || status !== ALL || isRangeSet(range);
  const matching = plans.filter(p =>
    matchesSearch(query, p.name, p.version, `${p.startYear}`, `${p.endYear}`) &&
    matchesStatus(p, status) &&
    inDateRange(p.updatedAt, range)
  );
  const pagination = usePagination(matching, `${query}|${status}|${range.from}|${range.to}`);

  return (
    <>
      <ListToolbar className="px-6 pb-4" count={narrowed ? `${matching.length} of ${plans.length} plans match` : `${plans.length} plans`}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search plan name, version or year" className="sm:w-80" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangeFilter value={range} onChange={setRange} label="Any update date" hint="Shows plans last updated in this range." />
        {narrowed && <Button variant="ghost" className="h-9 px-3" onClick={() => { setQuery(""); setStatus(ALL); setRange({}); }}>Reset</Button>}
      </ListToolbar>

      <div className="border-t border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3 font-medium">Plan</th>
              <th className="px-6 py-3 font-medium">Period</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Last updated</th>
              <th className="px-6 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {matching.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">No plans match the search or filters.</td>
              </tr>
            )}
            {pagination.items.map(plan => {
              const isCurrent = plan.id === currentPlanId;
              return (
                <tr
                  key={plan.id}
                  className={cn(
                    "group transition-colors",
                    isCurrent ? "bg-primary/[0.04]" : "hover:bg-muted/40"
                  )}
                  style={isCurrent ? { boxShadow: "inset 3px 0 0 0 hsl(var(--primary))" } : undefined}
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/strategic-plan/${plan.id}`}
                      className={cn("font-medium hover:underline", plan.isActive ? "text-foreground" : "text-muted-foreground")}
                    >
                      {plan.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">{plan.version}</p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{plan.startYear} – {plan.endYear}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          plan.status === "PUBLISHED" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", plan.status === "PUBLISHED" ? "bg-primary" : "bg-muted-foreground/50")} />
                        {plan.status === "PUBLISHED" ? "Published" : "Draft"}
                      </span>
                      {!plan.isActive && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Deactivated
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{format(new Date(plan.updatedAt), "PP")}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <PlanRowActions planId={plan.id} planName={plan.name} status={plan.status} isActive={plan.isActive} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination state={pagination} noun="plans" className="border-t border-border/60 px-6 py-3" />
    </>
  );
}
