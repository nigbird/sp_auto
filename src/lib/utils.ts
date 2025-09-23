

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
  return weightedSum / totalWeight;
}


function sumActivityWeights(activities: Activity[]): number {
    return activities.reduce((sum, activity) => sum + activity.weight, 0);
}

export const getInitiativeWeight = (initiative: Initiative): number => {
    return sumActivityWeights(initiative.activities);
}

export const getObjectiveWeight = (objective: Objective): number => {
    return objective.initiatives.reduce((sum, initiative) => {
        return sum + getInitiativeWeight(initiative);
    }, 0);
}

export const getPillarWeight = (pillar: Pillar): number => {
     return pillar.objectives.reduce((sum, objective) => {
        return sum + getObjectiveWeight(objective);
    }, 0);
}


export const getInitiativeProgress = (initiative: Initiative): number => {
    return calculateWeightedProgress(initiative.activities);
};

export const getObjectiveProgress = (objective: Objective): number => {
    const initiativesWithProgress = objective.initiatives.map(i => {
        return {
            progress: getInitiativeProgress(i),
            weight: getInitiativeWeight(i)
        };
    });
    return calculateWeightedProgress(initiativesWithProgress);
};

export const getPillarProgress = (pillar: Pillar): number => {
    const objectivesWithProgress = pillar.objectives.map(o => {
        return {
            progress: getObjectiveProgress(o),
            weight: getObjectiveWeight(o)
        };
    });
    return calculateWeightedProgress(objectivesWithProgress);
};


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
          if (activity.status === "Delayed" || (new Date(activity.endDate) < new Date() && activity.status !== 'Completed As Per Target')) {
            overdueActivities++;
          }
        });
      });
    });
  });

  const overallProgress = calculateWeightedProgress(
    pillars.map(p => ({ weight: getPillarWeight(p), progress: getPillarProgress(p) }))
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

export function calculateActivityStatus(activity: { progress: number; startDate: Date; endDate: Date }): ActivityStatus {
  const { progress, startDate, endDate } = activity;
  const now = new Date();

  if (progress >= 100) {
    return "Completed As Per Target";
  }

  if (now > endDate) {
    if (progress === 0) {
        return "Overdue";
    }
    return "Delayed";
  }
  
  if (progress === 0) {
    if (now < startDate) {
      return "Not Started";
    }
    // after start date but before end date
    return "Delayed";
  }
  
  // In-progress
  if (progress < 70) {
    return "Delayed";
  }

  return "On Track";
}

function sumWeights(items: { weight: number }[]): number {
    if (items.length === 0) return 0;
    return items.reduce((sum, item) => sum + item.weight, 0) / 100;
}

function sumActual(items: { weight: number, progress: number }[]): number {
    if (items.length === 0) return 0;
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if(totalWeight === 0) return 0;
    const weightedSum = items.reduce((sum, item) => sum + (item.progress/100 * item.weight), 0);
    return weightedSum / 100;
}

export function getPillarPlan(pillar: Pillar): number {
    let totalPlan = 0;
    pillar.objectives.forEach(objective => {
        objective.initiatives.forEach(initiative => {
            totalPlan += sumWeights(initiative.activities);
        });
    });
    return totalPlan;
}

export function getPillarActual(pillar: Pillar): number {
    let totalActual = 0;
    pillar.objectives.forEach(objective => {
        objective.initiatives.forEach(initiative => {
            totalActual += sumActual(initiative.activities);
        });
    });
    return totalActual;
}
