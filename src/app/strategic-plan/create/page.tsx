
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { ArrowLeft, Trash2, PlusCircle } from "lucide-react";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useState, useMemo, useRef } from "react";
import { createStrategicPlan } from "@/actions/strategic-plan";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";


const activitySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  weight: z.coerce.number().min(1, "Weight must be greater than 0"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  department: z.string().min(1, "Department is required"),
  responsible: z.string().min(1, "Responsible person is required"),
  description: z.string().optional(),
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
  name: z.string().min(1, "Plan Name is required"),
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

const getToday = () => format(new Date(), 'yyyy-MM-dd');
const getOneMonthFromToday = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return format(d, 'yyyy-MM-dd');
}


export default function CreateStrategicPlanPage() {
    const { toast } = useToast();
    const [currentTab, setCurrentTab] = useState(TABS[0].value);
    const [highestCompletedStep, setHighestCompletedStep] = useState(0);
    const formRef = useRef<HTMLFormElement>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "Corporate Strategic Plan",
            startYear: new Date().getFullYear(),
            endYear: new Date().getFullYear() + 4,
            version: "1.0",
            pillars: [
                { 
                    id: generateId('P'),
                    title: "Pillar 1", 
                    description: "", 
                    objectives: [
                        { 
                            id: generateId('O'),
                            statement: "Objective 1.1", 
                            initiatives: [
                                {
                                    id: generateId('I'),
                                    title: "Initiative 1.1.1",
                                    description: "",
                                    owner: "Liam Johnson",
                                    collaborators: [],
                                    activities: [
                                        { id: generateId('A'), title: "Activity 1.1.1.1", weight: 100, description: '', startDate: getToday(), endDate: getOneMonthFromToday(), department: 'Sales', responsible: 'Liam Johnson' },
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        mode: "onChange"
    });

    const { fields: pillarFields, append: appendPillar, remove: removePillar } = useFieldArray({
        control: form.control,
        name: "pillars"
    });

    const handleFormSubmit = (status: 'DRAFT' | 'PUBLISHED') => {
        const formData = new FormData(formRef.current!);
        formData.set('pillars', JSON.stringify(form.getValues('pillars')));
        formData.set('status', status);
        
        toast({
            title: status === 'DRAFT' ? "Saving Draft..." : "Publishing Plan...",
            description: "Please wait.",
        });

        createStrategicPlan(formData);
    };

    const handleNext = async () => {
        const currentTabIndex = TABS.findIndex(t => t.value === currentTab);
        const result = await form.trigger();
        
        if (result && currentTabIndex < TABS.length - 1) {
            setHighestCompletedStep(Math.max(highestCompletedStep, currentTabIndex + 1));
            setCurrentTab(TABS[currentTabIndex + 1].value);
        } else if (!result) {
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

    return (
        <Form {...form}>
            <form ref={formRef} className="flex-1 space-y-6">
                <input type="hidden" {...form.register('pillars')} />
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="outline" size="icon">
                        <Link href="/strategic-plan">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Create Strategic Plan</h1>
                            <p className="text-muted-foreground">Follow the steps to create a new strategic plan for your organization.</p>
                        </div>
                    </div>
                     <div className="flex gap-2">
                        <Button variant="outline" type="button" onClick={() => handleFormSubmit('DRAFT')}>Save Draft</Button>
                        <Button type="button" onClick={() => handleFormSubmit('PUBLISHED')}>Publish Plan</Button>
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
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                        <FormItem>
                                            <Label>Plan Name</Label>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <FormField
                                            control={form.control}
                                            name="startYear"
                                            render={({ field }) => (
                                            <FormItem>
                                                <Label>Start Year</Label>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="endYear"
                                            render={({ field }) => (
                                            <FormItem>
                                                <Label>End Year</Label>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="version"
                                            render={({ field }) => (
                                            <FormItem>
                                                <Label>Version</Label>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
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
                                                    <FormField
                                                        control={form.control}
                                                        name={`pillars.${index}.title`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <Label>Pillar Title</Label>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`pillars.${index}.description`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <Label>Pillar Description</Label>
                                                                <FormControl>
                                                                    <Textarea {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
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
                                <Button variant="outline" type="button" onClick={handleBack} disabled={currentTab === TABS[0].value}>Back</Button>
                                {currentTab !== TABS[TABS.length - 1].value ? (
                                    <Button type="button" onClick={handleNext}>Next</Button>
                                ) : (
                                    <Button type="button" onClick={() => handleFormSubmit('PUBLISHED')}>Publish Plan</Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </Form>
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

const calculateInitiativeWeight = (activities: any[] = []) => activities.reduce((total, activity) => total + (Number(activity.weight) || 0), 0);
const calculateObjectiveWeight = (initiatives: any[] = []) => initiatives.reduce((total, initiative) => total + calculateInitiativeWeight(initiative.activities || []), 0);
const calculatePillarWeight = (objectives: any[] = []) => objectives.reduce((total, objective) => total + calculateObjectiveWeight(objective.initiatives || []), 0);

function PillarObjectiveAccordion({ pIndex, form }: { pIndex: number; form: any }) {
    const { control, watch } = form;
    const { fields: objectiveFields, append: appendObjective, remove: removeObjective } = useFieldArray({ control, name: `pillars.${pIndex}.objectives` });
    const pillarTitle = watch(`pillars.${pIndex}.title`);

    return (
        <AccordionItem value={`pillar-${pIndex}`}>
            <AccordionTrigger className="text-xl font-semibold">{pillarTitle}</AccordionTrigger>
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
                             <FormField
                                control={control}
                                name={`pillars.${pIndex}.objectives.${oIndex}.statement`}
                                render={({ field }) => (
                                    <FormItem>
                                        <Label>Objective Statement</Label>
                                        <FormControl>
                                            <Textarea {...field} placeholder="e.g., Increase Market Share" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
                       <ObjectiveInitiativeAccordion key={_objective.id} pIndex={pIndex} oIndex={oIndex} form={form} />
                    ))}
                </Accordion>
            </AccordionContent>
        </AccordionItem>
    )
}

function ObjectiveInitiativeAccordion({ pIndex, oIndex, form }: { pIndex: number; oIndex: number; form: any }) {
    const { control, watch } = form;
    const { fields: initiativeFields, append: appendInitiative, remove: removeInitiative } = useFieldArray({ control, name: `pillars.${pIndex}.objectives.${oIndex}.initiatives` });
    const objectiveStatement = watch(`pillars.${pIndex}.objectives.${oIndex}.statement`);

    return (
        <AccordionItem value={`objective-${pIndex}-${oIndex}`}>
            <AccordionTrigger className="font-semibold text-lg">{objectiveStatement}</AccordionTrigger>
            <AccordionContent className="pl-4 border-l ml-4 space-y-4">
                {initiativeFields.map((initiative, iIndex) => {
                     return (
                         <Card key={initiative.id}>
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>Initiative {pIndex + 1}.{oIndex + 1}.{iIndex + 1}</CardTitle>
                                 <Button variant="destructive" size="icon" onClick={() => removeInitiative(iIndex)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={control}
                                    name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.title`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>Initiative Title</Label>
                                            <FormControl>
                                                <Input {...field} placeholder="Initiative Title" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.description`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>Initiative Description</Label>
                                            <FormControl>
                                                <Textarea {...field} placeholder="Initiative Description" rows={2}/>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={control}
                                        name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.owner`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <Label>Lead/Owner</Label>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {peopleOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.collaborators`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <Label>Collaborators</Label>
                                                <FormControl>
                                                    <MultiSelect
                                                        options={peopleOptions}
                                                        selected={field.value ?? []}
                                                        onChange={field.onChange}
                                                        placeholder="Select..."
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                     )
                })}
                <Button type="button" variant="outline" size="sm" onClick={() => appendInitiative({ id: generateId('I'), title: `Initiative ${pIndex+1}.${oIndex+1}.${initiativeFields.length+1}`, description: "", owner: "Liam Johnson", collaborators: [], activities: [] })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Initiative
                </Button>
            </AccordionContent>
        </AccordionItem>
    );
}

function PillarActivityAccordion({ pIndex, form }: { pIndex: number; form: any }) {
    const { watch } = form;
    const pillarTitle = watch(`pillars.${pIndex}.title`);
    const objectives = watch(`pillars.${pIndex}.objectives`);
    
    return (
        <AccordionItem value={`pillar-${pIndex}`}>
            <AccordionTrigger className="text-xl font-semibold">{pillarTitle}</AccordionTrigger>
            <AccordionContent className="pl-4 border-l ml-4 space-y-4">
                <Accordion type="multiple" className="space-y-4" defaultValue={objectives.map((_: any, oIndex: number) => `objective-${pIndex}-${oIndex}`)}>
                    {objectives.map((_objective: any, oIndex: number) => (
                       <ObjectiveActivityAccordion key={_objective.id} pIndex={pIndex} oIndex={oIndex} form={form} />
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
                        <InitiativeActivityAccordion key={_initiative.id} pIndex={pIndex} oIndex={oIndex} iIndex={iIndex} form={form} />
                    ))}
                </Accordion>
            </AccordionContent>
        </AccordionItem>
    );
}

function InitiativeActivityAccordion({ pIndex, oIndex, iIndex, form }: { pIndex: number; oIndex: number; iIndex: number; form: any }) {
    const { control } = form;
    const { fields: activityFields, append: appendActivity, remove: removeActivity } = useFieldArray({ control, name: `pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities` });
    const initiativeTitle = form.watch(`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.title`);

    return (
        <AccordionItem value={`initiative-${pIndex}-${oIndex}-${iIndex}`}>
            <AccordionTrigger className="font-medium text-base">{initiativeTitle}</AccordionTrigger>
            <AccordionContent className="pl-4 border-l ml-4 space-y-4">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Weight</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Responsible</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activityFields.map((activity, aIndex) => (
                            <TableRow key={activity.id}>
                                <TableCell>
                                     <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.title`} render={({ field }) => <Input {...field} />} />
                                </TableCell>
                                <TableCell>
                                     <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.weight`} render={({ field }) => <Input type="number" {...field} />} />
                                </TableCell>
                                <TableCell>
                                     <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.startDate`} render={({ field }) => <Input type="date" {...field} />} />
                                </TableCell>
                                <TableCell>
                                     <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.endDate`} render={({ field }) => <Input type="date" {...field} />} />
                                </TableCell>
                                <TableCell>
                                    <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.responsible`} render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{users.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                                    )} />
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
                <Button type="button" variant="outline" size="sm" onClick={() => appendActivity({ id: generateId('A'), title: ``, weight: 0, startDate: getToday(), endDate: getOneMonthFromToday(), department: '', responsible: 'Liam Johnson' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
                </Button>
            </AccordionContent>
        </AccordionItem>
    );
}

function ReviewSection({ form }: { form: any }) {
    const plan = form.watch();

    if (!plan.pillars || plan.pillars.length === 0) {
        return <p>No data entered yet. Please fill out the previous steps.</p>;
    }
    
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold">{plan.name} ({plan.startYear}-{plan.endYear}) v{plan.version}</h3>
            {plan.pillars.map((pillar: any, pIndex: number) => {
                const pillarWeight = calculatePillarWeight(pillar.objectives);
                return (
                    <div key={pIndex} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                        <h4 className="font-bold text-lg">{pillar.title} (Total Weight: {pillarWeight})</h4>
                        {pillar.objectives.map((objective: any, oIndex: number) => {
                             const objectiveWeight = calculateObjectiveWeight(objective.initiatives);
                             return (
                                <div key={oIndex} className="p-3 border rounded-md space-y-2 bg-background/50 ml-4">
                                    <h5 className="font-semibold">{objective.statement} (Total Weight: {objectiveWeight})</h5>
                                    {objective.initiatives.map((initiative: any, iIndex: number) => {
                                        const initiativeWeight = calculateInitiativeWeight(initiative.activities);
                                        return (
                                             <div key={iIndex} className="p-2 border rounded-md space-y-2 bg-muted/20 ml-4">
                                                 <h6 className="font-medium">{initiative.title} (Total Weight: {initiativeWeight})</h6>
                                                 <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                                    {initiative.activities.map((activity: any, aIndex: number) => (
                                                        <li key={aIndex}>
                                                           <span className="font-semibold text-foreground">Activity:</span> {activity.title} (Weight: {activity.weight})
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

    