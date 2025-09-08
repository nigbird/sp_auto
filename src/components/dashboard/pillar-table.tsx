
"use client"

import type { Pillar } from "@/lib/types";
import { getPillarActual, getPillarPlan } from "@/lib/utils";
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

export function PillarTable({ pillars }: { pillars: Pillar[] }) {
    const totalPlan = pillars.reduce((sum, p) => sum + getPillarPlan(p), 0);
    const totalActual = pillars.reduce((sum, p) => sum + getPillarActual(p), 0);
    const totalAchievement = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;
    
  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategic Pillar Performance</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
