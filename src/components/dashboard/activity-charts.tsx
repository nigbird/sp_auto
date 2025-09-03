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
  Planned: {
    label: "Planned",
    color: "hsl(var(--chart-2))",
  },
  "In Progress": {
    label: "In Progress",
    color: "hsl(var(--chart-3))",
  },
  Completed: {
    label: "Completed",
    color: "hsl(var(--chart-1))",
  },
  Delayed: {
    label: "Delayed",
    color: "hsl(var(--chart-4))",
  },
};

export function ActivityCharts({ activities }: { activities: Activity[] }) {
  const departmentProgress = useMemo(() => {
    const departments = [...new Set(activities.map((a) => a.department))];
    return departments.map((dept) => {
      const deptActivities = activities.filter((a) => a.department === dept);
      const completed = deptActivities.filter(
        (a) => a.status === "Completed"
      ).length;
      return {
        department: dept,
        progress: deptActivities.length > 0 ? (completed / deptActivities.length) * 100 : 0,
      };
    });
  }, [activities]);

  const activityStatusDistribution = useMemo(() => {
    const statuses = {
      Planned: 0,
      "In Progress": 0,
      Completed: 0,
      Delayed: 0,
    };
    activities.forEach((activity) => {
      statuses[activity.status]++;
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
              <Bar dataKey="progress" fill="hsl(var(--chart-1))" radius={5} />
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
