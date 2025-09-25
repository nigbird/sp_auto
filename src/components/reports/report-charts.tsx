'use client';

import { useMemo } from 'react';
import type { Activity, Pillar } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { getPillarProgress } from '@/lib/utils';

const chartConfig = {
  progress: { label: "Progress", color: "hsl(var(--chart-1))" },
  "Not Started": { label: "Not Started", color: "hsl(var(--chart-2))" },
  "On Track": { label: "On Track", color: "hsl(var(--chart-3))" },
  "Completed As Per Target": { label: "Completed", color: "hsl(var(--chart-1))" },
  "Delayed": { label: "Delayed", color: "hsl(var(--chart-4))" },
  "Overdue": { label: "Overdue", color: "hsl(var(--chart-5))" },
};

type ReportChartsProps = {
  activities: Activity[];
  pillars: Pillar[];
};

export function ReportCharts({ activities, pillars }: ReportChartsProps) {
  const statusDistribution = useMemo(() => {
    const counts: { [key: string]: number } = {
      "Not Started": 0,
      "On Track": 0,
      "Delayed": 0,
      "Completed As Per Target": 0,
      "Overdue": 0,
    };
    activities.forEach(activity => {
      if (activity.status in counts) {
        counts[activity.status]++;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ 
        name, 
        value, 
        fill: chartConfig[name as keyof typeof chartConfig]?.color || '#000000'
    }));
  }, [activities]);

  const pillarCompletion = useMemo(() => {
    return pillars.map(pillar => ({
      name: pillar.title,
      progress: getPillarProgress(pillar),
    }));
  }, [pillars]);

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Activities by Status</CardTitle>
          <CardDescription>Distribution of all filtered activities.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie data={statusDistribution} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                {statusDistribution.map(entry => (
                    <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Pillar Completion</CardTitle>
          <CardDescription>Weighted average progress for each strategic pillar.</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={pillarCompletion} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={120} />
              <XAxis dataKey="progress" type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => `${(v as number).toFixed(1)}%`} />} />
              <Bar dataKey="progress" fill="var(--color-progress)" radius={5} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

    