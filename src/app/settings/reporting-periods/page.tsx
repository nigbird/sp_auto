
"use client";

import { useState, useEffect, useCallback } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { PlusCircle, Trash2, Edit, Save, X, Lock, LockOpen, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { isCutOffPassed } from "@/lib/reporting-period";
import { listStrategicPlans } from "@/actions/strategic-plan";
import {
  getReportingPeriods,
  createReportingPeriod,
  updateReportingPeriod,
  deleteReportingPeriod,
} from "@/actions/reporting-periods";
import type { StrategicPlan, ReportingPeriod } from "@/lib/types";
import { getReportSummaries } from "@/actions/period-reports";
import { ReportProgress, ReportRequestButton, type ReportSummary } from "@/components/reporting-periods/report-request-dialog";
import { usePermissions } from "@/components/permissions-provider";
import { isPeriodClosedForSubmissions } from "@/lib/reporting-period";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { DateRangeFilter, ListToolbar, Pagination, SearchBox, usePagination } from "@/components/list-controls";
import { isRangeSet, matchesSearch, overlapsDateRange, type DateRangeValue } from "@/lib/list-filters";

type EditableFields = { name: string; startDate: string; endDate: string; cutOffDate: string };

const HEAD = "h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80";

function validatePeriodFields(fields: EditableFields): string | null {
  if (!fields.name.trim()) return "Name is required.";
  if (!fields.startDate || !fields.endDate || !fields.cutOffDate) return "Start, end and cut-off dates are all required.";
  if (new Date(fields.endDate) < new Date(fields.startDate)) return "End date can't be before the start date.";
  if (new Date(fields.cutOffDate) < new Date(fields.endDate)) return "Cut-off date can't be before the end date — owners report after the period ends.";
  return null;
}

function toDateInputValue(value: string | Date): string {
  return format(new Date(value), "yyyy-MM-dd");
}

/** "Jan 1 – Oct 15, 2026", or with both years when the period spans two. */
function formatRange(start: string | Date, end: string | Date): string {
  const s = new Date(start), e = new Date(end);
  return s.getFullYear() === e.getFullYear()
    ? `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`
    : `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
}

/** How far the cut-off is from today, e.g. "Due in 4 days" or "Passed 6 days ago". */
function cutOffHint(cutOff: string | Date): string {
  const days = differenceInCalendarDays(new Date(cutOff), new Date());
  if (days > 1) return `Due in ${days} days`;
  if (days === 1) return "Due tomorrow";
  if (days === 0) return "Due today";
  return days === -1 ? "Passed yesterday" : `Passed ${-days} days ago`;
}

export default function ReportingPeriodsPage() {
  const [plans, setPlans] = useState<StrategicPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<EditableFields | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ReportSummary>>({});
  const [deleting, setDeleting] = useState<ReportingPeriod | null>(null);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canManage = can("settings:manage");
  const canRequestReports = can("report-approvals:request");
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [range, setRange] = useState<DateRangeValue>({});
  const columnCount = 4 + (canRequestReports ? 1 : 0) + (canManage ? 1 : 0);

  const narrowed = query.trim() !== "" || statusFilter !== "ALL" || isRangeSet(range);
  const resetFilters = () => { setQuery(""); setStatusFilter("ALL"); setRange({}); };
  const matchingPeriods = periods.filter((p) =>
    p.id === editingId || (
      matchesSearch(query, p.name) &&
      (statusFilter === "ALL" || p.status === statusFilter) &&
      overlapsDateRange(p.startDate, p.endDate, range)
    )
  );
  const periodPages = usePagination(matchingPeriods, `${selectedPlanId}|${query}|${statusFilter}|${range.from}|${range.to}`);

  useEffect(() => {
    listStrategicPlans().then((plans) => {
      setPlans(plans as StrategicPlan[]);
      const published = plans.find((p) => p.status === "PUBLISHED");
      setSelectedPlanId((published ?? plans[0])?.id ?? null);
    });
  }, []);

  const loadPeriods = useCallback((planId: string) => {
    getReportingPeriods(planId).then((data) => setPeriods(data as unknown as ReportingPeriod[]));
    getReportSummaries(planId).then(setSummaries);
  }, []);

  useEffect(() => {
    if (selectedPlanId) loadPeriods(selectedPlanId);
    else setPeriods([]);
  }, [selectedPlanId, loadPeriods]);

  const handleEditClick = (period: ReportingPeriod) => {
    setEditingId(period.id);
    setEditedFields({
      name: period.name,
      startDate: toDateInputValue(period.startDate),
      endDate: toDateInputValue(period.endDate),
      cutOffDate: toDateInputValue(period.cutOffDate),
    });
  };

  const handleCancelEdit = () => {
    setEditError(null);
    setEditingId(null);
    setEditedFields(null);
  };

  const handleFieldChange = (field: keyof EditableFields, value: string) => {
    if (!editedFields) return;
    setEditedFields({ ...editedFields, [field]: value });
  };

  const handleSaveEdit = async () => {
    if (!editedFields || !editingId) return;
    const problem = validatePeriodFields(editedFields);
    if (problem) {
      setEditError(problem);
      return;
    }
    setEditError(null);
    await updateReportingPeriod(editingId, editedFields);
    if (selectedPlanId) loadPeriods(selectedPlanId);
    setEditingId(null);
    setEditedFields(null);
    toast({ title: "Reporting Period Updated" });
  };

  const handleAddPeriod = async () => {
    if (!selectedPlanId) return;
    resetFilters();
    const today = format(new Date(), "yyyy-MM-dd");
    const newPeriod = await createReportingPeriod(selectedPlanId, {
      name: "New Period",
      startDate: today,
      endDate: today,
      cutOffDate: today,
    });
    loadPeriods(selectedPlanId);
    handleEditClick(newPeriod as unknown as ReportingPeriod);
  };

  const handleDeletePeriod = async (id: string) => {
    setDeleting(null);
    await deleteReportingPeriod(id);
    setPeriods(periods.filter((p) => p.id !== id));
    toast({ title: "Reporting Period Deleted", variant: "destructive" });
  };

  const handleToggleStatus = async (period: ReportingPeriod) => {
    const nextStatus = period.status === "OPEN" ? "CLOSED" : "OPEN";
    await updateReportingPeriod(period.id, { status: nextStatus });
    if (selectedPlanId) loadPeriods(selectedPlanId);
    toast({ title: nextStatus === "CLOSED" ? "Period Closed" : "Period Reopened" });
  };

  return (
    <div className="flex-1 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Reporting Periods</h2>
            <p className="text-sm text-muted-foreground">
              Define the reporting calendar and cut-off dates for a strategic plan.
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={handleAddPeriod} disabled={!selectedPlanId}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Period
          </Button>
        )}
      </div>

      <Card className="rounded-xl border-border/50 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_4px_12px_-8px_rgba(16,24,40,0.06)]">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Periods</CardTitle>
          <CardDescription>
            <Select value={selectedPlanId ?? ""} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="mt-2 h-9 w-full rounded-xl sm:w-[280px]">
                <SelectValue placeholder="Select a strategic plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} v{plan.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {periods.length > 0 && (
            <ListToolbar count={narrowed ? `${matchingPeriods.length} of ${periods.length} periods match` : `${periods.length} periods`}>
              <SearchBox value={query} onChange={setQuery} placeholder="Search period name" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
              <DateRangeFilter value={range} onChange={setRange} label="Any dates" hint="Shows periods that run at any point in this range." />
              {narrowed && <Button variant="ghost" className="h-9 px-3" onClick={resetFilters}>Reset</Button>}
            </ListToolbar>
          )}
          {editError && <p className=" text-sm font-medium text-destructive">{editError}</p>}
          <div className="overflow-x-auto rounded-xl border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={HEAD}>Period</TableHead>
                <TableHead className={HEAD}>Cut-off</TableHead>
                <TableHead className={HEAD}>Status</TableHead>
                <TableHead className={HEAD}>Reports</TableHead>
                {canRequestReports && <TableHead className={HEAD}>Request</TableHead>}
                {canManage && <TableHead className={cn(HEAD, "w-12")}><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnCount} className="p-0">
                    <EmptyState art="plan" title="No reporting periods yet" description="Add a reporting period to start requesting reports for this plan." />
                  </TableCell>
                </TableRow>
              )}
              {periods.length > 0 && matchingPeriods.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnCount} className="py-8 text-center text-muted-foreground">No periods match the search or filters.</TableCell>
                </TableRow>
              )}
              {periodPages.items.map((period) => {
                const isEditing = editingId === period.id;
                const cutOffPassed = isCutOffPassed(period);
                return (
                  <TableRow key={period.id} className="border-border/50 align-top hover:bg-muted/30">
                    <TableCell className="py-4">
                      {isEditing ? (
                        <div className="min-w-[280px] space-y-2">
                          <Input value={editedFields?.name || ""} onChange={(e) => handleFieldChange("name", e.target.value)} aria-label="Period name" />
                          <div className="flex items-center gap-2">
                            <Input type="date" value={editedFields?.startDate || ""} onChange={(e) => handleFieldChange("startDate", e.target.value)} aria-label="Start date" />
                            <span className="text-muted-foreground">–</span>
                            <Input type="date" value={editedFields?.endDate || ""} onChange={(e) => handleFieldChange("endDate", e.target.value)} aria-label="End date" />
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-[160px]">
                          <p className="font-medium text-foreground">{period.name}</p>
                          <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">{formatRange(period.startDate, period.endDate)}</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      {isEditing ? (
                        <Input type="date" value={editedFields?.cutOffDate || ""} onChange={(e) => handleFieldChange("cutOffDate", e.target.value)} aria-label="Cut-off date" />
                      ) : (
                        <div className="whitespace-nowrap">
                          <p className="text-sm text-foreground">{format(new Date(period.cutOffDate), "PP")}</p>
                          {period.status === "OPEN" && (
                            <p className={cn("mt-0.5 text-xs", cutOffPassed ? "font-medium text-amber-700" : "text-muted-foreground")}>{cutOffHint(period.cutOffDate)}</p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className={cn("font-medium", period.status === "OPEN" ? "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-700" : "border-border/60 bg-muted/60 text-muted-foreground")}>
                        {period.status === "OPEN" ? "Open" : "Closed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <ReportProgress summary={summaries[period.id]} overdue={period.status === "OPEN" && cutOffPassed} />
                    </TableCell>
                    {canRequestReports && (
                      <TableCell className="py-4">
                        <ReportRequestButton
                          period={period}
                          disabledReason={
                            selectedPlan?.status !== "PUBLISHED"
                              ? "Publish the strategic plan first."
                              : isPeriodClosedForSubmissions(period)
                                ? "Reopen the period to send."
                                : isEditing
                                  ? "Save the period first."
                                  : undefined
                          }
                          onSent={() => selectedPlanId && loadPeriods(selectedPlanId)}
                        />
                      </TableCell>
                    )}
                    {canManage && (
                      <TableCell className="py-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={handleSaveEdit} title="Save"><Save className="h-4 w-4 text-green-600" /></Button>
                            <Button size="icon" variant="ghost" onClick={handleCancelEdit} title="Cancel"><X className="h-4 w-4 text-red-600" /></Button>
                          </div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Period actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditClick(period)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(period)}>
                                {period.status === "OPEN"
                                  ? <><Lock className="mr-2 h-4 w-4" /> Close period</>
                                  : <><LockOpen className="mr-2 h-4 w-4" /> Reopen period</>}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleting(period)} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          <Pagination state={periodPages} noun="periods" />
        </CardContent>
      </Card>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && summaries[deleting.id]?.total
                ? `${summaries[deleting.id].total} reports have already been requested for this period. Deleting it can't be undone.`
                : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && handleDeletePeriod(deleting.id)} className="border border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive/40 hover:bg-destructive/15">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
