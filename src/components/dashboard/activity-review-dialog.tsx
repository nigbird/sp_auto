
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { Activity } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { Separator } from "../ui/separator";
import { ArrowRight } from "lucide-react";

type ActivityReviewDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  activity: Activity | null;
  onApprove: (activityId: string) => void;
  onDecline: (activityId: string) => void;
};

export function ActivityReviewDialog({
  isOpen,
  onOpenChange,
  activity,
  onApprove,
  onDecline,
}: ActivityReviewDialogProps) {
  if (!activity || !activity.pendingUpdate) {
    return null;
  }

  const { title, progress: currentProgress, pendingUpdate } = activity;
  const { user, date, comment, progress: newProgress } = pendingUpdate;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Activity Update</DialogTitle>
          <DialogDescription>
            {user} submitted an update for "{title}".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
            <div className="space-y-2">
                <Label>Update Submitted</Label>
                <p className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(date), { addSuffix: true })} on {format(new Date(date), "PPp")}</p>
            </div>
          <div className="space-y-2">
            <Label>Progress Update</Label>
            <div className="flex items-center gap-4">
                <div className="flex-1 text-center">
                    <p className="text-2xl font-bold">{currentProgress}%</p>
                    <p className="text-xs text-muted-foreground">Current</p>
                </div>
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <div className="flex-1 text-center">
                    <p className="text-2xl font-bold text-primary">{newProgress}%</p>
                    <p className="text-xs text-muted-foreground">New</p>
                </div>
            </div>
             <Progress value={newProgress} />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Comment</Label>
            <div className="p-3 rounded-md border bg-muted">
                <p className="text-sm">{comment}</p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onDecline(activity.id)}>
            Decline
          </Button>
          <Button onClick={() => onApprove(activity.id)}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
