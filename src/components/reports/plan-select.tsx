"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Switches the performance report to another strategic plan (resetting the period to that plan's latest). */
export function PlanSelect({ plans, value }: { plans: { id: string; name: string; version: string; status: string }[]; value: string }) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(id) => router.push(`/reports?plan=${id}`)}>
      <SelectTrigger className="w-full sm:w-[320px]">
        <SelectValue placeholder="Select a strategic plan" />
      </SelectTrigger>
      <SelectContent>
        {plans.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name} ({p.version}){p.status !== "PUBLISHED" ? " — draft" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
