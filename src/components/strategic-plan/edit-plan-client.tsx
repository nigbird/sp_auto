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
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useMemo, useEffect } from "react";
import { unstable_rethrow } from "next/navigation";
import { updateStrategicPlan } from "@/actions/strategic-plan";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import type { StrategicPlan } from "@/lib/types";
import { format } from "date-fns";
import { calculateInitiativeWeight, cn } from "@/lib/utils";
import { planFormSchema, formatPlanIssue, type PlanFormValues, type PlanIssue } from "@/lib/plan-schema";
import { applyIssuesToForm, collectPlanIssues, focusIssue, IssueSummary, ListIssue, PlanFormIssuesProvider, useAutoOpenAccordion } from "./plan-form-issues";
import { type PlanPerson } from "./activity-lead-owner-field";
import { ActivityRowsEditor } from "./activity-rows-editor";
import { computeVisibility, EditVisibilityProvider, filtersActive, NO_FILTERS, PlanEditToolbar, useHiddenClass, type EditFilters } from "./plan-edit-filters";

type FormValues = PlanFormValues;
type PlanForm = UseFormReturn<FormValues>;
type Person = PlanPerson;

function generateId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const getToday = () => format(new Date(), 'yyyy-MM-dd');
const getOneMonthFromToday = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return format(d, 'yyyy-MM-dd');
}

function newActivity(users: Person[]) {
    const person = users[0];
    return { id: generateId('A'), title: '', weight: 0, description: '', deliverable: '', startDate: getToday(), endDate: getOneMonthFromToday(), collaborators: [] as string[], leadOwner: person?.leadOwner ?? '', responsible: person?.id ?? '' };
}
function newInitiative(users: Person[]) {
    return { id: generateId('I'), title: '', description: '', owners: users[0]?.id ? [users[0].id] : [], collaborators: [], activities: [newActivity(users)] };
}
function newObjective(users: Person[]) {
    return { id: generateId('O'), statement: '', initiatives: [newInitiative(users)] };
}
function newPillar(users: Person[]) {
    return { id: generateId('P'), title: '', description: '', objectives: [newObjective(users)] };
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
                        leadOwner: a.leadOwner ?? '',
                        startDate: toDateInput(a.startDate),
                        endDate: toDateInput(a.endDate),
                        collaborators: a.collaborators ?? [],
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
    plan: StrategicPlan;
}

export function EditPlanClient({ users, plan }: EditPlanClientProps) {
    const { toast } = useToast();
    const planId = plan.id;
    const [showIssues, setShowIssues] = useState(false);
    const [serverIssues, setServerIssues] = useState<PlanIssue[]>([]);
    const [expandSignal, setExpandSignal] = useState(0);
    const [collapseSignal, setCollapseSignal] = useState(0);
    const [collapsedAll, setCollapsedAll] = useState(false);
    const [filters, setFilters] = useState<EditFilters>(NO_FILTERS);
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

    const userNames = useMemo(() => new Map(users.map(u => [u.id, u.name])), [users]);
    const visibility = useMemo(() => computeVisibility(values.pillars, filters, liveIssues, userNames), [values.pillars, filters, liveIssues, userNames]);

    // Filtering searches the whole plan, so open every section to show what matches.
    useEffect(() => {
        if (filtersActive(filters)) { setExpandSignal(s => s + 1); setCollapsedAll(false); }
    }, [filters]);

    const toggleAll = () => {
        if (collapsedAll) setExpandSignal(s => s + 1); else setCollapseSignal(s => s + 1);
        setCollapsedAll(c => !c);
    };

    const goToIssue = (issue: PlanIssue) => {
        // A search or filter could be hiding the field; problems stay visible under "Only rows with problems".
        setFilters(f => filtersActive(f) ? { ...NO_FILTERS, problemsOnly: f.problemsOnly } : f);
        setExpandSignal(s => s + 1);
        setCollapsedAll(false);
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
            <PlanFormIssuesProvider issues={liveIssues} expandSignal={expandSignal} collapseSignal={collapseSignal}>
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

                        <PlanEditToolbar filters={filters} onChange={setFilters} pillars={values.pillars} users={users} visibility={visibility}
                            issueCount={liveIssues.length} anyCollapsed={collapsedAll} onToggleAll={toggleAll} />
                        {visibility.active && visibility.matched === 0 && (
                            <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">No activities match the search or filters.</p>
                        )}

                        <EditVisibilityProvider value={visibility}>
                        <Accordion type="multiple" className="w-full space-y-4" {...pillarAccordion}>
                            {pillarFields.map((pillar, pIndex) => (
                                <PillarAccordion key={pillar.id} pIndex={pIndex} form={form} removePillar={() => removePillar(pIndex)} users={users} peopleOptions={userOptions} userOptions={userOptions} />
                            ))}
                        </Accordion>
                        </EditVisibilityProvider>
                        <ListIssue path="pillars" />
                        <Button type="button" variant="outline" onClick={() => appendPillar(newPillar(users))}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Pillar
                        </Button>
                    </CardContent>
                </Card>
            </form>
            </PlanFormIssuesProvider>
        </Form>
    );
}

type SectionProps = { form: PlanForm; users: Person[]; peopleOptions: MultiSelectOption[]; userOptions: { value: string; label: string }[] };

type FormPillar = FormValues["pillars"][number];
type FormObjective = FormPillar["objectives"][number];
const objectiveWeight = (o?: FormObjective) => (o?.initiatives ?? []).reduce((sum, i) => sum + calculateInitiativeWeight(i.activities), 0);
const pillarWeight = (p?: FormPillar) => (p?.objectives ?? []).reduce((sum, o) => sum + objectiveWeight(o), 0);

const CAPTION = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80";

/** Section headers styled like the plan view's grouped rows: pillar darkest, then objective, then initiative. */
function SectionHeader({ label, title, weight, tone, onRemove, removeLabel, asTrigger }: {
    label: string;
    title: string;
    weight: number;
    tone: "pillar" | "objective" | "initiative";
    onRemove: () => void;
    removeLabel: string;
    asTrigger: boolean;
}) {
    const body = (
        <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="min-w-0 flex-1">
                <span className={cn("block", CAPTION)}>{label}</span>
                <span className={cn("block truncate", tone === "pillar" ? "font-semibold text-foreground" : "font-medium text-foreground/90")} title={title}>{title}</span>
            </span>
            <span className={cn("shrink-0 tabular-nums", tone === "pillar" ? "font-semibold" : "font-medium text-foreground/90")}>{weight.toFixed(1)}%</span>
        </span>
    );
    return (
        <div className={cn("flex items-center gap-1 pr-2", tone === "pillar" && "bg-muted/70", tone === "objective" && "bg-muted/35", tone === "initiative" && "border-b border-border/50 bg-muted/10")}>
            {asTrigger
                ? <AccordionTrigger className="flex-1 gap-3 px-4 py-3 hover:no-underline">{body}</AccordionTrigger>
                : <div className="flex flex-1 px-4 py-3">{body}</div>}
            <Button type="button" variant="ghost" size="icon" aria-label={removeLabel} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }} className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}

function PillarAccordion({ pIndex, form, removePillar, users, peopleOptions, userOptions }: SectionProps & { pIndex: number; removePillar: () => void }) {
    const { control, watch } = form;
    const { fields: objectiveFields, append: appendObjective, remove: removeObjective } = useFieldArray({ control, name: `pillars.${pIndex}.objectives` });
    const pillar = watch(`pillars.${pIndex}`);
    const objectiveAccordion = useAutoOpenAccordion((pillar?.objectives ?? []).map(o => o.id!));
    const hidden = useHiddenClass(`pillars.${pIndex}`);

    return (
        <AccordionItem value={pillar.id!} className={cn("overflow-hidden rounded-xl border border-border/50 bg-card", hidden)}>
            <SectionHeader asTrigger tone="pillar" label={`Pillar ${pIndex + 1}`} title={pillar.title || "Untitled pillar"} weight={pillarWeight(pillar)}
                onRemove={removePillar} removeLabel={`Remove pillar ${pIndex + 1}`} />
            <AccordionContent className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField control={control} name={`pillars.${pIndex}.title`} render={({ field }) => <FormItem><Label>Pillar Title</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={control} name={`pillars.${pIndex}.description`} render={({ field }) => <FormItem><Label>Pillar Description</Label><FormControl><Textarea {...field} value={field.value ?? ""} rows={1} className="min-h-10" /></FormControl><FormMessage /></FormItem>} />
                </div>

                <Accordion type="multiple" className="space-y-3" {...objectiveAccordion}>
                    {objectiveFields.map((objective, oIndex) => (
                        <ObjectiveAccordion key={objective.id} pIndex={pIndex} oIndex={oIndex} form={form} removeObjective={() => removeObjective(oIndex)} users={users} peopleOptions={peopleOptions} userOptions={userOptions} />
                    ))}
                </Accordion>
                <ListIssue path={`pillars.${pIndex}.objectives`} />
                <Button type="button" variant="outline" size="sm" onClick={() => appendObjective(newObjective(users))}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Objective
                </Button>
            </AccordionContent>
        </AccordionItem>
    )
}

function ObjectiveAccordion({ pIndex, oIndex, form, removeObjective, users, peopleOptions, userOptions }: SectionProps & { pIndex: number; oIndex: number; removeObjective: () => void }) {
    const { control, watch } = form;
    const base = `pillars.${pIndex}.objectives.${oIndex}` as const;
    const { fields: initiativeFields, append: appendInitiative, remove: removeInitiative } = useFieldArray({ control, name: `${base}.initiatives` });
    const objective = watch(base);
    const hidden = useHiddenClass(base);

    return (
        <AccordionItem value={objective.id!} className={cn("overflow-hidden rounded-xl border border-border/50", hidden)}>
            <SectionHeader asTrigger tone="objective" label={`Objective ${pIndex + 1}.${oIndex + 1}`} title={objective.statement || "Untitled objective"} weight={objectiveWeight(objective)}
                onRemove={removeObjective} removeLabel={`Remove objective ${pIndex + 1}.${oIndex + 1}`} />
            <AccordionContent className="space-y-4 p-4">
                <FormField control={control} name={`${base}.statement`} render={({ field }) => <FormItem><Label>Objective Statement</Label><FormControl><Textarea {...field} rows={1} className="min-h-10" /></FormControl><FormMessage /></FormItem>} />

                <div className="space-y-3">
                    {initiativeFields.map((initiative, iIndex) => (
                        <InitiativeCard key={initiative.id} pIndex={pIndex} oIndex={oIndex} iIndex={iIndex} form={form} removeInitiative={() => removeInitiative(iIndex)} users={users} peopleOptions={peopleOptions} userOptions={userOptions} />
                    ))}
                </div>
                <ListIssue path={`${base}.initiatives`} />
                <Button type="button" variant="outline" size="sm" onClick={() => appendInitiative(newInitiative(users))}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Initiative
                </Button>
            </AccordionContent>
        </AccordionItem>
    );
}

function InitiativeCard({ pIndex, oIndex, iIndex, form, removeInitiative, users, peopleOptions, userOptions }: SectionProps & { pIndex: number; oIndex: number; iIndex: number; removeInitiative: () => void }) {
    const { control, watch } = form;
    const base = `pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}` as const;
    const initiative = watch(base);
    const number = `${pIndex + 1}.${oIndex + 1}.${iIndex + 1}`;
    const hidden = useHiddenClass(base);

    return (
        <div className={cn("overflow-hidden rounded-xl border border-border/50 bg-card", hidden)}>
            <SectionHeader asTrigger={false} tone="initiative" label={`Initiative ${number}`} title={initiative?.title || "Untitled initiative"} weight={calculateInitiativeWeight(initiative?.activities)}
                onRemove={removeInitiative} removeLabel={`Remove initiative ${number}`} />
            <div className="space-y-4 p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField control={control} name={`${base}.title`} render={({ field }) => <FormItem><Label>Title</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={control} name={`${base}.description`} render={({ field }) => <FormItem><Label>Description</Label><FormControl><Textarea {...field} value={field.value ?? ""} rows={1} className="min-h-10" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={control} name={`${base}.owners`} render={({ field }) => <FormItem data-field-path={field.name} tabIndex={-1}><Label>Lead/Owner</Label><FormControl><MultiSelect options={peopleOptions} selected={field.value ?? []} onChange={field.onChange} maxVisible={3} /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={control} name={`${base}.collaborators`} render={({ field }) => <FormItem><Label>Collaborators</Label><FormControl><MultiSelect options={peopleOptions} selected={field.value ?? []} onChange={field.onChange} maxVisible={3} /></FormControl><FormMessage /></FormItem>} />
                </div>
                <div className="space-y-2 pt-2">
                    <p className="text-sm font-medium">Activities</p>
                    <ActivityRowsEditor form={form} path={`${base}.activities`} number={number} users={users} userOptions={userOptions} createActivity={() => newActivity(users)} />
                </div>
            </div>
        </div>
    );
}
