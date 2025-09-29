'use client';

import type { ReportFiltersState } from '@/app/reports/page';
import type { StrategicPlan, User, Pillar, Activity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

type ReportFiltersProps = {
  plans: StrategicPlan[];
  users: User[];
  filters: ReportFiltersState;
  onFiltersChange: (filters: ReportFiltersState) => void;
  filteredPillars: Pillar[];
  filteredActivities: Activity[];
};

export function ReportFilters({ plans, users, filters, onFiltersChange, filteredPillars, filteredActivities }: ReportFiltersProps) {

  const handleFilterChange = (key: keyof ReportFiltersState, value: string | null) => {
    onFiltersChange({ ...filters, [key]: value });
  };
  
  const handleExportExcel = () => {
    const flatData = filteredPillars.flatMap(pillar => 
      pillar.objectives.flatMap(objective => 
        objective.initiatives.flatMap(initiative => 
          initiative.activities.map(activity => ({
            "Pillar": pillar.title,
            "Objective": objective.statement,
            "Initiative": initiative.title,
            "Activity": activity.title,
            "Department": activity.department,
            "Responsible": (activity.responsible as User)?.name || 'N/A',
            "Start Date": format(new Date(activity.startDate), 'yyyy-MM-dd'),
            "End Date": format(new Date(activity.endDate), 'yyyy-MM-dd'),
            "Status": activity.status,
            "Progress (%)": activity.progress,
            "Weight (%)": activity.weight,
            "Approval Status": activity.approvalStatus,
          }))
        )
      )
    );

    const worksheet = XLSX.utils.json_to_sheet(flatData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, "strategic_report.xlsx");
  }

  const handleExportPdf = () => {
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

    (doc as any).autoTable({
        startY: 45,
        head: [['Activity', 'Responsible', 'End Date', 'Status', 'Progress']],
        body: tableData,
    });
    
    doc.save('strategic_report.pdf');
  }

  const resetFilters = () => {
    onFiltersChange({
        planId: plans.find(p => p.status === 'PUBLISHED')?.id || plans[0]?.id || null,
        year: null,
        quarter: null,
        ownerId: null,
        status: null,
    });
  }

  const isFiltered = filters.year || filters.quarter || filters.ownerId || filters.status;

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
        
        <Select value={filters.year?.toString() ?? ''} onValueChange={(v) => handleFilterChange('year', v === '' ? null : v)}>
          <SelectTrigger className="w-full sm:w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
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
        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileDown className="mr-2 h-4 w-4" /> Export Excel</Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileDown className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>
    </div>
  );
}
