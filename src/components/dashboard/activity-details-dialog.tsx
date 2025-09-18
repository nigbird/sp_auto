
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
import { format, formatDistanceToNow } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";

type ActivityDetailsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  activity: Activity | null;
  onApprove: (activityId: string) => void;
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
  onApprove,
  onDecline
}: ActivityDetailsDialogProps) {
  if (!activity) {
    return null;
  }
  
  const { pendingUpdate, progress: currentProgress } = activity;

  const handleApprove = () => {
    onApprove(activity.id);
  }
  const handleDecline = () => {
    onDecline(activity.id);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
                <DialogTitle>{activity.title}</DialogTitle>
                <DialogDescription>
                    {activity.description}
                </DialogDescription>
            </div>
            <ApprovalStatusBadge status={activity.approvalStatus} />
          </div>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
              <Label>Weight</Label>
              <p className="text-sm font-medium">{activity.weight}%</p>
            </div>
             <div className="space-y-1">
              <Label>Status</Label>
              <div>
                <StatusBadge status={activity.status} />
              </div>
            </div>
          </div>
           <div className="space-y-2">
            <Label>Overall Progress</Label>
            <div className="flex items-center gap-2">
              <Progress value={activity.progress} className="h-2" />
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

          {pendingUpdate && (
            <>
                <Separator />
                <div className="space-y-4">
                     <div className="space-y-1">
                        <h3 className="text-lg font-semibold">Progress Update</h3>
                        <p className="text-sm text-muted-foreground">
                            {pendingUpdate.user} submitted an update {formatDistanceToNow(new Date(pendingUpdate.date), { addSuffix: true })}.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-4">
                        <div className="flex-1 text-center">
                            <p className="text-2xl font-bold">{currentProgress}%</p>
                            <p className="text-xs text-muted-foreground">Current</p>
                        </div>
                        <ArrowRight className="h-6 w-6 text-muted-foreground" />
                        <div className="flex-1 text-center">
                            <p className="text-2xl font-bold text-primary">{pendingUpdate.progress}%</p>
                            <p className="text-xs text-muted-foreground">New</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Comment</Label>
                        <div className="p-3 rounded-md border bg-muted">
                            <p className="text-sm">{pendingUpdate.comment}</p>
                        </div>
                    </div>
                </div>
            </>
          )}

        </div>

        {pendingUpdate && activity.approvalStatus === 'Pending' && (
            <DialogFooter className="border-t pt-4">
                <Button onClick={handleDecline} variant="destructive">Decline</Button>
                <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">Approve</Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
