
"use client"

import { useState } from "react";
import type { Pillar, Objective, Initiative, Activity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card";
import { Trash2, PlusCircle } from "lucide-react";

type WizardProps = {
    onSave: (pillar: Pillar) => void;
    onCancel: () => void;
};

type Step = "pillar" | "objective" | "initiative" | "activities";

export function AddPlanWizard({ onSave, onCancel }: WizardProps) {
    const [step, setStep] = useState<Step>("pillar");
    const [pillar, setPillar] = useState<Pillar>({ id: "", title: "", objectives: [] });

    const [currentObjective, setCurrentObjective] = useState<Objective>({ id: "", title: "", weight: 0, initiatives: [] });
    const [currentInitiative, setCurrentInitiative] = useState<Initiative>({ id: "", title: "", weight: 0, activities: [] });
    const [currentActivities, setCurrentActivities] = useState<Partial<Activity>[]>([{ title: "", weight: 10 }]);

    const handleNext = () => {
        switch (step) {
            case "pillar":
                if (pillar.title.trim() === "") return;
                setPillar({ ...pillar, id: `P-${Date.now()}` });
                setStep("objective");
                break;
            case "objective":
                if (currentObjective.title.trim() === "") return;
                setCurrentObjective({ ...currentObjective, id: `O-${Date.now()}` });
                setStep("initiative");
                break;
            case "initiative":
                 if (currentInitiative.title.trim() === "") return;
                setCurrentInitiative({ ...currentInitiative, id: `I-${Date.now()}` });
                setStep("activities");
                break;
            case "activities":
                const finalInitiative: Initiative = {
                    ...currentInitiative,
                    activities: currentActivities
                        .filter(a => a.title && a.title.trim() !== "")
                        .map((a, index) => ({
                            id: `A-${Date.now()}-${index}`,
                            title: a.title!,
                            weight: a.weight || 0,
                            progress: 0,
                            description: "",
                            department: "N/A",
                            responsible: "N/A",
                            startDate: new Date(),
                            endDate: new Date(),
                            status: "Not Started",
                            kpis: [],
                            updates: [],
                            lastUpdated: { user: "Admin", date: new Date() }
                        }))
                };
                const finalObjective: Objective = { ...currentObjective, initiatives: [finalInitiative] };
                const finalPillar: Pillar = { ...pillar, objectives: [...pillar.objectives, finalObjective] };
                onSave(finalPillar);
                break;
        }
    };
    
    const handleAddAnotherObjective = () => {
        // Save current objective and reset for a new one
        const finalInitiative: Initiative = {
            ...currentInitiative,
            activities: currentActivities
                .filter(a => a.title && a.title.trim() !== "")
                .map((a, index) => ({
                    id: `A-${Date.now()}-${index}`,
                    title: a.title!,
                    weight: a.weight || 0,
                    progress: 0,
                    description: "",
                    department: "N/A",
                    responsible: "N/A",
                    startDate: new Date(),
                    endDate: new Date(),
                    status: "Not Started",
                    kpis: [],
                    updates: [],
                    lastUpdated: { user: "Admin", date: new Date() }
                }))
        };
        const finalObjective: Objective = { ...currentObjective, initiatives: [finalInitiative] };
        setPillar({ ...pillar, objectives: [...pillar.objectives, finalObjective] });
        
        // Reset for next objective
        setCurrentObjective({ id: "", title: "", weight: 0, initiatives: [] });
        setCurrentInitiative({ id: "", title: "", weight: 0, activities: [] });
        setCurrentActivities([{ title: "", weight: 10 }]);
        setStep("objective");
    }

    const renderStep = () => {
        switch (step) {
            case "pillar":
                return (
                    <div className="space-y-4">
                        <Label htmlFor="pillar-name" className="text-lg font-medium">Pillar Name</Label>
                        <Input id="pillar-name" placeholder="E.g., Market Leadership" value={pillar.title} onChange={(e) => setPillar({ ...pillar, title: e.target.value })} />
                    </div>
                );
            case "objective":
                 return (
                    <div className="space-y-4">
                        <Label htmlFor="objective-name" className="text-lg font-medium">Objective Name for "{pillar.title}"</Label>
                        <Input id="objective-name" placeholder="E.g., Increase Market Share" value={currentObjective.title} onChange={(e) => setCurrentObjective({ ...currentObjective, title: e.target.value })} />
                    </div>
                );
            case "initiative":
                return (
                    <div className="space-y-4">
                        <Label htmlFor="initiative-name" className="text-lg font-medium">Initiative Name for "{currentObjective.title}"</Label>
                        <Input id="initiative-name" placeholder="E.g., Aggressive Marketing & Sales" value={currentInitiative.title} onChange={(e) => setCurrentInitiative({ ...currentInitiative, title: e.target.value })} />
                    </div>
                );
            case "activities":
                return (
                    <div className="space-y-4">
                        <Label className="text-lg font-medium">Activities for "{currentInitiative.title}"</Label>
                        <Card>
                            <CardContent className="p-4 space-y-4">
                                {currentActivities.map((activity, index) => (
                                    <div key={index} className="flex items-center gap-4">
                                        <Input 
                                            placeholder={`Activity ${index + 1} Name`} 
                                            value={activity.title} 
                                            onChange={(e) => {
                                                const newActivities = [...currentActivities];
                                                newActivities[index].title = e.target.value;
                                                setCurrentActivities(newActivities);
                                            }}
                                            className="flex-grow"
                                        />
                                        <Input 
                                            type="number" 
                                            placeholder="Weight" 
                                            value={activity.weight}
                                            onChange={(e) => {
                                                const newActivities = [...currentActivities];
                                                newActivities[index].weight = parseInt(e.target.value, 10);
                                                setCurrentActivities(newActivities);
                                            }}
                                            className="w-24"
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => {
                                            const newActivities = currentActivities.filter((_, i) => i !== index);
                                            setCurrentActivities(newActivities);
                                        }}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={() => setCurrentActivities([...currentActivities, { title: "", weight: 10 }])}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                );
        }
    };
    
    const isNextDisabled = () => {
        switch (step) {
            case "pillar": return pillar.title.trim() === "";
            case "objective": return currentObjective.title.trim() === "";
            case "initiative": return currentInitiative.title.trim() === "";
            case "activities": return currentActivities.every(a => a.title?.trim() === "");
            default: return true;
        }
    }

    return (
        <div className="flex flex-col h-[60vh]">
            <div className="flex-grow p-4 overflow-y-auto">
                {renderStep()}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
                <Button variant="outline" onClick={onCancel}>Cancel</Button>
                 {step === "activities" && <Button variant="secondary" onClick={handleAddAnotherObjective}>Save & Add Another Objective</Button>}
                <Button onClick={handleNext} disabled={isNextDisabled()}>
                    {step === "activities" ? "Save Plan" : "Save & Continue"}
                </Button>
            </div>
        </div>
    );
}
