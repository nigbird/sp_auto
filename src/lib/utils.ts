import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Pillar, Objective, Initiative, Activity, ActivityStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function calculateWeightedProgress(items: { weight: number; progress: number }[]): number {
  if (items.length === 0) return 0;
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = items.reduce((sum, item) => sum + item.progress * item.weight, 0);
  return Math.round(weightedSum / totalWeight);
}

export const getInitiativeProgress = (initiative: Initiative) => calculateWeightedProgress(initiative.activities);
export const getObjectiveProgress = (objective: Objective) => calculateWeightedProgress(
    objective.initiatives.map(i => ({...i, progress: getInitiativeProgress(i) }))
);
export const getPillarProgress = (pillar: Pillar) => calculateWeightedProgress(
    pillar.objectives.map(o => ({...o, progress: getObjectiveProgress(o) }))
);


export const getTrafficLightColor = (progress: number) => {
  if (progress >= 80) return "bg-green-500";
  if (progress >= 50) return "bg-yellow-500";
  return "bg-red-500";
};

export interface ReportSummary {
  totalPillars: number;
  totalObjectives: number;
  totalInitiatives: number;
  totalActivities: number;
  overallProgress: number;
  overdueActivities: number;
}

export function generateReportSummary(pillars: Pillar[]): ReportSummary {
  let totalObjectives = 0;
  let totalInitiatives = 0;
  let totalActivities = 0;
  let overdueActivities = 0;

  pillars.forEach(pillar => {
    totalObjectives += pillar.objectives.length;
    pillar.objectives.forEach(objective => {
      totalInitiatives += objective.initiatives.length;
      objective.initiatives.forEach(initiative => {
        totalActivities += initiative.activities.length;
        initiative.activities.forEach(activity => {
          if (activity.status === "Delayed" || (activity.endDate < new Date() && activity.status !== 'Completed')) {
            overdueActivities++;
          }
        });
      });
    });
  });

  const overallProgress = calculateWeightedProgress(
    pillars.map(p => ({ weight: 1, progress: getPillarProgress(p) }))
  );

  return {
    totalPillars: pillars.length,
    totalObjectives,
    totalInitiatives,
    totalActivities,
    overallProgress,
    overdueActivities,
  };
}
