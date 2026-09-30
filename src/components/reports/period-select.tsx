"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays } from "lucide-react";

export interface PeriodSelectOption { id: string; name: string; reportRequestSentAt: string | null }

/** Switches the report to another reporting period — lists every period for the plan, noting which ones have never had a report requested. */
export function PeriodSelect({ periods, value, planId }: { periods: PeriodSelectOption[]; value: string; planId: string }) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(id) => router.push(`/reports?plan=${planId}&period=${id}`)}>
      <SelectTrigger className="h-9 w-[260px] gap-2 rounded-xl" aria-label="Reporting period">
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Reporting period" />
      </SelectTrigger>
      <SelectContent>
        {periods.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}{!p.reportRequestSentAt ? " · no reports requested" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
