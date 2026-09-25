"use client"

import * as React from "react";
import { PlusCircle, Trash2, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Alert, AlertDescription } from "../ui/alert";
import { cn } from "@/lib/utils";
import { formatTargetValue, monthKey, monthLabel, monthsBetween, plannedPercentAtMonth, validateBreakdown, type BreakdownEntry, type TargetType } from "@/lib/monthly-breakdown";

export interface BreakdownDraft {
  targetType: TargetType;
  annualTarget: string;
  rows: { month: string; value: string }[];
}

export function emptyBreakdownDraft(): BreakdownDraft {
  return { targetType: 'PERCENT', annualTarget: '100', rows: [{ month: '', value: '' }] };
}

export function breakdownDraftFrom(activity: { targetType?: TargetType | null; annualTarget?: number | null; monthlyTargets?: { month: string | Date; value: number }[] }): BreakdownDraft {
  const rows = (activity.monthlyTargets ?? []).map(t => ({ month: monthKey(t.month), value: String(t.value) }));
  return {
    targetType: activity.targetType ?? 'PERCENT',
    annualTarget: activity.annualTarget != null ? String(activity.annualTarget) : '100',
    rows: rows.length > 0 ? rows : [{ month: '', value: '' }],
  };
}

export function draftEntries(draft: BreakdownDraft): BreakdownEntry[] {
  return draft.rows.map(r => ({ month: r.month, value: r.value.trim() === '' ? NaN : Number(r.value) }));
}

export function validateDraft(draft: BreakdownDraft, startDate: string | Date, endDate: string | Date) {
  return validateBreakdown({
    targetType: draft.targetType,
    annualTarget: draft.annualTarget.trim() === '' ? NaN : Number(draft.annualTarget),
    entries: draftEntries(draft),
    startDate,
    endDate,
  });
}

interface BreakdownEditorProps {
  draft: BreakdownDraft;
  onChange: (draft: BreakdownDraft) => void;
  startDate: string | Date;
  endDate: string | Date;
  /** Show problems (set once the user has tried to submit). */
  showErrors: boolean;
  /** Errors the server returned, shown alongside the live ones. */
  serverFormErrors?: string[];
  disabled?: boolean;
}

/**
 * The annual target plus "which month(s), how much" rows — the Excel's Target
 * and Jul..Jun columns. Only months inside the activity's dates can be picked.
 */
export function BreakdownEditor({ draft, onChange, startDate, endDate, showErrors, serverFormErrors = [], disabled }: BreakdownEditorProps) {
  const validDates = !Number.isNaN(new Date(startDate).getTime()) && !Number.isNaN(new Date(endDate).getTime()) && new Date(endDate) > new Date(startDate);
  const months = validDates ? monthsBetween(startDate, endDate) : [];
  const validation = validDates ? validateDraft(draft, startDate, endDate) : null;
  const unit = draft.targetType === 'PERCENT' ? '%' : '';

  const update = (patch: Partial<BreakdownDraft>) => onChange({ ...draft, ...patch });
  const updateRow = (index: number, patch: Partial<BreakdownDraft['rows'][number]>) =>
    update({ rows: draft.rows.map((r, i) => i === index ? { ...r, ...patch } : r) });

  const usedMonths = new Set(draft.rows.map(r => r.month));
  const nextFreeMonth = months.find(m => !usedMonths.has(m)) ?? '';
  const formErrors = showErrors ? Array.from(new Set([...(validation?.formErrors ?? []), ...serverFormErrors])) : [];

  const entries = draftEntries(draft).filter(e => e.month && Number.isFinite(e.value));
  const annual = Number(draft.annualTarget);
  const numberTotal = entries.reduce((sum, e) => sum + e.value, 0);

  if (!validDates) {
    return <p className="text-sm text-muted-foreground">Set a valid start and end date first — the months you can plan come from them.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Target type</Label>
          <RadioGroup
            className="flex gap-6"
            value={draft.targetType}
            onValueChange={(v) => update({ targetType: v as TargetType, annualTarget: v === 'PERCENT' && !draft.annualTarget ? '100' : draft.annualTarget })}
            disabled={disabled}
          >
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="PERCENT" /> Percent (%)</label>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="NUMBER" /> Number (count)</label>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            {draft.targetType === 'PERCENT'
              ? 'Each month says how far along (in %) you will be by the end of that month.'
              : 'Each month says how many you will deliver in that month; together they must add up to the annual target.'}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="annual-target">Annual target {unit && `(${unit})`}</Label>
          <Input
            id="annual-target"
            type="number"
            min={0}
            max={draft.targetType === 'PERCENT' ? 100 : undefined}
            step="any"
            value={draft.annualTarget}
            onChange={(e) => update({ annualTarget: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Monthly breakdown</Label>
        <p className="text-xs text-muted-foreground">
          Pick the month you will finish by (and any months in between), from {monthLabel(months[0])} to {monthLabel(months[months.length - 1])}.
        </p>
        <div className="space-y-2">
          {draft.rows.map((row, index) => {
            const rowError = showErrors ? validation?.rowErrors[index] : undefined;
            return (
              <div key={index} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={row.month} onValueChange={(v) => updateRow(index, { month: v })} disabled={disabled}>
                    <SelectTrigger className={cn("w-[160px]", rowError && "border-destructive")} aria-label={`Month for row ${index + 1}`}>
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(m => (
                        <SelectItem key={m} value={m} disabled={m !== row.month && usedMonths.has(m)}>{monthLabel(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      className={cn("w-[140px]", unit && "pr-7", rowError && "border-destructive")}
                      placeholder={draft.targetType === 'PERCENT' ? 'e.g. 100' : 'e.g. 1'}
                      value={row.value}
                      onChange={(e) => updateRow(index, { value: e.target.value })}
                      aria-label={`Value for row ${index + 1}`}
                      disabled={disabled}
                    />
                    {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>}
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove row ${index + 1}`} onClick={() => update({ rows: draft.rows.filter((_, i) => i !== index) })} disabled={disabled || draft.rows.length === 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {rowError && <p className="text-xs font-medium text-destructive">{rowError}</p>}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => update({ rows: [...draft.rows, { month: nextFreeMonth, value: '' }] })} disabled={disabled || draft.rows.length >= months.length}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add month
          </Button>
          {draft.targetType === 'NUMBER' && Number.isFinite(annual) && annual > 0 && (
            <p className={cn("text-sm font-medium", Math.abs(numberTotal - annual) < 1e-6 ? "text-green-600" : "text-muted-foreground")}>
              Planned so far: {formatTargetValue(numberTotal, 'NUMBER')} of {formatTargetValue(annual, 'NUMBER')}
            </p>
          )}
        </div>
      </div>

      {entries.length > 0 && Number.isFinite(annual) && annual > 0 && (
        <BreakdownStrip months={months} entries={entries} targetType={draft.targetType} annualTarget={annual} />
      )}

      {formErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {formErrors.map(e => <li key={e}>{e}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/** A one-row, month-by-month preview of a breakdown, like a row of the Excel. */
export function BreakdownStrip({ months, entries, targetType, annualTarget }: { months: string[]; entries: BreakdownEntry[]; targetType: TargetType; annualTarget: number }) {
  const byMonth = new Map(entries.map(e => [e.month, e.value]));
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            {months.map(m => <th key={m} className="px-2 py-1 font-medium text-center whitespace-nowrap">{monthLabel(m)}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            {months.map(m => {
              const value = byMonth.get(m);
              return (
                <td key={m} className={cn("px-2 py-1 text-center", value != null && "font-semibold text-primary")}>
                  {value != null ? formatTargetValue(value, targetType) : ''}
                </td>
              );
            })}
          </tr>
          <tr className="text-muted-foreground border-t">
            {months.map(m => (
              <td key={m} className="px-2 py-1 text-center">{Math.round(plannedPercentAtMonth(targetType, annualTarget, entries, m))}%</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="px-2 py-1 text-[11px] text-muted-foreground border-t">Bottom row: how much of the annual target is planned to be done by the end of each month.</p>
    </div>
  );
}
