
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, RefreshCcw } from "lucide-react"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { Activity, StrategicPlan, Pillar, Objective, Initiative, ReportingPeriod } from "@/lib/types"
import { ScrollArea } from "../ui/scroll-area"

const kpiSchema = z.object({
  name: z.string().optional(),
  unit: z.string().optional(),
  hasTarget: z.boolean().default(true),
  direction: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER"]).default("HIGHER_IS_BETTER"),
  target: z.coerce.number().optional(),
  actual: z.coerce.number().optional(),
})

const activitySchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters." }),
  description: z.string().optional(),
  department: z.string({ required_error: "Please select a department." }).optional(),
  responsible: z.string({ required_error: "Please select a responsible person." }),
  startDate: z.date({ required_error: "A start date is required." }),
  endDate: z.date({ required_error: "An end date is required." }),
  status: z.string().optional(),
  weight: z.coerce.number().min(0).max(100),
  initiativeId: z.string().optional(),
  pillarId: z.string().optional(),
  objectiveId: z.string().optional(),
  reportingPeriodId: z.string().optional(),
  kpi: kpiSchema.optional(),
  deliverablesText: z.string().optional(),
})

type ActivityFormValues = Omit<z.infer<typeof activitySchema>, 'deliverablesText'> & { deliverables: string[] };

type ActivityFormProps = {
  onSubmit: (values: ActivityFormValues) => void;
  activity?: Activity | null;
  users: {id: string, name: string}[];
  onCancel: () => void;
  strategicPlan?: StrategicPlan | null;
  periods?: ReportingPeriod[];
}

export function ActivityForm({ onSubmit, activity, users, onCancel, strategicPlan, periods }: ActivityFormProps) {
  const existingKpi = activity?.kpis?.[0];
  const form = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: activity?.title ?? "",
      description: activity?.description ?? "",
      department: activity?.department ?? "",
      responsible: (activity?.responsible as any)?.id ?? "",
      startDate: activity?.startDate ? new Date(activity.startDate) : undefined,
      endDate: activity?.endDate ? new Date(activity.endDate) : undefined,
      status: activity?.status ?? "Not Started",
      weight: activity?.weight ?? 50,
      initiativeId: activity?.initiativeId ?? undefined,
      reportingPeriodId: activity?.reportingPeriodId ?? undefined,
      deliverablesText: activity?.deliverables?.map(d => d.title).join('\n') ?? "",
      kpi: {
        name: existingKpi?.name ?? "",
        unit: existingKpi?.unit ?? "",
        hasTarget: existingKpi?.hasTarget ?? true,
        direction: existingKpi?.direction ?? "HIGHER_IS_BETTER",
        target: existingKpi?.target ?? undefined,
        actual: existingKpi?.actual ?? undefined,
      },
    },
  })

  const kpiHasTarget = form.watch("kpi.hasTarget");
  
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
  const [selectedObjective, setSelectedObjective] = useState<Objective | null>(null);

  const pillarId = form.watch("pillarId");
  const objectiveId = form.watch("objectiveId");

  useEffect(() => {
    if (pillarId) {
      setSelectedPillar(strategicPlan?.pillars.find(p => p.id === pillarId) ?? null);
    } else {
      setSelectedPillar(null);
    }
    form.setValue("objectiveId", undefined);
    form.setValue("initiativeId", undefined);
  }, [pillarId, strategicPlan, form]);

  useEffect(() => {
    if (objectiveId) {
      setSelectedObjective(selectedPillar?.objectives.find(o => o.id === objectiveId) ?? null);
    } else {
      setSelectedObjective(null);
    }
    form.setValue("initiativeId", undefined);
  }, [objectiveId, selectedPillar, form]);

  const getSubmitButtonText = () => {
    if (activity) {
      return "Save Changes";
    }
    return "Submit for Approval";
  }

  const handleValidSubmit = (values: z.infer<typeof activitySchema>) => {
    const { deliverablesText, ...rest } = values;
    const deliverables = (deliverablesText ?? "")
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    onSubmit({ ...rest, deliverables });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleValidSubmit)} className="space-y-6">
        <ScrollArea className="h-[60vh] p-1">
          <div className="space-y-6 pr-6">
            {strategicPlan && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="pillarId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pillar</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a Pillar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {strategicPlan.pillars.map(pillar => (
                            <SelectItem key={pillar.id} value={pillar.id}>{pillar.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="objectiveId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Objective</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={!selectedPillar}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an Objective" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selectedPillar?.objectives.map(objective => (
                            <SelectItem key={objective.id} value={objective.id}>{objective.statement}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="initiativeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initiative</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={!selectedObjective}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an Initiative" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selectedObjective?.initiatives.map(initiative => (
                            <SelectItem key={initiative.id} value={initiative.id}>{initiative.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g. Q4 Marketing Campaign" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Provide a brief description of the activity..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
                control={form.control}
                name="responsible"
                render={({ field }) => (
          <FormItem>
          <FormLabel>Responsible Person</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            </FormControl>
            <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
            ))}
            </SelectContent>
          </Select>
          <FormMessage />
          </FormItem>
                )}
                />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP")
                            ) : (
                                <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP")
                            ) : (
                                <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <FormField
                    control={form.control}
                    name="weight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Weight (%)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="50" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
                    />
                {periods && periods.length > 0 && (
                  <FormField
                    control={form.control}
                    name="reportingPeriodId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reporting Period</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a period" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {periods.map((period) => (
                              <SelectItem key={period.id} value={period.id}>{period.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <FormLabel>KPI (optional)</FormLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="kpi.name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Name</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Customer Satisfaction Score" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kpi.unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. %, days, count" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <FormField
                  control={form.control}
                  name="kpi.direction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Direction</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="HIGHER_IS_BETTER">Higher is better</SelectItem>
                          <SelectItem value="LOWER_IS_BETTER">Lower is better</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kpi.target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Target</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" disabled={kpiHasTarget === false} {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kpi.actual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Actual</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="kpi.hasTarget"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="text-xs text-muted-foreground !mt-0">
                      Has a target (uncheck for no-target items, reported separately)
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="deliverablesText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deliverables (optional, one per line)</FormLabel>
                  <FormControl>
                    <Textarea placeholder={"E.g. Final report\nLaunched website"} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ScrollArea>
        <div className="flex justify-end items-center pt-4 gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Close</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90">{getSubmitButtonText()}</Button>
        </div>
      </form>
    </Form>
  )
}

    