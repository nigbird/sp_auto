
import { getStrategicPlanById, deleteStrategicPlan, publishStrategicPlan } from "@/actions/strategic-plan";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getPillarProgress, getObjectiveProgress, getInitiativeProgress, getTrafficLightColor, getObjectiveWeight, getInitiativeWeight } from "@/lib/utils";
import type { Pillar, Objective, Initiative, Activity, User } from "@/lib/types";
import { ArrowLeft, Edit, Trash2, CheckCircle, User as UserIcon, Calendar, Weight, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";


// Server action wrappers
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function deletePlanAction(formData: FormData) {
  "use server";
  const planId = formData.get("planId") as string;
  await deleteStrategicPlan(planId);
}

async function publishPlanAction(formData: FormData) {
  "use server";
  const planId = formData.get("planId") as string;
  await publishStrategicPlan(planId);
}

function ActionButtons({ planId, status }: { planId: string, status: string }) {
    return (
        <div className="flex gap-2">
            <Button asChild variant="outline">
                <Link href={`/strategic-plan/edit/${planId}`}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                </Link>
            </Button>
            <form action={deletePlanAction}>
                <input type="hidden" name="planId" value={planId} />
                <Button variant="destructive" type="submit">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
            </form>
            {status !== 'PUBLISHED' && (
                <form action={publishPlanAction}>
                    <input type="hidden" name="planId" value={planId} />
                    <Button type="submit">
                        <CheckCircle className="mr-2 h-4 w-4" /> Publish
                    </Button>
                </form>
            )}
        </div>
    )
}

function HierarchyView({ pillars }: { pillars: Pillar[] }) {
    return (
        <div className="space-y-4">
            {pillars.map(pillar => <PillarItem key={pillar.id} pillar={pillar} />)}
        </div>
    )
}

function PillarItem({ pillar }: { pillar: Pillar }) {
    const progress = getPillarProgress(pillar);
    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between p-4 bg-muted/30">
                <h3 className="flex-1 text-lg font-semibold">{pillar.title}</h3>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="font-bold">{progress.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Progress</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full ${getTrafficLightColor(progress)}`}></div>
                </div>
            </CardHeader>
            {pillar.objectives.length > 0 && (
                 <CardContent className="p-4 space-y-4">
                    {pillar.objectives.map(objective => <ObjectiveItem key={objective.id} objective={objective} />)}
                 </CardContent>
            )}
        </Card>
    )
}

function ObjectiveItem({ objective }: { objective: Objective }) {
    const progress = getObjectiveProgress(objective);
    const weight = getObjectiveWeight(objective);
    const title = objective.statement || objective.title;
    return (
        <Card className="overflow-hidden">
             <CardHeader className="flex flex-row items-center justify-between p-3 bg-muted/20">
                 <h4 className="flex-1 font-semibold">{title}</h4>
                 <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="font-semibold text-sm">Wt: {weight.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold">{progress.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Progress</p>
                    </div>
                    <div className={`w-3.5 h-3.5 rounded-full ${getTrafficLightColor(progress)}`}></div>
                </div>
            </CardHeader>
             {objective.initiatives.length > 0 && (
                <CardContent className="p-3 space-y-3">
                    {objective.initiatives.map(initiative => <InitiativeItem key={initiative.id} initiative={initiative} />)}
                </CardContent>
            )}
        </Card>
    )
}

function InitiativeItem({ initiative }: { initiative: Initiative }) {
    const progress = getInitiativeProgress(initiative);
    const weight = getInitiativeWeight(initiative);
    return (
        <Card className="overflow-hidden bg-background/70">
            <CardHeader className="flex flex-row items-center justify-between p-3">
                <div>
                     <h5 className="font-medium">{initiative.title}</h5>
                     <p className="text-xs text-muted-foreground flex items-center gap-1"><UserIcon className="h-3 w-3"/> Owner: {initiative.owner}</p>
                </div>
                 <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="font-semibold text-sm">Wt: {weight.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold">{progress.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Progress</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(progress)}`}></div>
                </div>
            </CardHeader>
            {initiative.activities.length > 0 && (
                 <CardContent className="px-3 pb-3 space-y-2">
                    {initiative.activities.map(activity => <ActivityItem key={activity.id} activity={activity} />)}
                </CardContent>
            )}
        </Card>
    )
}

function ActivityItem({ activity }: { activity: Activity }) {
    const responsible = activity.responsible as User;
    return (
        <div className="p-3 rounded-md border bg-background">
            <div className="flex justify-between items-start">
                <p className="font-medium text-sm mb-2">{activity.title}</p>
                <div className="flex items-center gap-4">
                    <StatusBadge status={activity.status} />
                    <div className="text-right">
                        <p className="font-bold text-sm">{activity.progress.toFixed(1)}%</p>
                    </div>
                </div>
            </div>
            <Progress value={activity.progress} indicatorClassName={getTrafficLightColor(activity.progress)} className="h-1.5" />
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                 <div className="flex items-center gap-1.5">
                    <UserIcon className="h-3 w-3"/>
                    <span>{responsible.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3"/>
                    <span>{format(new Date(activity.startDate), "MMM d")} - {format(new Date(activity.endDate), "MMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Weight className="h-3 w-3"/>
                    <span>Weight: {activity.weight}%</span>
                </div>
                {activity.description &&
                    <div className="flex items-center gap-1.5">
                        <Info className="h-3 w-3"/>
                        <span className="truncate">{activity.description}</span>
                    </div>
                }
            </div>
        </div>
    )
}


export default async function StrategicPlanDetailPage({ params }: { params: { id: string } }) {
  const plan = await getStrategicPlanById(params.id);

  if (!plan) {
    notFound();
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-start justify-between">
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
        <ActionButtons planId={plan.id} status={plan.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan Overview</CardTitle>
           <CardDescription>
            Status: <Badge variant={plan.status === 'PUBLISHED' ? 'default' : 'secondary'} className={plan.status === 'PUBLISHED' ? 'bg-green-500/20 text-green-700 border-green-400' : ''}>{plan.status}</Badge> 
            <span className="ml-4">Last Updated: {format(new Date(plan.updatedAt), 'PPp')}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
            <HierarchyView pillars={plan.pillars} />
        </CardContent>
      </Card>
    </div>
  );
}
