'use client';

import type { ReportFiltersState } from '@/app/reports/page';
import type { StrategicPlan, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, X } from 'lucide-react';
import * as XLSX from 'xlsx';

type ReportFiltersProps = {
  plans: StrategicPlan[];
  users: User[];
  filters: ReportFiltersState;
  onFiltersChange: (filters: ReportFiltersState) => void;
};

export function ReportFilters({ plans, users, filters, onFiltersChange }: ReportFiltersProps) {

  const handleFilterChange = (key: keyof ReportFiltersState, value: string | null) => {
    onFiltersChange({ ...filters, [key]: value });
  };
  
  const handleExportExcel = () => {
    // This is a placeholder for exporting data. In a real app, you'd use the filtered data.
    const worksheet = XLSX.utils.json_to_sheet([{ name: "Placeholder", data: "placeholder" }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, "report.xlsx");
  }

  const resetFilters = () => {
    onFiltersChange({
        planId: plans[0]?.id || null,
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
        
        <Select value={filters.year?.toString() ?? ''} onValueChange={(v) => handleFilterChange('year', v)}>
          <SelectTrigger className="w-full sm:w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filters.ownerId ?? ''} onValueChange={(v) => handleFilterChange('ownerId', v)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Lead/Owner" />
          </SelectTrigger>
          <SelectContent>
            {users.map(user => (
              <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status ?? ''} onValueChange={(v) => handleFilterChange('status', v)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="DECLINED">Declined</SelectItem>
          </SelectContent>
        </Select>
        {isFiltered && <Button variant="ghost" onClick={resetFilters}><X className="mr-2 h-4 w-4" /> Reset</Button>}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileDown className="mr-2 h-4 w-4" /> Export Excel</Button>
        <Button variant="outline" size="sm" onClick={() => alert("PDF export not implemented")}>
            <FileDown className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>
    </div>
  );
}

    