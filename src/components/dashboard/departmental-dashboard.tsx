
"use client";

import { useState, useMemo } from "react";
import type { Activity, Pillar } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusDonutChart } from "./status-donut-chart";
import { calculateWeightedProgress } from "@/lib/utils";
import { cn } from "@/lib/utils";

type DepartmentalDashboardProps = {
    activities: Activity[];
    departments: string[];
    pillars: Pillar[];
    selectedDepartment: string;
    onDepartmentChange: (department: string) => void;
}

export function DepartmentalDashboard({ activities, departments, pillars, selectedDepartment, onDepartmentChange }: DepartmentalDashboardProps) {

    const filteredActivities = useMemo(() => {
        if (selectedDepartment === "All") {
            return activities;
        }
        return activities.filter(a => a.department === selectedDepartment);
    }, [activities, selectedDepartment]);

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

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-4">
                    <h2 className="text-lg font-semibold mb-3">Responsible Units</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                        {departments.map(dept => (
                            <Button 
                                key={dept}
                                variant={selectedDepartment === dept ? "default" : "outline"}
                                onClick={() => onDepartmentChange(dept)}
                                className={cn(
                                    "w-full justify-start text-left truncate",
                                    selectedDepartment === dept && "bg-primary text-primary-foreground"
                                )}
                            >
                                {dept}
                            </Button>
                        ))}
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
