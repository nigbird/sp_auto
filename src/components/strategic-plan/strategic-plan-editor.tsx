
"use client";

import { useState, useCallback, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddPlanWizard } from "./add-plan-wizard";

// Dummy state management. In a real app, this would use Zustand, Redux, or React Context.
let state: Pillar[] = [];

type ItemType = "Pillar" | "Objective" | "Initiative" | "Activity";
type EditableItem = {
    path: number[];
    type: ItemType;
    currentTitle: string;
    currentWeight?: number;
};


export function StrategicPlanEditor({ initialData }: { initialData: Pillar[] }) {
  const [data, setData] = useState(initialData);
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [itemToEdit, setItemToEdit] = useState<EditableItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editWeight, setEditWeight] = useState("");
  
  const [itemToDelete, setItemToDelete] = useState<{ path: number[], type: ItemType} | null>(null);


  useEffect(() => {
    state = data;
  }, [data]);

  const forceUpdate = useCallback(() => setData([...state]), []);
  
  useEffect(() => {
    const handleExport = () => {
      const jsonData = JSON.stringify(state, null, 2);
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "strategic-plan.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const handleImport = (event: Event) => {
        const customEvent = event as CustomEvent;
        const importedData = customEvent.detail;
        // Basic validation for imported data
        if (Array.isArray(importedData)) {
            setData(importedData);
        } else {
            alert("Invalid file format. Please import a valid strategic plan JSON file.");
        }
    };

    window.addEventListener('export-strategic-plan', handleExport);
    window.addEventListener('import-strategic-plan', handleImport);

    return () => {
      window.removeEventListener('export-strategic-plan', handleExport);
      window.removeEventListener('import-strategic-plan', handleImport);
    };
  }, []);

  const handleAddPlan = (newPillar: Pillar) => {
    state.push(newPillar);
    forceUpdate();
    setIsAddPlanOpen(false);
  };


  const openEditDialog = (path: number[], type: ItemType, currentTitle: string, currentWeight?: number) => {
    setItemToEdit({ path, type, currentTitle, currentWeight });
    setEditTitle(currentTitle);
    setEditWeight(currentWeight !== undefined ? String(currentWeight) : "");
    setIsEditDialogOpen(true);
  };

  const handleEditItem = () => {
    if (!itemToEdit) return;

    const { path, type } = itemToEdit;
    let item: any;

    if (type === 'Pillar') {
        item = state[path[0]];
    } else if (type === 'Objective') {
        item = state[path[0]].objectives[path[1]];
    } else if (type === 'Initiative') {
        item = state[path[0]].objectives[path[1]].initiatives[path[2]];
    } else if (type === 'Activity') {
        item = state[path[0]].objectives[path[1]].initiatives[path[2]].activities[path[3]];
    }
    
    if(item) {
        item.title = editTitle;
        if (type === 'Activity') { // Only activities have editable weights now
            const newWeight = parseInt(editWeight, 10);
            if (!isNaN(newWeight)) {
                item.weight = newWeight;
            }
        }
    }
    
    forceUpdate();
    setIsEditDialogOpen(false);
    setItemToEdit(null);
  }

  const openDeleteDialog = (path: number[], type: ItemType) => {
    setItemToDelete({ path, type });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteItem = () => {
    if (!itemToDelete) return;
    const { path, type } = itemToDelete;

    if (type === 'Pillar') {
        state.splice(path[0], 1);
    } else if (type === 'Objective') {
        state[path[0]].objectives.splice(path[1], 1);
    } else if (type === 'Initiative') {
        state[path[0]].objectives[path[1]].initiatives.splice(path[2], 1);
    } else if (type === 'Activity') {
        state[path[0]].objectives[path[1]].initiatives[path[2]].activities.splice(path[3], 1);
    }
    
    forceUpdate();
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };


  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Plan Hierarchy</CardTitle>
        <Dialog open={isAddPlanOpen} onOpenChange={setIsAddPlanOpen}>
            <Button size="sm" onClick={() => setIsAddPlanOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Plan
            </Button>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Add New Strategic Plan</DialogTitle>
            </DialogHeader>
            <AddPlanWizard onSave={handleAddPlan} onCancel={() => setIsAddPlanOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((pillar, pillarIndex) => (
          <PillarItem 
            key={pillar.id} 
            pillar={pillar} 
            pillarIndex={pillarIndex} 
            onEdit={openEditDialog}
            onDelete={openDeleteDialog}
          />
        ))}
         {data.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
                <p>No strategic plan items yet.</p>
                <p>Click "Add Plan" to get started.</p>
            </div>
        )}
      </CardContent>
    </Card>

    {/* Edit Dialog */}
    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit {itemToEdit?.type}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-title">Title</Label>
                    <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                {(itemToEdit?.type === 'Activity') && (
                    <div className="space-y-2">
                        <Label htmlFor="edit-weight">Weight (%)</Label>
                        <Input id="edit-weight" type="number" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} />
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleEditItem}>Save Changes</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
     <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the {itemToDelete?.type} and all its nested items.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteItem}>Continue</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function ActionMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void; }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function PillarItem({ pillar, pillarIndex, onEdit, onDelete }: { pillar: Pillar; pillarIndex: number; onEdit: Function; onDelete: Function; }) {
  const [isOpen, setIsOpen] = useState(true);
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
           <ActionMenu 
                onEdit={() => onEdit([pillarIndex], "Pillar", pillar.title)}
                onDelete={() => onDelete([pillarIndex], "Pillar")}
            />
        </div>
      </div>
      {isOpen && (
        <div className="ml-8 space-y-2 border-l pl-4">
          {pillar.objectives.map((objective, objectiveIndex) => (
            <ObjectiveItem key={objective.id} objective={objective} objectiveIndex={objectiveIndex} onEdit={onEdit} onDelete={onDelete} pillarIndex={pillarIndex} />
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectiveItem({ objective, objectiveIndex, onEdit, onDelete, pillarIndex }: { objective: Objective; objectiveIndex: number; onEdit: Function; onDelete: Function; pillarIndex: number; }) {
    const [isOpen, setIsOpen] = useState(true);
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
                    <ActionMenu 
                        onEdit={() => onEdit([pillarIndex, objectiveIndex], "Objective", objective.title)}
                        onDelete={() => onDelete([pillarIndex, objectiveIndex], "Objective")}
                    />
                </div>
            </div>
            {isOpen && (
                 <div className="ml-8 space-y-2 border-l pl-4">
                    {objective.initiatives.map((initiative, initiativeIndex) => (
                        <InitiativeItem key={initiative.id} initiative={initiative} initiativeIndex={initiativeIndex} onEdit={onEdit} onDelete={onDelete} pillarIndex={pillarIndex} objectiveIndex={objectiveIndex}/>
                    ))}
                </div>
            )}
        </div>
    );
}

function InitiativeItem({ initiative, initiativeIndex, onEdit, onDelete, pillarIndex, objectiveIndex }: { initiative: Initiative; initiativeIndex: number; onEdit: Function; onDelete: Function; pillarIndex: number; objectiveIndex: number;}) {
    const [isOpen, setIsOpen] = useState(true);
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
                   <ActionMenu 
                        onEdit={() => onEdit([pillarIndex, objectiveIndex, initiativeIndex], "Initiative", initiative.title)}
                        onDelete={() => onDelete([pillarIndex, objectiveIndex, initiativeIndex], "Initiative")}
                    />
                </div>
            </div>
             {isOpen && (
                <div className="ml-8 space-y-2 border-l pl-4">
                    {initiative.activities.map((activity, activityIndex) => (
                        <ActivityItem key={activity.id} activity={activity} activityIndex={activityIndex} onEdit={onEdit} onDelete={onDelete} pillarIndex={pillarIndex} objectiveIndex={objectiveIndex} initiativeIndex={initiativeIndex}/>
                    ))}
                </div>
            )}
        </div>
    );
}

function ActivityItem({ activity, activityIndex, onEdit, onDelete, pillarIndex, objectiveIndex, initiativeIndex }: { activity: Activity; activityIndex: number; onEdit: Function; onDelete: Function; pillarIndex: number; objectiveIndex: number; initiativeIndex: number;}) {
    return (
        <div className="flex items-center justify-between rounded-md bg-muted/40 p-2">
            <p className="text-sm">{activity.title}</p>
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">(Wt: {activity.weight}%, Prog: {activity.progress}%)</span>
                <ActionMenu 
                    onEdit={() => onEdit([pillarIndex, objectiveIndex, initiativeIndex, activityIndex], "Activity", activity.title, activity.weight)}
                    onDelete={() => onDelete([pillarIndex, objectiveIndex, initiativeIndex, activityIndex], "Activity")}
                />
            </div>
        </div>
    );
}
