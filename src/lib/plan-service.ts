
'use client';

import { StrategicPlan, Pillar } from "./types";

const PLAN_STORAGE_KEY = 'strategic_plan';

export function savePlan(planData: Omit<StrategicPlan, 'status'>, status: 'draft' | 'published') {
  if (typeof window !== 'undefined') {
    const planToSave: StrategicPlan = { ...planData, status };
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planToSave));
  }
}

export function getSavedPlan(): StrategicPlan | null {
  if (typeof window !== 'undefined') {
    const savedData = localStorage.getItem(PLAN_STORAGE_KEY);
    if (savedData) {
      try {
        // A simple migration to handle old data structure if needed
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed)) {
            // This is the old format (just an array of pillars)
            // We can wrap it in the new format for compatibility
            return {
                planTitle: 'Imported Strategic Plan',
                startYear: new Date().getFullYear(),
                endYear: new Date().getFullYear() + 4,
                version: '1.0',
                pillars: parsed,
                status: 'published'
            };
        }
        return parsed;
      } catch (e) {
        console.error("Failed to parse strategic plan from localStorage", e);
        return null;
      }
    }
  }
  return null;
}
