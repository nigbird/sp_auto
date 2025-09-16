
"use client";

import { useState, useCallback, useEffect } from "react";
import type { Pillar, StrategicPlan } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit, Trash2, ChevronDown, ChevronRight, MoreVertical } from "lucide-react";
import { getPillarProgress } from "@/lib/utils";
import { getReportData } from "@/lib/data"; // To get initial data
import { getSavedPlan, deletePlan } from "@/lib/plan-service";
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
import Link from "next/link";
import { ObjectiveItem } from "@/components/strategic-plan/objective-item";
import { useToast } from "@/hooks/use-toast";


type ItemType = "Pillar" | "Objective" | "Initiative" | "Activity";
type EditableItem = {
    path: number[];
    type: ItemType;
    currentTitle: string;
    currentWeight?: number;
};


export default function StrategicPlanPage() {
  const [plan, setPlan] = useState<StrategicPlan | null>(null);
  const [data, setData] = useState<Pillar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletePlanDialogOpen, setIsDeletePlanDialogOpen] = useState(false);
  const { toast } = useToast();

  const [itemToEdit, setItemToEdit] = useState<EditableItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editWeight, setEditWeight] = useState("");
  
  const [itemToDelete, setItemToDelete] = useState<{ path: number[], type: ItemType} | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const savedPlan = getSavedPlan();
    if (savedPlan) {
        setPlan(savedPlan);
        setData(savedPlan.pillars);
    } else {
        setPlan(null);
        setData([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const forceUpdate = useCallback((newData: Pillar[]) => {
    setData([...newData]);
    if (plan) {
        const updatedPlan = { ...plan, pillars: newData };
        setPlan(updatedPlan);
    }
  }, [plan]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'strategic_plan') {
            loadData();
        }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
}, [loadData]);
  
  useEffect(() => {
    const handleExport = () => {
      const jsonData = JSON.stringify(data, null, 2);
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

  const openEditDialog = (path: number[], type: ItemType, currentTitle: string, currentWeight?: number) => {
    setItemToEdit({ path, type, currentTitle, currentWeight });
    setEditTitle(currentTitle);
    setEditWeight(currentWeight !== undefined ? String(currentWeight) : "");
    setIsEditDialogOpen(true);
  };

  const handleEditItem = () => {
    if (!itemToEdit) return;

    const { path, type } = itemToEdit;
    const newData = [...data];
    let item: any;

    if (type === 'Pillar') {
        item = newData[path[0]];
    } else if (type === 'Objective') {
        item = newData[path[0]].objectives[path[1]];
    } else if (type === 'Initiative') {
        item = newData[path[0]].objectives[path[1]].initiatives[path[2]];
    } else if (type === 'Activity') {
        item = newData[path[0]].objectives[path[1]].initiatives[path[2]].activities[path[3]];
    }
    
    if(item) {
        if(type === 'Pillar' || type === 'Objective') {
            item.title = editTitle;
            item.statement = editTitle;
        } else {
            item.title = editTitle;
        }
        if (type === 'Activity' || type === 'Objective' || type === 'Initiative') {
            const newWeight = parseInt(editWeight, 10);
            if (!isNaN(newWeight)) {
                item.weight = newWeight;
            }
        }
    }
    
    forceUpdate(newData);
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
    const newData = [...data];

    if (type === 'Pillar') {
        newData.splice(path[0], 1);
    } else if (type === 'Objective') {
        newData[path[0]].objectives.splice(path[1], 1);
    } else if (type === 'Initiative') {
        newData[path[0]].objectives[path[1]].initiatives.splice(path[2], 1);
    } else if (type === 'Activity') {
        newData[path[0]].objectives[path[1]].initiatives[path[2]].activities.splice(path[3], 1);
    }
    
    forceUpdate(newData);
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleDeletePlan = () => {
    deletePlan();
    setPlan(null);
    setData([]);
    setIsDeletePlanDialogOpen(false);
    toast({
        title: "Plan Deleted",
        description: "The strategic plan has been successfully deleted.",
    });
  }


  if (isLoading) {
    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Strategic Plan</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Loading Plan...</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Please wait while we load your strategic plan.</p>
                </CardContent>
            </Card>
        </div>
    );
  }


  return (
    <div className="flex flex-col h-full gap-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Strategic Plan</h1>
            <div className="flex gap-2">
                {plan ? (
                    <>
                        <Button variant="outline" asChild>
                            <Link href="/strategic-plan/edit">
                                <Edit className="mr-2 h-4 w-4" /> Edit Plan
                            </Link>
                        </Button>
                        <Button variant="destructive" onClick={() => setIsDeletePlanDialogOpen(true)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Plan
                        </Button>
                    </>
                ) : (
                    <Button asChild>
                        <Link href="/strategic-plan/create">
                            <PlusCircle className="mr-2 h-4 w-4" /> Create New Plan
                        </Link>
                    </Button>
                )}
            </div>
        </div>


    <Card className="flex-1 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>{plan?.planTitle ?? 'No Plan Created'}</CardTitle>
            {plan && <p className="text-sm text-muted-foreground">Version {plan.version} ({plan.startYear}-{plan.endYear}) - <span className="font-semibold capitalize">{plan.status}</span></p>}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-auto">
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
                {!plan && (
                    <Button asChild variant="link" className="p-0 h-auto">
                        <Link href="/strategic-plan/create">Click "Create New Plan" to get started.</Link>
                    </Button>
                )}
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
                    <Label htmlFor="edit-title">{itemToEdit?.type === 'Pillar' ? 'Title' : 'Statement'}</Label>
                    <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                {(itemToEdit?.type !== 'Pillar') && (
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

    {/* Delete Item Confirmation Dialog */}
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
     {/* Delete Plan Confirmation Dialog */}
     <AlertDialog open={isDeletePlanDialogOpen} onOpenChange={setIsDeletePlanDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Entire Plan?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action is permanent and cannot be undone. This will delete the entire strategic plan.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletePlan} className="bg-destructive hover:bg-destructive/90">Delete Plan</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </div>
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

    

