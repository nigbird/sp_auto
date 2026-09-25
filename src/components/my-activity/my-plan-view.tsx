"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Activity, ReportingPeriod, StrategicPlan, User } from "@/lib/types";
import { MyActivityOverview, type LatestReport } from "@/components/my-activity/my-activity-overview";
import { MyActivityPlanList } from "@/components/my-activity/my-activity-plan-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { updateActivity } from "@/actions/activities";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityForm } from "@/components/dashboard/activity-form";

type TabId = "activities" | "breakdown";

/**
 * The interactive part of My Plan. All data is loaded by the server page
 * (src/app/plan/page.tsx) in one parallel batch; switching plans changes the
 * URL and saving refreshes the server data, so nothing is fetched from here.
 */
export function MyPlanView({ plans, plan, activities, reports, periods, users }: {
  plans: { id: string; name: string; version: string }[];
  plan: StrategicPlan | null;
  activities: Activity[];
  reports: LatestReport[];
  periods: ReportingPeriod[];
  users: User[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<TabId>("activities");
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const { toast } = useToast();

  const initiativeTitles = useMemo(() => {
    const map = new Map<string, string>();
    plan?.pillars?.forEach(p => p.objectives.forEach(o => o.initiatives.forEach(i => map.set(i.id, i.title))));
    return map;
  }, [plan]);

  const refresh = () => startTransition(() => router.refresh());

  const handlePlanChange = (planId: string) => startTransition(() => router.push(`/plan?plan=${planId}`));

  // Resubmitting a declined activity. New activities are added from the
  // Monthly Breakdown tab ("Add another activity").
  const handleResubmit = async (values: any) => {
    if (!editingActivity) return;
    try {
      await updateActivity(editingActivity.id, { ...values, approvalStatus: "PENDING" });
    } catch (error) {
      toast({ title: "Couldn't resubmit", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
      return;
    }
    toast({ title: "Activity resubmitted", description: `"${editingActivity.title}" was sent for approval again.` });
    setEditingActivity(null);
    refresh();
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">My Plan</h1>
          <p className="text-muted-foreground">
            The activities you are responsible for: what's approved, what needs your input, and how they're progressing.
          </p>
        </div>
        {plans.length > 0 && (
          <Select value={plan?.id ?? ""} onValueChange={handlePlanChange}>
            <SelectTrigger className="w-full sm:w-[320px]">
              <SelectValue placeholder="Select a strategic plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name} ({p.version})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!plan ? (
        <p className="text-sm text-muted-foreground">There is no published strategic plan yet.</p>
      ) : (
        <Tabs value={tab} onValueChange={v => setTab(v as TabId)} className={isPending ? "opacity-60 transition-opacity" : undefined}>
          <TabsList>
            <TabsTrigger value="activities">My Activities</TabsTrigger>
            <TabsTrigger value="breakdown">Monthly Breakdown</TabsTrigger>
          </TabsList>
          <TabsContent value="activities" className="pt-2">
            <MyActivityOverview
              activities={activities}
              reports={reports}
              initiativeTitles={initiativeTitles}
              onOpenBreakdown={() => setTab("breakdown")}
              onEdit={setEditingActivity}
            />
          </TabsContent>
          <TabsContent value="breakdown" className="pt-2">
            <MyActivityPlanList activities={activities} plan={plan} onChanged={refresh} />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!editingActivity} onOpenChange={open => { if (!open) setEditingActivity(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit & resubmit activity</DialogTitle>
          </DialogHeader>
          {editingActivity && (
            <ActivityForm
              onSubmit={handleResubmit}
              activity={editingActivity}
              users={users as any}
              onCancel={() => setEditingActivity(null)}
              strategicPlan={plan}
              periods={periods}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
