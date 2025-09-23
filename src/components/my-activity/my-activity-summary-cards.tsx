
"use client";

import type { Activity } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle, Target, Hourglass, List } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type FilterType = "Delayed" | "Not Started" | "On Track" | "Completed As Per Target" | "Overdue" | "All";

type MyActivitySummaryCardsProps = {
  activities: Activity[];
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  overdueCount: number;
  pendingCount: number;
  activeCount: number;
  completedCount: number;
  allCount: number;
};

export function MyActivitySummaryCards({ 
  activities,
  activeFilter,
  onFilterChange,
  overdueCount,
  pendingCount,
  activeCount,
  completedCount,
  allCount,
}: MyActivitySummaryCardsProps) {
  
  const cardClasses = (filter: FilterType) =>
    cn(
      "cursor-pointer hover:bg-muted/50 transition-colors",
      activeFilter === filter && "bg-muted ring-2 ring-primary"
    );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card className={cardClasses("Delayed")} onClick={() => onFilterChange("Delayed")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overdueCount}</div>
          <p className="text-xs text-muted-foreground">Tasks past their due date</p>
        </CardContent>
      </Card>
      <Card className={cardClasses("Not Started")} onClick={() => onFilterChange("Not Started")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
          <Hourglass className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{pendingCount}</div>
         <p className="text-xs text-muted-foreground">Tasks not yet started</p>
        </CardContent>
      </Card>
      <Card className={cardClasses("On Track")} onClick={() => onFilterChange("On Track")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeCount}</div>
           <p className="text-xs text-muted-foreground">Tasks currently in-progress</p>
        </CardContent>
      </Card>
      <Card className={cardClasses("Completed As Per Target")} onClick={() => onFilterChange("Completed As Per Target")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completedCount}</div>
          <p className="text-xs text-muted-foreground">Tasks you have completed</p>
        </CardContent>
      </Card>
      <Card className={cardClasses("All")} onClick={() => onFilterChange("All")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">All Activities</CardTitle>
          <List className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{allCount}</div>
          <p className="text-xs text-muted-foreground">All of your assigned tasks</p>
        </CardContent>
      </Card>
    </div>
  );
}
