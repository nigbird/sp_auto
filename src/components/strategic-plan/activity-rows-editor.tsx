"use client";

import * as React from "react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { calculateInitiativeWeight, cn } from "@/lib/utils";
import type { PlanFormValues } from "@/lib/plan-schema";
import { ListIssue } from "./plan-form-issues";
import { ActivityLeadOwnerField, applyResponsibleDefaults, type PlanPerson } from "./activity-lead-owner-field";
import { ActivityCollaboratorsField } from "./activity-collaborators-field";

type PlanActivity = PlanFormValues["pillars"][number]["objectives"][number]["initiatives"][number]["activities"][number];
type ActivitiesPath = `pillars.${number}.objectives.${number}.initiatives.${number}.activities`;

/** The plan view's column-heading style, used as each field's caption. */
const CAPTION = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80";

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <p className={CAPTION}>{label}</p>
      {children}
    </div>
  );
}

/**
 * An initiative's activities, one block per activity instead of a nine-column
 * table: the fields wrap to the screen width (title and weight; deliverable;
 * dates, responsible person and lead owner; collaborators), so nothing scrolls
 * sideways and a long collaborator list can't spill out of its row. Every field
 * stays mounted, so validation can always jump to it.
 */
export function ActivityRowsEditor({ form, path, number, users, userOptions, createActivity }: {
  form: UseFormReturn<PlanFormValues>;
  path: ActivitiesPath;
  /** The initiative's number, e.g. "1.2.3"; each activity is numbered under it. */
  number: string;
  users: PlanPerson[];
  userOptions: { value: string; label: string }[];
  createActivity: () => PlanActivity;
}) {
  const { control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: path });
  const activities = form.watch(path) ?? [];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
        {fields.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No activities yet.</p>}
        {fields.map((activity, aIndex) => {
          const base = `${path}.${aIndex}` as const;
          return (
            <div key={activity.id} className={cn("space-y-3 px-4 py-4", aIndex > 0 && "border-t border-border/50")}>
              <div className="flex items-center justify-between gap-2">
                <p className={CAPTION}>Activity {number}.{aIndex + 1}</p>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(aIndex)}>
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-12">
                <Field label="Title" className="sm:col-span-3 lg:col-span-10">
                  <FormField control={control} name={`${base}.title`} render={({ field }) => (
                    <FormItem><FormControl><Input {...field} placeholder="Activity title" /></FormControl><FormMessage /></FormItem>
                  )} />
                </Field>
                <Field label="Weight" className="sm:col-span-1 lg:col-span-2">
                  <FormField control={control} name={`${base}.weight`} render={({ field }) => (
                    <FormItem>
                      <div className="relative">
                        <FormControl><Input type="number" step="0.01" min={0} max={100} {...field} className="pr-8 tabular-nums" /></FormControl>
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </Field>

                <Field label="Deliverable" className="sm:col-span-4 lg:col-span-12">
                  <FormField control={control} name={`${base}.deliverable`} render={({ field }) => (
                    <FormItem><FormControl><Textarea {...field} value={field.value ?? ""} rows={1} className="min-h-10 resize-y" placeholder="e.g., Segmented customer report" /></FormControl><FormMessage /></FormItem>
                  )} />
                </Field>

                <Field label="Start" className="sm:col-span-2 lg:col-span-2">
                  <FormField control={control} name={`${base}.startDate`} render={({ field }) => (
                    <FormItem><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </Field>
                <Field label="End" className="sm:col-span-2 lg:col-span-2">
                  <FormField control={control} name={`${base}.endDate`} render={({ field }) => (
                    <FormItem><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </Field>
                <Field label="Responsible" className="sm:col-span-2 lg:col-span-4">
                  <FormField control={control} name={`${base}.responsible`} render={({ field }) => (
                    <FormItem data-field-path={field.name} tabIndex={-1}>
                      <Select onValueChange={(v) => { field.onChange(v); applyResponsibleDefaults(form, base, v, users); }} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                        <SelectContent>{userOptions.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </Field>
                <Field label="Lead / Owner" className="sm:col-span-2 lg:col-span-4">
                  <ActivityLeadOwnerField form={form} name={`${base}.leadOwner`} />
                </Field>

                <Field label="Collaborating units" className="sm:col-span-4 lg:col-span-12">
                  <ActivityCollaboratorsField form={form} name={`${base}.collaborators`} />
                </Field>
              </div>
            </div>
          );
        })}
      </div>
      <ListIssue path={path} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => append(createActivity())}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
        </Button>
        <p className="text-sm font-medium text-muted-foreground">
          Subtotal: <span className="tabular-nums text-foreground">{calculateInitiativeWeight(activities).toFixed(1)}%</span> of whole plan
        </p>
      </div>
    </div>
  );
}
