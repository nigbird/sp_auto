
import { getStrategicPlanById, deleteStrategicPlan, publishStrategicPlan } from "@/actions/strategic-plan";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getPillarProgress, getObjectiveProgress, getInitiativeProgress, getTrafficLightColor } from "@/lib/utils";
import type { Pillar, Objective, Initiative, Activity } from "@/lib/types";
import { ChevronDown, ChevronRight, Edit, Trash2, CheckCircle } from "lucide-react";



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
        <div className="space-y-2">
            {pillars.map(pillar => <PillarItem key={pillar.id} pillar={pillar} />)}
        </div>
    )
}

function PillarItem({ pillar }: { pillar: Pillar }) {
    const progress = getPillarProgress(pillar);
    return (
        <div className="rounded-lg border bg-card">
            <div className="flex items-center p-4">
                <h3 className="flex-1 text-lg font-semibold">{pillar.title}</h3>
                <div className="flex items-center gap-2">
                    <span className="font-bold">{progress}%</span>
                    <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(progress)}`}></div>
                </div>
            </div>
            {pillar.objectives.length > 0 && (
                 <div className="border-t pl-6 pr-4 py-2 space-y-2">
                    {pillar.objectives.map(objective => <ObjectiveItem key={objective.id} objective={objective} />)}
                 </div>
            )}
        </div>
    )
}

function ObjectiveItem({ objective }: { objective: Objective }) {
    const progress = getObjectiveProgress(objective);
    const title = objective.statement || objective.title;
    return (
        <div className="rounded-md border">
            <div className="flex items-center p-3 bg-muted/50">
                 <h4 className="flex-1 font-semibold">{title}</h4>
                 <div className="flex items-center gap-2">
                    <span className="font-semibold">{progress}%</span>
                    <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(progress)}`}></div>
                </div>
            </div>
             {objective.initiatives.length > 0 && (
                <div className="border-t pl-6 pr-3 py-2 space-y-2">
                    {objective.initiatives.map(initiative => <InitiativeItem key={initiative.id} initiative={initiative} />)}
                </div>
            )}
        </div>
    )
}

function InitiativeItem({ initiative }: { initiative: Initiative }) {
    const progress = getInitiativeProgress(initiative);
    return (
        <div className="rounded-md border bg-background/60">
            <div className="flex items-center p-2">
                 <h5 className="flex-1 font-medium">{initiative.title}</h5>
                 <div className="flex items-center gap-2">
                    <span className="font-medium">{progress}%</span>
                    <div className={`w-2.5 h-2.5 rounded-full ${getTrafficLightColor(progress)}`}></div>
                </div>
            </div>
            {initiative.activities.length > 0 && (
                 <div className="border-t pl-6 pr-2 py-2 space-y-1">
                    {initiative.activities.map(activity => <ActivityItem key={activity.id} activity={activity} />)}
                </div>
            )}
        </div>
    )
}

function ActivityItem({ activity }: { activity: Activity }) {
    return (
        <div className="flex items-center text-sm">
            <p className="flex-1 text-muted-foreground">{activity.title}</p>
             <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{activity.progress}%</span>
                <div className={`w-2 h-2 rounded-full ${getTrafficLightColor(activity.progress)}`}></div>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{plan.name}</h1>
          <p className="text-muted-foreground">Version {plan.version} &bull; {plan.startYear} - {plan.endYear}</p>
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
