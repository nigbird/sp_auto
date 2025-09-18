
"use client";

import { useState, useMemo } from "react";
import type { Pillar, Activity } from "@/lib/types";
import { PillarTable } from "@/components/dashboard/pillar-table";
import { DepartmentalDashboard } from "./departmental-dashboard";

type DashboardClientLayoutProps = {
    initialReportData: Pillar[];
    allActivities: Activity[];
    departments: string[];
}

function filterPillarsByDepartment(pillars: Pillar[], department: string | null): Pillar[] {
    if (!department || department === "All") return pillars;

    return pillars.map(pillar => ({
        ...pillar,
        objectives: pillar.objectives.map(objective => ({
            ...objective,
            initiatives: objective.initiatives.map(initiative => ({
                ...initiative,
                activities: initiative.activities.filter(activity => activity.department === department),
            })).filter(initiative => initiative.activities.length > 0)
        })).filter(objective => objective.initiatives.length > 0)
    })).filter(pillar => pillar.objectives.length > 0);
}


export function DashboardClientLayout({ initialReportData, allActivities, departments }: DashboardClientLayoutProps) {
    const [selectedDepartment, setSelectedDepartment] = useState<string>("All");

    const filteredReportData = useMemo(() => {
        return filterPillarsByDepartment(initialReportData, selectedDepartment === "All" ? null : selectedDepartment);
    }, [initialReportData, selectedDepartment]);

    return (
        <div className="space-y-6">
            <DepartmentalDashboard 
                activities={allActivities}
                departments={departments}
                pillars={initialReportData}
                selectedDepartment={selectedDepartment}
                onDepartmentChange={setSelectedDepartment}
            />
            <PillarTable pillars={filteredReportData} />
        </div>
    )
}
