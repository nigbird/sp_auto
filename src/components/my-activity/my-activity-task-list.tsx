
"use client"

import * as React from "react"
import type { Activity, ActivityStatus } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, ChevronDown, ChevronUp, Hourglass, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Slider } from "../ui/slider";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { calculateActivityStatus } from "@/lib/utils";
import { Progress } from "../ui/progress";

type TaskCardProps = { 
  activity: Activity;
  onUpdateActivity: (activityId: string, newProgress: number, newStatus: ActivityStatus, updateComment: string) => void;
};

function TaskCard({ activity, onUpdateActivity }: TaskCardProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [progress, setProgress] = React.useState(activity.progress);
  const [status, setStatus] = React.useState(activity.status);
  const [updateComment, setUpdateComment] = React.useState("");

  React.useEffect(() => {
    // This needs to be a valid date object. If it's a string, convert it.
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
        // Maybe show a toast notification here
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

  const deadline = activity.endDate ? (typeof activity.endDate === 'string' ? new Date(activity.endDate) : activity.endDate) : new Date();

  return (
    <Card className="bg-card">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
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
                    <Badge variant="outline">Due: {format(deadline, "PP")}</Badge>
                    <Badge variant="outline">Weight: {activity.weight}%</Badge>
                    <Progress value={activity.progress} className="h-2 flex-1" />
                </div>
            </CardContent>
            <CollapsibleContent>
                <CardContent className="space-y-6 pt-6">
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
                                    <SelectItem value="Overdue">Overdue & Not Started</SelectItem>
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
                        <Button onClick={handleSubmit}>Submit Update</Button>
                    </div>

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
    </Card>
  )
}


export function MyActivityTaskList({ title, count, activities, onUpdateActivity }: { title: string, count: number, activities: Activity[], onUpdateActivity: (activityId: string, newProgress: number, newStatus: ActivityStatus, updateComment: string) => void }) {
  
  const titleIcon = {
    Overdue: <AlertTriangle className="text-destructive" />,
    Pending: <Hourglass className="text-muted-foreground" />,
    Active: <Clock className="text-muted-foreground" />,
    Completed: <CheckCircle className="text-green-500" />,
  }[title] || <AlertTriangle className="text-destructive" />;

  if (activities.length === 0) {
    return (
        <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-xl font-bold">
                {titleIcon}
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
        {titleIcon}
        {title} ({count})
      </h2>
      <div className="space-y-4">
        {activities.map(activity => (
          <TaskCard key={activity.id} activity={activity} onUpdateActivity={onUpdateActivity} />
        ))}
      </div>
    </div>
  )
}
