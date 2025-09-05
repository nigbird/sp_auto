
"use client"

import * as React from "react"
import type { Activity } from "@/lib/types";
import { format } from "date-fns";
import { List, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Button } from "../ui/button";
import { StatusBadge } from "../status-badge";
import { Progress } from "../ui/progress";

function ReadOnlyTaskCard({ activity }: { activity: Activity }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Card className="bg-card">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <h3 className="font-semibold">{activity.title}</h3>
                    <p className="text-sm text-muted-foreground">Due: {format(activity.endDate, "PP")}</p>
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
            <CollapsibleContent>
                <CardContent className="space-y-6">
                    <p className="text-sm">{activity.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                           <p className="text-sm font-medium">Status</p>
                           <StatusBadge status={activity.status} />
                        </div>
                         <div className="space-y-2">
                             <p className="text-sm font-medium">Start Date</p>
                             <p className="text-sm">{format(activity.startDate, "PP")}</p>
                        </div>
                        <div className="space-y-2">
                             <p className="text-sm font-medium">End Date</p>
                             <p className="text-sm">{format(activity.endDate, "PP")}</p>
                        </div>
                        <div className="space-y-2">
                             <p className="text-sm font-medium">Weight</p>
                             <p className="text-sm">{activity.weight}%</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Progress</p>
                        <Progress value={activity.progress} />
                    </div>
                </CardContent>
            </CollapsibleContent>
       </Collapsible>
    </Card>
  )
}

export function AllActivityTaskList({ title, count, activities }: { title: string, count: number, activities: Activity[] }) {
  
  if (activities.length === 0) {
    return (
        <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-xl font-bold">
                <List className="text-muted-foreground" />
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
        <List className="text-muted-foreground" />
        {title} ({count})
      </h2>
      <div className="space-y-4">
        {activities.map(activity => (
          <ReadOnlyTaskCard key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  )
}
