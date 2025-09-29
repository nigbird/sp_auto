
"use client";

import { useState, useMemo } from "react";
import type { Pillar, Activity, User } from "@/lib/types";
import { PillarTable } from "@/components/dashboard/pillar-table";
import { DepartmentalDashboard } from "./departmental-dashboard";

type DashboardClientLayoutProps = {
    initialReportData: Pillar[];
    allActivities: Activity[];
    departments: string[];
    users: User[];
}

function filterPillarsByResponsibleUnit(pillars: Pillar[], unit: string | null, unitType: 'department' | 'user'): Pillar[] {
    if (!unit || unit === "All") return pillars;

    return pillars.map(pillar => ({
        ...pillar,
        objectives: pillar.objectives.map(objective => ({
            ...objective,
            initiatives: objective.initiatives.map(initiative => ({
                ...initiative,
                activities: initiative.activities.filter(activity => {
                    if (unitType === 'department') {
                        return activity.department === unit;
                    } else { // 'user'
                        return (activity.responsible as User)?.name === unit;
                    }
                }),
            })).filter(initiative => initiative.activities.length > 0)
        })).filter(objective => objective.initiatives.length > 0)
    })).filter(pillar => pillar.objectives.length > 0);
}


export function DashboardClientLayout({ initialReportData, allActivities, departments, users }: DashboardClientLayoutProps) {
    const [selectedUnit, setSelectedUnit] = useState<string>("All");
    const [unitType, setUnitType] = useState<'department' | 'user' | 'all'>('all');

    const handleUnitChange = (unit: string, type: 'department' | 'user') => {
        if (unit === "All") {
            setSelectedUnit("All");
            setUnitType("all");
        } else {
            setSelectedUnit(unit);
            setUnitType(type);
        }
    };
    
    const filteredReportData = useMemo(() => {
        return filterPillarsByResponsibleUnit(initialReportData, selectedUnit === "All" ? null : selectedUnit, unitType as 'department' | 'user');
    }, [initialReportData, selectedUnit, unitType]);

    return (
        <div className="space-y-6">
            <DepartmentalDashboard 
                activities={allActivities}
                departments={departments}
                users={users}
                pillars={initialReportData}
                selectedUnit={selectedUnit}
                onUnitChange={handleUnitChange}
            />
            <PillarTable pillars={filteredReportData} />
        </div>
    )
}
