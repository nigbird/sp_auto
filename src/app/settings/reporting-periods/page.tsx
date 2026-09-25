
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, CalendarRange, PlusCircle, Trash2, Edit, Save, X, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { ReportRequestButton, ReportSummaryBadges, type ReportSummary } from "@/components/reporting-periods/report-request-dialog";
import { isPeriodClosedForSubmissions } from "@/lib/reporting-period";

type EditableFields = { name: string; startDate: string; endDate: string; cutOffDate: string };

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

export default function ReportingPeriodsPage() {
  const [plans, setPlans] = useState<StrategicPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<EditableFields | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ReportSummary>>({});
  const { toast } = useToast();
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

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
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reporting Periods</h1>
            <p className="text-muted-foreground">
              Define the reporting calendar and cut-off dates for a strategic plan.
            </p>
          </div>
        </div>
        <Button onClick={handleAddPeriod} disabled={!selectedPlanId}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Period
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Periods</CardTitle>
          <CardDescription>
            <Select value={selectedPlanId ?? ""} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="w-full sm:w-[280px] mt-2">
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
        <CardContent>
          {editError && <p className="mb-3 text-sm font-medium text-destructive">{editError}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Cut-off Date</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Report Request</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <CalendarRange className="mx-auto mb-2 h-6 w-6" />
                    No reporting periods defined for this plan yet.
                  </TableCell>
                </TableRow>
              )}
              {periods.map((period) => {
                const isEditing = editingId === period.id;
                return (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">
                      {isEditing ? (
                        <Input value={editedFields?.name || ""} onChange={(e) => handleFieldChange("name", e.target.value)} />
                      ) : (
                        period.name
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input type="date" value={editedFields?.startDate || ""} onChange={(e) => handleFieldChange("startDate", e.target.value)} />
                      ) : (
                        format(new Date(period.startDate), "PP")
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input type="date" value={editedFields?.endDate || ""} onChange={(e) => handleFieldChange("endDate", e.target.value)} />
                      ) : (
                        format(new Date(period.endDate), "PP")
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input type="date" value={editedFields?.cutOffDate || ""} onChange={(e) => handleFieldChange("cutOffDate", e.target.value)} />
                      ) : (
                        format(new Date(period.cutOffDate), "PP")
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant={period.status === "OPEN" ? "outline" : "secondary"} className={period.status === "OPEN" ? "border-green-500 text-green-600 bg-green-500/10" : ""}>
                          {period.status}
                        </Badge>
                        {period.status === "OPEN" && isCutOffPassed(period) && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10 text-[10px]">
                            Cut-off passed
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-2">
                        <ReportRequestButton
                          period={period}
                          disabledReason={
                            selectedPlan?.status !== "PUBLISHED"
                              ? "Publish the strategic plan first."
                              : isPeriodClosedForSubmissions(period)
                                ? "Period is closed or past cut-off."
                                : isEditing
                                  ? "Save the period first."
                                  : undefined
                          }
                          onSent={() => selectedPlanId && loadPeriods(selectedPlanId)}
                        />
                        <ReportSummaryBadges summary={summaries[period.id]} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing ? (
                        <div className="flex justify-center gap-2">
                          <Button size="icon" variant="ghost" onClick={handleSaveEdit}><Save className="h-4 w-4 text-green-600" /></Button>
                          <Button size="icon" variant="ghost" onClick={handleCancelEdit}><X className="h-4 w-4 text-red-600" /></Button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleToggleStatus(period)} title={period.status === "OPEN" ? "Close period" : "Reopen period"}>
                            {period.status === "OPEN" ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleEditClick(period)}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeletePeriod(period.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
