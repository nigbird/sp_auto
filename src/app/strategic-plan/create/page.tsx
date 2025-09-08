
"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { ArrowLeft, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Stepper } from "@/components/ui/stepper";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const activitySchema = z.object({
  code: z.string().min(1, "Code is required"),
  title: z.string().min(1, "Title is required"),
  deliverable: z.string().optional(),
  uom: z.string().optional(),
  weight: z.coerce.number().min(0, "Weight must be positive").max(100, "Weight cannot exceed 100"),
  target: z.coerce.number().min(0, "Target must be positive"),
  baseline: z.coerce.number().optional(),
  deadline: z.string().min(1, "Deadline is required"),
  responsible: z.string().min(1, "Responsible person/dept is required"),
});

const formSchema = z.object({
  planTitle: z.string().min(1, "Plan Title is required"),
  startYear: z.coerce.number().min(2000),
  endYear: z.coerce.number().min(2000),
  version: z.string().min(1, "Version is required"),

  pillarCode: z.string().min(1, "Pillar Code is required"),
  pillarTitle: z.string().min(1, "Pillar Title is required"),
  pillarDescription: z.string().optional(),

  objectiveCode: z.string().min(1, "Objective Code is required"),
  objectiveStatement: z.string().min(1, "Objective Statement is required"),

  initiativeCode: z.string().min(1, "Initiative Code is required"),
  initiativeTitle: z.string().min(1, "Initiative Title is required"),
  initiativeDescription: z.string().optional(),

  activities: z.array(activitySchema).min(1, "At least one activity is required"),
}).refine(data => data.endYear >= data.startYear, {
    message: "End year must be greater than or equal to start year",
    path: ["endYear"],
}).refine(data => {
    const totalWeight = data.activities.reduce((sum, act) => sum + act.weight, 0);
    return totalWeight === 100;
}, {
    message: "The weights of all activities must add up to 100%",
    path: ["activities"],
});

type FormValues = z.infer<typeof formSchema>;

const steps = [
    { title: "Plan Info" },
    { title: "Pillar" },
    { title: "Objective" },
    { title: "Initiative" },
    { title: "Activities" },
    { title: "Review & Save" },
];

const users = ["Liam Johnson", "Olivia Smith", "Noah Williams", "Emma Brown", "Oliver Jones", "Admin User"];
const departments = ["Marketing", "Sales", "Engineering", "Human Resources", "Support", "Finance"];


export default function CreateStrategicPlanPage() {
    const [currentStep, setCurrentStep] = useState(0);
    const { toast } = useToast();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            planTitle: "",
            startYear: new Date().getFullYear(),
            endYear: new Date().getFullYear() + 4,
            version: "1.0",
            pillarCode: "",
            pillarTitle: "",
            pillarDescription: "",
            objectiveCode: "",
            objectiveStatement: "",
            initiativeCode: "",
            initiativeTitle: "",
            initiativeDescription: "",
            activities: [{ code: 'ACT-001', title: '', deliverable: '', uom: '', weight: 100, target: 100, baseline: 0, deadline: '', responsible: '' }]
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "activities"
    });

    const triggerValidation = async (fields: (keyof FormValues)[]) => {
        return await form.trigger(fields);
    };

    const handleNext = async () => {
        let isValid = false;
        switch (currentStep) {
            case 0:
                isValid = await triggerValidation(["planTitle", "startYear", "endYear", "version"]);
                break;
            case 1:
                isValid = await triggerValidation(["pillarCode", "pillarTitle"]);
                break;
            case 2:
                isValid = await triggerValidation(["objectiveCode", "objectiveStatement"]);
                break;
            case 3:
                isValid = await triggerValidation(["initiativeCode", "initiativeTitle"]);
                break;
            case 4:
                isValid = await triggerValidation(["activities"]);
                 const totalWeight = form.getValues('activities').reduce((sum, a) => sum + a.weight, 0);
                 if (totalWeight !== 100) {
                     form.setError("activities", { type: "manual", message: "Total weight of all activities must be exactly 100%." });
                     isValid = false;
                 }
                break;
            default:
                isValid = true;
        }

        if (isValid) {
            setCurrentStep(s => s + 1);
        }
    };
    
    const handleBack = () => {
        setCurrentStep(s => s - 1);
    };

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
    
    const handleClearForm = () => {
        form.reset();
        setCurrentStep(0);
         toast({
            title: "Form Cleared",
            description: "All fields have been reset.",
            variant: "destructive"
        });
    }

    const stepperState = steps.map((step, index) => ({
        ...step,
        isCompleted: index < currentStep,
        isCurrent: index === currentStep,
    }));

  return (
    <div className="flex-1 space-y-6">
       <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/strategic-plan">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Strategic Plan</h1>
            <p className="text-muted-foreground">
                Follow the steps to create a new strategic plan for your organization.
            </p>
        </div>
      </div>
      <Card>
        <CardHeader>
            <Stepper steps={stepperState} onStepClick={setCurrentStep} />
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
                <div className={currentStep === 0 ? 'block' : 'hidden'}>
                    <CardTitle className="mb-1">Step 1: Plan Information</CardTitle>
                    <CardDescription className="mb-4">Provide the basic details for this strategic plan.</CardDescription>
                     <div className="space-y-4">
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
                    </div>
                </div>

                <div className={currentStep === 1 ? 'block' : 'hidden'}>
                     <CardTitle className="mb-1">Step 2: Define Pillar</CardTitle>
                    <CardDescription className="mb-4">A Pillar is a high-level strategic focus area.</CardDescription>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="pillarCode">Pillar Code</Label>
                            <Input id="pillarCode" {...form.register("pillarCode")} />
                             {form.formState.errors.pillarCode && <p className="text-sm text-destructive">{form.formState.errors.pillarCode.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pillarTitle">Pillar Title</Label>
                            <Input id="pillarTitle" {...form.register("pillarTitle")} />
                            {form.formState.errors.pillarTitle && <p className="text-sm text-destructive">{form.formState.errors.pillarTitle.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="pillarDescription">Pillar Description</Label>
                            <Textarea id="pillarDescription" {...form.register("pillarDescription")} />
                        </div>
                    </div>
                </div>

                <div className={currentStep === 2 ? 'block' : 'hidden'}>
                     <CardTitle className="mb-1">Step 3: Define Objective</CardTitle>
                    <CardDescription className="mb-4">An Objective is a specific, measurable goal that supports a Pillar.</CardDescription>
                     <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="objectiveCode">Objective Code</Label>
                            <Input id="objectiveCode" {...form.register("objectiveCode")} />
                             {form.formState.errors.objectiveCode && <p className="text-sm text-destructive">{form.formState.errors.objectiveCode.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="objectiveStatement">Objective Statement</Label>
                            <Textarea id="objectiveStatement" {...form.register("objectiveStatement")} />
                             {form.formState.errors.objectiveStatement && <p className="text-sm text-destructive">{form.formState.errors.objectiveStatement.message}</p>}
                        </div>
                    </div>
                </div>

                <div className={currentStep === 3 ? 'block' : 'hidden'}>
                     <CardTitle className="mb-1">Step 4: Define Initiative</CardTitle>
                    <CardDescription className="mb-4">An Initiative is a project or program designed to achieve an Objective.</CardDescription>
                     <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="initiativeCode">Initiative Code</Label>
                            <Input id="initiativeCode" {...form.register("initiativeCode")} />
                             {form.formState.errors.initiativeCode && <p className="text-sm text-destructive">{form.formState.errors.initiativeCode.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="initiativeTitle">Initiative Title</Label>
                            <Input id="initiativeTitle" {...form.register("initiativeTitle")} />
                            {form.formState.errors.initiativeTitle && <p className="text-sm text-destructive">{form.formState.errors.initiativeTitle.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="initiativeDescription">Initiative Description</Label>
                            <Textarea id="initiativeDescription" {...form.register("initiativeDescription")} />
                        </div>
                    </div>
                </div>

                <div className={currentStep === 4 ? 'block' : 'hidden'}>
                     <CardTitle className="mb-1">Step 5: Define Activities</CardTitle>
                    <CardDescription className="mb-4 flex items-center">
                        Activities are the specific tasks required to complete an Initiative. Weights must add up to 100%.
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 ml-2 cursor-pointer"/>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Each activity's weight represents its contribution to the initiative. The sum of all activity weights for one initiative must be exactly 100%.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </CardDescription>
                    <div className="w-full overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Title/Description</TableHead>
                                    <TableHead>Deliverable</TableHead>
                                    <TableHead>UoM</TableHead>
                                    <TableHead>Weight (%)</TableHead>
                                    <TableHead>Target</TableHead>
                                    <TableHead>Baseline</TableHead>
                                    <TableHead>Deadline</TableHead>
                                    <TableHead>Responsible</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell><Input {...form.register(`activities.${index}.code`)} className="min-w-[80px]"/></TableCell>
                                        <TableCell><Input {...form.register(`activities.${index}.title`)} className="min-w-[150px]"/></TableCell>
                                        <TableCell><Input {...form.register(`activities.${index}.deliverable`)} className="min-w-[150px]"/></TableCell>
                                        <TableCell><Input {...form.register(`activities.${index}.uom`)} className="min-w-[80px]"/></TableCell>
                                        <TableCell><Input type="number" {...form.register(`activities.${index}.weight`)} className="min-w-[80px]"/></TableCell>
                                        <TableCell><Input type="number" {...form.register(`activities.${index}.target`)} className="min-w-[80px]"/></TableCell>
                                        <TableCell><Input type="number" {...form.register(`activities.${index}.baseline`)} className="min-w-[80px]"/></TableCell>
                                        <TableCell><Input type="date" {...form.register(`activities.${index}.deadline`)} className="min-w-[150px]"/></TableCell>
                                        <TableCell>
                                            <Controller
                                                control={form.control}
                                                name={`activities.${index}.responsible`}
                                                render={({ field }) => (
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <SelectTrigger className="min-w-[150px]">
                                                            <SelectValue placeholder="Select..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {users.map(user => <SelectItem key={user} value={user}>{user}</SelectItem>)}
                                                            {departments.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => remove(index)}>
                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => append({ code: `ACT-00${fields.length+1}`, title: '', deliverable: '', uom: '', weight: 0, target: 100, baseline: 0, deadline: '', responsible: '' })}>Add Activity</Button>
                     {form.formState.errors.activities?.message && <p className="text-sm text-destructive mt-2">{form.formState.errors.activities.message}</p>}
                     {form.formState.errors.activities?.root?.message && <p className="text-sm text-destructive mt-2">{form.formState.errors.activities.root.message}</p>}
                </div>
                
                <div className={currentStep === 5 ? 'block' : 'hidden'}>
                     <CardTitle className="mb-1">Step 6: Review & Save</CardTitle>
                     <CardDescription className="mb-4">Review the full strategic plan hierarchy before saving or publishing.</CardDescription>
                     <div className="space-y-4 rounded-md border p-4">
                        {/* Plan */}
                        <div>
                            <h3 className="font-bold text-lg">{form.watch('planTitle')} ({form.watch('startYear')}-{form.watch('endYear')}) - v{form.watch('version')}</h3>
                            {/* Pillar */}
                            <div className="ml-4 mt-2 space-y-2 border-l pl-4">
                                <div>
                                    <h4 className="font-semibold">{form.watch('pillarTitle')}</h4>
                                    <p className="text-sm text-muted-foreground">{form.watch('pillarDescription')}</p>
                                    {/* Objective */}
                                    <div className="ml-4 mt-2 space-y-2 border-l pl-4">
                                        <div>
                                            <h5 className="font-medium">{form.watch('objectiveStatement')}</h5>
                                            {/* Initiative */}
                                            <div className="ml-4 mt-2 space-y-2 border-l pl-4">
                                                <div>
                                                    <h6 className="font-medium italic">{form.watch('initiativeTitle')}</h6>
                                                     <p className="text-sm text-muted-foreground">{form.watch('initiativeDescription')}</p>
                                                    {/* Activities */}
                                                    <ul className="ml-4 mt-2 list-disc pl-4 space-y-1">
                                                        {form.watch('activities').map((act, i) => (
                                                            <li key={i} className="text-sm">{act.title} (Weight: {act.weight}%, Responsible: {act.responsible})</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                     </div>
                </div>

            </CardContent>
            <CardFooter className="justify-end gap-2 pt-6">
                {currentStep > 0 && <Button type="button" variant="outline" onClick={handleBack}>Back</Button>}
                {currentStep < steps.length - 1 && <Button type="button" onClick={handleNext}>Next</Button>}
                {currentStep === steps.length - 1 && (
                    <>
                        <Button type="button" variant="outline" onClick={handleClearForm}>Clear Form</Button>
                        <Button type="button" variant="secondary" onClick={handleSaveDraft}>Save Draft</Button>
                        <Button type="submit">Publish Plan</Button>
                    </>
                )}
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}
