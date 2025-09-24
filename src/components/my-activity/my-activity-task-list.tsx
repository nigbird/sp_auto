

"use client"

import * as React from "react"
import type { Activity, ActivityStatus, ApprovalStatus, User } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, ChevronDown, ChevronUp, Hourglass, Clock, CheckCircle, ShieldQuestion, ShieldX, Edit, Check, List, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Slider } from "../ui/slider";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { calculateActivityStatus } from "@/lib/utils";
import { Progress } from "../ui/progress";
import { Tooltip, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";

const ApprovalBadge = ({ status, reason }: { status: ApprovalStatus; reason?: string | null }) => {
    if (status === 'APPROVED') {
        return <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
    }
    if (status === 'PENDING') {
        return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-500/10"><ShieldQuestion className="h-3 w-3 mr-1" />Pending Approval</Badge>;
    }
    if (status === 'DECLINED') {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge variant="destructive" className="cursor-help"><ShieldX className="h-3 w-3 mr-1" />Declined</Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{reason || 'No reason provided.'}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
    return null;
}

type TaskCardProps = { 
  activity: Activity;
  currentUser: User | null;
  onUpdateActivity: (activityId: string, newProgress: number, newStatus: ActivityStatus, updateComment: string) => void;
  onEditDeclined: (activity: Activity) => void;
  onApprove: (activityId: string) => void;
  onDecline: (activityId: string, reason: string) => void;
};

function TaskCard({ activity, currentUser, onUpdateActivity, onEditDeclined, onApprove, onDecline }: TaskCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [progress, setProgress] = React.useState(activity.progress);
  const [status, setStatus] = React.useState(activity.status);
  const [updateComment, setUpdateComment] = React.useState("");
  const [isDeclineModalOpen, setIsDeclineModalOpen] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");
  
  const isAdmin = currentUser?.role === 'ADMINISTRATOR';
  const showApprovalControls = isAdmin && activity.approvalStatus === 'PENDING';

  React.useEffect(() => {
    const activityWithDateObjects = {
      ...activity,
      startDate: typeof activity.startDate === 'string' ? new Date(activity.startDate) : activity.startDate,
      endDate: typeof activity.endDate === 'string' ? new Date(activity.endDate) : activity.endDate,
    }
    const newStatus = calculateActivityStatus({ ...activityWithDateObjects, progress });
    setStatus(newStatus);
  }, [progress, activity]);

  const handleSubmit = () => {
    if (updateComment.trim() === "") {
        alert("Please provide an update comment.");
        return;
    }
    const activityWithDateObjects = {
      ...activity,
      startDate: typeof activity.startDate === 'string' ? new Date(activity.startDate) : activity.startDate,
      endDate: typeof activity.endDate === 'string' ? new Date(activity.endDate) : activity.endDate,
    }
    const newStatus = calculateActivityStatus({ ...activityWithDateObjects, progress });
    onUpdateActivity(activity.id, progress, newStatus, updateComment);
    setUpdateComment("");
  };
  
  const handleProgressChange = (value: number[]) => {
      const newProgress = value[0];
      if (newProgress >= activity.progress) {
          setProgress(newProgress);
      }
  }

  const handleDeclineClick = () => {
    setIsDeclineModalOpen(true);
  }

  const handleConfirmDecline = () => {
    if(declineReason.trim() === "") {
      alert("Please provide a reason for declining.");
      return;
    }
    onDecline(activity.id, declineReason);
    setIsDeclineModalOpen(false);
    setDeclineReason("");
  }

  const deadline = activity.endDate ? (typeof activity.endDate === 'string' ? new Date(activity.endDate) : activity.endDate) : new Date();

  // An activity is editable by a non-admin if it's approved and not pending an update.
  const isEditableForUser = activity.approvalStatus === 'APPROVED' && !activity.pendingUpdate;

  return (
    <Card className="bg-card">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CardHeader className="flex flex-row items-start justify-between">
                <div className="space-y-1.5">
                    <h3 className="font-semibold">{activity.title}</h3>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
                 <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-lg">{activity.progress}%</p>
                      <p className="text-xs text-muted-foreground">Complete</p>
                    </div>
                     <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                         {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                    </CollapsibleTrigger>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                    <ApprovalBadge status={activity.approvalStatus} reason={activity.declineReason} />
                    <Badge variant="outline">Due: {format(deadline, "PP")}</Badge>
                    <Badge variant="outline">Weight: {activity.weight}%</Badge>
                    <Progress value={activity.progress} className="h-2 flex-1" />
                </div>
            </CardContent>
            <CollapsibleContent>
                <CardContent className="space-y-6 pt-0">
                    {isEditableForUser && !isAdmin && (
                    <>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor={`status-${activity.id}`}>Status</Label>
                                <Select value={status} onValueChange={(value) => setStatus(value as ActivityStatus)} disabled>
                                    <SelectTrigger id={`status-${activity.id}`} className="bg-background">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="On Track">On Track</SelectItem>
                                        <SelectItem value="Completed As Per Target">Completed As Per Target</SelectItem>
                                        <SelectItem value="Delayed">Delayed</SelectItem>
                                        <SelectItem value="Not Started">Not Started</SelectItem>
                                        <SelectItem value="Overdue">Overdue</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                 <Label htmlFor={`progress-${activity.id}`}>Progress: {progress}%</Label>
                                 <Slider
                                    id={`progress-${activity.id}`}
                                    value={[progress]}
                                    onValueChange={handleProgressChange}
                                    max={100}
                                    step={1}
                                />
                            </div>
                        </div>
                         <div className="space-y-2">
                             <Label htmlFor={`update-${activity.id}`}>Provide an update</Label>
                            <Textarea
                                id={`update-${activity.id}`}
                                placeholder="E.g., 'Completed the initial draft of the proposal...'"
                                value={updateComment}
                                onChange={(e) => setUpdateComment(e.target.value)}
                            />
                         </div>
                         <div className="flex justify-end">
                            <Button onClick={handleSubmit}>Submit Update for Review</Button>
                        </div>
                    </>
                    )}

                    {showApprovalControls && (
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <Button variant="destructive" onClick={handleDeclineClick}>Decline</Button>
                            <Button onClick={() => onApprove(activity.id)} className="bg-green-600 hover:bg-green-700">Approve</Button>
                        </div>
                    )}

                    {activity.approvalStatus === 'DECLINED' && (
                         <div className="flex justify-end">
                            <Button onClick={() => onEditDeclined(activity)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit & Resubmit
                            </Button>
                        </div>
                    )}

                    <div className="space-y-4">
                        <h4 className="font-medium">Update History</h4>
                        <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                        {[...(activity.updates || [])].reverse().map((update, index) => (
                            <div key={index} className="flex items-start gap-4">
                                <Avatar className="h-9 w-9">
                                    <AvatarFallback>{update.user.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="w-full">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold">{update.user}</p>
                                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(update.date), { addSuffix: true })}</p>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{update.comment}</p>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                </CardContent>
            </CollapsibleContent>
       </Collapsible>
        <AlertDialog open={isDeclineModalOpen} onOpenChange={setIsDeclineModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Decline</AlertDialogTitle>
                    <AlertDialogDescription>
                        Please provide a reason for declining this update. This will be visible to the user.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    <Textarea 
                        placeholder="Type your reason here..."
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                    />
                </div>
                 <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsDeclineModalOpen(false)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDecline} className="bg-destructive hover:bg-destructive/90">Confirm Decline</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}


export function MyActivityTaskList({ title, count, activities, currentUser, onUpdateActivity, onEditDeclined, onApprove, onDecline }: { title: string; count: number; activities: Activity[]; currentUser: User | null; onUpdateActivity: (activityId: string, newProgress: number, newStatus: ActivityStatus, updateComment: string) => void; onEditDeclined: (activity: Activity) => void; onApprove: (activityId: string) => void; onDecline: (activityId: string, reason: string) => void; }) {
  
  const titleIcon: Record<string, React.ReactNode> = {
    Overdue: <AlertTriangle className="text-destructive" />,
    "Not Started": <Hourglass className="text-muted-foreground" />,
    "On Track": <Clock className="text-muted-foreground" />,
    Completed: <CheckCircle className="text-green-500" />,
    "All Activities": <List className="text-muted-foreground" />,
  };

  if (activities.length === 0) {
    return (
        <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-xl font-bold">
                {titleIcon[title] || <List className="text-muted-foreground" />}
                {title} (0)
            </h2>
            <Card>
                <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No tasks in this category.</p>
                </CardContent>
            </Card>
        </div>
    )
  }
  
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        {titleIcon[title] || <List className="text-muted-foreground" />}
        {title} ({count})
      </h2>
      <div className="space-y-4">
        {activities.map(activity => (
          <TaskCard key={activity.id} activity={activity} currentUser={currentUser} onUpdateActivity={onUpdateActivity} onEditDeclined={onEditDeclined!} onApprove={onApprove} onDecline={onDecline} />
        ))}
      </div>
    </div>
  )
}
