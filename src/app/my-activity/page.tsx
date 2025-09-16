
"use client";

import { useEffect, useState, useMemo } from "react";
import { getSavedPlan } from "@/lib/plan-service";
import type { Activity, ActivityStatus, ActivityUpdate, StrategicPlan, PendingUpdate } from "@/lib/types";
import { MyActivitySummaryCards } from "@/components/my-activity/my-activity-summary-cards";
import { MyActivityTaskList } from "@/components/my-activity/my-activity-task-list";
import { AllActivityTaskList } from "@/components/my-activity/all-activity-task-list";
import { useToast } from "@/hooks/use-toast";

type FilterType = "Delayed" | "Not Started" | "On Track" | "Completed As Per Target" | "Overdue" | "All";

export default function MyActivityPage() {
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("Delayed");
  const { toast } = useToast();

  useEffect(() => {
    function loadActivities() {
      const plan: StrategicPlan | null = getSavedPlan();
      let activities: Activity[] = [];
      if (plan) {
        plan.pillars.forEach(pillar => {
          pillar.objectives.forEach(objective => {
            objective.initiatives.forEach(initiative => {
              activities.push(...initiative.activities);
            });
          });
        });
      }
      setAllActivities(activities);
      // In a real application, this would be based on the logged-in user's identity.
      // For this demo, we'll assign tasks to a few specific users.
      const userActivities = activities.filter(
        (activity) => activity.responsible === "Liam Johnson" || activity.responsible === "Olivia Smith"
      );
      setMyActivities(userActivities);
    }
    loadActivities();
  }, []);

  const overdueActivities = useMemo(() => myActivities.filter(a => a.status === 'Delayed' || a_status === 'Overdue'), [myActivities]);
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

  const handleUpdateActivity = (
    activityId: string,
    newProgress: number,
    _newStatus: ActivityStatus,
    updateComment: string
  ) => {
    const newPendingUpdate: PendingUpdate = {
        user: "Liam Johnson", // Hardcoded for demo
        date: new Date(),
        comment: updateComment,
        progress: newProgress,
    };
    
    const updatedActivities = myActivities.map(activity => {
        if (activity.id === activityId) {
            return {
                ...activity,
                pendingUpdate: newPendingUpdate,
            };
        }
        return activity;
    });
    setMyActivities(updatedActivities);
    
    // In a real app, you would save this to the backend.
    // For now, we simulate by updating the state of another component
    // We can use a custom event for this if needed, or rely on a shared state management
    
    toast({
        title: "Update Submitted",
        description: `Your progress update for "${updatedActivities.find(a => a.id === activityId)?.title}" has been submitted for review.`,
    });
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
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">My Activity</h1>
        <p className="text-muted-foreground">
          Your personal dashboard for managing all assigned tasks and tracking performance.
        </p>
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
