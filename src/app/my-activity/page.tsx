
"use client";

import { useEffect, useState, useMemo } from "react";
import type { Activity, ActivityStatus, PendingUpdate, Rule } from "@/lib/types";
import { MyActivitySummaryCards } from "@/components/my-activity/my-activity-summary-cards";
import { MyActivityTaskList } from "@/components/my-activity/my-activity-task-list";
import { AllActivityTaskList } from "@/components/my-activity/all-activity-task-list";
import { useToast } from "@/hooks/use-toast";
import { getActivities, createActivity, submitActivityUpdate } from "@/actions/activities";
import { getRules } from "@/actions/rules";
import { getUsers } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { ActivityForm } from "@/components/dashboard/activity-form";

type FilterType = "Delayed" | "Not Started" | "On Track" | "Completed As Per Target" | "Overdue" | "All";

export default function MyActivityPage() {
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("Delayed");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [users, setUsers] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    async function loadInitialData() {
      const activities = await getActivities();
      setAllActivities(activities);
      // In a real application, this would be based on the logged-in user's identity.
      // For this demo, we'll assign tasks to "Liam Johnson".
      const userActivities = activities.filter(
        (activity) => activity.responsible === "Liam Johnson"
      );
      setMyActivities(userActivities);

      const userList = await getUsers();
      setUsers(userList.map(u => u.name));
      
      const uniqueDepartments = ["All", ...new Set(activities.map((a) => a.department))];
      setDepartments(uniqueDepartments);

      const rules: Rule[] = await getRules();
      setStatuses(rules.map(rule => rule.status));
    }
    loadInitialData();
  }, []);

  const overdueActivities = useMemo(() => myActivities.filter(a => a.status === 'Delayed' || a.status === 'Overdue'), [myActivities]);
  const pendingActivities = useMemo(() => myActivities.filter(a => a.status === 'Not Started'), [myActivities]);
  const activeActivities = useMemo(() => myActivities.filter(a => a.status === 'On Track'), [myActivities]);
  const completedActivities = useMemo(() => myActivities.filter(a => a.status === 'Completed As Per Target'), [myActivities]);

  useEffect(() => {
    switch (activeFilter) {
      case "Delayed":
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
        setFilteredActivities(overdueActivities);
    }
  }, [activeFilter, myActivities, overdueActivities, pendingActivities, activeActivities, completedActivities]);

  const handleUpdateActivity = async (
    activityId: string,
    newProgress: number,
    _newStatus: ActivityStatus,
    updateComment: string
  ) => {
    // In a real app, userId would come from session
    await submitActivityUpdate(activityId, newProgress, updateComment, "user-id-placeholder");
    
    const updatedActivities = myActivities.map(activity => {
        if (activity.id === activityId) {
            const newPendingUpdate: PendingUpdate = {
                user: "Liam Johnson", // Hardcoded for demo
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
    const newActivity = await createActivity(values);

    setMyActivities(prev => [
        { ...newActivity, kpis: [], updates: []}, 
        ...prev
    ]);
    setAllActivities(prev => [
        { ...newActivity, kpis: [], updates: []}, 
        ...prev
    ]);
    toast({ title: "Activity Created", description: "The new activity has been successfully created and is pending approval." });
    setIsCreateFormOpen(false);
  };

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
        <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Activity
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Create New Activity</DialogTitle>
                </DialogHeader>
                <ActivityForm 
                    onSubmit={handleFormSubmit}
                    users={users}
                    departments={departments}
                    statuses={statuses}
                    onReset={() => {}}
                    onCancel={() => setIsCreateFormOpen(false)}
                />
            </DialogContent>
        </Dialog>
      </div>
      <MyActivitySummaryCards
        activities={myActivities}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
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
