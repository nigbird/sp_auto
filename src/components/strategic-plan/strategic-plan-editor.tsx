
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

  const handleAddItemByCode = () => {
    const code = prompt("Enter the code for the new item (e.g., P3, O1.2, I1.1.1, A1.1.1.1):");
    if (!code) return;

    const title = prompt(`Enter title for new item:`);
    if (!title) return;
    
    const codeParts = code.trim().toUpperCase().split('.');
    const itemType = codeParts[0][0];
    const indices = codeParts.map(p => parseInt(p.substring(1), 10) - 1);

    try {
        if (itemType === 'P') {
            if (indices.length !== 1 || isNaN(indices[0])) throw new Error("Invalid Pillar code. Format: P<number>");
            const newPillar: Pillar = { id: `P-${Date.now()}`, title, objectives: [] };
            state.splice(indices[0], 0, newPillar);
        } else if (itemType === 'O') {
            if (indices.length !== 2 || indices.some(isNaN)) throw new Error("Invalid Objective code. Format: O<p_idx>.<o_idx>");
            const pillar = state[indices[0]];
            if (!pillar) throw new Error(`Pillar P${indices[0]+1} not found.`);
            const newObjective: Objective = { id: `O-${Date.now()}`, title, weight: 0, initiatives: [] };
            pillar.objectives.splice(indices[1], 0, newObjective);
        } else if (itemType === 'I') {
            if (indices.length !== 3 || indices.some(isNaN)) throw new Error("Invalid Initiative code. Format: I<p_idx>.<o_idx>.<i_idx>");
            const pillar = state[indices[0]];
            if (!pillar) throw new Error(`Pillar P${indices[0]+1} not found.`);
            const objective = pillar.objectives[indices[1]];
            if (!objective) throw new Error(`Objective O${indices[0]+1}.${indices[1]+1} not found.`);
            const newInitiative: Initiative = { id: `I-${Date.now()}`, title, weight: 0, activities: [] };
            objective.initiatives.splice(indices[2], 0, newInitiative);
        } else if (itemType === 'A') {
             if (indices.length !== 4 || indices.some(isNaN)) throw new Error("Invalid Activity code. Format: A<p_idx>.<o_idx>.<i_idx>.<a_idx>");
            const pillar = state[indices[0]];
            if (!pillar) throw new Error(`Pillar P${indices[0]+1} not found.`);
            const objective = pillar.objectives[indices[1]];
            if (!objective) throw new Error(`Objective O${indices[0]+1}.${indices[1]+1} not found.`);
            const initiative = objective.initiatives[indices[2]];
            if (!initiative) throw new Error(`Initiative I${indices[0]+1}.${indices[1]+1}.${indices[2]+1} not found.`);
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
              initiative.activities.splice(indices[3], 0, newActivity);
        } else {
            throw new Error("Invalid item type in code. Must start with P, O, I, or A.");
        }
        forceUpdate();
    } catch(e: any) {
        alert(`Error: ${e.message}`);
    }
  }


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Plan Hierarchy</CardTitle>
        <Button onClick={handleAddItemByCode} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Item by Code
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((pillar, pillarIndex) => (
          <PillarItem key={pillar.id} pillar={pillar} pillarIndex={pillarIndex} />
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

function PillarItem({ pillar, pillarIndex }: { pillar: Pillar; pillarIndex: number }) {
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
          <ActionMenu />
        </div>
      </div>
      {isOpen && (
        <div className="ml-8 space-y-2 border-l pl-4">
          {pillar.objectives.map((objective, objectiveIndex) => (
            <ObjectiveItem key={objective.id} objective={objective} pillarCode={pillarCode} objectiveIndex={objectiveIndex} />
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectiveItem({ objective, pillarCode, objectiveIndex }: { objective: Objective; pillarCode: string; objectiveIndex: number; }) {
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
                    <ActionMenu />
                </div>
            </div>
            {isOpen && (
                 <div className="ml-8 space-y-2 border-l pl-4">
                    {objective.initiatives.map((initiative, initiativeIndex) => (
                        <InitiativeItem key={initiative.id} initiative={initiative} objectiveCode={objectiveCode} initiativeIndex={initiativeIndex} />
                    ))}
                </div>
            )}
        </div>
    );
}

function InitiativeItem({ initiative, objectiveCode, initiativeIndex }: { initiative: Initiative; objectiveCode: string; initiativeIndex: number; }) {
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
