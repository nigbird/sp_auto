"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLeadOwners } from "@/actions/lead-owners";

const NONE = "__none__";

export type PlanPerson = { id: string; name: string; leadOwner?: string | null; department?: string | null };

let cached: Promise<string[]> | null = null;
/** The Configuration → Departments & Lead Owners list, loaded once per page. */
function useLeadOwnerNames() {
  const [names, setNames] = React.useState<string[]>([]);
  React.useEffect(() => {
    cached ??= getLeadOwners().then(list => list.map(l => l.name)).catch(() => []);
    let alive = true;
    cached.then(list => { if (alive) setNames(list); });
    return () => { alive = false; };
  }, []);
  return names;
}

/** An activity's Lead / Owner office picker (optional). */
export function ActivityLeadOwnerField({ form, name }: { form: UseFormReturn<any>; name: string }) {
  const names = useLeadOwnerNames();
  const current: string = form.watch(name) ?? "";
  // An office saved on the activity but no longer on the list still shows.
  const options = Array.from(new Set([...names, current].filter(Boolean)));
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem data-field-path={field.name} tabIndex={-1}>
        <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
          <FormControl>
            <SelectTrigger title={field.value || undefined}><SelectValue placeholder="None" /></SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}

/**
 * When the responsible person changes, bring along their office and
 * department (if their department is on the list) — the usual case, which
 * the planner can still override.
 */
export function applyResponsibleDefaults(form: UseFormReturn<any>, activityPath: string, userId: string, users: PlanPerson[], departments: string[]) {
  const person = users.find(u => u.id === userId);
  if (!person) return;
  if (person.leadOwner) form.setValue(`${activityPath}.leadOwner`, person.leadOwner, { shouldDirty: true });
  if (person.department && departments.includes(person.department)) form.setValue(`${activityPath}.department`, person.department, { shouldDirty: true, shouldValidate: true });
}
