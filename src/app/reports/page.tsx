'use client';

import { useState, useMemo, useEffect } from 'react';
import type { ReportData, Activity, Pillar, User } from '@/lib/types';
import { ReportFilters } from '@/components/reports/report-filters';
import { ReportKpiCards } from '@/components/reports/report-kpi-cards';
import { ReportCharts } from '@/components/reports/report-charts';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { getReportData } from '@/actions/reports';
import { Loader2 } from 'lucide-react';

export type ReportFiltersState = {
  planId: string | null;
  year: number | null;
  quarter: number | null;
  ownerId: string | null;
  status: string | null;
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFiltersState>({
    planId: null,
    year: null,
    quarter: null,
    ownerId: null,
    status: null,
  });

  useEffect(() => {
    getReportData().then((d) => {
      setData(d as any);
       const publishedPlan = d.plans.find(p => p.status === 'PUBLISHED');
      if (publishedPlan) {
        setFilters(f => ({ ...f, planId: publishedPlan.id }));
      } else if (d.plans.length > 0) {
        setFilters(f => ({ ...f, planId: d.plans[0].id }));
      }
      setIsLoading(false);
    });
  }, []);

  const filteredActivities = useMemo(() => {
    if (!data) return [];
    
    let activities = data.activities;

    if (filters.planId) {
        activities = activities.filter(a => a.strategicPlanId === filters.planId);
    }
    if (filters.ownerId) {
        activities = activities.filter(a => (a.responsible as User)?.id === filters.ownerId);
    }
    if (filters.status) {
        activities = activities.filter(a => a.approvalStatus === filters.status);
    }
    if (filters.year) {
        activities = activities.filter(a => new Date(a.startDate).getFullYear() === filters.year);
    }
    if (filters.quarter) {
        activities = activities.filter(a => Math.floor(new Date(a.startDate).getMonth() / 3) + 1 === filters.quarter);
    }

    return activities;
  }, [data, filters]);

  const filteredPillars = useMemo(() => {
    if (!data || !filters.planId) return [];
    
    const activityIds = new Set(filteredActivities.map(a => a.id));
    
    return data.pillars
      .filter(p => p.strategicPlanId === filters.planId)
      .map(pillar => ({
        ...pillar,
        objectives: pillar.objectives
          .map(objective => ({
            ...objective,
            initiatives: objective.initiatives
              .map(initiative => ({
                ...initiative,
                activities: initiative.activities.filter(activity => activityIds.has(activity.id)),
              }))
              .filter(initiative => initiative.activities.length > 0),
          }))
          .filter(objective => objective.initiatives.length > 0),
      }))
      .filter(pillar => pillar.objectives.length > 0);

  }, [data, filteredActivities, filters.planId]);

  if (isLoading || !data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
      </div>
      
      <ReportFilters 
        plans={data.plans} 
        users={data.users} 
        filters={filters}
        onFiltersChange={setFilters}
        filteredPillars={filteredPillars}
        filteredActivities={filteredActivities}
      />
      
      <ReportKpiCards activities={filteredActivities} />
      
      <ReportCharts activities={filteredActivities} pillars={filteredPillars} />
      
      <ReportDataTable data={filteredPillars} />
    </div>
  );
}
