"use client";

import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { MultiSelect } from "@/components/ui/multi-select";

/**
 * An activity's collaborating units — the units that work with the lead owner
 * on it ("Responsible / Collaborating Unit" in the plan sheet). Any number can
 * be picked from the Departments list; a unit already saved on the activity
 * (e.g. from an imported sheet) stays selectable even if it isn't on the list.
 */
export function ActivityCollaboratorsField({ form, name, units }: { form: UseFormReturn<any>; name: string; units: string[] }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => {
      const selected: string[] = field.value ?? [];
      const options = Array.from(new Set([...units, ...selected])).map(u => ({ value: u, label: u }));
      return (
        <FormItem data-field-path={field.name} tabIndex={-1}>
          <FormControl>
            <MultiSelect options={options} selected={selected} onChange={field.onChange} placeholder="Select units..." />
          </FormControl>
          <FormMessage />
        </FormItem>
      );
    }} />
  );
}
