"use client";

import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { MultiSelect } from "@/components/ui/multi-select";
import { useLeadOwnerNames } from "./activity-lead-owner-field";

/**
 * An activity's collaborating units — the other lead-owner offices that work
 * with the activity's lead owner on it ("Collaborating Unit" in the plan
 * sheet). Any number can be picked from the Lead Owners list; a unit already
 * saved on the activity (e.g. from an imported sheet) stays selectable even if
 * it isn't on the list.
 */
export function ActivityCollaboratorsField({ form, name }: { form: UseFormReturn<any>; name: string }) {
  const leadOwners = useLeadOwnerNames();
  return (
    <FormField control={form.control} name={name} render={({ field }) => {
      const selected: string[] = field.value ?? [];
      const options = Array.from(new Set([...leadOwners, ...selected])).map(u => ({ value: u, label: u }));
      return (
        <FormItem data-field-path={field.name} tabIndex={-1}>
          <FormControl>
            <MultiSelect options={options} selected={selected} onChange={field.onChange} placeholder="Select lead owners..." maxVisible={2} />
          </FormControl>
          <FormMessage />
        </FormItem>
      );
    }} />
  );
}
