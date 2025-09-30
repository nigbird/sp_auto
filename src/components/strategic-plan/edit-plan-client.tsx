
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { ArrowLeft, Trash2, PlusCircle } from "lucide-react";
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
import { useState, useEffect, useMemo } from "react";
import { updateStrategicPlan } from "@/actions/strategic-plan";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import type { StrategicPlan, User as AppUser } from "@/lib/types";
import { useParams } from "next/navigation";
import { format } from "date-fns";

const activitySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  weight: z.coerce.number().min(0, "Weight must be positive"),
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

function generateId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const getToday = () => format(new Date(), 'yyyy-MM-dd');
const getOneMonthFromToday = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return format(d, 'yyyy-MM-dd');
}

type EditPlanClientProps = {
    users: { id: string; name: string; }[];
    departments: string[];
    plan: StrategicPlan;
}

export function EditPlanClient({ users, departments, plan }: EditPlanClientProps) {
    const { toast } = useToast();
    const params = useParams();
    const planId = params.id as string;
    
    const userOptions = useMemo(() => users.map(u => ({ value: u.id, label: u.name })), [users]);
    const peopleOptions: MultiSelectOption[] = useMemo(() => 
        [...userOptions, ...departments.map(d => ({ value: d, label: d }))]
    , [userOptions, departments]);

    // Prepare initial default values from plan
    const initialDefaultValues = useMemo(() => {
        if (!plan) return {};
        const planData = JSON.parse(JSON.stringify(plan));
        planData.pillars.forEach((p:any) => {
            p.description = p.description ?? '';
            p.objectives.forEach((o:any) => {
                o.initiatives.forEach((i:any) => {
                    i.description = i.description ?? '';
                    i.owner = i.owner || "";
                    i.collaborators = i.collaborators || [];
                    i.activities.forEach((a:any) => {
                        if (a.startDate) a.startDate = a.startDate.split('T')[0];
                        if (a.endDate) a.endDate = a.endDate.split('T')[0];
                        a.responsible = (a.responsible as AppUser)?.id || a.responsible;
                        a.description = a.description ?? '';
                    })
                })
            })
        })
        return planData;
    }, [plan]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: initialDefaultValues,
        mode: "onChange"
    });

    // Only reset if planId changes and plan is loaded (to support navigation)
    useEffect(() => {
        if (planId && plan) {
            form.reset(initialDefaultValues);
        }
    }, [planId, initialDefaultValues, form]);

    const { fields: pillarFields, append: appendPillar, remove: removePillar } = useFieldArray({
        control: form.control,
        name: "pillars"
    });

    const handleFormSubmit = async (status: 'DRAFT' | 'PUBLISHED') => {
        const formData = new FormData();
        const formValues = form.getValues();

        formData.set('name', formValues.name);
        formData.set('startYear', String(formValues.startYear));
        formData.set('endYear', String(formValues.endYear));
        formData.set('version', formValues.version);
        formData.set('pillars', JSON.stringify(formValues.pillars));
        formData.set('status', status);
        
        toast({
            title: status === 'DRAFT' ? "Updating Draft..." : "Updating Plan...",
            description: "Please wait.",
        });

        const result = await updateStrategicPlan(planId, formData);
        if (result?.success === false) {
             toast({
                title: "Validation Error",
                description: "Please correct the errors and try again.",
                variant: "destructive",
            });
            form.clearErrors();
            for (const [field, messages] of Object.entries(result.errors)) {
                form.setError(field as any, {
                    type: 'manual',
                    message: (messages as string[]).join(', '),
                });
            }
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={e => e.preventDefault()} className="flex-1 space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="outline" size="icon">
                        <Link href={`/strategic-plan/${planId}`}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Edit Strategic Plan</h1>
                            <p className="text-muted-foreground">Modify the details of the strategic plan.</p>
                        </div>
                    </div>
                     <div className="flex gap-2">
                        <Button variant="outline" type="button" onClick={() => handleFormSubmit('DRAFT')}>Save Draft</Button>
                        <Button type="button" onClick={() => form.handleSubmit(() => handleFormSubmit('PUBLISHED'))()}>Update & Publish</Button>
                    </div>
                </div>
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

                        <Accordion type="multiple" className="w-full space-y-4" defaultValue={pillarFields.map(p => p.id || '')}>
                            {pillarFields.map((pillar, pIndex) => (
                                <PillarAccordion key={pillar.id} pIndex={pIndex} form={form} removePillar={() => removePillar(pIndex)} users={users} departments={departments} peopleOptions={peopleOptions} userOptions={userOptions} />
                            ))}
                        </Accordion>
                        <Button type="button" variant="outline" onClick={() => appendPillar({ id: generateId('P'), title: `Pillar ${pillarFields.length + 1}`, description: "", objectives: [] })}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Pillar
                        </Button>
                    </CardContent>
                </Card>
            </form>
        </Form>
    );
}


function PillarAccordion({ pIndex, form, removePillar, users, departments, peopleOptions, userOptions }: { pIndex: number; form: any; removePillar: () => void; users: any[], departments: any[], peopleOptions: any[], userOptions: any[] }) {
    const { control, watch } = form;
    const { fields: objectiveFields, append: appendObjective, remove: removeObjective } = useFieldArray({ control, name: `pillars.${pIndex}.objectives` });
    const pillarTitle = watch(`pillars.${pIndex}.title`);

    return (
        <AccordionItem value={form.getValues(`pillars.${pIndex}.id`)}>
            <div className="flex items-center justify-between w-full">
                <AccordionTrigger className="text-xl font-semibold p-4 bg-muted/50 rounded-t-lg flex-1">
                    <span>{pillarTitle}</span>
                </AccordionTrigger>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePillar(); }}
                    className="mr-2 hover:bg-destructive/20"
                    type="button"
                >
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </div>
            <AccordionContent className="p-4 border border-t-0 rounded-b-lg space-y-4">
                 <FormField control={control} name={`pillars.${pIndex}.title`} render={({ field }) => <FormItem><Label>Pillar Title</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                 <FormField control={control} name={`pillars.${pIndex}.description`} render={({ field }) => <FormItem><Label>Pillar Description</Label><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>} />
                 
                 <h3 className="font-semibold text-lg mt-4">Objectives</h3>
                 <Accordion type="multiple" className="space-y-4" defaultValue={objectiveFields.map(o => o.id || '')}>
                    {objectiveFields.map((objective, oIndex) => (
                        <ObjectiveAccordion key={objective.id} pIndex={pIndex} oIndex={oIndex} form={form} removeObjective={() => removeObjective(oIndex)} users={users} departments={departments} peopleOptions={peopleOptions} userOptions={userOptions} />
                    ))}
                 </Accordion>
                 <Button type="button" variant="outline" size="sm" onClick={() => appendObjective({ id: generateId('O'), statement: ``, initiatives: [] })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Objective
                </Button>
            </AccordionContent>
        </AccordionItem>
    )
}

function ObjectiveAccordion({ pIndex, oIndex, form, removeObjective, users, departments, peopleOptions, userOptions }: { pIndex: number; oIndex: number; form: any, removeObjective: () => void, users: any[], departments: any[], peopleOptions: any[], userOptions: any[] }) {
    const { control, watch } = form;
    const { fields: initiativeFields, append: appendInitiative, remove: removeInitiative } = useFieldArray({ control, name: `pillars.${pIndex}.objectives.${oIndex}.initiatives` });
    const objectiveStatement = watch(`pillars.${pIndex}.objectives.${oIndex}.statement`);

    return (
        <AccordionItem value={form.getValues(`pillars.${pIndex}.objectives.${oIndex}.id`)}>
            <AccordionTrigger className="font-semibold text-lg p-3 bg-background rounded-t-md border">{objectiveStatement || `Objective ${oIndex + 1}`}</AccordionTrigger>
            <AccordionContent className="p-4 border border-t-0 rounded-b-md space-y-4">
                <div className="flex justify-between items-start">
                    <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.statement`} render={({ field }) => <FormItem className="flex-grow"><Label>Objective Statement</Label><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
                    <Button variant="ghost" size="icon" onClick={removeObjective} className="ml-2"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                </div>
                
                <h4 className="font-semibold mt-4">Initiatives</h4>
                 <div className="space-y-4">
                    {initiativeFields.map((initiative, iIndex) => (
                        <InitiativeCard key={initiative.id} pIndex={pIndex} oIndex={oIndex} iIndex={iIndex} form={form} removeInitiative={() => removeInitiative(iIndex)} users={users} departments={departments} peopleOptions={peopleOptions} userOptions={userOptions} />
                    ))}
                 </div>
                <Button type="button" variant="outline" size="sm" onClick={() => appendInitiative({ id: generateId('I'), title: ``, description: "", owner: users[0]?.id || "", collaborators: [], activities: [] })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Initiative
                </Button>
            </AccordionContent>
        </AccordionItem>
    );
}

function InitiativeCard({ pIndex, oIndex, iIndex, form, removeInitiative, users, departments, peopleOptions, userOptions }: { pIndex: number; oIndex: number; iIndex: number; form: any, removeInitiative: () => void, users: any[], departments: any[], peopleOptions: any[], userOptions: any[] }) {
    const { control } = form;
    const { fields: activityFields, append: appendActivity, remove: removeActivity } = useFieldArray({ control, name: `pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities` });

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between p-4 bg-muted/30">
                <CardTitle className="text-base">Initiative {iIndex + 1}</CardTitle>
                <Button variant="ghost" size="icon" onClick={removeInitiative} className="hover:bg-destructive/20"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
                <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.title`} render={({ field }) => <FormItem><Label>Title</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.description`} render={({ field }) => <FormItem><Label>Description</Label><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>} />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.owner`} render={({ field }) => <FormItem><Label>Owner</Label><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl><SelectContent>{userOptions.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                    <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.collaborators`} render={({ field }) => <FormItem><Label>Collaborators</Label><FormControl><MultiSelect options={peopleOptions} selected={field.value ?? []} onChange={field.onChange}/></FormControl><FormMessage /></FormItem>} />
                </div>
                <div className="space-y-2 pt-4">
                    <Label>Activities</Label>
                    <Table>
                        <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Weight</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Department</TableHead><TableHead>Responsible</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                        {activityFields.map((activity, aIndex) => (
                            <TableRow key={activity.id}>
                                <TableCell><FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.title`} render={({ field }) => <Input {...field} />} /></TableCell>
                                <TableCell><FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.weight`} render={({ field }) => <Input type="number" step="0.01" {...field} />} /></TableCell>
                                <TableCell><FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.startDate`} render={({ field }) => <Input type="date" {...field} />} /></TableCell>
                                <TableCell><FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.endDate`} render={({ field }) => <Input type="date" {...field} />} /></TableCell>
                                <TableCell>
                                    <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.department`} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl>
                                            <SelectContent>{departments.map(d=><SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )} />
                                </TableCell>
                                <TableCell>
                                    <FormField control={control} name={`pillars.${pIndex}.objectives.${oIndex}.initiatives.${iIndex}.activities.${aIndex}.responsible`} render={({ field }) => (
                                         <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl>
                                            <SelectContent>{userOptions.map(u=><SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )} />
                                </TableCell>
                                <TableCell><Button variant="ghost" size="icon" onClick={() => removeActivity(aIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                     <Button type="button" variant="outline" size="sm" onClick={() => appendActivity({ id: generateId('A'), title: ``, weight: 0, startDate: getToday(), endDate: getOneMonthFromToday(), department: departments[0] || '', responsible: users[0]?.id || '' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
