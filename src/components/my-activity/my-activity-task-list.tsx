
"use client"

import * as React from "react"
import type { Activity } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, ChevronDown, ChevronUp, Hourglass, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";

function TaskCard({ activity }: { activity: Activity }) {
  const [isOpen, setIsOpen] = React.useState(true);
  
  return (
    <Card className="bg-card">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <h3 className="font-semibold">{activity.title}</h3>
                    <p className="text-sm text-muted-foreground">In Project: Pillar / Objective / Initiative</p>
                </div>
                 <div className="flex items-center gap-4">
                    <Select defaultValue="Pending review">
                        <SelectTrigger className="w-[180px] bg-background">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pending review">Pending review</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>
                     <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                         {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                    </CollapsibleTrigger>
                </div>
            </CardHeader>
            <CollapsibleContent>
                <CardContent className="space-y-6">
                    <p className="text-sm">{activity.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                       <Badge variant="outline">Due: {format(activity.endDate, "PP")}</Badge>
                       <Badge variant="outline">Weight: {activity.weight}%</Badge>
                       <Progress value={activity.progress} className="w-[40%]" />
                       <span className="text-muted-foreground">{activity.progress}% Complete</span>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-medium">Updates</h4>
                        <div className="flex items-start gap-4">
                            <Avatar className="h-9 w-9">
                                <AvatarFallback>{activity.lastUpdated.user.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="w-full">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold">{activity.lastUpdated.user}</p>
                                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(activity.lastUpdated.date, { addSuffix: true })}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">Progress reported: {activity.progress}%</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </CollapsibleContent>
       </Collapsible>
    </Card>
  )
}


export function MyActivityTaskList({ title, count, activities }: { title: string, count: number, activities: Activity[] }) {
  
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
          <TaskCard key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  )
}
