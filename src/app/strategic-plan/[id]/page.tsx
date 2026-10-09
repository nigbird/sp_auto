
import { getStrategicPlanById } from "@/actions/strategic-plan";
import { getUsers } from "@/actions/users";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ArrowLeft, BarChart3, Edit } from "lucide-react";
import { PublishButton } from "@/components/strategic-plan/publish-button";
import { DeletePlanButton } from "@/components/strategic-plan/delete-plan-button";
import { SendBreakdownRequestsButton, type BreakdownOwner, type RequestState } from "@/components/strategic-plan/send-breakdown-requests-button";
import { MonthlyBreakdownTable } from "@/components/strategic-plan/monthly-breakdown-table";
import { ExportMenu } from "@/components/export-menu";
import { Can } from "@/components/permissions-provider";
import { PlanStructureView } from "@/components/strategic-plan/plan-structure-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function StrategicPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [plan, users] = await Promise.all([getStrategicPlanById(id), getUsers()]);

    if (!plan) {
        notFound();
    }

    const userNames = Object.fromEntries(users.map(u => [u.id, u.name]));
    const userOffices = new Map(users.map(u => [u.id, u.leadOwner || u.department || null]));
    const activities = plan.pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities)));
    // Everyone responsible for an activity, with where each of their breakdown requests stands.
    const owners = new Map<string, BreakdownOwner>();
    for (const a of activities) {
        const person = a.responsible as { id?: string; name?: string } | null;
        if (!person?.id) continue;
        const owner = owners.get(person.id) ?? { id: person.id, name: person.name ?? userNames[person.id] ?? "Unknown user", office: userOffices.get(person.id) || a.leadOwner || a.department || "—", activities: [] };
        const state: RequestState = a.planRequestStatus === 'SENT' ? 'sent' : a.planRequestStatus === 'ACCEPTED' ? 'accepted' : 'waiting';
        owner.activities.push({ id: a.id, title: a.title, state });
        owners.set(person.id, owner);
    }
    const breakdownOwners = [...owners.values()].sort((x, y) => x.name.localeCompare(y.name));
    const approvedCount = activities.filter(a => a.planSubmissionStatus === 'APPROVED').length;
    const isPublished = plan.status === 'PUBLISHED';

    return (
        <div className="flex-1 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/60 bg-white px-6 py-5">
                <div className="flex min-w-0 items-start gap-4">
                    <Button asChild variant="outline" size="icon" className="mt-0.5 shrink-0">
                        <Link href="/strategic-plan" aria-label="Back to strategic plans">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="min-w-0 space-y-1">
                        <h1 className="text-xl font-semibold tracking-tight text-foreground">{plan.name}</h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span
                                className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                    isPublished ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                )}
                            >
                                <span className={cn("h-1.5 w-1.5 rounded-full", isPublished ? "bg-primary" : "bg-muted-foreground/50")} />
                                {isPublished ? "Published" : "Draft"}
                            </span>
                            {!plan.isActive && (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Deactivated</span>
                            )}
                            <span>Version {plan.version}</span>
                            <span>{plan.startYear} – {plan.endYear}</span>
                            <span>Updated {format(new Date(plan.updatedAt), "PPp")}</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <ExportMenu options={[
                        {
                            kind: "excel",
                            label: "Plan (Excel)",
                            description: "Structure, weights and monthly targets. Can be imported again.",
                            href: `/api/export/plan/${plan.id}?period=none`,
                        },
                    ]} />
                    {isPublished && (
                        <Can anyOf={["reports:view"]}>
                            <Button asChild variant="outline">
                                <Link href={`/reports?plan=${plan.id}`}>
                                    <BarChart3 className="mr-2 h-4 w-4" /> Performance Report
                                </Link>
                            </Button>
                        </Can>
                    )}
                    {isPublished && (
                        <Can anyOf={["plan-approvals:request"]}>
                            <SendBreakdownRequestsButton planId={plan.id} owners={breakdownOwners} />
                        </Can>
                    )}
                    <Can anyOf={["strategic-plan:edit"]}>
                        <Button asChild variant="outline">
                            <Link href={`/strategic-plan/edit/${plan.id}`}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </Link>
                        </Button>
                        {!isPublished && <PublishButton planId={plan.id} />}
                    </Can>
                    <Can anyOf={["strategic-plan:delete"]}>
                        <DeletePlanButton planId={plan.id} planName={plan.name} />
                    </Can>
                </div>
            </div>

            <Tabs defaultValue="structure" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="structure">Plan structure</TabsTrigger>
                    <TabsTrigger value="breakdown">Monthly breakdown ({approvedCount}/{activities.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="structure" className="mt-0">
                    <PlanStructureView pillars={plan.pillars} userNames={userNames} />
                </TabsContent>
                <TabsContent value="breakdown" className="mt-0 space-y-3">
                    <p className="text-sm text-muted-foreground">
                        {isPublished
                            ? `${approvedCount} of ${activities.length} activities have an approved breakdown.`
                            : "Publish the plan, then send breakdown requests so each activity owner can fill in their monthly targets."}
                    </p>
                    <MonthlyBreakdownTable pillars={plan.pillars} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
