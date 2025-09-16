
"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Stepper } from "@/components/ui/stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo, useEffect } from "react";
import { savePlan, getSavedPlan } from "@/lib/plan-service";


const activitySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  weight: z.coerce.number().min(0, "Weight must be positive"),
  deadline: z.string().min(1, "Deadline is required"),
  owner: z.string().min(1, "Owner is required"),
  collaborators: z.array(z.string()).optional(),
  progress: z.number().default(0),
  status: z.string().default('Not Started'),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  department: z.string().min(1, "Department is required"),
  responsible: z.string().min(1, "Responsible person is required"),
  updates: z.array(z.any()).default([]),
  lastUpdated: z.any().optional(),
});

const initiativeSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  owner: z.string().min(1, "Owner is required"),
  collaborators: z.array(z.string()).optional(),
  activities: z.array(activitySchema).min(1, "At least one activity is required."),
});

const objectiveSchema = z.object({
  id: z.string().optional(),
  statement: z.string().min(1, "Objective Statement is required"),
  initiatives: z.array(initiativeSchema).min(1, "At least one initiative is required."),
});

const pillarSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Pillar Title is required"),
  description: z.string().optional(),
  objectives: z.array(objectiveSchema).min(1, "At least one objective is required."),
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

const TABS = [
    { value: "plan-info", title: "Plan Info" },
    { value: "pillars", title: "Pillar" },
    { value: "objectives", title: "Objective" },
    { value: "initiatives", title: "Initiative" },
    { value: "activities", title: "Activities" },
    { value: "review", title: "Review & Save" }
];

function generateId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}


export default function EditStrategicPlanPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [currentTab, setCurrentTab] = useState(TABS[0].value);
    const [highestCompletedStep, setHighestCompletedStep] = useState(TABS.length - 1); // Start with all steps "completed"
    const [isLoading, setIsLoading] = useState(true);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {},
        mode: "onChange"
    });

    useEffect(() => {
        const plan = getSavedPlan();
        if (plan) {
            // The dates are stored as strings, but the form expects them in 'yyyy-MM-dd' format for date inputs.
            plan.pillars.forEach(p => {
                p.objectives.forEach(o => {
                    o.initiatives.forEach(i => {
                        i.activities.forEach(a => {
                            if (a.deadline && typeof a.deadline === 'string') a.deadline = a.deadline.split('T')[0];
                            if (a.startDate && typeof a.startDate === 'string') a.startDate = a.startDate.split('T')[0];
                            if (a.endDate && typeof a.endDate === 'string') a.endDate = a.endDate.split('T')[0];
                        })
                    })
                })
            })
            form.reset(plan);
        } else {
            toast({
                title: "No Plan Found",
                description: "Could not find a strategic plan to edit. Redirecting to create page.",
                variant: "destructive",
            });
            router.replace('/strategic-plan/create');
        }
        setIsLoading(false);
    }, [form, router, toast]);

    const { fields: pillarFields, append: appendPillar, remove: removePillar } = useFieldArray({
        control: form.control,
        name: "pillars"
    });

    const onSubmit = (data: FormValues) => {
        savePlan(data, 'published');
        toast({
            title: "Plan Published!",
            description: "The strategic plan has been successfully updated and published.",
        });
        router.push('/strategic-plan');
    };
    
    const handleSaveDraft = () => {
        const data = form.getValues();
        savePlan(data, 'draft');
        toast({
            title: "Draft Saved!",
            description: "Your strategic plan has been saved as a draft.",
        });
        router.push('/strategic-plan');
    }

    const handleNext = async () => {
        const currentTabIndex = TABS.findIndex(t => t.value === currentTab);
        let isValid = false;

        switch (currentTabIndex) {
            case 0: // Plan Info
                isValid = await form.trigger(["planTitle", "startYear", "endYear", "version"]);
                break;
            case 1: // Pillars
                 isValid = await form.trigger("pillars");
                 const pillars = form.getValues("pillars");
                 if (pillars.every(p => p.title)) {
                    isValid = true;
                 }
                break;
            case 2: // Objectives
                isValid = await form.trigger("pillars");
                 const pillarsForObjectives = form.getValues("pillars");
                if (pillarsForObjectives.every(p => p.objectives.length > 0 && p.objectives.every(o => o.statement))) {
                    isValid = true;
                }
                break;
            case 3: // Initiatives
                isValid = await form.trigger("pillars");
                const pillarsForInitiatives = form.getValues("pillars");
                if (pillarsForInitiatives.every(p => p.objectives.every(o => o.initiatives.length > 0 && o.initiatives.every(i => i.title && i.owner)))) {
                    isValid = true;
                }
                break;
            case 4: // Activities
                isValid = await form.trigger("pillars");
                 const pillarsForActivities = form.getValues("pillars");
                if (pillarsForActivities.every(p => p.objectives.every(o => o.initiatives.every(i => i.activities.length > 0 && i.activities.every(a => a.title && a.deadline && a.weight > 0))))) {
                     isValid = true;
                }
                break;
            case 5: // Review
                isValid = await form.trigger();
                break;
        }

        if (isValid && currentTabIndex < TABS.length - 1) {
            setHighestCompletedStep(Math.max(highestCompletedStep, currentTabIndex + 1));
            setCurrentTab(TABS[currentTabIndex + 1].value);
        } else if (!isValid) {
             toast({
                title: "Validation Error",
                description: "Please fill out all required fields before proceeding.",
                variant: "destructive",
            });
            console.log("Validation failed", form.formState.errors);
        }
    };
    
    const handleBack = () => {
        const currentTabIndex = TABS.findIndex(t => t.value === currentTab);
        if (currentTabIndex > 0) {
            setCurrentTab(TABS[currentTabIndex - 1].value);
        }
    };

    const isStepCompleted = (index: number) => index < highestCompletedStep;

    if (isLoading) {
        return (
            <div className="flex-1 space-y-6 flex items-center justify-center">
                <div className="flex items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p className="text-muted-foreground">Loading plan...</p>
                </div>
            </div>
        );
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
                        <h1 className="text-3xl font-bold tracking-tight">Edit Strategic Plan</h1>
                        <p className="text-muted-foreground">Modify the details of your existing strategic plan.</p>
                    </div>
                </div>
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={form.handleSubmit(handleSaveDraft)}>Save Draft</Button>
                    <Button onClick={form.handleSubmit(onSubmit)}>Update & Publish</Button>
                </div>
            </div>
            
            <Card>
                <CardContent className="p-6">
                    <Stepper 
                        steps={TABS.map((tab, index) => ({
                            title: tab.title,
                            isCompleted: isStepCompleted(index) || highestCompletedStep > index,
                            isCurrent: currentTab === tab.value
                        }))}
                        onStepClick={(index) => {
                            if (isStepCompleted(index) || index === highestCompletedStep) {
                                setCurrentTab(TABS[index].value);
                            }
                        }}
                    />

                    <div className="mt-8">
                        <Tabs value={currentTab} onValueChange={setCurrentTab}>
                            <TabsContent value="plan-info" className="space-y-6">
                                <StepHeader title="Step 1: Define Plan Information" description="Set the basic details for your new strategic plan." />
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
                            </TabsContent>
                            
                            <TabsContent value="pillars" className="space-y-6">
                                <StepHeader title="Step 2: Define Pillars" description="A Pillar is a high-level strategic focus area for the organization." />
                                <div className="space-y-4">
                                    {pillarFields.map((pillar, index) => (
                                        <Card key={pillar.id}>
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <CardTitle>Pillar {index + 1}</CardTitle>
                                                <Button variant="destructive" size="icon" onClick={() => removePillar(index)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>Pillar Title</Label>
                                                    <Input {...form.register(`pillars.${index}.title`)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Pillar Description</Label>
                                                    <Textarea {...form.register(`pillars.${index}.description`)} />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <Button type="button" variant="outline" onClick={() => appendPillar({ id: generateId('P'), title: `Pillar ${pillarFields.length + 1}`, description: "", objectives: [] })}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Pillar
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="objectives" className="space-y-6">
                                 <StepHeader title="Step 3: Define Objectives" description="An Objective is a specific, measurable goal that supports a Pillar." />
                                <Accordion type="multiple" defaultValue={pillarFields.map((_, pIndex) => `pillar-${pIndex}`)}>
                                    {pillarFields.map((pillar, pIndex) => (
                                        <PillarObjectiveAccordion key={pillar.id} pIndex={pIndex} form={form} />
                                    ))}
                                </Accordion>
                            </TabsContent>

                             <TabsContent value="initiatives" className="space-y-6">
                                 <StepHeader title="Step 4: Define Initiatives" description="An Initiative is a specific project or program designed to achieve an Objective." />
                                <Accordion type="multiple" defaultValue={pillarFields.map((_, pIndex) => `pillar-${pIndex}`)}>
                                    {pillarFields.map((pillar, pIndex) => (
                                        <PillarInitiativeAccordion key={pillar.id} pIndex={pIndex} form={form} />
                                    ))}
                                </Accordion>
                            </TabsContent>

                             <TabsContent value="activities" className="space-y-6">
                                 <StepHeader title="Step 5: Define Activities" description="An Activity is a specific task required to complete an Initiative." />
                                <Accordion type="multiple" defaultValue={pillarFields.map((_, pIndex) => `pillar-${pIndex}`)}>
                                    {pillarFields.map((pillar, pIndex) => (
                                        <PillarActivityAccordion key={pillar.id} pIndex={pIndex} form={form} />
                                    ))}
                                </Accordion>
                            </TabsContent>

                            <TabsContent value="review" className="space-y-6">
                                 <StepHeader title="Step 6: Review & Save" description="Review the complete strategic plan hierarchy before publishing." />
                                <ReviewSection form={form} />
                            </TabsContent>

                        </Tabs>

                        <div className="flex justify-between mt-8">
                            <Button variant="outline" onClick={handleBack} disabled={currentTab === TABS[0].value}>Back</Button>
                            {currentTab !== TABS[TABS.length - 1].value ? (
                                <Button onClick={handleNext}>Next</Button>
                            ) : (
                                <Button onClick={form.handleSubmit(onSubmit)}>Update & Publish</Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function StepHeader({ title, description }: { title: string, description: string }) {
    return (
        <div>
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{description}</p>
        </div>
    )
}

// Helper to calculate weights
const calculateInitiativeWeight = (activities: any[] = []) => {
    return activities.reduce((total, activity) => total + (Number(activity.weight) || 0), 0);
};

const calculateObjectiveWeight = (initiatives: any[] = []) => {
    return initiatives.reduce((total, initiative) => total + calculateInitiativeWeight(initiative.activities || []), 0);
};

const calculatePillarWeight = (objectives: any[] = []) => {
    return objectives.reduce((total, objective) => total + calculateObjectiveWeight(objective.initiatives || []), 0);
}


function PillarObjectiveAccordion({ pIndex, form }: { pIndex: number; form: any }) {
    const { control, register, watch } = form;
    const { fields: objectiveFields, append: appendObjective, remove: removeObjective } = useFieldArray({ control, name: `pillars.${pIndex}.objectives` });
    const pillarTitle = watch(`pillars.${pIndex}.title`);
    const objectives = watch(`pillars.${pIndex}.objectives`);
    const totalPillarWeight = useMemo(() => calculatePillarWeight(objectives), [objectives]);

    
    return (
        <AccordionItem value={`pillar-${pIndex}`}>
            <AccordionTrigger className="text-xl font-semibold">{pillarTitle} <span className="text-base font-normal text-muted-foreground ml-2">(Total Weight: {totalPillarWeight})</span></AccordionTrigger>
            <AccordionContent className="pl-4 border-l ml-4 space-y-4">
                 {objectiveFields.map((objective, oIndex) => (
                    <Card key={objective.id}>
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle>Objective {pIndex + 1}.{oIndex + 1}</CardTitle>
                             <Button variant="destructive" size="icon" onClick={() => removeObjective(oIndex)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label>Objective Statement</Label>
                                <Textarea {...register(`pillars.${pIndex}.objectives.${oIndex}.statement`)} placeholder="e.g., Increase Market Share" />
                            </div>
                        </CardContent>
                    </Card>
                 ))}
                 <Button type="button" variant="outline" size="sm" onClick={() => appendObjective({ id: generateId('O'), statement: `Objective ${pIndex + 1}.${objectiveFields.length + 1}`, initiatives: [] })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Objective
                </Button>
            </AccordionContent>
        </AccordionItem>
    )
}

function PillarInitiativeAccordion({ pIndex, form }: { pIndex: number; form: any }) {
    const { control, watch } = form;
    const pillarTitle = watch(`pillars.${pIndex}.title`);
    const objectives = watch(`pillars.${pIndex}.objectives`);
    
    return (
        <AccordionItem value={`pillar-${pIndex}`}>
            <AccordionTrigger className="text-xl font-semibold">{pillarTitle}</AccordionTrigger>
            <AccordionContent className="pl-4 border-l ml-4 space-y-4">
                <Accordion type="multiple" className="space-y-4" defaultValue={objectives.map((_: any, oIndex: number) => `objective-${pIndex}-${oIndex}`)}>
                    {objectives.map((_objective: any, oIndex: number) => (
                       <ObjectiveInitiativeAccordion key={oIndex} pIndex={pIndex} oIndex={oIndex} form={form} />
                    ))}
                </Accordion>
            </AccordionContent>
        </AccordionItem>
    )
}

function ObjectiveInitiativeAccordion({ pIndex, oIndex, form }: { pIndex: number; oIndex: number; form: any }) {
    const { control, register, watch } = form;
    const { fields: initiativeFields, append: appendInitiative, remove: removeInitiative } = useFieldArray({ control, name: `pillars.${pIndex}.objectives.${oIndex}.initiatives` });
    const objectiveStatement = watch(`pillars.${pIndex}.objectives.${oIndex}.statement`);
    const initiatives = watch(`pillars.${pIndex}.objectives.${oIndex}.initiatives`);
    const totalObjectiveWeight = useMemo(() => calculateObjectiveWeight(initiatives), [initiatives]);

    return (
        <AccordionItem value={`objective-${pIndex}-${oIndex}`}>
            <AccordionTrigger className="font-semibold text-lg">Objective {pIndex + 1}.{oIndex + 1}: {objectiveStatement} <span className="text-base font-normal text-muted-foreground ml-2">(Total Weight: {totalObjectiveWeight})</span></AccordionTrigger>
            <AccordionContent className="pl-4 border-l ml-4 space-y-4">
                {initiativeFields.map((initiative, iIndex) => {
                     const initiativeWeight = calculateInitiativeWeight(watch(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities`));
                     return (
                         <Card key={initiative.id}>
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>Initiative {pIndex + 1}.{oIndex + 1}.{iIndex + 1} <span className="text-base font-normal text-muted-foreground ml-2">(Total Weight: {initiativeWeight})</span></CardTitle>
                                 <Button variant="destructive" size="icon" onClick={() => removeInitiative(iIndex)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Initiative Title</Label>
                                    <Input {...register(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.title`)} placeholder="Initiative Title" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Initiative Description</Label>
                                    <Textarea {...register(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.description`)} placeholder="Initiative Description" rows={2}/>
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
                            </CardContent>
                        </Card>
                     )
                })}
                <Button type="button" variant="outline" size="sm" onClick={() => appendInitiative({ id: generateId('I'), title: `Initiative ${pIndex+1}.${oIndex+1}.${initiativeFields.length+1}`, description: "", owner: "", collaborators: [], activities: [] })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Initiative
                </Button>
            </AccordionContent>
        </AccordionItem>
    );
}

function PillarActivityAccordion({ pIndex, form }: { pIndex: number; form: any }) {
    const { control, watch } = form;
    const pillarTitle = watch(`pillars.${pIndex}.title`);
    const objectives = watch(`pillars.${pIndex}.objectives`);
    
    return (
        <AccordionItem value={`pillar-${pIndex}`}>
            <AccordionTrigger className="text-xl font-semibold">{pillarTitle}</AccordionTrigger>
            <AccordionContent className="pl-4 border-l ml-4 space-y-4">
                <Accordion type="multiple" className="space-y-4" defaultValue={objectives.map((_: any, oIndex: number) => `objective-${pIndex}-${oIndex}`)}>
                    {objectives.map((_objective: any, oIndex: number) => (
                       <ObjectiveActivityAccordion key={oIndex} pIndex={pIndex} oIndex={oIndex} form={form} />
                    ))}
                </Accordion>
            </AccordionContent>
        </AccordionItem>
    )
}

function ObjectiveActivityAccordion({ pIndex, oIndex, form }: { pIndex: number; oIndex: number; form: any }) {
    const { watch } = form;
    const objectiveStatement = watch(`pillars.${pIndex}.objectives.${oIndex}.statement`);
    const initiatives = watch(`pillars.${pIndex}.objectives.${oIndex}.initiatives`);

    return (
        <AccordionItem value={`objective-${pIndex}-${oIndex}`}>
            <AccordionTrigger className="font-semibold text-lg">Objective {pIndex + 1}.{oIndex + 1}: {objectiveStatement}</AccordionTrigger>
            <AccordionContent className="pl-4 border-l ml-4 space-y-4">
                <Accordion type="multiple" className="space-y-4" defaultValue={initiatives.map((_: any, iIndex: number) => `initiative-${pIndex}-${oIndex}-${iIndex}`)}>
                    {initiatives.map((_initiative: any, iIndex: number) => (
                        <InitiativeActivityAccordion key={iIndex} pIndex={pIndex} oIndex={oIndex} iIndex={iIndex} form={form} />
                    ))}
                </Accordion>
            </AccordionContent>
        </AccordionItem>
    );
}

function InitiativeActivityAccordion({ pIndex, oIndex, iIndex, form }: { pIndex: number; oIndex: number; iIndex: number; form: any }) {
    const { control, register, watch } = form;
    const { fields: activityFields, append: appendActivity, remove: removeActivity } = useFieldArray({ control, name: `pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities` });
    const initiativeTitle = watch(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.title`);
    const activities = watch(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities`);
    const initiativeWeight = useMemo(() => calculateInitiativeWeight(activities), [activities]);


    return (
        <AccordionItem value={`initiative-${pIndex}-${oIndex}-${iIndex}`}>
            <AccordionTrigger className="font-medium text-base">Initiative {pIndex + 1}.{oIndex + 1}.{iIndex + 1}: {initiativeTitle} <span className="text-sm font-normal text-muted-foreground ml-2">(Total Weight: {initiativeWeight})</span></AccordionTrigger>
            <AccordionContent className="pl-4 border-l ml-4 space-y-4">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[10%]">Code</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Weight</TableHead>
                            <TableHead>Deadline</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Collaborators</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activityFields.map((activity, aIndex) => (
                            <TableRow key={activity.id}>
                                <TableCell>
                                <span className="text-sm text-muted-foreground">{pIndex + 1}.{oIndex + 1}.{iIndex + 1}.{aIndex + 1}</span>
                                </TableCell>
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
                                    <Controller
                                        control={control}
                                        name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.collaborators`}
                                        render={({ field }) => (
                                            <MultiSelect
                                                options={peopleOptions}
                                                selected={field.value ?? []}
                                                onChange={field.onChange}
                                                placeholder="Select..."
                                            />
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
                <Button type="button" variant="outline" size="sm" onClick={() => appendActivity({ id: generateId('A'), title: `Activity ${pIndex + 1}.${oIndex + 1}.${iIndex + 1}.${activityFields.length + 1}`, weight: 0, deadline: '', owner: '', collaborators: [], progress:0, status: 'Not Started', startDate: '', endDate: '', department: 'Sales', responsible: 'Liam Johnson', updates: [] })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
                </Button>
            </AccordionContent>
        </AccordionItem>
    );
}


function ReviewSection({ form }: { form: any }) {
    const { getValues, watch } = form;
    const plan = watch(); // Watch all fields to re-render on change

    if (!plan.pillars || plan.pillars.length === 0) {
        return <p>No data entered yet. Please fill out the previous steps.</p>;
    }
    
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold">{plan.planTitle} ({plan.startYear}-{plan.endYear}) v{plan.version}</h3>
            {plan.pillars.map((pillar: any, pIndex: number) => {
                const pillarWeight = calculatePillarWeight(pillar.objectives);
                return (
                    <div key={pIndex} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                        <h4 className="font-bold text-lg">Pillar {pIndex+1}: {pillar.title} (Total Weight: {pillarWeight})</h4>
                        {pillar.objectives.map((objective: any, oIndex: number) => {
                             const objectiveWeight = calculateObjectiveWeight(objective.initiatives);
                             return (
                                <div key={oIndex} className="p-3 border rounded-md space-y-2 bg-background/50 ml-4">
                                    <h5 className="font-semibold">Objective {pIndex+1}.{oIndex+1}: {objective.statement} (Total Weight: {objectiveWeight})</h5>
                                    {objective.initiatives.map((initiative: any, iIndex: number) => {
                                        const initiativeWeight = calculateInitiativeWeight(initiative.activities);
                                        return (
                                             <div key={iIndex} className="p-2 border rounded-md space-y-2 bg-muted/20 ml-4">
                                                 <h6 className="font-medium">Initiative {pIndex+1}.{oIndex+1}.{iIndex+1}: {initiative.title} (Total Weight: {initiativeWeight})</h6>
                                                 <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                                    {initiative.activities.map((activity: any, aIndex: number) => (
                                                        <li key={aIndex}>
                                                           <span className="font-semibold text-foreground">Activity {pIndex+1}.{oIndex+1}.{iIndex+1}.{aIndex+1}:</span> {activity.title} (Weight: {activity.weight})
                                                        </li>
                                                    ))}
                                                 </ul>
                                             </div>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </div>
    )
}

    