
"use client";

import { useEffect, useState, useMemo } from "react";
import type { Activity, ActivityStatus, PendingUpdate, Rule, StrategicPlan, Pillar, Objective, Initiative, User } from "@/lib/types";
import { MyActivitySummaryCards } from "@/components/my-activity/my-activity-summary-cards";
import { MyActivityTaskList } from "@/components/my-activity/my-activity-task-list";
import { AllActivityTaskList } from "@/components/my-activity/all-activity-task-list";
import { useToast } from "@/hooks/use-toast";
import { getActivities, createActivity, submitActivityUpdate } from "@/actions/activities";
import { getRules } from "@/actions/rules";
import { getUsers } from "@/actions/users";
import { listStrategicPlans, getStrategicPlanById } from "@/actions/strategic-plan";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle } from "lucide-react";
import { ActivityForm } from "@/components/dashboard/activity-form";

type FilterType = "Delayed" | "Not Started" | "On Track" | "Completed As Per Target" | "Overdue" | "All";

export default function MyActivityPage() {
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [strategicPlans, setStrategicPlans] = useState<StrategicPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<StrategicPlan | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function loadInitialData() {
      const [userList, rules, plans] = await Promise.all([
        getUsers(),
        getRules(),
        listStrategicPlans(),
      ]);
      
      setUsers(userList);
      // In a real app, you would get the logged-in user from a session.
      // For this demo, we'll find the admin user to demonstrate the role-based view.
      const adminUser = userList.find(u => u.email === 'admin@corp-plan.com');
      setCurrentUser(adminUser || userList.find(u => u.name === "Liam Johnson") || null);

      setStatuses(rules.map(rule => rule.status));
      
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
        setAllActivities([]);
        setSelectedPlan(null);
        return;
      };

      const [activities, planDetails] = await Promise.all([
        getActivities(selectedPlanId),
        getStrategicPlanById(selectedPlanId)
      ]);
      
      setAllActivities(activities);
      setSelectedPlan(planDetails);

      const uniqueDepartments = ["All", ...new Set(activities.map((a) => a.department).filter(d => d && d !== "All"))];
      setDepartments(uniqueDepartments);
    }
    loadActivitiesForPlan();
  }, [selectedPlanId]);


  useEffect(() => {
    if (currentUser?.role === 'ADMINISTRATOR') {
        setMyActivities(allActivities);
    } else {
        // In a real application, this would be based on the logged-in user's identity.
        // For this demo, we'll assign tasks to "Liam Johnson".
        const userActivities = allActivities.filter(
          (activity) => (activity.responsible as any)?.name === "Liam Johnson"
        );
        setMyActivities(userActivities);
    }
  }, [allActivities, currentUser]);
  
  const overdueActivities = useMemo(() => myActivities.filter(a => new Date(a.endDate) < new Date() && a.status !== 'Completed As Per Target'), [myActivities]);
  const pendingActivities = useMemo(() => myActivities.filter(a => a.status === 'Not Started' && new Date(a.startDate) <= new Date()), [myActivities]);
  const activeActivities = useMemo(() => myActivities.filter(a => a.status === 'On Track'), [myActivities]);
  const completedActivities = useMemo(() => myActivities.filter(a => a.status === 'Completed As Per Target'), [myActivities]);


  useEffect(() => {
    switch (activeFilter) {
      case "Delayed":
      case "Overdue":
        setFilteredActivities(overdueActivities);
        break;
      case "Not Started":
        setFilteredActivities(pendingActivities);
        break;
      case "On Track":
        setFilteredActivities(activeActivities);
        break;
      case "Completed As Per Target":
        setFilteredActivities(completedActivities);
        break;
      case "All":
        setFilteredActivities(myActivities);
        break;
      default:
        setFilteredActivities(myActivities);
    }
  }, [activeFilter, myActivities, overdueActivities, pendingActivities, activeActivities, completedActivities]);

  const handleUpdateActivity = async (
    activityId: string,
    newProgress: number,
    _newStatus: ActivityStatus,
    updateComment: string
  ) => {
    if (!currentUser) return;
    // In a real app, userId would come from session
    await submitActivityUpdate(activityId, newProgress, updateComment, currentUser.id);
    
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
    if (!selectedPlanId) {
      toast({ title: "Error", description: "A strategic plan must be selected.", variant: "destructive" });
      return;
    }
    const responsibleUser = users.find(u => u.id === values.responsible);
    if (!responsibleUser) {
        toast({ title: "Error", description: "Invalid responsible user selected.", variant: "destructive" });
        return;
    }

    const newActivityData = { ...values, responsible: responsibleUser.id, strategicPlanId: selectedPlanId };

    const newActivity = await createActivity(newActivityData);

    const fullNewActivity = { 
        ...newActivity, 
        kpis: [], 
        updates: [], 
        responsible: responsibleUser,
        startDate: new Date(newActivity.startDate),
        endDate: new Date(newActivity.endDate),
    };
    
    setAllActivities(prev => [fullNewActivity, ...prev]);

    if (fullNewActivity.responsible.name === "Liam Johnson") {
         setMyActivities(prev => [fullNewActivity, ...prev]);
    }
   
    toast({ title: "Activity Created", description: "The new activity has been successfully created and is pending approval." });
    setIsCreateFormOpen(false);
  };
  
  const handlePlanChange = async (planId: string) => {
    setSelectedPlanId(planId);
  }

  const taskListTitle = useMemo(() => {
    const titles: Record<FilterType, string> = {
      Delayed: "Overdue",
      "Not Started": "Pending",
      "On Track": "Active",
      "Completed As Per Target": "Completed",
      Overdue: "Overdue",
      All: "All Activities"
    };
    return titles[activeFilter];
  }, [activeFilter]);

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
          <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
              <DialogTrigger asChild>
                  <Button disabled={!selectedPlanId}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Activity
                  </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                      <DialogTitle>Create New Activity</DialogTitle>
                  </DialogHeader>
                  <ActivityForm 
                      onSubmit={handleFormSubmit}
                      users={users as any}
                      departments={departments}
                      statuses={statuses}
                      onReset={() => {}}
                      onCancel={() => setIsCreateFormOpen(false)}
                      strategicPlan={selectedPlan}
                  />
              </DialogContent>
          </Dialog>
        </div>
      </div>
      <MyActivitySummaryCards
        activities={myActivities}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        overdueCount={overdueActivities.length}
        pendingCount={pendingActivities.length}
        activeCount={activeActivities.length}
        completedCount={completedActivities.length}
        allCount={myActivities.length}
      />
      {activeFilter === 'All' ? (
        <AllActivityTaskList 
            title={taskListTitle} 
            count={filteredActivities.length} 
            activities={filteredActivities}
        />
      ) : (
        <MyActivityTaskList 
            title={taskListTitle} 
            count={filteredActivities.length} 
            activities={filteredActivities} 
            onUpdateActivity={handleUpdateActivity}
        />
      )}
    </div>
  );
}
