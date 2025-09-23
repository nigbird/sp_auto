
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
import { cn } from "@/lib/utils"
import type { Activity, StrategicPlan, Pillar, Objective, Initiative } from "@/lib/types"
import { ScrollArea } from "../ui/scroll-area"

const activitySchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters." }),
  description: z.string().optional(),
  department: z.string({ required_error: "Please select a department." }),
  responsible: z.string({ required_error: "Please select a responsible person." }),
  startDate: z.date({ required_error: "A start date is required." }),
  endDate: z.date({ required_error: "An end date is required." }),
  status: z.string({ required_error: "Please select a status." }),
  weight: z.coerce.number().min(0).max(100),
  initiativeId: z.string().optional(),
  pillarId: z.string().optional(),
  objectiveId: z.string().optional(),
})

type ActivityFormProps = {
  onSubmit: (values: z.infer<typeof activitySchema>) => void;
  activity?: Activity | null;
  users: string[];
  departments: string[];
  statuses: string[];
  onReset: (activityId: string) => void;
  onCancel: () => void;
  strategicPlan?: StrategicPlan | null;
}

export function ActivityForm({ onSubmit, activity, users, departments, statuses, onReset, onCancel, strategicPlan }: ActivityFormProps) {
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
    },
  })
  
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
      if (activity.approvalStatus === 'DECLINED') {
        return "Resubmit for Approval";
      }
      return "Save Changes";
    }
    return "Submit for Approval";
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                          {strategicPlan.pillars.map(pillar => <SelectItem key={pillar.id} value={pillar.id}>{pillar.title}</SelectItem>)}
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
                          {selectedPillar?.objectives.map(objective => <SelectItem key={objective.id} value={objective.id}>{objective.statement}</SelectItem>)}
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
                          {selectedObjective?.initiatives.map(initiative => <SelectItem key={initiative.id} value={initiative.id}>{initiative.title}</SelectItem>)}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
                        {users.map((user:any) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {statuses.map(status => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
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
            </div>
          </div>
        </ScrollArea>
        <div className="flex justify-between items-center pt-4">
            <div>
              {activity && activity.approvalStatus === 'DECLINED' && (
                <p className="text-sm text-destructive">This activity was declined. Please edit and resubmit.</p>
              )}
            </div>
            <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onCancel}>Close</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90">{getSubmitButtonText()}</Button>
            </div>
        </div>
      </form>
    </Form>
  )
}
