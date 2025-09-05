"use client";

import { ActivityCharts } from "@/components/dashboard/activity-charts";
import { ActivityTable } from "@/components/dashboard/activity-table";
import type { Activity } from "@/lib/types";

type DashboardClientLayoutProps = {
    activities: Activity[];
    users: string[];
    departments: string[];
}

export function DashboardClientLayout({ activities, users, departments }: DashboardClientLayoutProps) {
    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <ActivityCharts activities={activities} />
            </div>
            <ActivityTable activities={activities} users={users} departments={departments} />
        </div>
    )
}
