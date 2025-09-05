
"use client";

import { useEffect, useState, useMemo } from "react";
import { getActivities } from "@/lib/data";
import type { Activity, ActivityStatus, ActivityUpdate } from "@/lib/types";
import { MyActivitySummaryCards } from "@/components/my-activity/my-activity-summary-cards";
import { MyActivityTaskList } from "@/components/my-activity/my-activity-task-list";
import { useToast } from "@/hooks/use-toast";
import { calculateActivityStatus } from "@/lib/utils";

type FilterType = "Delayed" | "Not Started" | "On Track" | "Completed As Per Target" | "Overdue";

export default function MyActivityPage() {
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("Delayed");
  const { toast } = useToast();

  useEffect(() => {
    async function loadActivities() {
      const activities = await getActivities();
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
      default:
        setFilteredActivities(overdueActivities);
    }
  }, [activeFilter, overdueActivities, pendingActivities, activeActivities, completedActivities]);

  const handleUpdateActivity = (
    activityId: string,
    newProgress: number,
    newStatus: ActivityStatus,
    updateComment: string
  ) => {
    // In a real app, this would be a call to a server action or API endpoint.
    const newUpdate: ActivityUpdate = {
        user: "Liam Johnson", // Hardcoded for demo
        date: new Date(),
        comment: updateComment,
    };
    
    const updatedActivities = myActivities.map(activity => {
        if (activity.id === activityId) {
            const status = calculateActivityStatus({ ...activity, progress: newProgress });
            return {
                ...activity,
                progress: newProgress,
                status: status,
                updates: [...activity.updates, newUpdate],
                lastUpdated: { user: newUpdate.user, date: newUpdate.date }
            };
        }
        return activity;
    });
    setMyActivities(updatedActivities);

    toast({
        title: "Activity Updated",
        description: `Progress for "${updatedActivities.find(a => a.id === activityId)?.title}" has been saved.`,
    });
  };

  const taskListTitle = useMemo(() => {
    const titles: Record<FilterType, string> = {
      Delayed: "Overdue",
      "Not Started": "Pending",
      "On Track": "Active",
      "Completed As Per Target": "Completed",
      "Overdue": "Overdue"
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
      />
      <MyActivityTaskList 
        title={taskListTitle} 
        count={filteredActivities.length} 
        activities={filteredActivities} 
        onUpdateActivity={handleUpdateActivity}
      />
    </div>
  );
}
