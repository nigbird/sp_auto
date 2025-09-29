
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { Pillar, Activity, User, StrategicPlan } from "@/lib/types";
import { PillarTable } from "@/components/dashboard/pillar-table";
import { DepartmentalDashboard } from "./departmental-dashboard";
import { getActivities } from "@/actions/activities";
import { getStrategicPlanById } from "@/actions/strategic-plan";
import { Loader2 } from "lucide-react";
import { ReportSummaryCards } from "../reports/summary-cards";
import { generateReportSummary } from "@/lib/utils";

type DashboardClientLayoutProps = {
    initialPillars: Pillar[];
    initialActivities: Activity[];
    allPlans: StrategicPlan[];
    initialPlanId?: string;
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


export function DashboardClientLayout({ initialPillars, initialActivities, allPlans, initialPlanId, departments, users }: DashboardClientLayoutProps) {
    const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(initialPlanId);
    const [currentPillars, setCurrentPillars] = useState<Pillar[]>(initialPillars);
    const [currentActivities, setCurrentActivities] = useState<Activity[]>(initialActivities);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    
    const [selectedUnit, setSelectedUnit] = useState<string>("All");
    const [unitType, setUnitType] = useState<'department' | 'user' | 'all'>('all');

    const handlePlanChange = useCallback(async (planId: string) => {
        setIsLoading(true);
        setSelectedPlanId(planId);
        setSelectedUnit("All");
        setUnitType("all");

        const [planDetails, activities] = await Promise.all([
             getStrategicPlanById(planId),
             getActivities(planId)
        ]);

        if (planDetails) {
            setCurrentPillars(planDetails.pillars);
        }
        setCurrentActivities(activities);
        setIsLoading(false);
    }, []);
    
    useEffect(() => {
        if(initialPlanId) {
            handlePlanChange(initialPlanId);
        }
    }, [initialPlanId, handlePlanChange]);


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
        if (!selectedPlanId) return [];
        const pillarsForPlan = currentPillars;
        return filterPillarsByResponsibleUnit(pillarsForPlan, selectedUnit === "All" ? null : selectedUnit, unitType as 'department' | 'user');
    }, [currentPillars, selectedPlanId, selectedUnit, unitType]);

    const summary = useMemo(() => {
        return generateReportSummary(currentPillars);
    }, [currentPillars]);

    return (
        <div className="space-y-6">
            <ReportSummaryCards summary={summary} />
            <DepartmentalDashboard 
                activities={currentActivities}
                departments={departments}
                users={users}
                pillars={currentPillars}
                selectedUnit={selectedUnit}
                onUnitChange={handleUnitChange}
                plans={allPlans}
                selectedPlanId={selectedPlanId}
                onPlanChange={handlePlanChange}
                isLoading={isLoading}
            />
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <PillarTable pillars={filteredReportData} />
            )}
        </div>
    )
}
