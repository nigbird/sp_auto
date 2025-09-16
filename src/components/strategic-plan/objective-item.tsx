
"use client";

import { useState } from "react";
import type { Objective } from "@/lib/types";
import { ChevronDown, ChevronRight, Edit, MoreVertical, Trash2 } from "lucide-react";
import { getObjectiveProgress } from "@/lib/utils";
import { InitiativeItem } from "./initiative-item";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "../ui/button";

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


export function ObjectiveItem({ objective, objectiveIndex, onEdit, onDelete, pillarIndex }: { objective: Objective; objectiveIndex: number; onEdit: Function; onDelete: Function; pillarIndex: number; }) {
    const [isOpen, setIsOpen] = useState(true);
    const progress = getObjectiveProgress(objective);
    const title = objective.statement || objective.title;
    
    return (
        <div className="space-y-2 rounded-md border bg-background/70 p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none">
                       {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    <h4 className="font-semibold">{title}</h4>
                    <span className="text-sm font-medium text-muted-foreground">(Wt: {objective.weight}%, Prog: {progress}%)</span>
                </div>
                <div className="flex items-center gap-2">
                    <ActionMenu 
                        onEdit={() => onEdit([pillarIndex, objectiveIndex], "Objective", title, objective.weight)}
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

    