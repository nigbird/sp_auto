"use client";

import { useForm, useFieldArray, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { ArrowLeft, Trash2, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Stepper } from "@/components/ui/stepper";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import React, { useState, useMemo } from "react";
import { unstable_rethrow } from "next/navigation";
import { createStrategicPlan } from "@/actions/strategic-plan";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { calculateInitiativeWeight } from "@/lib/utils";
import { planFormSchema, sectionOfPath, formatPlanIssue, type PlanFormValues, type PlanIssue, type PlanSection } from "@/lib/plan-schema";
import { applyIssuesToForm, collectPlanIssues, focusIssue, IssueSummary, ListIssue, PlanFormIssuesProvider, useAutoOpenAccordion } from "./plan-form-issues";

type FormValues = PlanFormValues;
type Person = { id: string; name: string };

const TABS: { value: string; title: string; section: PlanSection | 'review' }[] = [
    { value: "plan-info", title: "Plan Info", section: 'plan-info' },
    { value: "pillars", title: "Pillar", section: 'pillars' },
    { value: "objectives", title: "Objective", section: 'objectives' },
    { value: "initiatives", title: "Initiative", section: 'initiatives' },
    { value: "activities", title: "Activities", section: 'activities' },
    { value: "review", title: "Review & Save", section: 'review' },
];

/** The wizard step where an issue can be fixed. */
function stepIndexOfIssue(issue: PlanIssue): number {
    if (issue.path.startsWith('_')) return TABS.length - 1;
    const section = sectionOfPath(issue.path);
    return TABS.findIndex(t => t.section === section);
}

function generateId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const getToday = () => format(new Date(), 'yyyy-MM-dd');
const getOneMonthFromToday = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return format(d, 'yyyy-MM-dd');
}

function newActivity(users: Person[], departments: string[], title = "", weight = 0) {
    return { id: generateId('A'), title, weight, description: '', deliverable: '', startDate: getToday(), endDate: getOneMonthFromToday(), department: departments[0] ?? '', responsible: users[0]?.id ?? '' };
}
function newInitiative(users: Person[], departments: string[], title = "") {
    return { id: generateId('I'), title, description: "", owners: users[0]?.id ? [users[0].id] : [], collaborators: [], activities: [newActivity(users, departments)] };
}
function newObjective(users: Person[], departments: string[], statement = "") {
    return { id: generateId('O'), statement, initiatives: [newInitiative(users, departments)] };
}
function newPillar(users: Person[], departments: string[], title = "") {
    return { id: generateId('P'), title, description: "", objectives: [newObjective(users, departments)] };
}

type CreatePlanClientProps = {
    users: Person[];
    departments: string[];
}

export function CreatePlanClient({ users, departments }: CreatePlanClientProps) {
    const { toast } = useToast();
    const [currentTab, setCurrentTab] = useState(TABS[0].value);
    const [highestCompletedStep, setHighestCompletedStep] = useState(0);
    const [showIssues, setShowIssues] = useState(false);
    const [serverIssues, setServerIssues] = useState<PlanIssue[]>([]);
    const [expandSignal, setExpandSignal] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    const userOptions = useMemo(() => users.map(u => ({ value: u.id, label: u.name })), [users]);

    const form = useForm<FormValues>({
        resolver: zodResolver(planFormSchema),
        defaultValues: {
            name: "Corporate Strategic Plan",
            startYear: new Date().getFullYear(),
            endYear: new Date().getFullYear() + 4,
            version: "1.0",
            pillars: [
                {
                    ...newPillar(users, departments, "Pillar 1"),
                    objectives: [{
                        ...newObjective(users, departments, "Objective 1.1"),
                        initiatives: [{
                            ...newInitiative(users, departments, "Initiative 1.1.1"),
                            activities: [newActivity(users, departments, "Activity 1.1.1.1", 100)],
                        }],
                    }],
                },
            ],
        },
        mode: "onBlur",
    });

    const { fields: pillarFields, append: appendPillar, remove: removePillar } = useFieldArray({
        control: form.control,
        name: "pillars"
    });

    const values = form.watch();
    const currentIndex = TABS.findIndex(t => t.value === currentTab);

    // Once a Next/Save attempt has failed, keep the list current as the user
    // fixes things, so it empties out instead of showing stale problems.
    const liveIssues = useMemo(() => {
        if (!showIssues) return [];
        const schemaIssues = collectPlanIssues(values);
        const stillRelevantServerIssues = serverIssues.filter(si => !schemaIssues.some(i => i.path === si.path) && !si.path.startsWith('_'));
        return [...schemaIssues, ...stillRelevantServerIssues];
    }, [showIssues, values, serverIssues]);

    const issuesForThisStep = currentTab === 'review'
        ? liveIssues
        : liveIssues.filter(issue => stepIndexOfIssue(issue) <= currentIndex);

    const goToIssue = (issue: PlanIssue) => {
        const stepIndex = stepIndexOfIssue(issue);
        if (stepIndex >= 0) setCurrentTab(TABS[stepIndex].value);
        setExpandSignal(s => s + 1);
        setTimeout(() => focusIssue(issue), 150);
    };

    const reportIssues = (issues: PlanIssue[], title: string) => {
        setShowIssues(true);
        applyIssuesToForm(form, issues);
        const first = [...issues].sort((a, b) => stepIndexOfIssue(a) - stepIndexOfIssue(b))[0];
        toast({
            title,
            description: issues.length === 1
                ? formatPlanIssue(first)
                : `${formatPlanIssue(first)} (and ${issues.length - 1} more — see the list on the page).`,
            variant: "destructive",
        });
        goToIssue(first);
    };

    const handleFormSubmit = async (status: 'DRAFT' | 'PUBLISHED') => {
        const formValues = form.getValues();
        const issues = collectPlanIssues(formValues);
        if (status === 'PUBLISHED' && Math.abs(calculatePlanWeight(formValues.pillars) - 100) > 0.01) {
            issues.push({ path: '_weight', message: `Activity weights add up to ${calculatePlanWeight(formValues.pillars).toFixed(1)}% — they must total 100% to publish. You can still save it as a draft.` });
        }
        if (issues.length > 0) {
            reportIssues(issues, status === 'DRAFT' ? "Can't save the draft yet" : "Can't publish yet");
            return;
        }

        const formData = new FormData();
        formData.append('name', formValues.name);
        formData.append('startYear', String(formValues.startYear));
        formData.append('endYear', String(formValues.endYear));
        formData.append('version', formValues.version);
        formData.append('pillars', JSON.stringify(formValues.pillars));
        formData.append('status', status);

        setIsSaving(true);
        try {
            const result = await createStrategicPlan(formData);
            if (result && result.success === false) {
                setServerIssues(result.issues);
                if (result.issues.length > 0) {
                    reportIssues(result.issues, status === 'DRAFT' ? "Could not save the draft" : "Could not publish the plan");
                } else {
                    toast({ title: status === 'DRAFT' ? "Could not save the draft" : "Could not publish the plan", description: result.message, variant: "destructive" });
                }
            }
        } catch (error) {
            // createStrategicPlan redirects on success, which Next.js implements by
            // throwing — let that through; anything else is a real failure.
            unstable_rethrow(error);
            toast({
                title: status === 'DRAFT' ? "Could not save the draft" : "Could not publish the plan",
                description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleNext = () => {
        const blocking = collectPlanIssues(form.getValues()).filter(issue => stepIndexOfIssue(issue) <= currentIndex);
        if (blocking.length > 0) {
            reportIssues(blocking, "Can't continue yet");
            return;
        }
        form.clearErrors();
        setShowIssues(false);
        setServerIssues([]);
        if (currentIndex < TABS.length - 1) {
            setHighestCompletedStep(Math.max(highestCompletedStep, currentIndex + 1));
            setCurrentTab(TABS[currentIndex + 1].value);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleBack = () => {
        if (currentIndex > 0) setCurrentTab(TABS[currentIndex - 1].value);
    };

    return (
        <Form {...form}>
            <PlanFormIssuesProvider issues={liveIssues} expandSignal={expandSignal}>
            <form onSubmit={e => e.preventDefault()} className="flex-1 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
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
                        <Button variant="outline" type="button" disabled={isSaving} onClick={() => handleFormSubmit('DRAFT')}>Save Draft</Button>
                        <Button type="button" disabled={isSaving} onClick={() => handleFormSubmit('PUBLISHED')}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Publish Plan
                        </Button>
                    </div>
                </div>
                <Card>
                    <CardContent className="p-6">
                        <Stepper
                            steps={TABS.map((tab, index) => ({
                                title: tab.title,
                                isCompleted: index < highestCompletedStep,
                                isCurrent: currentTab === tab.value
                            }))}
                            onStepClick={(index) => {
                                if (index <= highestCompletedStep) setCurrentTab(TABS[index].value);
                            }}
                        />

                        <div className="mt-8 space-y-6">
                            <IssueSummary issues={issuesForThisStep} onSelect={goToIssue} />

                            <Tabs value={currentTab} onValueChange={setCurrentTab}>
                                <TabsContent value="plan-info" className="space-y-6">
                                    <StepHeader title="Step 1: Define Plan Information" description="Set the basic details for your new strategic plan." />
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <Label>Plan Name</Label>
                                                <FormControl><Input {...field} /></FormControl>
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
                                                    <FormControl><Input type="number" {...field} /></FormControl>
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
                                                    <FormControl><Input type="number" {...field} /></FormControl>
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
                                                    <FormControl><Input {...field} /></FormControl>
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
                                                    <Button type="button" variant="destructive" size="icon" aria-label={`Remove pillar ${index + 1}`} onClick={() => removePillar(index)}>
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
                                                                <FormControl><Input {...field} placeholder="e.g., Sustainable Growth" /></FormControl>
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
                                                                <FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </CardContent>
                                            </Card>
                                        ))}
                                        <ListIssue path="pillars" />
                                        <Button type="button" variant="outline" onClick={() => appendPillar(newPillar(users, departments, `Pillar ${pillarFields.length + 1}`))}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add Pillar
                                        </Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="objectives" className="space-y-6">
                                    <StepHeader title="Step 3: Define Objectives" description="An Objective is a specific, measurable goal that supports a Pillar." />
                                    <PillarSections form={form} render={(pIndex) => (
                                        <ObjectiveList pIndex={pIndex} form={form} users={users} departments={departments} />
                                    )} />
                                </TabsContent>

                                <TabsContent value="initiatives" className="space-y-6">
                                    <StepHeader title="Step 4: Define Initiatives" description="An Initiative is a specific project or program designed to achieve an Objective." />
                                    <PillarSections form={form} render={(pIndex) => (
                                        <ObjectiveSections form={form} pIndex={pIndex} render={(oIndex) => (
                                            <InitiativeList pIndex={pIndex} oIndex={oIndex} form={form} users={users} departments={departments} peopleOptions={userOptions} />
                                        )} />
                                    )} />
                                </TabsContent>

                                <TabsContent value="activities" className="space-y-6">
                                    <StepHeader title="Step 5: Define Activities" description="An Activity is a specific task required to complete an Initiative. Every activity shares one 100% weight pool across the whole plan." />
                                    {departments.length === 0 && (
                                        <Alert variant="destructive"><AlertDescription>No departments exist yet. Add departments on the Departments page before assigning activities.</AlertDescription></Alert>
                                    )}
                                    <PlanWeightSummary pillars={values.pillars} />
                                    <PillarSections form={form} render={(pIndex) => (
                                        <ObjectiveSections form={form} pIndex={pIndex} render={(oIndex) => (
                                            <InitiativeSections form={form} pIndex={pIndex} oIndex={oIndex} render={(iIndex) => (
                                                <ActivityTable pIndex={pIndex} oIndex={oIndex} iIndex={iIndex} form={form} users={users} departments={departments} userOptions={userOptions} />
                                            )} />
                                        )} />
                                    )} />
                                </TabsContent>

                                <TabsContent value="review" className="space-y-6">
                                    <StepHeader title="Step 6: Review & Save" description="Review the complete strategic plan hierarchy before publishing." />
                                    <ReviewSection values={values} users={users} />
                                </TabsContent>
                            </Tabs>

                            <div className="flex justify-between">
                                <Button variant="outline" type="button" onClick={handleBack} disabled={currentIndex === 0}>Back</Button>
                                {currentIndex < TABS.length - 1 ? (
                                    <Button type="button" onClick={handleNext}>Next</Button>
                                ) : (
                                    <Button type="button" disabled={isSaving} onClick={() => handleFormSubmit('PUBLISHED')}>Publish Plan</Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </form>
            </PlanFormIssuesProvider>
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

const calculateObjectiveWeight = (initiatives: any[] = []) => initiatives.reduce((total, initiative) => total + calculateInitiativeWeight(initiative.activities || []), 0);
const calculatePillarWeight = (objectives: any[] = []) => objectives.reduce((total, objective) => total + calculateObjectiveWeight(objective.initiatives || []), 0);
/** Sum of every activity's weight across the whole plan — the one pool that must total 100%. */
const calculatePlanWeight = (pillars: any[] = []) => pillars.reduce((total, pillar) => total + calculatePillarWeight(pillar.objectives || []), 0);

function PlanWeightSummary({ pillars }: { pillars: any[] }) {
    const total = calculatePlanWeight(pillars);
    const isBalanced = Math.abs(total - 100) < 0.01;
    return (
        <p data-weight-summary className={`text-sm font-semibold ${isBalanced ? 'text-green-600' : 'text-destructive'}`}>
            Total plan weight: {total.toFixed(1)}% {!isBalanced && '(must total 100% across the whole plan before publishing)'}
        </p>
    );
}

type PlanForm = UseFormReturn<FormValues>;

/** One collapsible section per pillar; `render` fills in what goes inside. */
function PillarSections({ form, render }: { form: PlanForm; render: (pIndex: number) => React.ReactNode }) {
    const pillars = form.watch('pillars') ?? [];
    const accordion = useAutoOpenAccordion(pillars.map(p => p.id!));
    if (pillars.length === 0) {
        return <p className="text-sm text-muted-foreground">There are no pillars yet. Go back to the Pillar step to add one.</p>;
    }
    return (
        <Accordion type="multiple" {...accordion}>
            {pillars.map((pillar, pIndex) => (
                <AccordionItem key={pillar.id} value={pillar.id!}>
                    <AccordionTrigger className="text-xl font-semibold">{pillar.title || `Pillar ${pIndex + 1}`}</AccordionTrigger>
                    <AccordionContent className="pl-4 border-l ml-4 space-y-4">{render(pIndex)}</AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}

function ObjectiveSections({ form, pIndex, render }: { form: PlanForm; pIndex: number; render: (oIndex: number) => React.ReactNode }) {
    const objectives = form.watch(`pillars.${pIndex}.objectives`) ?? [];
    const accordion = useAutoOpenAccordion(objectives.map(o => o.id!));
    if (objectives.length === 0) {
        return <ListIssueOr path={`pillars.${pIndex}.objectives`} text="This pillar has no objectives. Go back to the Objective step to add one." />;
    }
    return (
        <Accordion type="multiple" className="space-y-4" {...accordion}>
            {objectives.map((objective, oIndex) => (
                <AccordionItem key={objective.id} value={objective.id!}>
                    <AccordionTrigger className="font-semibold text-lg">{objective.statement || `Objective ${pIndex + 1}.${oIndex + 1}`}</AccordionTrigger>
                    <AccordionContent className="pl-4 border-l ml-4 space-y-4">{render(oIndex)}</AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}

function InitiativeSections({ form, pIndex, oIndex, render }: { form: PlanForm; pIndex: number; oIndex: number; render: (iIndex: number) => React.ReactNode }) {
    const initiatives = form.watch(`pillars.${pIndex}.objectives.${oIndex}.initiatives`) ?? [];
    const accordion = useAutoOpenAccordion(initiatives.map(i => i.id!));
    if (initiatives.length === 0) {
        return <ListIssueOr path={`pillars.${pIndex}.objectives.${oIndex}.initiatives`} text="This objective has no initiatives. Go back to the Initiative step to add one." />;
    }
    return (
        <Accordion type="multiple" className="space-y-4" {...accordion}>
            {initiatives.map((initiative, iIndex) => (
                <AccordionItem key={initiative.id} value={initiative.id!}>
                    <AccordionTrigger className="font-medium text-base">{initiative.title || `Initiative ${pIndex + 1}.${oIndex + 1}.${iIndex + 1}`}</AccordionTrigger>
                    <AccordionContent className="pl-4 border-l ml-4 space-y-4">{render(iIndex)}</AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}

/** An empty list in a later step: show its validation message if there is one, else a hint. */
function ListIssueOr({ path, text }: { path: string; text: string }) {
    return (
        <div className="space-y-1">
            <ListIssue path={path} />
            <p className="text-sm text-muted-foreground">{text}</p>
        </div>
    );
}

function ObjectiveList({ pIndex, form, users, departments }: { pIndex: number; form: PlanForm; users: Person[]; departments: string[] }) {
    const { control } = form;
    const { fields: objectiveFields, append: appendObjective, remove: removeObjective } = useFieldArray({ control, name: `pillars.${pIndex}.objectives` });

    return (
        <>
            {objectiveFields.map((objective, oIndex) => (
                <Card key={objective.id}>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Objective {pIndex + 1}.{oIndex + 1}</CardTitle>
                        <Button type="button" variant="destructive" size="icon" aria-label={`Remove objective ${pIndex + 1}.${oIndex + 1}`} onClick={() => removeObjective(oIndex)}>
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
                                    <FormControl><Textarea {...field} placeholder="e.g., Increase Market Share" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>
            ))}
            <ListIssue path={`pillars.${pIndex}.objectives`} />
            <Button type="button" variant="outline" size="sm" onClick={() => appendObjective(newObjective(users, departments, `Objective ${pIndex + 1}.${objectiveFields.length + 1}`))}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Objective
            </Button>
        </>
    )
}

function InitiativeList({ pIndex, oIndex, form, peopleOptions, users, departments }: { pIndex: number; oIndex: number; form: PlanForm; peopleOptions: MultiSelectOption[]; users: Person[]; departments: string[] }) {
    const { control } = form;
    const base = `pillars.${pIndex}.objectives.${oIndex}.initiatives` as const;
    const { fields: initiativeFields, append: appendInitiative, remove: removeInitiative } = useFieldArray({ control, name: base });

    return (
        <>
            {initiativeFields.map((initiative, iIndex) => (
                <Card key={initiative.id}>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Initiative {pIndex + 1}.{oIndex + 1}.{iIndex + 1}</CardTitle>
                        <Button type="button" variant="destructive" size="icon" aria-label={`Remove initiative ${pIndex + 1}.${oIndex + 1}.${iIndex + 1}`} onClick={() => removeInitiative(iIndex)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={control}
                            name={`${base}.${iIndex}.title`}
                            render={({ field }) => (
                                <FormItem>
                                    <Label>Initiative Title</Label>
                                    <FormControl><Input {...field} placeholder="Initiative Title" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name={`${base}.${iIndex}.description`}
                            render={({ field }) => (
                                <FormItem>
                                    <Label>Initiative Description</Label>
                                    <FormControl><Textarea {...field} value={field.value ?? ''} placeholder="Initiative Description" rows={2} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={control}
                                name={`${base}.${iIndex}.owners`}
                                render={({ field }) => (
                                    <FormItem data-field-path={field.name} tabIndex={-1}>
                                        <Label>Lead/Owner</Label>
                                        <FormControl>
                                            <MultiSelect options={peopleOptions} selected={field.value ?? []} onChange={field.onChange} placeholder="Select..." />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`${base}.${iIndex}.collaborators`}
                                render={({ field }) => (
                                    <FormItem>
                                        <Label>Collaborators</Label>
                                        <FormControl>
                                            <MultiSelect options={peopleOptions} selected={field.value ?? []} onChange={field.onChange} placeholder="Select..." />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>
            ))}
            <ListIssue path={base} />
            <Button type="button" variant="outline" size="sm" onClick={() => appendInitiative(newInitiative(users, departments, `Initiative ${pIndex + 1}.${oIndex + 1}.${initiativeFields.length + 1}`))}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Initiative
            </Button>
        </>
    );
}

function ActivityTable({ pIndex, oIndex, iIndex, form, users, departments, userOptions }: { pIndex: number; oIndex: number; iIndex: number; form: PlanForm; users: Person[]; departments: string[]; userOptions: { value: string; label: string }[] }) {
    const { control } = form;
    const base = `pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities` as const;
    const { fields: activityFields, append: appendActivity, remove: removeActivity } = useFieldArray({ control, name: base });
    const activities = form.watch(base) ?? [];

    return (
        <>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Deliverable</TableHead>
                            <TableHead>Weight (%)</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Responsible</TableHead>
                            <TableHead><span className="sr-only">Remove</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activityFields.map((activity, aIndex) => (
                            <TableRow key={activity.id} className="align-top">
                                <TableCell className="min-w-[200px]">
                                    <FormField control={control} name={`${base}.${aIndex}.title`} render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input {...field} placeholder="Activity title" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </TableCell>
                                <TableCell className="min-w-[220px]">
                                    <FormField control={control} name={`${base}.${aIndex}.deliverable`} render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Textarea {...field} value={field.value ?? ''} rows={1} placeholder="e.g., Segmented customer report" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </TableCell>
                                <TableCell className="min-w-[100px]">
                                    <FormField control={control} name={`${base}.${aIndex}.weight`} render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input type="number" step="0.01" min={0} max={100} {...field} placeholder="Weight" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </TableCell>
                                <TableCell className="min-w-[150px]">
                                    <FormField control={control} name={`${base}.${aIndex}.startDate`} render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input type="date" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </TableCell>
                                <TableCell className="min-w-[150px]">
                                    <FormField control={control} name={`${base}.${aIndex}.endDate`} render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input type="date" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </TableCell>
                                <TableCell className="min-w-[150px]">
                                    <FormField control={control} name={`${base}.${aIndex}.department`} render={({ field }) => (
                                        <FormItem data-field-path={field.name} tabIndex={-1}>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </TableCell>
                                <TableCell className="min-w-[170px]">
                                    <FormField control={control} name={`${base}.${aIndex}.responsible`} render={({ field }) => (
                                        <FormItem data-field-path={field.name} tabIndex={-1}>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>{userOptions.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </TableCell>
                                <TableCell>
                                    <Button type="button" variant="ghost" size="icon" aria-label="Remove activity" onClick={() => removeActivity(aIndex)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <ListIssue path={base} />
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => appendActivity(newActivity(users, departments))}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
                </Button>
                <p className="text-sm font-medium text-muted-foreground">
                    Subtotal: {calculateInitiativeWeight(activities).toFixed(1)}% of whole plan
                </p>
            </div>
        </>
    );
}

function ReviewSection({ values, users }: { values: FormValues; users: Person[] }) {
    const nameOf = (id: string) => users.find(u => u.id === id)?.name ?? 'Unknown';

    if (!values.pillars || values.pillars.length === 0) {
        return <p>No data entered yet. Please fill out the previous steps.</p>;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold">{values.name} ({values.startYear}-{values.endYear}) v{values.version}</h3>
            <PlanWeightSummary pillars={values.pillars} />
            {values.pillars.map((pillar, pIndex) => (
                <div key={pillar.id ?? pIndex} className="p-4 border rounded-lg space-y-3 bg-muted/20">
                    <h4 className="font-bold text-lg">{pillar.title} (Weight: {calculatePillarWeight(pillar.objectives).toFixed(1)}% of plan)</h4>
                    {pillar.objectives.map((objective, oIndex) => (
                        <div key={objective.id ?? oIndex} className="p-3 border rounded-md space-y-2 bg-background/50 ml-4">
                            <h5 className="font-semibold">{objective.statement} (Weight: {calculateObjectiveWeight(objective.initiatives).toFixed(1)}% of plan)</h5>
                            {objective.initiatives.map((initiative, iIndex) => (
                                <div key={initiative.id ?? iIndex} className="p-2 border rounded-md space-y-2 bg-muted/20 ml-4">
                                    <h6 className="font-medium">{initiative.title} (Weight: {calculateInitiativeWeight(initiative.activities).toFixed(1)}% of plan)</h6>
                                    <p className="text-xs text-muted-foreground">Lead/Owner: {initiative.owners.map(nameOf).join(', ') || '—'}</p>
                                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                        {initiative.activities.map((activity, aIndex) => (
                                            <li key={activity.id ?? aIndex}>
                                                <span className="font-semibold text-foreground">{activity.title}</span> — {activity.weight}% · {activity.startDate} to {activity.endDate} · {nameOf(activity.responsible)}
                                                {activity.deliverable ? <> · <span className="italic">Deliverable: {activity.deliverable}</span></> : null}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    )
}
