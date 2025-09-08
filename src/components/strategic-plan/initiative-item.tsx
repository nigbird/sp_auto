
"use client";

import { useState } from "react";
import type { Initiative } from "@/lib/types";
import { ChevronDown, ChevronRight, Edit, MoreVertical, Trash2 } from "lucide-react";
import { getInitiativeProgress } from "@/lib/utils";
import { ActivityItem } from "./activity-item";
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


export function InitiativeItem({ initiative, initiativeIndex, onEdit, onDelete, pillarIndex, objectiveIndex }: { initiative: Initiative; initiativeIndex: number; onEdit: Function; onDelete: Function; pillarIndex: number; objectiveIndex: number;}) {
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
                        onEdit={() => onEdit([pillarIndex, objectiveIndex, initiativeIndex], "Initiative", initiative.title, initiative.weight)}
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
