'use client';

import { useMemo } from 'react';
import type { Activity } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListChecks, CheckCircle, ShieldQuestion, ShieldX, Percent, AlertOctagon } from 'lucide-react';
import { calculateWeightedProgress } from '@/lib/utils';

type ReportKpiCardsProps = {
  activities: Activity[];
};

export function ReportKpiCards({ activities }: ReportKpiCardsProps) {
  const summary = useMemo(() => {
    const total = activities.length;
    const approved = activities.filter(a => a.approvalStatus === 'APPROVED').length;
    const pending = activities.filter(a => a.approvalStatus === 'PENDING').length;
    const declined = activities.filter(a => a.approvalStatus === 'DECLINED').length;
    const overdue = activities.filter(a => new Date(a.endDate) < new Date() && a.status !== 'Completed As Per Target').length;
    const overallProgress = calculateWeightedProgress(activities);

    return { total, approved, pending, declined, overdue, overallProgress };
  }, [activities]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.total}</div>
          <div className="flex space-x-2 text-xs text-muted-foreground">
            <span className="flex items-center"><CheckCircle className="mr-1 h-3 w-3 text-green-500" /> {summary.approved} Approved</span>
            <span className="flex items-center"><ShieldQuestion className="mr-1 h-3 w-3 text-blue-500" /> {summary.pending} Pending</span>
            <span className="flex items-center"><ShieldX className="mr-1 h-3 w-3 text-red-500" /> {summary.declined} Declined</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.overallProgress.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">Weighted by activity completion</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue Activities</CardTitle>
          <AlertOctagon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.overdue}</div>
           <p className="text-xs text-muted-foreground">Past due date and not completed</p>
        </CardContent>
      </Card>
       <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed Activities</CardTitle>
          <ListChecks className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activities.filter(a => a.status === 'Completed As Per Target').length}</div>
           <p className="text-xs text-muted-foreground">Activities with 100% progress</p>
        </CardContent>
      </Card>
    </div>
  );
}

    