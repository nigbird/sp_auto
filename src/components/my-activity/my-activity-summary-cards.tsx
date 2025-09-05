
import type { Activity } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

export function MyActivitySummaryCards({ activities }: { activities: Activity[] }) {
  const overdueTasks = activities.filter(a => a.status === 'Delayed').length;
  const activeTasks = activities.filter(a => a.status === 'In Progress' || a.status === 'Planned').length;
  const accomplishedLast30Days = activities.filter(a => {
    if (a.status !== 'Completed') return false;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return a.endDate > thirtyDaysAgo;
  }).length;

  const completedTasks = activities.filter(a => a.status === 'Completed');
  const onTimePerformance = completedTasks.length > 0
    ? Math.round((completedTasks.filter(a => a.status !== 'Delayed').length / completedTasks.length) * 100)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Link href="/my-activity?filter=overdue">
        <Card className="hover:bg-muted/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueTasks}</div>
            <p className="text-xs text-muted-foreground">Tasks past their due date</p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/my-activity?filter=active">
        <Card className="hover:bg-muted/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTasks}</div>
           <p className="text-xs text-muted-foreground">Upcoming or in-progress tasks</p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/my-activity?filter=accomplished">
        <Card className="hover:bg-muted/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accomplished (Month)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accomplishedLast30Days}</div>
            <p className="text-xs text-muted-foreground">Tasks completed in the last 30 days</p>
          </CardContent>
        </Card>
      </Link>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">On-Time Performance</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{onTimePerformance}%</div>
          <Progress value={onTimePerformance} className="h-2 mt-2" />
        </CardContent>
      </Card>
    </div>
  );
}
