"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { monthLabel } from "@/lib/monthly-breakdown";
import type { ImportPeriodSettings } from "@/lib/plan-import/write-plan";
import { importPlanReport, previewReportImport, type ReportImportPreview, type ReportRowOutcome } from "@/actions/report-import";

const NEW = "new";

const OUTCOME: Record<ReportRowOutcome, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  import: { label: "Will import", variant: "default" },
  "already-reported": { label: "Already reported", variant: "secondary" },
  "below-previous": { label: "Below last period", variant: "destructive" },
  "no-breakdown": { label: "No breakdown", variant: "outline" },
  invalid: { label: "Invalid value", variant: "destructive" },
  unmatched: { label: "Not matched", variant: "outline" },
  "own-activity": { label: "Your own activity", variant: "outline" },
};

/**
 * "Import report" on the Performance Report: loads a report sheet (the
 * report template, or the full cascaded workbook) into a period of this
 * plan, as approved reports.
 */
export function ReportImportDialog({ planId, selectedPeriodId }: { planId: string; selectedPeriodId?: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ReportImportPreview | null>(null);
  const [periodId, setPeriodId] = React.useState<string>("");
  const [newPeriod, setNewPeriod] = React.useState<ImportPeriodSettings | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [problems, setProblems] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<"reading" | "importing" | null>(null);

  const reset = () => {
    setFile(null); setPreview(null); setPeriodId(""); setNewPeriod(null); setError(null); setProblems([]);
  };

  const read = async (chosen: File, period?: string) => {
    setBusy("reading");
    setError(null);
    setProblems([]);
    try {
      const formData = new FormData();
      formData.set("file", chosen);
      formData.set("planId", planId);
      if (period) formData.set("periodId", period);
      const result = await previewReportImport(formData);
      if (!result.success) {
        setPreview(null);
        setError(result.message);
        return;
      }
      const p = result.preview;
      setPreview(p);
      setNewPeriod(prev => prev ?? p.suggestedPeriod);
      if (!period) {
        // The period open on the page if it can take the report, else the latest one that can.
        const fitting = p.periods.filter(x => x.fits);
        const pick = fitting.find(x => x.id === selectedPeriodId) ?? fitting[fitting.length - 1];
        setPeriodId(pick ? pick.id : p.canCreatePeriod ? NEW : "");
      }
    } catch {
      setError("The file couldn't be uploaded. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const choosePeriod = (value: string) => {
    setPeriodId(value);
    if (file) read(file, value);
  };

  const counts = (preview?.rows ?? []).reduce<Record<ReportRowOutcome, number>>(
    (acc, r) => ({ ...acc, [r.outcome]: acc[r.outcome] + 1 }),
    { import: 0, "already-reported": 0, "below-previous": 0, "no-breakdown": 0, invalid: 0, unmatched: 0, "own-activity": 0 }
  );
  const through = preview?.throughMonth ? monthLabel(preview.throughMonth) : null;
  const fittingPeriods = preview?.periods.filter(p => p.fits) ?? [];
  const canImport = !!preview && counts.import > 0 && (periodId === NEW ? !!newPeriod : !!periodId) && busy === null;

  const handleImport = async () => {
    if (!file || !preview) return;
    setBusy("importing");
    setProblems([]);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("planId", planId);
      formData.set("options", JSON.stringify(periodId === NEW ? { newPeriod } : { periodId }));
      const result = await importPlanReport(formData);
      if (!result.success) {
        setProblems(result.problems ?? [result.message]);
        return;
      }
      toast({ title: "Report imported", description: `${result.imported} approved ${result.imported === 1 ? "report was" : "reports were"} saved.` });
      setOpen(false);
      reset();
      router.push(`/reports?plan=${planId}&period=${result.periodId}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Upload className="mr-2 h-4 w-4" /> Import report</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import a report from Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/template/report" download><Download className="mr-2 h-4 w-4" /> Download template</a>
            </Button>
            <Input type="file" accept=".xlsx,.xlsm,.xls" className="max-w-sm" disabled={busy !== null}
              onChange={(e) => { const f = e.target.files?.[0] ?? null; reset(); setFile(f); if (f) read(f); }} />
            {busy === "reading" && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading…</span>}
          </div>
          {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

          {preview && (
            <>
              {through && (
                <p className="text-sm">Sheet "{preview.sheetName}" reports <span className="font-medium">up to {through}</span>.</p>
              )}

              <div className="space-y-2">
                <Label>Reporting period</Label>
                {fittingPeriods.length === 0 && !preview.canCreatePeriod ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>This plan has no {through ? `period ending in ${through}` : "reporting period"}. Ask someone who manages reporting periods to add one, then import again.</AlertDescription>
                  </Alert>
                ) : (
                  <Select value={periodId} onValueChange={choosePeriod} disabled={busy !== null}>
                    <SelectTrigger className="w-full sm:w-[380px]"><SelectValue placeholder="Choose a period…" /></SelectTrigger>
                    <SelectContent>
                      {fittingPeriods.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}{p.approvedReports ? ` — ${p.approvedReports} approved already` : ""}</SelectItem>
                      ))}
                      {preview.canCreatePeriod && <SelectItem value={NEW}>Create a new period…</SelectItem>}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  {through
                    ? `Only a period that ends in ${through} can take this report — its actuals run up to that month.`
                    : "Actuals are up to the end of the period you pick, counted from the start of the plan."}
                </p>
                {periodId === NEW && newPeriod && (
                  <div className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-4">
                    <div className="space-y-1 sm:col-span-4">
                      <Label htmlFor="rp-name">Name</Label>
                      <Input id="rp-name" value={newPeriod.name} onChange={(e) => setNewPeriod({ ...newPeriod, name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rp-start">Start</Label>
                      <Input id="rp-start" type="date" value={newPeriod.startDate} onChange={(e) => setNewPeriod({ ...newPeriod, startDate: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rp-end">End</Label>
                      <Input id="rp-end" type="date" value={newPeriod.endDate} onChange={(e) => setNewPeriod({ ...newPeriod, endDate: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rp-cutoff">Cut-off</Label>
                      <Input id="rp-cutoff" type="date" value={newPeriod.cutOffDate} onChange={(e) => setNewPeriod({ ...newPeriod, cutOffDate: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-sm">
                {(Object.keys(OUTCOME) as ReportRowOutcome[]).filter(k => counts[k] > 0).map(k => (
                  <Badge key={k} variant={OUTCOME[k].variant}>{OUTCOME[k].label}: {counts[k]}</Badge>
                ))}
              </div>

              {preview.issues.length > 0 && (
                <Alert className="border-amber-500/50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle>{preview.issues.length} row{preview.issues.length === 1 ? "" : "s"} in the sheet can't be read as a report</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 space-y-1 text-sm">{preview.issues.map((i, n) => <li key={n}>{i.row != null && <Badge variant="outline" className="mr-2">Row {i.row}</Badge>}{i.message}</li>)}</ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-[320px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...preview.rows].sort((a, b) => Number(a.outcome === "import") - Number(b.outcome === "import") || a.row - b.row).map(r => (
                      <TableRow key={r.row} className="align-top">
                        <TableCell className="text-muted-foreground">{r.row}</TableCell>
                        <TableCell>
                          <p>{r.code} {r.title}</p>
                          <p className="text-xs text-muted-foreground">{r.leadOwner}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.actual}</TableCell>
                        <TableCell>
                          <Badge variant={OUTCOME[r.outcome].variant}>{OUTCOME[r.outcome].label}</Badge>
                          {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {problems.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>The import didn't run</AlertTitle>
                  <AlertDescription><ul className="list-disc pl-4">{problems.map(p => <li key={p}>{p}</li>)}</ul></AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy === "importing"}>Cancel</Button>
          <Button onClick={handleImport} disabled={!canImport}>
            {busy === "importing" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import {counts.import} {counts.import === 1 ? "report" : "reports"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
