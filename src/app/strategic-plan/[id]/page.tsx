
import { getStrategicPlanById } from "@/actions/strategic-plan";
import { getUsers } from "@/actions/users";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getObjectiveWeight, getInitiativeWeight, getPillarWeight } from "@/lib/utils";
import type { Pillar, Objective, Initiative, Activity } from "@/lib/types";
import { ArrowLeft, Edit, User as UserIcon, Calendar, Weight, Info, PackageCheck } from "lucide-react";
import { PublishButton } from "@/components/strategic-plan/publish-button";
import { DeletePlanButton } from "@/components/strategic-plan/delete-plan-button";
import { SendBreakdownRequestsButton } from "@/components/strategic-plan/send-breakdown-requests-button";
import { MonthlyBreakdownTable } from "@/components/strategic-plan/monthly-breakdown-table";
import { PerformanceReportTable, type PerformanceEntry, type PerformancePeriod } from "@/components/strategic-plan/performance-report-table";
import { getPlanPerformance } from "@/actions/period-reports";

function HierarchyView({ pillars, userNames }: { pillars: Pillar[]; userNames: Map<string, string> }) {
    return (
        <div className="space-y-4">
            {pillars.map(pillar => <PillarItem key={pillar.id} pillar={pillar} userNames={userNames} />)}
        </div>
    )
}

function PillarItem({ pillar, userNames }: { pillar: Pillar; userNames: Map<string, string> }) {
    const weight = getPillarWeight(pillar);
    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between p-4 bg-muted/30">
                <h3 className="flex-1 text-lg font-semibold">{pillar.title}</h3>
                <p className="font-semibold text-sm">Wt: {weight.toFixed(1)}%</p>
            </CardHeader>
            {pillar.objectives.length > 0 && (
                <CardContent className="p-4 space-y-4">
                    {pillar.objectives.map(objective => <ObjectiveItem key={objective.id} objective={objective} userNames={userNames} />)}
                </CardContent>
            )}
        </Card>
    )
}

function ObjectiveItem({ objective, userNames }: { objective: Objective; userNames: Map<string, string> }) {
    const weight = getObjectiveWeight(objective);
    const title = objective.statement || objective.title;
    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between p-3 bg-muted/20">
                <h4 className="flex-1 font-semibold">{title}</h4>
                <p className="font-semibold text-sm">Wt: {weight.toFixed(1)}%</p>
            </CardHeader>
            {objective.initiatives.length > 0 && (
                <CardContent className="p-3 space-y-3">
                    {objective.initiatives.map(initiative => <InitiativeItem key={initiative.id} initiative={initiative} userNames={userNames} />)}
                </CardContent>
            )}
        </Card>
    )
}

function InitiativeItem({ initiative, userNames }: { initiative: Initiative; userNames: Map<string, string> }) {
    const weight = getInitiativeWeight(initiative);
    const owners = [initiative.owner?.name, ...(initiative.coOwners ?? []).map(id => userNames.get(id) ?? 'Unknown user')].filter(Boolean);
    return (
        <Card className="overflow-hidden bg-background/70">
            <CardHeader className="flex flex-row items-center justify-between p-3">
                <div>
                    <h5 className="font-medium">{initiative.title}</h5>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><UserIcon className="h-3 w-3" /> {owners.length > 1 ? 'Owners' : 'Owner'}: {owners.join(', ')}</p>
                </div>
                <p className="font-semibold text-sm">Wt: {weight.toFixed(1)}%</p>
            </CardHeader>
            {initiative.activities.length > 0 && (
                <CardContent className="px-3 pb-3 space-y-2">
                    {initiative.activities.map(activity => <ActivityItem key={activity.id} activity={activity} />)}
                </CardContent>
            )}
        </Card>
    )
}

function BreakdownBadge({ activity }: { activity: Activity }) {
    if (activity.planSubmissionStatus === 'APPROVED') return <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10">Breakdown approved</Badge>;
    if (activity.planSubmissionStatus === 'PENDING') return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-500/10">Breakdown pending approval</Badge>;
    if (activity.planSubmissionStatus === 'DECLINED') return <Badge variant="destructive">Breakdown returned</Badge>;
    if (activity.planRequestStatus === 'SENT') return <Badge variant="outline">Breakdown requested</Badge>;
    if (activity.planRequestStatus === 'ACCEPTED') return <Badge variant="outline">Owner filling in breakdown</Badge>;
    if (activity.planRequestStatus === 'DECLINED') return <Badge variant="destructive">Request declined</Badge>;
    return null;
}

function ActivityItem({ activity }: { activity: Activity }) {
    const responsible = activity.responsible as { name?: string };
    return (
        <div className="p-3 rounded-md border bg-background">
            <div className="flex flex-wrap justify-between items-start gap-2">
                <p className="font-medium text-sm">
                    {activity.title}
                    {activity.approvalStatus === 'PENDING' && <span className="ml-2 text-xs font-normal text-muted-foreground">(awaiting approval)</span>}
                </p>
                <BreakdownBadge activity={activity} />
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <UserIcon className="h-3 w-3" />
                    <span>{responsible?.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(activity.startDate), "MMM d")} - {format(new Date(activity.endDate), "MMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Weight className="h-3 w-3" />
                    <span>Weight: {activity.weight}%</span>
                </div>
                {activity.description &&
                    <div className="flex items-center gap-1.5">
                        <Info className="h-3 w-3" />
                        <span className="truncate">{activity.description}</span>
                    </div>
                }
            </div>
            {activity.deliverable && (
                <p className="mt-2 flex items-start gap-1.5 text-xs">
                    <PackageCheck className="h-3 w-3 mt-0.5 text-muted-foreground" />
                    <span><span className="font-medium">Deliverable:</span> {activity.deliverable}</span>
                </p>
            )}
        </div>
    )
}


export default async function StrategicPlanDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
    const { id } = await params;
    const { period: periodId } = await searchParams;
    const [plan, users, performance] = await Promise.all([getStrategicPlanById(id), getUsers(), getPlanPerformance(id, periodId)]);

    if (!plan) {
        notFound();
    }

    const userNames = new Map(users.map(u => [u.id, u.name]));
    const activities = plan.pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities)));
    const sendable = activities.filter(a => a.planRequestStatus === 'NOT_SENT' || a.planRequestStatus === 'DECLINED');
    const sendableOwnerCount = new Set(sendable.map(a => (a.responsible as { id?: string })?.id)).size;
    const approvedCount = activities.filter(a => a.planSubmissionStatus === 'APPROVED').length;
    const isPublished = plan.status === 'PUBLISHED';

    return (
        <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button asChild variant="outline" size="icon">
                        <Link href="/strategic-plan">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{plan.name}</h1>
                        <p className="text-muted-foreground">Version {plan.version} &bull; {plan.startYear} - {plan.endYear}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isPublished && <SendBreakdownRequestsButton planId={plan.id} sendableCount={sendable.length} ownerCount={sendableOwnerCount} />}
                    <Button asChild variant="outline">
                        <Link href={`/strategic-plan/edit/${plan.id}`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Link>
                    </Button>
                    <DeletePlanButton planId={plan.id} planName={plan.name} />
                    {!isPublished && <PublishButton planId={plan.id} />}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Plan Overview</CardTitle>
                    <CardDescription>
                        Status: <Badge variant={isPublished ? 'default' : 'secondary'} className={isPublished ? 'bg-green-500/20 text-green-700 border-green-400' : ''}>{plan.status}</Badge>
                        <span className="ml-4">Last Updated: {format(new Date(plan.updatedAt), 'PPp')}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <HierarchyView pillars={plan.pillars} userNames={userNames} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Monthly Breakdown</CardTitle>
                    <CardDescription>
                        {isPublished
                            ? `${approvedCount} of ${activities.length} activities have an approved breakdown.`
                            : 'Publish the plan, then send breakdown requests so each activity owner can fill in their monthly targets.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <MonthlyBreakdownTable pillars={plan.pillars} />
                </CardContent>
            </Card>

            <Card id="performance">
                <CardHeader>
                    <CardTitle>Performance Report</CardTitle>
                    <CardDescription>Plan vs. actual for each reporting period, calculated from approved reports.</CardDescription>
                </CardHeader>
                <CardContent>
                    <PerformanceReportTable
                        planId={plan.id}
                        pillars={plan.pillars}
                        periods={performance.periods as PerformancePeriod[]}
                        selected={performance.selected as PerformancePeriod | null}
                        entries={performance.entries as PerformanceEntry[]}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
