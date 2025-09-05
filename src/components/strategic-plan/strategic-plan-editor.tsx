
"use client";

import * as React from "react";
import type { Pillar, Objective, Initiative, Activity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { getPillarProgress, getObjectiveProgress, getInitiativeProgress } from "@/lib/utils";

// Dummy state management. In a real app, this would use Zustand, Redux, or React Context.
let state: Pillar[] = [];

export function StrategicPlanEditor({ initialData }: { initialData: Pillar[] }) {
  const [data, setData] = React.useState(initialData);
  state = data;

  const forceUpdate = React.useCallback(() => setData([...state]), []);

  const handleAddItem = (type: "pillar" | "objective" | "initiative" | "activity", parentId?: string) => {
    const title = prompt(`Enter title for new ${type}:`);
    if (!title) return;

    if (type === "pillar") {
      const newPillar: Pillar = { id: `P-${Date.now()}`, title, objectives: [] };
      state.push(newPillar);
    } else if (parentId) {
      // simplified logic to find and update parent
      for (const pillar of state) {
        if (type === "objective" && pillar.id === parentId) {
          const newObjective: Objective = { id: `O-${Date.now()}`, title, weight: 0, initiatives: [] };
          pillar.objectives.push(newObjective);
          break;
        }
        for (const objective of pillar.objectives) {
          if (type === "initiative" && objective.id === parentId) {
            const newInitiative: Initiative = { id: `I-${Date.now()}`, title, weight: 0, activities: [] };
            objective.initiatives.push(newInitiative);
            break;
          }
          for (const initiative of objective.initiatives) {
            if (type === "activity" && initiative.id === parentId) {
              const weight = parseInt(prompt("Enter weight for new activity:", "50") || "50", 10);
               const newActivity: Activity = {
                id: `A-${Date.now()}`,
                title,
                weight,
                description: "New Activity",
                department: "N/A",
                responsible: "N/A",
                startDate: new Date(),
                endDate: new Date(),
                status: "Not Started",
                kpis: [],
                lastUpdated: { user: "Admin", date: new Date() },
                updates: [],
                progress: 0,
              };
              initiative.activities.push(newActivity);
              break;
            }
          }
        }
      }
    }
    forceUpdate();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Plan Hierarchy</CardTitle>
        <Button onClick={() => handleAddItem("pillar")} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Pillar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((pillar) => (
          <PillarItem key={pillar.id} pillar={pillar} onAddItem={handleAddItem} />
        ))}
      </CardContent>
    </Card>
  );
}

function PillarItem({ pillar, onAddItem }: { pillar: Pillar; onAddItem: Function }) {
  const [isOpen, setIsOpen] = React.useState(true);
  const progress = getPillarProgress(pillar);

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none">
            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
          <h3 className="text-lg font-semibold">{pillar.title}</h3>
           <span className="text-sm font-bold text-muted-foreground">({progress}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => onAddItem("objective", pillar.id)} size="sm" variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Objective
          </Button>
          <Button size="icon" variant="ghost"><Edit className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {isOpen && (
        <div className="ml-8 space-y-2 border-l pl-4">
          {pillar.objectives.map((objective) => (
            <ObjectiveItem key={objective.id} objective={objective} onAddItem={onAddItem} />
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectiveItem({ objective, onAddItem }: { objective: Objective; onAddItem: Function }) {
    const [isOpen, setIsOpen] = React.useState(true);
    const progress = getObjectiveProgress(objective);

    return (
        <div className="space-y-2 rounded-md border bg-background/70 p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none">
                       {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    <h4 className="font-semibold">{objective.title}</h4>
                    <span className="text-sm font-medium text-muted-foreground">(Wt: {objective.weight}%, Prog: {progress}%)</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => onAddItem("initiative", objective.id)} size="sm" variant="outline">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Initiative
                    </Button>
                    <Button size="icon" variant="ghost"><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
            </div>
            {isOpen && (
                 <div className="ml-8 space-y-2 border-l pl-4">
                    {objective.initiatives.map((initiative) => (
                        <InitiativeItem key={initiative.id} initiative={initiative} onAddItem={onAddItem} />
                    ))}
                </div>
            )}
        </div>
    );
}

function InitiativeItem({ initiative, onAddItem }: { initiative: Initiative; onAddItem: Function }) {
    const [isOpen, setIsOpen] = React.useState(true);
    const progress = getInitiativeProgress(initiative);

    return (
        <div className="space-y-2 rounded-md border bg-background p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                     <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none">
                       {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    <h5 className="font-medium">{initiative.title}</h5>
                    <span className="text-xs text-muted-foreground">(Wt: {initiative.weight}%, Prog: {progress}%)</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => onAddItem("activity", initiative.id)} size="sm" variant="outline">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
                    </Button>
                    <Button size="icon" variant="ghost"><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
            </div>
             {isOpen && (
                <div className="ml-8 space-y-2 border-l pl-4">
                    {initiative.activities.map((activity) => (
                        <ActivityItem key={activity.id} activity={activity} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ActivityItem({ activity }: { activity: Activity; }) {
    return (
        <div className="flex items-center justify-between rounded-md bg-muted/40 p-2">
            <p className="text-sm">{activity.title}</p>
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">(Wt: {activity.weight}%, Prog: {activity.progress}%)</span>
                <Button size="icon" variant="ghost"><Edit className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </div>
        </div>
    );
}
