
'use client';

import { StrategicPlan, Pillar } from "./types";

const PLAN_STORAGE_KEY = 'strategic_plan';

export function savePlan(planData: Omit<StrategicPlan, 'status'>, status: 'draft' | 'published') {
  if (typeof window !== 'undefined') {
    const planToSave: StrategicPlan = { ...planData, status };
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planToSave));
    // Dispatch a storage event to notify other tabs/windows
    window.dispatchEvent(new StorageEvent('storage', { key: PLAN_STORAGE_KEY }));
  }
}

export function getSavedPlan(): StrategicPlan | null {
  if (typeof window !== 'undefined') {
    const savedData = localStorage.getItem(PLAN_STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Basic migration for old format (array of pillars)
        if (Array.isArray(parsed)) {
            return {
                planTitle: 'Imported Strategic Plan',
                startYear: new Date().getFullYear(),
                endYear: new Date().getFullYear() + 4,
                version: '1.0',
                pillars: parsed,
                status: 'published'
            };
        }
        // Ensure dates are converted from strings to Date objects
        if (parsed.pillars) {
            parsed.pillars.forEach((p: Pillar) => {
                p.objectives.forEach(o => {
                    o.initiatives.forEach(i => {
                        i.activities.forEach(a => {
                            if (a.startDate) a.startDate = new Date(a.startDate);
                            if (a.endDate) a.endDate = new Date(a.endDate);
                            if (a.deadline) a.deadline = new Date(a.deadline as string);
                        });
                    });
                });
            });
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

export function deletePlan() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(PLAN_STORAGE_KEY);
        // Dispatch a storage event to notify other tabs/windows
        window.dispatchEvent(new StorageEvent('storage', { key: PLAN_STORAGE_KEY }));
    }
}

    