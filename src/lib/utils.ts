

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Pillar, Objective, Initiative, Activity, ActivityStatus, Rule } from "./types";

export type StatusRule = Pick<Rule, 'status' | 'min' | 'max'>;

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

/** Sums raw activity weights from wizard form data (weight may still be a string before zod coercion), as opposed to getInitiativeWeight which operates on a fully-typed Initiative. */
export function calculateInitiativeWeight(activities: { weight: number | string }[] = []): number {
    return activities.reduce((total, activity) => total + (Number(activity.weight) || 0), 0);
}

const WEIGHT_RECONCILIATION_TOLERANCE = 0.01;

export interface WeightReconciliationResult {
    valid: boolean;
    issues: string[];
}

/**
 * Checks that every activity's weight across the WHOLE plan sums to 100% —
 * one absolute weight pool shared by every activity regardless of which
 * pillar/objective/initiative it sits under, rather than each initiative
 * having its own independent 100% pool. Operates on raw wizard form data
 * (pillars -> objectives -> initiatives -> activities), so it can run
 * before anything is written to the DB.
 */
export function validateWeightReconciliation(
    pillars: { title?: string; objectives: { statement?: string; initiatives: { title?: string; activities: { weight: number | string }[] }[] }[] }[]
): WeightReconciliationResult {
    let total = 0;
    for (const pillar of pillars) {
        for (const objective of pillar.objectives) {
            for (const initiative of objective.initiatives) {
                total += calculateInitiativeWeight(initiative.activities);
            }
        }
    }

    if (Math.abs(total - 100) > WEIGHT_RECONCILIATION_TOLERANCE) {
        return {
            valid: false,
            issues: [`Activity weights across the whole plan sum to ${total.toFixed(1)}% — must total 100%.`],
        };
    }

    return { valid: true, issues: [] };
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

/**
 * Classifies an activity's status from its progress percentage, using the
 * live, admin-configurable thresholds from Settings > Rules (src/actions/rules.ts)
 * rather than hardcoded numbers — editing a rule's min/max there now actually
 * changes what counts as "Delayed" vs "On Track", etc.
 *
 * "Overdue" and "Not Started" stay time-conditioned overrides (past deadline;
 * zero progress before the start date) rather than pure progress bands —
 * otherwise they'd shadow "Delayed"/"On Track" for every 0%-progress activity,
 * since their configured ranges happen to include 0.
 */
export function calculateActivityStatus(
  activity: { progress: number; startDate: Date; endDate: Date },
  rules: StatusRule[]
): ActivityStatus {
  const { progress, startDate, endDate } = activity;
  const now = new Date();

  const byName = (name: string) => (rules.find((r) => r.status === name)?.status ?? name) as ActivityStatus;
  const findByRange = (value: number, pool: StatusRule[]) =>
    pool.find((r) => value >= r.min && value <= r.max)?.status as ActivityStatus | undefined;

  const timeConditionedNames = new Set(['Overdue', 'Not Started']);
  const progressBandRules = rules.filter((r) => !timeConditionedNames.has(r.status));

  if (progress >= 100) {
    return findByRange(progress, rules) ?? byName('Completed As Per Target');
  }

  if (now > endDate) {
    if (progress === 0) {
      return byName('Overdue');
    }
    return findByRange(progress, progressBandRules) ?? byName('Delayed');
  }

  if (progress === 0 && now < startDate) {
    return byName('Not Started');
  }

  // Zero progress after the start date (but before the deadline) falls
  // through here too: it won't match "Delayed"'s configured range (which
  // typically starts above 0), so the byName fallback covers it.
  return findByRange(progress, progressBandRules) ?? byName('Delayed');
}

/**
 * Whole calendar days past the activity's end date — 0 while it's still
 * complete or not yet past its deadline, even if `calculateActivityStatus`
 * already reports "Delayed" due to slow pace before the deadline. Computed
 * live wherever it's needed rather than stored, since there's no scheduler
 * in this app to keep a stored count fresh day to day.
 */
export function calculateDelayDays(activity: { progress: number; endDate: Date }, now: Date = new Date()): number {
  if (activity.progress >= 100) return 0;
  if (now <= activity.endDate) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((now.getTime() - activity.endDate.getTime()) / msPerDay);
}

function sumWeights(items: { weight: number }[]): number {
    return items.reduce((sum, item) => sum + item.weight, 0);
}

function sumActual(items: { weight: number, progress: number }[]): number {
    return items.reduce((sum, item) => sum + (item.progress / 100 * item.weight), 0);
}

/** This pillar's share of the whole plan's 100-point weight pool (its "quota"). */
export function getPillarPlan(pillar: Pillar): number {
    let totalPlan = 0;
    pillar.objectives.forEach(objective => {
        objective.initiatives.forEach(initiative => {
            totalPlan += sumWeights(initiative.activities);
        });
    });
    return totalPlan;
}

/** Points this pillar has actually earned out of its getPillarPlan() quota (weight * progress, summed). */
export function getPillarActual(pillar: Pillar): number {
    let totalActual = 0;
    pillar.objectives.forEach(objective => {
        objective.initiatives.forEach(initiative => {
            totalActual += sumActual(initiative.activities);
        });
    });
    return totalActual;
}
