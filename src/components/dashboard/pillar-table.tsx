
"use client"

import { useState } from "react";
import type { Pillar, Objective } from "@/lib/types";
import { getPillarActual, getPillarPlan, getObjectiveProgress, getObjectiveWeight } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

function PillarPerformanceTable({ pillars }: { pillars: Pillar[] }) {
    const totalPlan = pillars.reduce((sum, p) => sum + getPillarPlan(p), 0);
    const totalActual = pillars.reduce((sum, p) => sum + getPillarActual(p), 0);
    const totalAchievement = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;
    
  return (
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/10 hover:bg-primary/20">
              <TableHead className="font-bold text-primary">STRATEGIC PILLAR</TableHead>
              <TableHead className="text-right font-bold text-primary">Plan</TableHead>
              <TableHead className="text-right font-bold text-primary">Actual</TableHead>
              <TableHead className="text-right font-bold text-primary">AVERAGE WEIGHTED ACHIEVEMENT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pillars.map((pillar) => {
              const plan = getPillarPlan(pillar);
              const actual = getPillarActual(pillar);
              const achievement = plan > 0 ? (actual / plan) * 100 : 0;
              return (
                <TableRow key={pillar.id}>
                  <TableCell className="font-medium">{pillar.title}</TableCell>
                  <TableCell className="text-right">{plan.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{actual.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{achievement.toFixed(0)}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-primary/20 font-bold hover:bg-primary/30">
              <TableCell>Total Average Performance</TableCell>
              <TableCell className="text-right">{totalPlan.toFixed(1)}</TableCell>
              <TableCell className="text-right">{totalActual.toFixed(1)}</TableCell>
              <TableCell className="text-right">{totalAchievement.toFixed(1)}%</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
  );
}

function ObjectivePerformanceTable({ pillars }: { pillars: Pillar[] }) {
    const allObjectives = pillars.flatMap(p => 
        p.objectives.map(o => ({ ...o, pillarTitle: p.title }))
    );

    const totalPlan = allObjectives.reduce((sum, o) => sum + (getObjectiveWeight(o) / 100), 0);
    const totalActual = allObjectives.reduce((sum, o) => sum + (getObjectiveProgress(o)/100 * getObjectiveWeight(o)/100), 0);
    const totalAchievement = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;

  return (
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/10 hover:bg-primary/20">
              <TableHead className="font-bold text-primary">STRATEGIC OBJECTIVE</TableHead>
              <TableHead className="font-bold text-primary">PILLAR</TableHead>
              <TableHead className="text-right font-bold text-primary">Plan</TableHead>
              <TableHead className="text-right font-bold text-primary">Actual</TableHead>
              <TableHead className="text-right font-bold text-primary">AVERAGE WEIGHTED ACHIEVEMENT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allObjectives.map((objective) => {
              const plan = getObjectiveWeight(objective) / 100;
              const actual = (getObjectiveProgress(objective) / 100) * plan;
              const achievement = plan > 0 ? (actual / plan) * 100 : 0;
              return (
                <TableRow key={objective.id}>
                  <TableCell className="font-medium">{objective.statement}</TableCell>
                  <TableCell>{objective.pillarTitle}</TableCell>
                  <TableCell className="text-right">{plan.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{actual.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{achievement.toFixed(0)}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-primary/20 font-bold hover:bg-primary/30">
              <TableCell colSpan={2}>Total Average Performance</TableCell>
              <TableCell className="text-right">{totalPlan.toFixed(1)}</TableCell>
              <TableCell className="text-right">{totalActual.toFixed(1)}</TableCell>
              <TableCell className="text-right">{totalAchievement.toFixed(1)}%</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
  );
}


export function PillarTable({ pillars }: { pillars: Pillar[] }) {
    const [activeTab, setActiveTab] = useState<'pillars' | 'objectives'>('pillars');
    
  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategic Performance</CardTitle>
          <div className="flex space-x-2 border-b-2 border-transparent py-2">
            <Button
              variant="ghost"
              onClick={() => setActiveTab('pillars')}
              className={cn(
                "rounded-none border-b-2 border-transparent pb-1 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary",
                activeTab === 'pillars' && "border-primary font-semibold text-primary"
              )}
            >
              Pillars
            </Button>
            <Button
              variant="ghost"
              onClick={() => setActiveTab('objectives')}
               className={cn(
                "rounded-none border-b-2 border-transparent pb-1 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary",
                activeTab === 'objectives' && "border-primary font-semibold text-primary"
              )}
            >
              Objectives
            </Button>
          </div>
      </CardHeader>
      <CardContent>
        {activeTab === 'pillars' ? <PillarPerformanceTable pillars={pillars} /> : <ObjectivePerformanceTable pillars={pillars} />}
      </CardContent>
    </Card>
  );
}
