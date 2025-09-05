
"use client";

import { useState, useCallback, useEffect } from "react";
import type { Pillar, Objective, Initiative, Activity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit, Trash2, ChevronDown, ChevronRight, MoreVertical, AlertCircle } from "lucide-react";
import { getPillarProgress, getObjectiveProgress, getInitiativeProgress } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  DialogTrigger,
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [newItemCode, setNewItemCode] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemWeight, setNewItemWeight] = useState("50");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  }, [data]);

  const resetAddDialog = () => {
    setIsAddDialogOpen(false);
    setNewItemCode("");
    setNewItemTitle("");
    setNewItemWeight("50");
    setErrorMessage(null);
  };

  const codeExists = (codeToFind: string): boolean => {
    const codeParts = codeToFind.trim().toUpperCase().split('.');
    if (codeParts.length === 0 || codeParts[0] === '') return false;
    const itemType = codeParts[0][0];
    const indices = codeParts.map(p => parseInt(p.substring(1), 10) - 1);
    
    if (indices.some(isNaN)) return false;

    if (itemType === 'P') {
      return indices.length === 1 && state.length > indices[0];
    } else if (itemType === 'O') {
      if (indices.length !== 2) return false;
      const pillar = state[indices[0]];
      return !!pillar && pillar.objectives.length > indices[1];
    } else if (itemType === 'I') {
      if (indices.length !== 3) return false;
      const pillar = state[indices[0]];
      const objective = pillar?.objectives[indices[1]];
      return !!objective && objective.initiatives.length > indices[2];
    } else if (itemType === 'A') {
      if (indices.length !== 4) return false;
      const pillar = state[indices[0]];
      const objective = pillar?.objectives[indices[1]];
      const initiative = objective?.initiatives[indices[2]];
      return !!initiative && initiative.activities.length > indices[3];
    }
    return false;
  };

  const handleAddItem = () => {
    const code = newItemCode;
    if (!code) {
        setErrorMessage("Please enter a code.");
        return;
    };

    if (codeExists(code)) {
      setErrorMessage(`The code ${code} is already taken. Please enter a unique code.`);
      return;
    }

    const title = newItemTitle;
    if (!title) {
        setErrorMessage("Please enter a title.");
        return;
    };
    
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
            const weight = parseInt(newItemWeight, 10);
            if (isNaN(weight)) throw new Error("Invalid weight. Please enter a number.");
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
        resetAddDialog();
    } catch(e: any) {
        setErrorMessage(`Error: ${e.message}`);
    }
  }

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
        if (type === 'Activity' || type === 'Objective' || type === 'Initiative') {
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
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
                resetAddDialog();
            }
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item by Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Plan Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {errorMessage && (
                  <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                          {errorMessage}
                      </AlertDescription>
                  </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="item-code">Code</Label>
                <Input id="item-code" placeholder="e.g., P3, O1.2, I1.1.1, A1.1.1.1" value={newItemCode} onChange={(e) => { setNewItemCode(e.target.value); setErrorMessage(null); }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-title">Title</Label>
                <Input id="item-title" placeholder="Enter title for the new item" value={newItemTitle} onChange={(e) => { setNewItemTitle(e.target.value); setErrorMessage(null); }} />
              </div>
              {newItemCode.trim().toUpperCase().startsWith('A') && (
                <div className="space-y-2">
                  <Label htmlFor="item-weight">Weight (%)</Label>
                  <Input id="item-weight" type="number" placeholder="Enter weight" value={newItemWeight} onChange={(e) => setNewItemWeight(e.target.value)} />
                </div>
              )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={resetAddDialog}>Cancel</Button>
                <Button onClick={handleAddItem}>Add Item</Button>
            </DialogFooter>
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
                {(itemToEdit?.type === 'Activity' || itemToEdit?.type === 'Objective' || itemToEdit?.type === 'Initiative') && (
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
           <ActionMenu 
                onEdit={() => onEdit([pillarIndex], "Pillar", pillar.title)}
                onDelete={() => onDelete([pillarIndex], "Pillar")}
            />
        </div>
      </div>
      {isOpen && (
        <div className="ml-8 space-y-2 border-l pl-4">
          {pillar.objectives.map((objective, objectiveIndex) => (
            <ObjectiveItem key={objective.id} objective={objective} pillarCode={pillarCode} objectiveIndex={objectiveIndex} onEdit={onEdit} onDelete={onDelete} pillarIndex={pillarIndex} />
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectiveItem({ objective, pillarCode, objectiveIndex, onEdit, onDelete, pillarIndex }: { objective: Objective; pillarCode: string; objectiveIndex: number; onEdit: Function; onDelete: Function; pillarIndex: number; }) {
    const [isOpen, setIsOpen] = useState(false);
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
                    <ActionMenu 
                        onEdit={() => onEdit([pillarIndex, objectiveIndex], "Objective", objective.title, objective.weight)}
                        onDelete={() => onDelete([pillarIndex, objectiveIndex], "Objective")}
                    />
                </div>
            </div>
            {isOpen && (
                 <div className="ml-8 space-y-2 border-l pl-4">
                    {objective.initiatives.map((initiative, initiativeIndex) => (
                        <InitiativeItem key={initiative.id} initiative={initiative} objectiveCode={objectiveCode} initiativeIndex={initiativeIndex} onEdit={onEdit} onDelete={onDelete} pillarIndex={pillarIndex} objectiveIndex={objectiveIndex}/>
                    ))}
                </div>
            )}
        </div>
    );
}

function InitiativeItem({ initiative, objectiveCode, initiativeIndex, onEdit, onDelete, pillarIndex, objectiveIndex }: { initiative: Initiative; objectiveCode: string; initiativeIndex: number; onEdit: Function; onDelete: Function; pillarIndex: number; objectiveIndex: number;}) {
    const [isOpen, setIsOpen] = useState(false);
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
                   <ActionMenu 
                        onEdit={() => onEdit([pillarIndex, objectiveIndex, initiativeIndex], "Initiative", initiative.title, initiative.weight)}
                        onDelete={() => onDelete([pillarIndex, objectiveIndex, initiativeIndex], "Initiative")}
                    />
                </div>
            </div>
             {isOpen && (
                <div className="ml-8 space-y-2 border-l pl-4">
                    {initiative.activities.map((activity, activityIndex) => (
                        <ActivityItem key={activity.id} activity={activity} initiativeCode={initiativeCode} activityIndex={activityIndex} onEdit={onEdit} onDelete={onDelete} pillarIndex={pillarIndex} objectiveIndex={objectiveIndex} initiativeIndex={initiativeIndex}/>
                    ))}
                </div>
            )}
        </div>
    );
}

function ActivityItem({ activity, initiativeCode, activityIndex, onEdit, onDelete, pillarIndex, objectiveIndex, initiativeIndex }: { activity: Activity; initiativeCode: string; activityIndex: number; onEdit: Function; onDelete: Function; pillarIndex: number; objectiveIndex: number; initiativeIndex: number;}) {
    const activityCode = `${initiativeCode.replace('I', 'A')}.${activityIndex + 1}`;
    return (
        <div className="flex items-center justify-between rounded-md bg-muted/40 p-2">
            <p className="text-sm"><span className="text-muted-foreground">{activityCode}:</span> {activity.title}</p>
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
