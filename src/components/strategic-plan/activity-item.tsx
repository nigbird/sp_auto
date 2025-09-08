
"use client";

import type { Activity } from "@/lib/types";
import { Edit, MoreVertical, Trash2 } from "lucide-react";
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

export function ActivityItem({ activity, activityIndex, onEdit, onDelete, pillarIndex, objectiveIndex, initiativeIndex }: { activity: Activity; activityIndex: number; onEdit: Function; onDelete: Function; pillarIndex: number; objectiveIndex: number; initiativeIndex: number;}) {
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
