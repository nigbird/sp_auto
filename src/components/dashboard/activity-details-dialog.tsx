
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Activity } from "@/lib/types";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type ActivityDetailsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  activity: Activity | null;
};

export function ActivityDetailsDialog({
  isOpen,
  onOpenChange,
  activity,
}: ActivityDetailsDialogProps) {
  if (!activity) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{activity.title}</DialogTitle>
          <DialogDescription>
            {activity.description}
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Department</Label>
              <p className="text-sm font-medium">{activity.department}</p>
            </div>
            <div className="space-y-1">
              <Label>Responsible</Label>
              <p className="text-sm font-medium">{activity.responsible}</p>
            </div>
             <div className="space-y-1">
              <Label>Start Date</Label>
              <p className="text-sm font-medium">{format(new Date(activity.startDate), "PP")}</p>
            </div>
             <div className="space-y-1">
              <Label>End Date</Label>
              <p className="text-sm font-medium">{format(new Date(activity.endDate), "PP")}</p>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <div>
                <StatusBadge status={activity.status} />
              </div>
            </div>
             <div className="space-y-1">
              <Label>Weight</Label>
              <p className="text-sm font-medium">{activity.weight}%</p>
            </div>
          </div>
           <div className="space-y-2">
            <Label>Progress</Label>
            <div className="flex items-center gap-2">
              <Progress value={activity.progress} className="h-3" />
              <span className="text-sm font-medium">{activity.progress}%</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
