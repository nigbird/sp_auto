import type { Activity } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Loader, CheckCircle2, AlertTriangle } from "lucide-react";

export function SummaryCards({ activities }: { activities: Activity[] }) {
  const totalActivities = activities.length;
  const inProgress = activities.filter(a => a.status === 'In Progress').length;
  const completed = activities.filter(a => a.status === 'Completed').length;
  const delayed = activities.filter(a => a.status === 'Delayed').length;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
          <ListTodo className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalActivities}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          <Loader className="h-4 w-4 text-muted-foreground animate-spin" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{inProgress}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completed}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Delayed</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{delayed}</div>
        </CardContent>
      </Card>
    </div>
  );
}
