
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


function sumActivityWeights(activities: Activity[]): number {
    return activities.reduce((sum, activity) => sum + activity.weight, 0);
}

function sumInitiativeWeights(initiatives: Initiative[]): number {
    return initiatives.reduce((sum, initiative) => {
        initiative.weight = sumActivityWeights(initiative.activities);
        return sum + initiative.weight;
    }, 0);
}

function sumObjectiveWeights(objectives: Objective[]): number {
    return objectives.reduce((sum, objective) => {
        objective.weight = sumInitiativeWeights(objective.initiatives);
        return sum + objective.weight;
    }, 0);
}

export const getInitiativeProgress = (initiative: Initiative): number => {
    initiative.weight = sumActivityWeights(initiative.activities);
    return calculateWeightedProgress(initiative.activities);
};

export const getObjectiveProgress = (objective: Objective): number => {
    const progressWithCalculatedWeights = objective.initiatives.map(i => {
        return {
            ...i,
            progress: getInitiativeProgress(i),
            weight: i.weight // weight is now calculated inside getInitiativeProgress
        };
    });
    objective.weight = sumInitiativeWeights(objective.initiatives);
    return calculateWeightedProgress(progressWithCalculatedWeights);
};

export const getPillarProgress = (pillar: Pillar): number => {
    const progressWithCalculatedWeights = pillar.objectives.map(o => {
        return {
            ...o,
            progress: getObjectiveProgress(o),
            weight: o.weight // weight is now calculated inside getObjectiveProgress
        };
    });
    sumObjectiveWeights(pillar.objectives);
    return calculateWeightedProgress(progressWithCalculatedWeights);
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
          if (activity.status === "Delayed" || (activity.endDate < new Date() && activity.status !== 'Completed As Per Target')) {
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
