
"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { ArrowLeft, Trash2, PlusCircle, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

const activitySchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  deliverable: z.string().optional(),
  uom: z.string().optional(),
  weight: z.coerce.number().min(0, "Weight must be positive").max(100, "Weight cannot exceed 100"),
  target: z.coerce.number().min(0, "Target must be positive"),
  baseline: z.coerce.number().optional(),
  deadline: z.string().min(1, "Deadline is required"),
  owner: z.string().min(1, "Owner is required"),
  collaborators: z.array(z.string()).optional(),
});

const initiativeSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  weight: z.coerce.number().min(0).max(100),
  owner: z.string().min(1, "Owner is required"),
  collaborators: z.array(z.string()).optional(),
  activities: z.array(activitySchema),
});

const objectiveSchema = z.object({
  id: z.string(),
  statement: z.string().min(1, "Objective Statement is required"),
  weight: z.coerce.number().min(0).max(100),
  initiatives: z.array(initiativeSchema),
});

const pillarSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Pillar Title is required"),
  description: z.string().optional(),
  objectives: z.array(objectiveSchema),
});

const formSchema = z.object({
  planTitle: z.string().min(1, "Plan Title is required"),
  startYear: z.coerce.number().min(2000),
  endYear: z.coerce.number().min(2000),
  version: z.string().min(1, "Version is required"),
  pillars: z.array(pillarSchema).min(1, "At least one pillar is required"),
}).refine(data => data.endYear >= data.startYear, {
    message: "End year must be greater than or equal to start year",
    path: ["endYear"],
});

type FormValues = z.infer<typeof formSchema>;

const users = ["Liam Johnson", "Olivia Smith", "Noah Williams", "Emma Brown", "Oliver Jones", "Admin User"];
const departments = ["Marketing", "Sales", "Engineering", "Human Resources", "Support", "Finance"];
const peopleOptions = [...users, ...departments].map(p => ({ value: p, label: p }));

export default function CreateStrategicPlanPage() {
    const { toast } = useToast();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            planTitle: "",
            startYear: new Date().getFullYear(),
            endYear: new Date().getFullYear() + 4,
            version: "1.0",
            pillars: []
        },
    });

    const { fields: pillarFields, append: appendPillar, remove: removePillar } = useFieldArray({
        control: form.control,
        name: "pillars"
    });

    const onSubmit = (data: FormValues) => {
        console.log(data);
        toast({
            title: "Plan Published!",
            description: "The new strategic plan has been successfully published.",
        });
    };
    
    const handleSaveDraft = () => {
        toast({
            title: "Draft Saved!",
            description: "Your strategic plan has been saved as a draft.",
        });
    }

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button asChild variant="outline" size="icon">
                    <Link href="/strategic-plan">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Create Strategic Plan</h1>
                        <p className="text-muted-foreground">Build your organization's strategic plan from pillars to activities.</p>
                    </div>
                </div>
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSaveDraft}>Save Draft</Button>
                    <Button onClick={form.handleSubmit(onSubmit)}>Publish Plan</Button>
                </div>
            </div>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Plan Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="planTitle">Plan Title</Label>
                            <Input id="planTitle" {...form.register("planTitle")} />
                            {form.formState.errors.planTitle && <p className="text-sm text-destructive">{form.formState.errors.planTitle.message}</p>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startYear">Start Year</Label>
                                <Input id="startYear" type="number" {...form.register("startYear")} />
                                {form.formState.errors.startYear && <p className="text-sm text-destructive">{form.formState.errors.startYear.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endYear">End Year</Label>
                                <Input id="endYear" type="number" {...form.register("endYear")} />
                                {form.formState.errors.endYear && <p className="text-sm text-destructive">{form.formState.errors.endYear.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="version">Version</Label>
                                <Input id="version" {...form.register("version")} />
                                {form.formState.errors.version && <p className="text-sm text-destructive">{form.formState.errors.version.message}</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Plan Structure</CardTitle>
                        <CardDescription>Define the pillars, objectives, initiatives, and activities for your plan.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {pillarFields.map((pillar, pIndex) => (
                           <PillarAccordion key={pillar.id} pIndex={pIndex} removePillar={removePillar} form={form} />
                        ))}
                         <Button type="button" variant="outline" onClick={() => appendPillar({ id: `p-${Date.now()}`, title: "", description: "", objectives: []})}>
                           <PlusCircle className="mr-2 h-4 w-4" /> Add Pillar
                        </Button>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}


function PillarAccordion({ pIndex, removePillar, form }: { pIndex: number; removePillar: Function; form: any }) {
    const { control, register } = form;
    const { fields: objectiveFields, append: appendObjective, remove: removeObjective } = useFieldArray({ control, name: `pillars.${pIndex}.objectives` });
    
    return (
        <Card className="bg-muted/30">
            <div className="flex items-center p-4">
                <GripVertical className="h-5 w-5 text-muted-foreground mr-2"/>
                <div className="flex-1 space-y-2">
                    <Label>Pillar {pIndex + 1}</Label>
                    <Input {...register(`pillars.${pIndex}.title`)} placeholder="Pillar Title" />
                    <Textarea {...register(`pillars.${pIndex}.description`)} placeholder="Pillar Description" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removePillar(pIndex)} className="ml-4">
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </div>
            <CardContent className="pl-12 pr-4 pb-4">
                <div className="space-y-4">
                    {objectiveFields.map((objective, oIndex) => (
                        <ObjectiveAccordion key={objective.id} pIndex={pIndex} oIndex={oIndex} removeObjective={removeObjective} form={form} />
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendObjective({ id: `o-${Date.now()}`, statement: "", weight: 0, initiatives: [] })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Objective
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function ObjectiveAccordion({ pIndex, oIndex, removeObjective, form }: { pIndex: number; oIndex: number; removeObjective: Function; form: any }) {
    const { control, register } = form;
    const { fields: initiativeFields, append: appendInitiative, remove: removeInitiative } = useFieldArray({ control, name: `pillars.${pIndex}.objectives.${oIndex}.initiatives` });

    return (
         <Accordion type="single" collapsible className="w-full bg-background border rounded-md p-4">
            <AccordionItem value={`objective-${oIndex}`} className="border-none">
                <div className="flex items-center">
                    <AccordionTrigger className="flex-1">
                        <div className="flex items-center gap-2">
                           <span className="font-semibold">Objective {pIndex + 1}.{oIndex + 1}</span>
                        </div>
                    </AccordionTrigger>
                     <Button variant="ghost" size="icon" onClick={() => removeObjective(oIndex)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
                <AccordionContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2 col-span-3">
                            <Label>Objective Statement</Label>
                            <Textarea {...register(`pillars.${pIndex}.objectives.${oIndex}.statement`)} placeholder="e.g., Increase Market Share" />
                        </div>
                        <div className="space-y-2">
                            <Label>Weight (%)</Label>
                            <Input type="number" {...register(`pillars.${pIndex}.objectives.${oIndex}.weight`)} placeholder="100" />
                        </div>
                    </div>
                     <Separator />
                     <h4 className="font-medium text-muted-foreground">Initiatives</h4>
                     <div className="space-y-4">
                        {initiativeFields.map((initiative, iIndex) => (
                           <InitiativeAccordion key={initiative.id} pIndex={pIndex} oIndex={oIndex} iIndex={iIndex} removeInitiative={removeInitiative} form={form} />
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => appendInitiative({ id: `i-${Date.now()}`, title: "", description: "", weight: 100, owner: "", collaborators: [], activities: [] })}>
                           <PlusCircle className="mr-2 h-4 w-4" /> Add Initiative
                        </Button>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}


function InitiativeAccordion({ pIndex, oIndex, iIndex, removeInitiative, form }: { pIndex: number; oIndex: number; iIndex: number; removeInitiative: Function; form: any }) {
    const { control, register } = form;
    const { fields: activityFields, append: appendActivity, remove: removeActivity } = useFieldArray({ control, name: `pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities` });

    return (
         <Accordion type="single" collapsible className="w-full bg-muted/30 border rounded-md p-4">
            <AccordionItem value={`initiative-${iIndex}`} className="border-none">
                <div className="flex items-center">
                    <AccordionTrigger className="flex-1">
                        <div className="flex items-center gap-2">
                           <span className="font-semibold">Initiative {pIndex + 1}.{oIndex + 1}.{iIndex + 1}</span>
                        </div>
                    </AccordionTrigger>
                     <Button variant="ghost" size="icon" onClick={() => removeInitiative(iIndex)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
                <AccordionContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Initiative Title</Label>
                        <Input {...register(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.title`)} placeholder="Initiative Title" />
                    </div>
                    <div className="space-y-2">
                        <Label>Initiative Description</Label>
                        <Textarea {...register(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.description`)} placeholder="Initiative Description" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Controller
                            control={control}
                            name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.owner`}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label>Lead/Owner</Label>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {peopleOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        />
                         <Controller
                            control={control}
                            name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.collaborators`}
                            render={({ field }) => (
                                <div className="space-y-2">
                                    <Label>Collaborators</Label>
                                    <MultiSelect
                                        options={peopleOptions}
                                        selected={field.value ?? []}
                                        onChange={field.onChange}
                                        placeholder="Select..."
                                    />
                                </div>
                            )}
                        />
                    </div>
                     <Separator />
                     <h4 className="font-medium text-muted-foreground">Activities</h4>
                     <div className="space-y-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Weight (%)</TableHead>
                                    <TableHead>Deadline</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activityFields.map((activity, aIndex) => (
                                    <TableRow key={activity.id}>
                                        <TableCell>
                                            <Input {...register(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.title`)} placeholder="Activity Title"/>
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" {...register(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.weight`)} placeholder="100"/>
                                        </TableCell>
                                        <TableCell>
                                            <Input type="date" {...register(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.deadline`)} />
                                        </TableCell>
                                         <TableCell>
                                            <Controller
                                                control={control}
                                                name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.owner`}
                                                render={({ field }) => (
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <SelectTrigger className="min-w-[150px]">
                                                            <SelectValue placeholder="Select..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {peopleOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => removeActivity(aIndex)}>
                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         <Button type="button" variant="outline" size="sm" onClick={() => appendActivity({ id: `a-${Date.now()}`, title: '', deliverable: '', uom: '', weight: 100, target: 100, baseline: 0, deadline: '', owner: '', collaborators: [] })}>
                             <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
                        </Button>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}
