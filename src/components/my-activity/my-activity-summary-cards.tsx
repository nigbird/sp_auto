
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle, Hourglass, List, ShieldQuestion, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterType = "Overdue" | "Not Started" | "On Track" | "Completed As Per Target" | "All" | "Pending Approval" | "Declined";

type MyActivitySummaryCardsProps = {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  overdueCount: number;
  pendingCount: number;
  activeCount: number;
  completedCount: number;
  allCount: number;
  pendingApprovalCount: number;
  declinedCount: number;
};

export function MyActivitySummaryCards({ 
  activeFilter,
  onFilterChange,
  overdueCount,
  pendingCount,
  activeCount,
  completedCount,
  allCount,
  pendingApprovalCount,
  declinedCount,
}: MyActivitySummaryCardsProps) {
  
  const cardClasses = (filter: FilterType) =>
    cn(
      "cursor-pointer hover:bg-muted/50 transition-colors",
      activeFilter === filter && "bg-muted ring-2 ring-primary"
    );

  const cards = [
    { filter: "Pending Approval", title: "Pending Approval", count: pendingApprovalCount, icon: <ShieldQuestion className="h-4 w-4 text-blue-500" />, description: "Awaiting review" },
    { filter: "Declined", title: "Declined", count: declinedCount, icon: <ShieldX className="h-4 w-4 text-destructive" />, description: "Needs revision" },
    { filter: "Overdue", title: "Overdue Tasks", count: overdueCount, icon: <AlertTriangle className="h-4 w-4 text-destructive" />, description: "Tasks past due date" },
    { filter: "Not Started", title: "Pending Tasks", count: pendingCount, icon: <Hourglass className="h-4 w-4 text-muted-foreground" />, description: "Tasks not yet started" },
    { filter: "On Track", title: "Active Tasks", count: activeCount, icon: <Clock className="h-4 w-4 text-muted-foreground" />, description: "Tasks in-progress" },
    { filter: "Completed As Per Target", title: "Completed Tasks", count: completedCount, icon: <CheckCircle className="h-4 w-4 text-green-500" />, description: "Tasks completed" },
    { filter: "All", title: "All Approved", count: allCount, icon: <List className="h-4 w-4 text-muted-foreground" />, description: "All approved tasks" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map(card => (
        <Card key={card.filter} className={cardClasses(card.filter)} onClick={() => onFilterChange(card.filter)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            {card.icon}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.count}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
