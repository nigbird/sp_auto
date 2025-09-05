
"use client";

import * as React from "react";
import type { Pillar, Objective, Initiative, Activity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit, Trash2, ChevronDown, ChevronRight, MoreVertical } from "lucide-react";
import { getPillarProgress, getObjectiveProgress, getInitiativeProgress } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        {data.map((pillar, pillarIndex) => (
          <PillarItem key={pillar.id} pillar={pillar} pillarIndex={pillarIndex} onAddItem={handleAddItem} />
        ))}
      </CardContent>
    </Card>
  );
}

function ActionMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function PillarItem({ pillar, pillarIndex, onAddItem }: { pillar: Pillar; pillarIndex: number, onAddItem: Function }) {
  const [isOpen, setIsOpen] = React.useState(true);
  const progress = getPillarProgress(pillar);
  const pillarCode = `P${pillarIndex + 1}`;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none">
            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
          <h3 className="text-lg font-semibold"><span className="text-muted-foreground">{pillarCode}:</span> {pillar.title}</h3>
           <span className="text-sm font-bold text-muted-foreground">({progress}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => onAddItem("objective", pillar.id)} size="sm" variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Objective
          </Button>
          <ActionMenu />
        </div>
      </div>
      {isOpen && (
        <div className="ml-8 space-y-2 border-l pl-4">
          {pillar.objectives.map((objective, objectiveIndex) => (
            <ObjectiveItem key={objective.id} objective={objective} pillarCode={pillarCode} objectiveIndex={objectiveIndex} onAddItem={onAddItem} />
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectiveItem({ objective, pillarCode, objectiveIndex, onAddItem }: { objective: Objective; pillarCode: string; objectiveIndex: number; onAddItem: Function }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const progress = getObjectiveProgress(objective);
    const objectiveCode = `${pillarCode.replace('P', 'O')}.${objectiveIndex + 1}`;

    return (
        <div className="space-y-2 rounded-md border bg-background/70 p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none">
                       {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    <h4 className="font-semibold"><span className="text-muted-foreground">{objectiveCode}:</span> {objective.title}</h4>
                    <span className="text-sm font-medium text-muted-foreground">(Wt: {objective.weight}%, Prog: {progress}%)</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => onAddItem("initiative", objective.id)} size="sm" variant="outline">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Initiative
                    </Button>
                    <ActionMenu />
                </div>
            </div>
            {isOpen && (
                 <div className="ml-8 space-y-2 border-l pl-4">
                    {objective.initiatives.map((initiative, initiativeIndex) => (
                        <InitiativeItem key={initiative.id} initiative={initiative} objectiveCode={objectiveCode} initiativeIndex={initiativeIndex} onAddItem={onAddItem} />
                    ))}
                </div>
            )}
        </div>
    );
}

function InitiativeItem({ initiative, objectiveCode, initiativeIndex, onAddItem }: { initiative: Initiative; objectiveCode: string; initiativeIndex: number; onAddItem: Function }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const progress = getInitiativeProgress(initiative);
    const initiativeCode = `${objectiveCode.replace('O', 'I')}.${initiativeIndex + 1}`;

    return (
        <div className="space-y-2 rounded-md border bg-background p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                     <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none">
                       {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    <h5 className="font-medium"><span className="text-muted-foreground">{initiativeCode}:</span> {initiative.title}</h5>
                    <span className="text-xs text-muted-foreground">(Wt: {initiative.weight}%, Prog: {progress}%)</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => onAddItem("activity", initiative.id)} size="sm" variant="outline">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Activity
                    </Button>
                   <ActionMenu />
                </div>
            </div>
             {isOpen && (
                <div className="ml-8 space-y-2 border-l pl-4">
                    {initiative.activities.map((activity, activityIndex) => (
                        <ActivityItem key={activity.id} activity={activity} initiativeCode={initiativeCode} activityIndex={activityIndex} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ActivityItem({ activity, initiativeCode, activityIndex }: { activity: Activity; initiativeCode: string; activityIndex: number; }) {
    const activityCode = `${initiativeCode.replace('I', 'A')}.${activityIndex + 1}`;
    return (
        <div className="flex items-center justify-between rounded-md bg-muted/40 p-2">
            <p className="text-sm"><span className="text-muted-foreground">{activityCode}:</span> {activity.title}</p>
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">(Wt: {activity.weight}%, Prog: {activity.progress}%)</span>
                <ActionMenu />
            </div>
        </div>
    );
}
