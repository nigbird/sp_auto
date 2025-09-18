
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Activity } from "@/lib/types";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type ActivityDetailsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  activity: Activity | null;
  onAccept: (activityId: string) => void;
  onDecline: (activityId: string) => void;
};

const ApprovalStatusBadge = ({ status }: { status: Activity['approvalStatus'] }) => {
    if (!status) return null;
    const variant = status === 'Approved' ? 'default' : status === 'Declined' ? 'destructive' : 'secondary';
    const className = status === 'Approved' ? 'bg-green-500/20 text-green-700 border-green-400' : status === 'Declined' ? 'bg-red-500/20 text-red-700 border-red-400' : '';
    return <Badge variant={variant} className={className}>{status}</Badge>
}

export function ActivityDetailsDialog({
  isOpen,
  onOpenChange,
  activity,
  onAccept,
  onDecline
}: ActivityDetailsDialogProps) {
  if (!activity) {
    return null;
  }

  const handleAccept = () => {
    onAccept(activity.id);
  }
  const handleDecline = () => {
    onDecline(activity.id);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{activity.title}</DialogTitle>
            <ApprovalStatusBadge status={activity.approvalStatus} />
          </div>
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
          {activity.approvalStatus === 'Declined' && activity.declineReason && (
            <div className="space-y-2">
              <Label>Reason for Decline</Label>
              <div className="p-3 rounded-md border bg-muted text-sm text-destructive">
                {activity.declineReason}
              </div>
            </div>
          )}
        </div>

        {activity.pendingUpdate && activity.approvalStatus === 'Pending' && (
            <DialogFooter className="border-t pt-4">
                <Button onClick={handleDecline} variant="destructive">Decline</Button>
                <Button onClick={handleAccept} className="bg-green-600 hover:bg-green-700">Accept</Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
