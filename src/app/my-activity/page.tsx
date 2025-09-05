
"use client";

import { useEffect, useState, useMemo } from "react";
import { getActivities } from "@/lib/data";
import type { Activity, ActivityStatus } from "@/lib/types";
import { MyActivitySummaryCards } from "@/components/my-activity/my-activity-summary-cards";
import { MyActivityTaskList } from "@/components/my-activity/my-activity-task-list";

type FilterType = "Overdue" | "Pending" | "Active" | "Completed";

export default function MyActivityPage() {
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("Overdue");

  useEffect(() => {
    async function loadActivities() {
      const activities = await getActivities();
      setAllActivities(activities);
      // In a real application, this would be based on the logged-in user's identity.
      const userActivities = activities.filter(
        (activity) => activity.responsible === "Liam Johnson" || activity.responsible === "Olivia Smith"
      );
      setMyActivities(userActivities);
    }
    loadActivities();
  }, []);

  const overdueActivities = useMemo(() => myActivities.filter(a => a.status === 'Delayed'), [myActivities]);
  const pendingActivities = useMemo(() => myActivities.filter(a => a.status === 'Planned'), [myActivities]);
  const activeActivities = useMemo(() => myActivities.filter(a => a.status === 'In Progress'), [myActivities]);
  const completedActivities = useMemo(() => myActivities.filter(a => a.status === 'Completed'), [myActivities]);

  useEffect(() => {
    switch (activeFilter) {
      case "Overdue":
        setFilteredActivities(overdueActivities);
        break;
      case "Pending":
        setFilteredActivities(pendingActivities);
        break;
      case "Active":
        setFilteredActivities(activeActivities);
        break;
      case "Completed":
        setFilteredActivities(completedActivities);
        break;
      default:
        setFilteredActivities(overdueActivities);
    }
  }, [activeFilter, overdueActivities, pendingActivities, activeActivities, completedActivities]);

  const taskListTitle = useMemo(() => {
    const titles: Record<FilterType, string> = {
      Overdue: "Overdue",
      Pending: "Pending",
      Active: "Active",
      Completed: "Completed",
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
      />
    </div>
  );
}
