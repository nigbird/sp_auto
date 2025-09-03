
"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import {
  getTrafficLightColor,
  getPillarProgress,
  getObjectiveProgress,
  getInitiativeProgress,
} from "@/lib/utils";
import type { Pillar, Objective, Initiative, Activity } from "@/lib/types";

export function ReportTable({ data }: { data: Pillar[] }) {
  const [openPillars, setOpenPillars] = React.useState<Record<string, boolean>>({});
  const [openObjectives, setOpenObjectives] = React.useState<Record<string, boolean>>({});
  const [openInitiatives, setOpenInitiatives] = React.useState<Record<string, boolean>>({});

  const togglePillar = (id: string) => setOpenPillars((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleObjective = (id: string) => setOpenObjectives((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleInitiative = (id: string) => setOpenInitiatives((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-4">
       <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm"><FileDown className="mr-2 h-4 w-4" /> Export to Excel</Button>
        <Button variant="outline" size="sm"><FileDown className="mr-2 h-4 w-4" /> Export to PDF</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Title</TableHead>
              <TableHead>Owner/Lead</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead className="text-right">Progress</TableHead>
            </TableRow>
          </TableHeader>
            {data.map((pillar) => (
              <PillarRow
                key={pillar.id}
                pillar={pillar}
                isOpen={!!openPillars[pillar.id]}
                onToggle={() => togglePillar(pillar.id)}
                openObjectives={openObjectives}
                toggleObjective={toggleObjective}
                openInitiatives={openInitiatives}
                toggleInitiative={toggleInitiative}
              />
            ))}
        </Table>
      </div>
    </div>
  );
}

const PillarRow = ({ pillar, isOpen, onToggle, ...props }: { pillar: Pillar; isOpen: boolean; onToggle: () => void; [key: string]: any }) => {
  const progress = getPillarProgress(pillar);
  return (
     <Collapsible asChild open={isOpen} onOpenChange={onToggle} tagName="tbody">
      <>
        <TableRow className="bg-muted/50 hover:bg-muted/60">
          <TableCell>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 font-bold text-base cursor-pointer">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {pillar.title}
              </div>
            </CollapsibleTrigger>
          </TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span className="font-bold">{progress}%</span>
              <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(progress)}`}></div>
            </div>
          </TableCell>
        </TableRow>
        <CollapsibleContent asChild>
            <TableRow>
                <TableCell colSpan={7} className="p-0">
                    <Table>
                        <TableBody>
                        {pillar.objectives.map((objective) => (
                        <ObjectiveRow
                            key={objective.id}
                            objective={objective}
                            isOpen={!!props.openObjectives[objective.id]}
                            onToggle={() => props.toggleObjective(objective.id)}
                            openInitiatives={props.openInitiatives}
                            toggleInitiative={props.toggleInitiative}
                            className="bg-card"
                        />
                        ))}
                        </TableBody>
                    </Table>
                </TableCell>
            </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
};

const ObjectiveRow = ({ objective, isOpen, onToggle, ...props }: { objective: Objective; isOpen: boolean; onToggle: () => void; [key: string]: any }) => {
  const progress = getObjectiveProgress(objective);
  return (
    <Collapsible asChild open={isOpen} onOpenChange={onToggle} tagName="tbody">
      <>
        <TableRow className="hover:bg-accent/10">
          <TableCell className="w-[40%]">
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 pl-6 font-semibold cursor-pointer">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {objective.title}
              </div>
            </CollapsibleTrigger>
          </TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell>{objective.weight}%</TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span>{progress}%</span>
              <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(progress)}`}></div>
            </div>
          </TableCell>
        </TableRow>
        <CollapsibleContent asChild>
            <TableRow>
                <TableCell colSpan={7} className="p-0">
                    <Table>
                        <TableBody>
                        {objective.initiatives.map((initiative) => (
                        <InitiativeRow
                            key={initiative.id}
                            initiative={initiative}
                            isOpen={!!props.openInitiatives[initiative.id]}
                            onToggle={() => props.toggleInitiative(initiative.id)}
                        />
                        ))}
                        </TableBody>
                    </Table>
                </TableCell>
            </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
};

const InitiativeRow = ({ initiative, isOpen, onToggle }: { initiative: Initiative; isOpen: boolean; onToggle: () => void }) => {
  const progress = getInitiativeProgress(initiative);
  return (
     <Collapsible asChild open={isOpen} onOpenChange={onToggle} tagName="tbody">
        <>
        <TableRow className="hover:bg-accent/5">
          <TableCell className="w-[40%]">
            <CollapsibleTrigger asChild>
               <div className="flex items-center gap-2 pl-12 font-medium cursor-pointer">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {initiative.title}
              </div>
            </CollapsibleTrigger>
          </TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell></TableCell>
          <TableCell>{initiative.weight}%</TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
                <span>{progress}%</span>
                <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(progress)}`}></div>
            </div>
          </TableCell>
        </TableRow>
        <CollapsibleContent asChild>
            <TableRow>
                <TableCell colSpan={7} className="p-0">
                    <Table>
                        <TableBody>
                        {initiative.activities.map((activity) => (
                        <ActivityRow key={activity.id} activity={activity} />
                        ))}
                        </TableBody>
                    </Table>
                </TableCell>
            </TableRow>
        </CollapsibleContent>
        </>
      </Collapsible>
  );
};

const ActivityRow = ({ activity }: { activity: Activity }) => {
  return (
    <TableRow>
      <TableCell className="w-[40%] pl-20">{activity.title}</TableCell>
      <TableCell>{activity.responsible}</TableCell>
      <TableCell>{format(activity.startDate, "PP")}</TableCell>
      <TableCell>{format(activity.endDate, "PP")}</TableCell>
      <TableCell>
        <StatusBadge status={activity.status} />
      </TableCell>
      <TableCell>{activity.weight}%</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
            <span>{activity.progress}%</span>
            <div className={`w-3 h-3 rounded-full ${getTrafficLightColor(activity.progress)}`}></div>
        </div>
      </TableCell>
    </TableRow>
  );
};
