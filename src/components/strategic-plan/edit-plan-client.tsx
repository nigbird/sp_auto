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
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useMemo } from "react";
import { unstable_rethrow } from "next/navigation";
import { updateStrategicPlan } from "@/actions/strategic-plan";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import type { StrategicPlan } from "@/lib/types";
import { format } from "date-fns";
import { calculateInitiativeWeight } from "@/lib/utils";
import { planFormSchema, formatPlanIssue, type PlanFormValues, type PlanIssue } from "@/lib/plan-schema";
import { applyIssuesToForm, collectPlanIssues, focusIssue, IssueSummary, ListIssue, PlanFormIssuesProvider, useAutoOpenAccordion } from "./plan-form-issues";

type FormValues = PlanFormValues;
type PlanForm = UseFormReturn<FormValues>;
type Person = { id: string; name: string };

function generateId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const getToday = () => format(new Date(), 'yyyy-MM-dd');
const getOneMonthFromToday = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return format(d, 'yyyy-MM-dd');
}

function newActivity(users: Person[], departments: string[]) {
    return { id: generateId('A'), title: '', weight: 0, description: '', deliverable: '', startDate: getToday(), endDate: getOneMonthFromToday(), department: departments[0] ?? '', responsible: users[0]?.id ?? '' };
}
function newInitiative(users: Person[], departments: string[]) {
    return { id: generateId('I'), title: '', description: '', owners: users[0]?.id ? [users[0].id] : [], collaborators: [], activities: [newActivity(users, departments)] };
}
function newObjective(users: Person[], departments: string[]) {
    return { id: generateId('O'), statement: '', initiatives: [newInitiative(users, departments)] };
}
function newPillar(users: Person[], departments: string[]) {
    return { id: generateId('P'), title: '', description: '', objectives: [newObjective(users, departments)] };
}

const toDateInput = (value: unknown) => typeof value === 'string' ? value.split('T')[0] : value instanceof Date ? format(value, 'yyyy-MM-dd') : '';
const idOf = (value: unknown) => typeof value === 'string' ? value : (value as { id?: string } | null)?.id ?? '';

/** Turns the saved plan into exactly the shape the form (and the shared schema) expects. */
function planToFormValues(plan: StrategicPlan): FormValues {
    return {
        name: plan.name,
        startYear: plan.startYear,
        endYear: plan.endYear,
        version: plan.version,
        pillars: plan.pillars.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description ?? '',
            objectives: p.objectives.map(o => ({
                id: o.id,
                statement: o.statement ?? '',
                initiatives: o.initiatives.map(i => ({
                    id: i.id,
                    title: i.title,
                    description: i.description ?? '',
                    owners: [idOf(i.owner), ...(i.coOwners ?? [])].filter(Boolean),
                    collaborators: i.collaborators ?? [],
                    activities: i.activities.map(a => ({
                        id: a.id,
                        title: a.title,
                        weight: a.weight,
                        description: a.description ?? '',
                        deliverable: a.deliverable ?? '',
                        startDate: toDateInput(a.startDate),
                        endDate: toDateInput(a.endDate),
                        department: a.department,
                        responsible: idOf(a.responsible),
                        countsTowardWeight: a.countsTowardWeight,
                    })),
                })),
            })),
        })),
    };
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

type EditPlanClientProps = {
    users: Person[];
    departments: string[];
    plan: StrategicPlan;
}

export function EditPlanClient({ users, departments, plan }: EditPlanClientProps) {
    const { toast } = useToast();
    const planId = plan.id;
    const [showIssues, setShowIssues] = useState(false);
    const [serverIssues, setServerIssues] = useState<PlanIssue[]>([]);
    const [expandSignal, setExpandSignal] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    const userOptions = useMemo(() => users.map(u => ({ value: u.id, label: u.name })), [users]);
    const defaultValues = useMemo(() => planToFormValues(plan), [plan]);

    const form = useForm<FormValues>({
        resolver: zodResolver(planFormSchema),
        defaultValues,
        mode: "onBlur",
    });

    const { fields: pillarFields, append: appendPillar, remove: removePillar } = useFieldArray({
        control: form.control,
        name: "pillars"
    });

    const values = form.watch();
    const pillarAccordion = useAutoOpenAccordion((values.pillars ?? []).map(p => p.id!));

    const liveIssues = useMemo(() => {
        if (!showIssues) return [];
        const schemaIssues = collectPlanIssues(values);
        const stillRelevantServerIssues = serverIssues.filter(si => !schemaIssues.some(i => i.path === si.path) && !si.path.startsWith('_'));
        return [...schemaIssues, ...stillRelevantServerIssues];
    }, [showIssues, values, serverIssues]);

    const goToIssue = (issue: PlanIssue) => {
        setExpandSignal(s => s + 1);
        setTimeout(() => focusIssue(issue), 150);
    };

    const reportIssues = (issues: PlanIssue[], title: string) => {
        setShowIssues(true);
        applyIssuesToForm(form, issues);
        toast({
            title,
            description: issues.length === 1
                ? formatPlanIssue(issues[0])
                : `${formatPlanIssue(issues[0])} (and ${issues.length - 1} more — see the list at the top).`,
            variant: "destructive",
        });
        goToIssue(issues[0]);
    };

    const handleFormSubmit = async (status: 'DRAFT' | 'PUBLISHED') => {
        const formValues = form.getValues();
        const issues = collectPlanIssues(formValues);
        if (status === 'PUBLISHED' && Math.abs(calculatePlanWeight(formValues.pillars) - 100) > 0.01) {
            issues.push({ path: '_weight', message: `Activity weights add up to ${calculatePlanWeight(formValues.pillars).toFixed(1)}% — they must total 100% to publish. You can still save it as a draft.` });
        }
        if (issues.length > 0) {
            reportIssues(issues, status === 'DRAFT' ? "Can't save yet" : "Can't publish yet");
            return;
        }

        const formData = new FormData();
        formData.set('name', formValues.name);
        formData.set('startYear', String(formValues.startYear));
        formData.set('endYear', String(formValues.endYear));
        formData.set('version', formValues.version);
        formData.set('pillars', JSON.stringify(formValues.pillars));
        formData.set('status', status);

        setIsSaving(true);
        try {
            const result = await updateStrategicPlan(planId, formData);
            if (result && result.success === false) {
                setServerIssues(result.issues);
                if (result.issues.length > 0) {
                    reportIssues(result.issues, status === 'DRAFT' ? "Could not save" : "Could not publish");
                } else {
                    toast({ title: status === 'DRAFT' ? "Could not save" : "Could not publish", description: result.message, variant: "destructive" });
                }
            }
        } catch (error) {
            // updateStrategicPlan redirects on success, which Next.js implements by
            // throwing — let that through; anything else is a real failure.
            unstable_rethrow(error);
            toast({
                title: status === 'DRAFT' ? "Could not save" : "Could not publish",
                description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Form {...form}>
            <PlanFormIssuesProvider issues={liveIssues} expandSignal={expandSignal}>
            <form onSubmit={e => e.preventDefault()} className="flex-1 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="outline" size="icon">
                            <Link href={`/strategic-plan/${planId}`}>
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Edit Strategic Plan</h1>
                            <p className="text-muted-foreground">
                                Modify the details of the strategic plan.{plan.status === 'PUBLISHED' && ' This plan is published — saving it as a draft will unpublish it.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" type="button" disabled={isSaving} onClick={() => handleFormSubmit('DRAFT')}>Save as Draft</Button>
                        <Button type="button" disabled={isSaving} onClick={() => handleFormSubmit('PUBLISHED')}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save & Publish
                        </Button>
                    </div>
                </div>

                <IssueSummary issues={liveIssues} onSelect={goToIssue} />

                <Card>
                    <CardHeader>
                        <CardTitle>Plan Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
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

                        <PlanWeightSummary pillars={values.pillars} />

                        <Accordion type="multiple" className="w-full space-y-4" {...pillarAccordion}>
                            {pillarFields.map((pillar, pIndex) => (
                                <PillarAccordion key={pillar.id} pIndex={pIndex} form={form} removePillar={() => removePillar(pIndex)} users={users} departments={departments} peopleOptions={userOptions} userOptions={userOptions} />
                            ))}
                        </Accordion>
                        <ListIssue path="pillars" />
                        <Button type="button" variant="outline" onClick={() => appendPillar(newPillar(users, departments))}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Pillar
                        </Button>
                    </CardContent>
                </Card>
            </form>
            </PlanFormIssuesProvider>
        </Form>
    );
}

type SectionProps = { form: PlanForm; users: Person[]; departments: string[]; peopleOptions: MultiSelectOption[]; userOptions: { value: string; label: string }[] };

function PillarAccordion({ pIndex, form, removePillar, users, departments, peopleOptions, userOptions }: SectionProps & { pIndex: number; removePillar: () => void }) {
    const { control, watch } = form;
    const { fields: objectiveFields, append: appendObjective, remove: removeObjective } = useFieldArray({ control, name: `pillars.${pIndex}.objectives` });
    const pillar = watch(`pillars.${pIndex}`);
    const objectiveAccordion = useAutoOpenAccordion((pillar?.objectives ?? []).map(o => o.id!));

    return (
        <AccordionItem value={pillar.id!}>
            <div className="flex items-center justify-between w-full">
                <AccordionTrigger className="text-xl font-semibold p-4 bg-muted/50 rounded-t-lg flex-1">
                    <span>{pillar.title || `Pillar ${pIndex + 1}`}</span>
                </AccordionTrigger>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove pillar ${pIndex + 1}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePillar(); }} className="mr-2 hover:bg-destructive/20">
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </div>
            <AccordionContent className="p-4 border border-t-0 rounded-b-lg space-y-4">
                <FormField control={control} name={`pillars.${pIndex}.title`} render={({ field }) => <FormItem><Label>Pillar Title</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={control} name={`pillars.${pIndex}.description`} render={({ field }) => <FormItem><Label>Pillar Description</Label><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>} />

                <h3 className="font-semibold text-lg mt-4">Objectives</h3>
                <Accordion type="multiple" className="space-y-4" {...objectiveAccordion}>
                    {objectiveFields.map((objective, oIndex) => (
                        <ObjectiveAccordion key={objective.id} pIndex={pIndex} oIndex={oIndex} form={form} removeObjective={() => removeObjective(oIndex)} users={users} departments={departments} peopleOptions={peopleOptions} userOptions={userOptions} />
                    ))}
                </Accordion>
                <ListIssue path={`pillars.${pIndex}.objectives`} />
                <Button type="button" variant="outline" size="sm" onClick={() => appendObjective(newObjective(users, departments))}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Objective
                </Button>
            </AccordionContent>
        </AccordionItem>
    )
}

function ObjectiveAccordion({ pIndex, oIndex, form, removeObjective, users, departments, peopleOptions, userOptions }: SectionProps & { pIndex: number; oIndex: number; removeObjective: () => void }) {
    const { control, watch } = form;
    const base = `pillars.${pIndex}.objectives.${oIndex}` as const;
    const { fields: initiativeFields, append: appendInitiative, remove: removeInitiative } = useFieldArray({ control, name: `${base}.initiatives` });
    const objective = watch(base);

    return (
        <AccordionItem value={objective.id!}>
            <AccordionTrigger className="font-semibold text-lg p-3 bg-background rounded-t-md border">{objective.statement || `Objective ${pIndex + 1}.${oIndex + 1}`}</AccordionTrigger>
            <AccordionContent className="p-4 border border-t-0 rounded-b-md space-y-4">
                <div className="flex justify-between items-start">
                    <FormField control={control} name={`${base}.statement`} render={({ field }) => <FormItem className="flex-grow"><Label>Objective Statement</Label><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove objective ${pIndex + 1}.${oIndex + 1}`} onClick={removeObjective} className="ml-2"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>

                <h4 className="font-semibold mt-4">Initiatives</h4>
                <div className="space-y-4">
                    {initiativeFields.map((initiative, iIndex) => (
                        <InitiativeCard key={initiative.id} pIndex={pIndex} oIndex={oIndex} iIndex={iIndex} form={form} removeInitiative={() => removeInitiative(iIndex)} users={users} departments={departments} peopleOptions={peopleOptions} userOptions={userOptions} />
                    ))}
                </div>
                <ListIssue path={`${base}.initiatives`} />
                <Button type="button" variant="outline" size="sm" onClick={() => appendInitiative(newInitiative(users, departments))}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Initiative
                </Button>
            </AccordionContent>
        </AccordionItem>
    );
}

function InitiativeCard({ pIndex, oIndex, iIndex, form, removeInitiative, users, departments, peopleOptions, userOptions }: SectionProps & { pIndex: number; oIndex: number; iIndex: number; removeInitiative: () => void }) {
    const { control, watch } = form;
    const base = `pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}` as const;
    const { fields: activityFields, append: appendActivity, remove: removeActivity } = useFieldArray({ control, name: `${base}.activities` });
    const activities = watch(`${base}.activities`) || [];

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between p-4 bg-muted/30">
                <CardTitle className="text-base">Initiative {pIndex + 1}.{oIndex + 1}.{iIndex + 1}</CardTitle>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove initiative ${pIndex + 1}.${oIndex + 1}.${iIndex + 1}`} onClick={removeInitiative} className="hover:bg-destructive/20"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
                <FormField control={control} name={`${base}.title`} render={({ field }) => <FormItem><Label>Title</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={control} name={`${base}.description`} render={({ field }) => <FormItem><Label>Description</Label><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={control} name={`${base}.owners`} render={({ field }) => <FormItem data-field-path={field.name} tabIndex={-1}><Label>Lead/Owner</Label><FormControl><MultiSelect options={peopleOptions} selected={field.value ?? []} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={control} name={`${base}.collaborators`} render={({ field }) => <FormItem><Label>Collaborators</Label><FormControl><MultiSelect options={peopleOptions} selected={field.value ?? []} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>} />
                </div>
                <div className="space-y-2 pt-4">
                    <Label>Activities</Label>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Deliverable</TableHead>
                                    <TableHead>Weight (%)</TableHead>
                                    <TableHead>Start</TableHead>
                                    <TableHead>End</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Responsible</TableHead>
                                    <TableHead><span className="sr-only">Remove</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activityFields.map((activity, aIndex) => {
                                    const aBase = `${base}.activities.${aIndex}` as const;
                                    return (
                                        <TableRow key={activity.id} className="align-top">
                                            <TableCell className="min-w-[200px]"><FormField control={control} name={`${aBase}.title`} render={({ field }) => <FormItem><FormControl><Input {...field} placeholder="Activity title" /></FormControl><FormMessage /></FormItem>} /></TableCell>
                                            <TableCell className="min-w-[220px]"><FormField control={control} name={`${aBase}.deliverable`} render={({ field }) => <FormItem><FormControl><Textarea {...field} value={field.value ?? ''} rows={1} placeholder="e.g., Segmented customer report" /></FormControl><FormMessage /></FormItem>} /></TableCell>
                                            <TableCell className="min-w-[100px]"><FormField control={control} name={`${aBase}.weight`} render={({ field }) => <FormItem><FormControl><Input type="number" step="0.01" min={0} max={100} {...field} /></FormControl><FormMessage /></FormItem>} /></TableCell>
                                            <TableCell className="min-w-[150px]"><FormField control={control} name={`${aBase}.startDate`} render={({ field }) => <FormItem><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} /></TableCell>
                                            <TableCell className="min-w-[150px]"><FormField control={control} name={`${aBase}.endDate`} render={({ field }) => <FormItem><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} /></TableCell>
                                            <TableCell className="min-w-[150px]">
                                                <FormField control={control} name={`${aBase}.department`} render={({ field }) => (
                                                    <FormItem data-field-path={field.name} tabIndex={-1}>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                                                            <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </TableCell>
                                            <TableCell className="min-w-[170px]">
                                                <FormField control={control} name={`${aBase}.responsible`} render={({ field }) => (
                                                    <FormItem data-field-path={field.name} tabIndex={-1}>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                                                            <SelectContent>{userOptions.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </TableCell>
                                            <TableCell><Button type="button" variant="ghost" size="icon" aria-label="Remove activity" onClick={() => removeActivity(aIndex)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    <ListIssue path={`${base}.activities`} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => appendActivity(newActivity(users, departments))}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
                        </Button>
                        <p className="text-sm font-medium text-muted-foreground">
                            Subtotal: {calculateInitiativeWeight(activities).toFixed(1)}% of whole plan
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
