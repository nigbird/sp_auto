'use client';

import * as React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight, CheckCircle, ShieldQuestion, ShieldX, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/status-badge';
import { getTrafficLightColor, getPillarProgress, getObjectiveProgress, getInitiativeProgress } from '@/lib/utils';
import type { Pillar, Objective, Initiative, Activity, User, PendingUpdate, ActivityUpdate } from '@/lib/types';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback } from '../ui/avatar';

const ApprovalStatusBadge = ({ status, reason }: { status: Activity['approvalStatus'], reason?: string | null }) => {
    if (!status) return null;
    let variant: 'default' | 'destructive' | 'secondary' = 'secondary';
    let className = '';
    let icon = <Info className="mr-1 h-3 w-3" />;

    switch(status) {
        case 'APPROVED':
            variant = 'default';
            className = 'bg-green-500/20 text-green-700 border-green-400';
            icon = <CheckCircle className="mr-1 h-3 w-3" />;
            break;
        case 'PENDING':
            className = 'bg-blue-500/20 text-blue-700 border-blue-400';
            icon = <ShieldQuestion className="mr-1 h-3 w-3" />;
            break;
        case 'DECLINED':
            variant = 'destructive';
            icon = <ShieldX className="mr-1 h-3 w-3" />;
            break;
    }
    
    return <Badge variant={variant} className={className}>{icon}{status}</Badge>;
}

export function ReportDataTable({ data }: { data: Pillar[] }) {
  const [openStates, setOpenStates] = React.useState<Record<string, boolean>>({});

  const toggleOpen = (id: string) => {
    setOpenStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!data || data.length === 0) {
    return (
        <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
                No data available for the selected filters.
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Report</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Title</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((pillar) => (
                <PillarRow key={pillar.id} pillar={pillar} openStates={openStates} toggleOpen={toggleOpen} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ROW COMPONENTS
const PillarRow = ({ pillar, openStates, toggleOpen }: { pillar: Pillar; openStates: Record<string, boolean>; toggleOpen: (id: string) => void; }) => {
  const progress = getPillarProgress(pillar);
  const isOpen = !!openStates[pillar.id];

  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/60" onClick={() => toggleOpen(pillar.id)}>
        <TableCell className="cursor-pointer">
          <div className="flex items-center gap-2 font-bold text-base">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {pillar.title}
          </div>
        </TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="font-bold">{progress.toFixed(1)}%</span>
            <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(progress)}`}></div>
          </div>
        </TableCell>
      </TableRow>
      {isOpen && pillar.objectives.map(objective => (
        <ObjectiveRow key={objective.id} objective={objective} openStates={openStates} toggleOpen={toggleOpen} />
      ))}
    </>
  );
};

const ObjectiveRow = ({ objective, openStates, toggleOpen }: { objective: Objective; openStates: Record<string, boolean>; toggleOpen: (id: string) => void; }) => {
  const progress = getObjectiveProgress(objective);
  const isOpen = !!openStates[objective.id];

  return (
    <>
      <TableRow className="hover:bg-accent/10" onClick={() => toggleOpen(objective.id)}>
        <TableCell className="cursor-pointer">
          <div className="flex items-center gap-2 pl-6 font-semibold">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {objective.statement}
          </div>
        </TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <span>{progress.toFixed(1)}%</span>
            <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(progress)}`}></div>
          </div>
        </TableCell>
      </TableRow>
       {isOpen && objective.initiatives.map(initiative => (
        <InitiativeRow key={initiative.id} initiative={initiative} openStates={openStates} toggleOpen={toggleOpen} />
       ))}
    </>
  );
};

const InitiativeRow = ({ initiative, openStates, toggleOpen }: { initiative: Initiative; openStates: Record<string, boolean>; toggleOpen: (id: string) => void }) => {
  const progress = getInitiativeProgress(initiative);
  const isOpen = !!openStates[initiative.id];

  return (
     <>
      <TableRow className="hover:bg-accent/5" onClick={() => toggleOpen(initiative.id)}>
        <TableCell className="cursor-pointer">
           <div className="flex items-center gap-2 pl-12 font-medium">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {initiative.title}
          </div>
        </TableCell>
        <TableCell>{initiative.owner}</TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
              <span>{progress.toFixed(1)}%</span>
              <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(progress)}`}></div>
          </div>
        </TableCell>
      </TableRow>
       {isOpen && initiative.activities.map(activity => (
         <ActivityRow key={activity.id} activity={activity} openStates={openStates} toggleOpen={toggleOpen} />
       ))}
      </>
  );
};

const ActivityRow = ({ activity, openStates, toggleOpen }: { activity: Activity; openStates: Record<string, boolean>; toggleOpen: (id: string) => void; }) => {
  const responsible = activity.responsible as User;
  const isOpen = !!openStates[activity.id];

  return (
    <>
    <TableRow onClick={() => toggleOpen(activity.id)} className="cursor-pointer">
      <TableCell className="pl-20">{activity.title}</TableCell>
      <TableCell>{responsible?.name || 'N/A'}</TableCell>
      <TableCell className="text-sm">
        {format(new Date(activity.startDate), "MMM dd")} - {format(new Date(activity.endDate), "MMM dd, yyyy")}
      </TableCell>
      <TableCell>
        <StatusBadge status={activity.status} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
            <span>{activity.progress}%</span>
            <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(activity.progress)}`}></div>
        </div>
      </TableCell>
    </TableRow>
    {isOpen && (
        <TableRow>
            <TableCell colSpan={5} className="p-0">
                <div className="p-4 bg-muted/30">
                    <ActivityDetails activity={activity} />
                </div>
            </TableCell>
        </TableRow>
    )}
    </>
  );
};

const ActivityDetails = ({ activity }: { activity: Activity }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className='space-y-4'>
                <h4 className="font-semibold">Details</h4>
                <div className="text-sm space-y-2">
                    <p><strong>Description:</strong> {activity.description || 'N/A'}</p>
                    <p><strong>Department:</strong> {activity.department}</p>
                    <p><strong>Weight:</strong> {activity.weight}%</p>
                </div>
                 <div className="space-y-2">
                    <h4 className="font-semibold">Approval Status</h4>
                    <ApprovalStatusBadge status={activity.approvalStatus} reason={activity.declineReason} />
                    {activity.declineReason && <p className="text-sm text-destructive mt-1">Reason: {activity.declineReason}</p>}
                </div>
            </div>
            <div className='space-y-4'>
                <h4 className="font-semibold">Update History</h4>
                <ScrollArea className="h-48 rounded-md border p-4">
                    {(activity.updates || []).length > 0 ? (
                        <div className="space-y-4">
                        {[...(activity.updates || [])].reverse().map((update, index) => (
                            <div key={index} className="flex items-start gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback>{update.user.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="w-full text-sm">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold">{update.user}</p>
                                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(update.date), { addSuffix: true })}</p>
                                    </div>
                                    <p className="text-muted-foreground">{update.comment}</p>
                                </div>
                            </div>
                        ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center">No update history.</p>
                    )}
                </ScrollArea>
            </div>
        </div>
    )
}

    