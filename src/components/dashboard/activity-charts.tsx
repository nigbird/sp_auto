
"use client";

import type { Activity } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from "recharts";
import { useMemo } from "react";

const chartConfig = {
  progress: {
    label: "Progress",
  },
  "Not Started": {
    label: "Not Started",
    color: "hsl(var(--chart-2))",
  },
  "On Track": {
    label: "On Track",
    color: "hsl(var(--chart-3))",
  },
  "Completed As Per Target": {
    label: "Completed",
    color: "hsl(var(--chart-1))",
  },
  "Delayed": {
    label: "Delayed",
    color: "hsl(var(--chart-4))",
  },
};

type ActivityChartsProps = { 
    activities: Activity[], 
    allActivities: Activity[],
    onDepartmentSelect: (department: string | null) => void;
    selectedDepartment: string | null;
};

export function ActivityCharts({ activities, allActivities, onDepartmentSelect, selectedDepartment }: ActivityChartsProps) {
  const departmentProgress = useMemo(() => {
    const departments = [...new Set(allActivities.map((a) => a.department))];
    return departments.map((dept) => {
      const deptActivities = allActivities.filter((a) => a.department === dept);
      const completed = deptActivities.filter(
        (a) => a.status === "Completed As Per Target"
      ).length;
      return {
        department: dept,
        progress: deptActivities.length > 0 ? (completed / deptActivities.length) * 100 : 0,
      };
    });
  }, [allActivities]);

  const activityStatusDistribution = useMemo(() => {
    const statuses: Record<string, number> = {
      "Not Started": 0,
      "On Track": 0,
      "Completed As Per Target": 0,
      "Delayed": 0,
    };
    activities.forEach((activity) => {
      if (activity.status in statuses) {
        statuses[activity.status]++;
      }
    });
    return Object.entries(statuses).map(([name, value]) => ({ name, value, fill: chartConfig[name as keyof typeof chartConfig].color }));
  }, [activities]);

  return (
    <>
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle>Departmental Progress</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart
              data={departmentProgress}
              layout="vertical"
              margin={{ left: 20 }}
              onClick={(e) => e && onDepartmentSelect(e.activePayload?.[0]?.payload.department)}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="department"
                type="category"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                width={100}
              />
              <XAxis dataKey="progress" type="number" hide />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent formatter={(value) => `${Math.round(Number(value))}%`} />}
              />
              <Bar dataKey="progress" radius={5}>
                {departmentProgress.map((entry) => (
                    <Cell 
                        key={`cell-${entry.department}`} 
                        fill={entry.department === selectedDepartment ? "hsl(var(--chart-3))" : "hsl(var(--chart-1))"}
                        className="cursor-pointer"
                    />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Activities by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={activityStatusDistribution}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                strokeWidth={5}
              >
                 {activityStatusDistribution.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="name" />}
                className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
              />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}
