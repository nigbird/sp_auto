
"use client";

import { useState } from "react";
import { BarChart, List } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

const performanceData = [
    { director: 'Senior Director Risk Management & Compliance', achievement: 100.0, rating: 'Excellent' },
    { director: 'Senior Director Enterprise Program Management', achievement: 100.0, rating: 'Excellent' },
    { director: 'Director, Legal Services', achievement: 66.7, rating: 'Fair' },
    { director: 'Chief Wholesale Banking Officer', achievement: 100.0, rating: 'Excellent' },
    { director: 'Deputy Chief IFB Officer', achievement: 100.0, rating: 'Excellent' },
    { director: 'Deputy Chief Credit Operations Officer', achievement: 100.0, rating: 'Excellent' },
    { director: 'Chief Strategy Officer', achievement: 100.0, rating: 'Excellent' },
    { director: 'Chief Information Officer', achievement: 36.8, rating: 'Poor' },
    { director: 'Deputy Chief Digital Banking Officer', achievement: 74.8, rating: 'Good' },
    { director: 'Chief Finance Officer', achievement: 0.0, rating: 'Poor' },
];

const getPerformanceColor = (achievement: number) => {
    if (achievement >= 80) return "from-chart-1/80 to-chart-1/90 bg-gradient-to-r";
    if (achievement >= 50) return "from-chart-3/80 to-chart-3/90 bg-gradient-to-r";
    return "from-chart-4/90 to-chart-4/100 bg-gradient-to-r";
};

const getRatingBadgeClass = (rating: string) => {
    switch (rating) {
        case 'Excellent':
            return 'bg-green-100 text-green-800 border-green-300';
        case 'Good':
        case 'Fair':
            return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'Poor':
            return 'bg-red-100 text-red-800 border-red-300';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-300';
    }
}


export function DirectorsPerformance() {
    const [view, setView] = useState<'chart' | 'table'>('chart');

    return (
        <Card className="shadow-lg rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Streams & Directors Performance</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant={view === 'chart' ? 'default' : 'outline'} size="sm" onClick={() => setView('chart')}>
                        <BarChart className="mr-2 h-4 w-4" />
                        Chart View
                    </Button>
                    <Button variant={view === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setView('table')}>
                        <List className="mr-2 h-4 w-4" />
                        Table View
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {view === 'chart' ? (
                    <div className="space-y-1">
                        {performanceData.map((item, index) => (
                            <div key={index} className={cn("grid grid-cols-[1fr_2fr] items-center gap-4 p-2 rounded-md", index % 2 !== 0 && "bg-muted/50")}>
                                <p className="truncate text-sm font-medium text-right text-muted-foreground">{item.director}</p>
                                <div className="relative w-full flex items-center">
                                    <Progress value={item.achievement} className="h-6 bg-muted/30 rounded-full shadow-inner" indicatorClassName={cn("rounded-full shadow-md", getPerformanceColor(item.achievement))} />
                                     <div 
                                        className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center size-8 rounded-full bg-background/80 shadow-md border"
                                        style={{ left: `calc(${item.achievement}% - 16px)`}}
                                     >
                                         <span className="text-xs font-bold text-foreground">
                                             {item.achievement.toFixed(0)}%
                                         </span>
                                     </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Director Name</TableHead>
                                <TableHead className="text-right">Achievement %</TableHead>
                                <TableHead className="text-center">Rating</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {performanceData.map((item, index) => (
                                <TableRow key={index} className={cn(index % 2 !== 0 && "bg-muted/50")}>
                                    <TableCell className="font-medium">{item.director}</TableCell>
                                    <TableCell className="text-right font-semibold">{item.achievement.toFixed(1)}%</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={cn("font-semibold", getRatingBadgeClass(item.rating))}>
                                            {item.rating}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
