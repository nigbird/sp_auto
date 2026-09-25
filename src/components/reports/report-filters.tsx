'use client';

import type { ReportFiltersState } from '@/app/reports/page';
import type { StrategicPlan, User, Pillar, Activity, ReportingPeriod } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { ExportMenu } from '@/components/export-menu';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

type ReportFiltersProps = {
  plans: StrategicPlan[];
  users: User[];
  periods: ReportingPeriod[];
  filters: ReportFiltersState;
  onFiltersChange: (filters: ReportFiltersState) => void;
  filteredPillars: Pillar[];
  filteredActivities: Activity[];
};

export function ReportFilters({ plans, users, periods, filters, onFiltersChange, filteredPillars, filteredActivities }: ReportFiltersProps) {
  const periodsForPlan = periods.filter((p) => p.strategicPlanId === filters.planId);

  const handleFilterChange = (key: keyof ReportFiltersState, value: string | null) => {
    onFiltersChange({ ...filters, [key]: value });
  };
  
  const handleExportExcel = () => {
    const flatData = filteredPillars.flatMap(pillar =>
      pillar.objectives.flatMap(objective =>
        objective.initiatives.flatMap(initiative =>
          initiative.activities.map(activity => {
            const period = periods.find(p => p.id === (activity as any).reportingPeriodId);
            return {
              "Pillar": pillar.title,
              "Objective": objective.statement,
              "Initiative": initiative.title,
              "Activity": activity.title,
              "Deliverable": activity.deliverable ?? '',
              "Department": activity.department,
              "Responsible": (activity.responsible as User)?.name || 'N/A',
              "Reporting Period": period?.name || 'N/A',
              "Cut-off Date": period ? format(new Date(period.cutOffDate), 'yyyy-MM-dd') : 'N/A',
              "Start Date": format(new Date(activity.startDate), 'yyyy-MM-dd'),
              "End Date": format(new Date(activity.endDate), 'yyyy-MM-dd'),
              "Status": activity.status,
              "Progress (%)": activity.progress,
              "Weight (%)": activity.weight,
              "Target": activity.annualTarget != null ? (activity.targetType === 'PERCENT' ? `${activity.annualTarget}%` : activity.annualTarget) : '',
              "Monthly Breakdown": activity.planSubmissionStatus === 'APPROVED' ? 'Approved' : activity.planSubmissionStatus === 'PENDING' ? 'Pending approval' : activity.planSubmissionStatus === 'DECLINED' ? 'Returned' : 'Not submitted',
              "Approval Status": activity.approvalStatus,
            };
          })
        )
      )
    );

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    worksheet['!cols'] = Object.keys(flatData[0] ?? {}).map(k => ({ wch: ['Activity', 'Deliverable', 'Objective', 'Initiative'].includes(k) ? 40 : 16 }));
    XLSX.writeFile(workbook, `strategic_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }

  const handleExportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const selectedPlan = plans.find(p => p.id === filters.planId);
    
    doc.text("Strategic Plan Report", 14, 20);
    doc.setFontSize(12);
    doc.text(`Plan: ${selectedPlan?.name || 'All'}`, 14, 30);
    doc.text(`Date: ${format(new Date(), 'PP')}`, 14, 36);

    const tableData = filteredActivities.map(a => [
        a.title,
        (a.responsible as User)?.name || 'N/A',
        format(new Date(a.endDate), 'PP'),
        a.status,
        `${a.progress}%`
    ]);

    autoTable(doc, {
        startY: 45,
        head: [['Activity', 'Responsible', 'End Date', 'Status', 'Progress']],
        body: tableData,
    });
    
    doc.save(`strategic_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }

  const resetFilters = () => {
    onFiltersChange({
        planId: plans.find(p => p.status === 'PUBLISHED')?.id || plans[0]?.id || null,
        reportingPeriodId: null,
        ownerId: null,
        status: 'APPROVED',
    });
  }

  const isFiltered = filters.reportingPeriodId || filters.ownerId || (filters.status && filters.status !== 'APPROVED');

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.planId ?? ''} onValueChange={(v) => handleFilterChange('planId', v)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Select Plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map(plan => (
              <SelectItem key={plan.id} value={plan.id}>{plan.name} v{plan.version}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filters.reportingPeriodId ?? ''} onValueChange={(v) => handleFilterChange('reportingPeriodId', v === '' ? null : v)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Reporting Period" />
          </SelectTrigger>
          <SelectContent>
            {periodsForPlan.map(period => (
              <SelectItem key={period.id} value={period.id}>{period.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.ownerId ?? ''} onValueChange={(v) => handleFilterChange('ownerId', v === '' ? null : v)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Lead/Owner" />
          </SelectTrigger>
          <SelectContent>
            {users.map(user => (
              <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status ?? ''} onValueChange={(v) => handleFilterChange('status', v === '' ? null : v)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="DECLINED">Declined</SelectItem>
          </SelectContent>
        </Select>
        {isFiltered && <Button variant="ghost" onClick={resetFilters}><X className="mr-2 h-4 w-4" /> Reset</Button>}
      </div>

      <div className="flex items-center gap-2">
        <ExportMenu options={[
          { kind: 'excel', label: 'Report table (Excel)', description: 'The activities listed below, with the current filters.', onSelect: handleExportExcel },
          { kind: 'pdf', label: 'Report table (PDF)', description: 'A printable list of the filtered activities.', onSelect: handleExportPdf },
          {
            kind: 'excel',
            label: 'Full plan & period report (Excel)',
            description: filters.reportingPeriodId
              ? 'The whole plan in the cascaded-initiatives layout, with this period’s report columns and formulas.'
              : 'The whole plan in the cascaded-initiatives layout, with the latest requested period’s report.',
            href: filters.planId ? `/api/export/plan/${filters.planId}${filters.reportingPeriodId ? `?period=${filters.reportingPeriodId}` : ''}` : undefined,
            disabled: !filters.planId,
          },
        ]} />
      </div>
    </div>
  );
}
