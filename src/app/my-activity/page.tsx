
"use client";

import { useEffect, useState, useMemo } from "react";
import type { Activity, ActivityStatus, PendingUpdate, Rule, StrategicPlan, Pillar, Objective, Initiative, User } from "@/lib/types";
import { MyActivitySummaryCards } from "@/components/my-activity/my-activity-summary-cards";
import { MyActivityTaskList } from "@/components/my-activity/my-activity-task-list";
import { MyActivityPlanList } from "@/components/my-activity/my-activity-plan-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getActivities, createActivity, updateActivity } from "@/actions/activities";
import { submitPeriodUpdate, approvePeriodEntry, declinePeriodEntry } from "@/actions/activity-period-entries";
import { getRules } from "@/actions/rules";
import { getUsers } from "@/actions/users";
import { getCurrentUserAction } from "@/actions/auth";
import type { SessionUser } from "@/lib/auth/session";
import { listStrategicPlans, getStrategicPlanById } from "@/actions/strategic-plan";
import { getReportingPeriods } from "@/actions/reporting-periods";
import type { ReportingPeriod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle } from "lucide-react";
import { ActivityForm } from "@/components/dashboard/activity-form";
import type { StatusRule } from "@/lib/utils";

type FilterType = "Overdue" | "Not Started" | "On Track" | "Completed As Per Target" | "All";

export default function MyActivityPage() {
  const [allActivitiesForPlan, setAllActivitiesForPlan] = useState<Activity[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [statusRules, setStatusRules] = useState<StatusRule[]>([]);
  const [strategicPlans, setStrategicPlans] = useState<StrategicPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<StrategicPlan | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    async function loadInitialData() {
      const [userList, rules, plans, sessionUser] = await Promise.all([
        getUsers(),
        getRules(),
        listStrategicPlans(),
        getCurrentUserAction(),
      ]);

      setUsers(userList);
      setCurrentUser(sessionUser);

      setStatuses(rules.map(rule => rule.status));
      setStatusRules(rules);
      
      const publishedPlans = plans.filter(p => p.status === 'PUBLISHED');
      setStrategicPlans(publishedPlans);

      if (publishedPlans.length > 0) {
        const defaultPlanId = publishedPlans[0].id;
        setSelectedPlanId(defaultPlanId);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    async function loadActivitiesForPlan() {
      if (!selectedPlanId) {
        setAllActivitiesForPlan([]);
        setSelectedPlan(null);
        setPeriods([]);
        return;
      };

      const [activities, planDetails, planPeriods] = await Promise.all([
        getActivities(selectedPlanId),
        getStrategicPlanById(selectedPlanId),
        getReportingPeriods(selectedPlanId),
      ]);

      setAllActivitiesForPlan(activities);
      setSelectedPlan(planDetails);
      setPeriods(planPeriods as unknown as ReportingPeriod[]);

      const uniqueDepartments = Array.from(new Set(activities.map((a) => a.department).filter(d => d)));
      setDepartments(uniqueDepartments);
    }
    loadActivitiesForPlan();
  }, [selectedPlanId]);


  useEffect(() => {
    if (!currentUser) return;
    
    // If the user can view all activities, show all for the selected plan. Otherwise, filter for the user.
    if (currentUser.permissions.includes('activities:view')) {
        setMyActivities(allActivitiesForPlan);
    } else {
        const userActivities = allActivitiesForPlan.filter(
          (activity) => (activity.responsible as User)?.id === currentUser.id
        );
        setMyActivities(userActivities);
    }
  }, [allActivitiesForPlan, currentUser]);
  
  // Breakdowns are filled in only by the activity's own responsible person,
  // even for users who can view everyone's activities.
  const activitiesIAmResponsibleFor = useMemo(
    () => allActivitiesForPlan.filter(a => (a.responsible as { id?: string })?.id === currentUser?.id),
    [allActivitiesForPlan, currentUser]
  );

  const refreshActivities = async () => {
    if (!selectedPlanId) return;
    setAllActivitiesForPlan(await getActivities(selectedPlanId));
  };

  const approvedActivities = useMemo(() => myActivities.filter(a => a.approvalStatus === 'APPROVED'), [myActivities]);
  
  const overdueActivities = useMemo(() => approvedActivities.filter(a => new Date(a.endDate) < new Date() && a.status !== 'Completed As Per Target'), [approvedActivities]);
  const pendingActivities = useMemo(() => myActivities.filter(a => a.approvalStatus === 'PENDING'), [myActivities]);
  const activeActivities = useMemo(() => approvedActivities.filter(a => a.status === 'On Track' || a.status === 'Delayed'), [approvedActivities]);
  const completedActivities = useMemo(() => approvedActivities.filter(a => a.status === 'Completed As Per Target'), [approvedActivities]);
  
  useEffect(() => {
    switch (activeFilter) {
      case "Overdue":
        setFilteredActivities(overdueActivities);
        break;
      case "Not Started":
        setFilteredActivities(myActivities.filter(a => a.approvalStatus === 'PENDING' || a.status === 'Not Started'));
        break;
      case "On Track":
        setFilteredActivities(activeActivities);
        break;
      case "Completed As Per Target":
        setFilteredActivities(completedActivities);
        break;
      case "All":
      default:
        setFilteredActivities(myActivities);
    }
  }, [activeFilter, myActivities, approvedActivities, overdueActivities, pendingActivities, activeActivities, completedActivities]);

  const handleUpdateActivity = async (
    activityId: string,
    newProgress: number,
    _newStatus: ActivityStatus,
    updateComment: string,
    completionDate?: string,
    delayExplanation?: string,
    recommendedAction?: string,
    escalationIssues?: string
  ) => {
    if (!currentUser) return;
    try {
      await submitPeriodUpdate(activityId, newProgress, updateComment, completionDate, delayExplanation, recommendedAction, escalationIssues);
    } catch (error) {
      toast({
        title: "Submission Blocked",
        description: error instanceof Error ? error.message : "Could not submit the update.",
        variant: "destructive",
      });
      return;
    }

    const updatedActivities = myActivities.map(activity => {
        if (activity.id === activityId) {
            const newPendingUpdate: PendingUpdate = {
                user: currentUser.name,
                date: new Date(),
                comment: updateComment,
                progress: newProgress,
            };
            return {
                ...activity,
                pendingUpdate: newPendingUpdate,
                approvalStatus: 'PENDING'
            };
        }
        return activity;
    });
    setMyActivities(updatedActivities);
    
    toast({
        title: "Update Submitted",
        description: `Your progress update for "${updatedActivities.find(a => a.id === activityId)?.title}" has been submitted for review.`,
    });
  };

  const handleFormSubmit = async (values: any) => {
    if (!selectedPlanId || !currentUser) {
      toast({ title: "Error", description: "A strategic plan and user must be selected.", variant: "destructive" });
      return;
    }
    const responsibleUser = users.find(u => u.id === values.responsible);
    if (!responsibleUser) {
        toast({ title: "Error", description: "Invalid responsible user selected.", variant: "destructive" });
        return;
    }

    if (editingActivity) {
      await updateActivity(editingActivity.id, { ...values, approvalStatus: 'PENDING' });
      const updatedActivity = {
          ...editingActivity,
          ...values,
          responsible: responsibleUser,
          approvalStatus: 'PENDING',
          declineReason: null,
      } as Activity;

      setAllActivitiesForPlan(prev => prev.map(act => act.id === editingActivity.id ? updatedActivity : act));
      toast({ title: "Activity Resubmitted", description: "The activity has been resubmitted for approval." });

    } else {
        const newActivityData = { ...values, responsible: responsibleUser.id, strategicPlanId: selectedPlanId, userId: currentUser.id };
        const newActivity = await createActivity(newActivityData);
        const fullNewActivity = { 
            ...newActivity, 
            kpis: [], 
            updates: [], 
            responsible: responsibleUser,
            startDate: new Date(newActivity.startDate),
            endDate: new Date(newActivity.endDate),
        };
        setAllActivitiesForPlan(prev => [fullNewActivity, ...prev]);
        toast({ title: "Activity Created", description: "The new activity has been successfully created and is pending approval." });
    }
   
    setIsCreateFormOpen(false);
    setEditingActivity(null);
  };
  
  const handlePlanChange = async (planId: string) => {
    setSelectedPlanId(planId);
  }

  const handleEditDeclined = (activity: Activity) => {
    setEditingActivity(activity);
    setIsCreateFormOpen(true);
  }

  const handleApproveActivity = async (activityId: string) => {
    await approvePeriodEntry(activityId);
    // Refetch or update state
    const activities = await getActivities(selectedPlanId!);
    setAllActivitiesForPlan(activities);
    toast({ title: "Activity Approved", description: "The activity is now active." });
  };

  const handleDeclineActivity = async (activityId: string, reason: string) => {
    await declinePeriodEntry(activityId, reason);
    // Refetch or update state
    const activities = await getActivities(selectedPlanId!);
    setAllActivitiesForPlan(activities);
    toast({ title: "Activity Declined", description: "The activity has been declined.", variant: "destructive" });
  };

  const taskListTitle = useMemo(() => {
    const titles: Record<string, string> = {
      Overdue: "Overdue",
      "Not Started": "Pending",
      "On Track": "Active",
      "Completed As Per Target": "Completed",
      "All": "All Activities"
    };
    return titles[activeFilter] || "All Activities";
  }, [activeFilter]);

  const allCount = myActivities.length;
  const pendingCount = myActivities.filter(a => a.approvalStatus === 'PENDING').length;

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">My Activity</h1>
            <p className="text-muted-foreground">
            Your personal dashboard for managing all assigned tasks and tracking performance.
            </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedPlanId ?? ""} onValueChange={handlePlanChange}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a Strategic Plan" />
            </SelectTrigger>
            <SelectContent>
              {strategicPlans.map(plan => (
                <SelectItem key={plan.id} value={plan.id}>{plan.name} ({plan.version})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isCreateFormOpen} onOpenChange={(isOpen) => {
                if (!isOpen) setEditingActivity(null);
                setIsCreateFormOpen(isOpen);
            }}>
              <DialogTrigger asChild>
                  <Button disabled={!selectedPlanId}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Activity
                  </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                      <DialogTitle>{editingActivity ? 'Edit Activity' : 'Create New Activity'}</DialogTitle>
                  </DialogHeader>
                  <ActivityForm
                      onSubmit={handleFormSubmit}
                      activity={editingActivity}
                      users={users as any}
                      onCancel={() => { setIsCreateFormOpen(false); setEditingActivity(null); }}
                      strategicPlan={selectedPlan}
                      periods={periods}
                  />
              </DialogContent>
          </Dialog>
        </div>
      </div>
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">My Tasks</TabsTrigger>
          <TabsTrigger value="plan">Monthly Breakdown</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="space-y-6">
          <MyActivitySummaryCards
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            overdueCount={overdueActivities.length}
            pendingCount={pendingCount}
            activeCount={activeActivities.length}
            completedCount={completedActivities.length}
            allCount={allCount}
          />
          <MyActivityTaskList
              title={taskListTitle}
              count={filteredActivities.length}
              activities={filteredActivities}
              onUpdateActivity={handleUpdateActivity}
              onEditDeclined={handleEditDeclined}
              currentUser={currentUser}
              rules={statusRules}
              onApprove={handleApproveActivity}
              onDecline={handleDeclineActivity}
          />
        </TabsContent>
        <TabsContent value="plan">
          <MyActivityPlanList activities={activitiesIAmResponsibleFor} plan={selectedPlan} onChanged={refreshActivities} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

    