
"use client";

import { useState, useMemo } from "react";
import type { Activity, Pillar, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusDonutChart } from "./status-donut-chart";
import { calculateWeightedProgress } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";

type DepartmentalDashboardProps = {
    activities: Activity[];
    departments: string[];
    users: User[];
    pillars: Pillar[];
    selectedUnit: string;
    onUnitChange: (unit: string, type: 'department' | 'user') => void;
}

export function DepartmentalDashboard({ activities, departments, users, selectedUnit, onUnitChange }: DepartmentalDashboardProps) {

    const filteredActivities = useMemo(() => {
        if (selectedUnit === "All") {
            return activities;
        }
        // This logic needs to know if the selected unit is a department or a user.
        // The parent component now handles the filtering, so we can simplify here.
        const isDepartment = departments.includes(selectedUnit);
        if (isDepartment) {
            return activities.filter(a => a.department === selectedUnit);
        } else {
            return activities.filter(a => (a.responsible as User)?.name === selectedUnit);
        }

    }, [activities, selectedUnit, departments]);

    const overallWeightedProgress = useMemo(() => {
        return calculateWeightedProgress(filteredActivities);
    }, [filteredActivities]);

    const statusCounts = useMemo(() => {
        const counts = {
            "Completed As Per Target": 0,
            "On Track": 0,
            "Delayed": 0,
            "Not Started": 0,
            "Overdue": 0
        };
        filteredActivities.forEach(activity => {
            if (activity.status in counts) {
                counts[activity.status as keyof typeof counts]++;
            }
        });
        // Combine Overdue into Delayed for the chart
        counts.Delayed += counts.Overdue;
        return counts;
    }, [filteredActivities]);

    const totalFilteredActivities = filteredActivities.length;

    const departmentButtons = departments.map(dept => (
        <Button 
            key={dept}
            variant={selectedUnit === dept ? "default" : "outline"}
            onClick={() => onUnitChange(dept, 'department')}
            className={cn(
                "w-full justify-start text-left truncate",
                selectedUnit === dept && "bg-primary text-primary-foreground"
            )}
        >
            {dept}
        </Button>
    ));

    const userButtons = users.map(user => (
         <Button 
            key={user.id}
            variant={selectedUnit === user.name ? "default" : "outline"}
            onClick={() => onUnitChange(user.name, 'user')}
            className={cn(
                "w-full justify-start text-left truncate",
                selectedUnit === user.name && "bg-primary text-primary-foreground"
            )}
        >
            {user.name}
        </Button>
    ));

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-4 space-y-4">
                    <h2 className="text-lg font-semibold mb-3">Responsible Units</h2>
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Departments</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                           {departmentButtons}
                        </div>
                    </div>
                    <Separator />
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Individuals</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                           {userButtons}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weighted Percentage Indicator */}
                <Card className="lg:col-span-1">
                    <CardContent className="flex flex-col items-center justify-center p-6 h-full">
                         <div className="relative flex items-center justify-center w-48 h-48 rounded-2xl bg-gray-700 shadow-2xl p-4">
                            <div className="absolute w-40 h-40 rounded-full bg-yellow-300 flex items-center justify-center shadow-inner">
                                <span className="text-4xl font-bold text-gray-800">{overallWeightedProgress.toFixed(1)}%</span>
                            </div>
                        </div>
                        <p className="mt-4 text-lg font-semibold text-muted-foreground">WEIGHTED PER</p>
                    </CardContent>
                </Card>
                
                {/* Status Charts */}
                <Card className="lg:col-span-2">
                    <CardContent className="p-6">
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center justify-items-center">
                            <StatusDonutChart 
                                title="Completed"
                                value={statusCounts["Completed As Per Target"]}
                                total={totalFilteredActivities}
                                color="hsl(var(--chart-1))"
                            />
                             <StatusDonutChart 
                                title="On the Right Track"
                                value={statusCounts["On Track"]}
                                total={totalFilteredActivities}
                                color="hsl(var(--chart-3))"
                            />
                            <StatusDonutChart 
                                title="Delayed"
                                value={statusCounts["Delayed"]}
                                total={totalFilteredActivities}
                                color="hsl(var(--chart-4))"
                            />
                            <StatusDonutChart 
                                title="Not Started"
                                value={statusCounts["Not Started"]}
                                total={totalFilteredActivities}
                                color="hsl(var(--chart-2))"
                            />
                       </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
