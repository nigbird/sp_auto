
"use client";

import { useState, useMemo } from "react";
import type { Pillar, Activity } from "@/lib/types";
import { ActivityCharts } from "@/components/dashboard/activity-charts";
import { PillarTable } from "@/components/dashboard/pillar-table";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type DashboardClientLayoutProps = {
    initialReportData: Pillar[];
    allActivities: Activity[];
    departments: string[];
}

function filterPillarsByDepartment(pillars: Pillar[], department: string | null): Pillar[] {
    if (!department) return pillars;

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
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

    const filteredActivities = useMemo(() => {
        if (!selectedDepartment) return allActivities;
        return allActivities.filter(a => a.department === selectedDepartment);
    }, [allActivities, selectedDepartment]);

    const filteredReportData = useMemo(() => {
        return filterPillarsByDepartment(initialReportData, selectedDepartment);
    }, [initialReportData, selectedDepartment]);

    return (
        <div className="space-y-6">
            {selectedDepartment && (
                 <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Showing Performance for: <span className="text-primary">{selectedDepartment}</span>
                    </h2>
                    <Button variant="ghost" onClick={() => setSelectedDepartment(null)}>
                        <X className="mr-2 h-4 w-4" />
                        Clear Filter
                    </Button>
                </div>
            )}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <ActivityCharts 
                    activities={filteredActivities}
                    allActivities={allActivities}
                    onDepartmentSelect={setSelectedDepartment}
                    selectedDepartment={selectedDepartment}
                />
                <PillarTable pillars={filteredReportData} />
            </div>
        </div>
    )
}
