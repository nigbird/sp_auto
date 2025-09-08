
"use client"

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type StatusDonutChartProps = {
    title: string;
    value: number;
    total: number;
    color: string;
};

const INACTIVE_COLOR = "hsl(var(--muted))";

export function StatusDonutChart({ title, value, total, color }: StatusDonutChartProps) {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const data = [
        { name: "active", value: percentage, color: color },
        { name: "inactive", value: 100 - percentage, color: INACTIVE_COLOR },
    ];

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="w-32 h-32">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="60%"
                            outerRadius="80%"
                            startAngle={90}
                            endAngle={450}
                            paddingAngle={0}
                            stroke="none"
                        >
                            {data.map((entry) => (
                                <Cell key={`cell-${entry.name}`} fill={entry.color} />
                            ))}
                        </Pie>
                         <text
                            x="50%"
                            y="50%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-2xl font-bold fill-foreground"
                        >
                            {`${Math.round(percentage)}%`}
                        </text>
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <p className="font-semibold text-center">{title}</p>
        </div>
    );
}
