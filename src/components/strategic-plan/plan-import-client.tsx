"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet, Loader2, AlertCircle, AlertTriangle, Upload, CheckCircle2, UserPlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { importStrategicPlan, previewPlanImport, type LeadOwnerMapping } from "@/actions/plan-import";
import { registerLeadOwnerUser } from "@/actions/users";
import { UserForm } from "@/components/settings/user-form";
import { InviteLinkDialog } from "@/components/settings/invite-link-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ParsedWorkbook } from "@/lib/plan-import/parse-workbook";
import type { ImportPeriodSettings } from "@/lib/plan-import/write-plan";
import { monthKey, monthLabel } from "@/lib/monthly-breakdown";

type Person = { id: string; name: string; email?: string; leadOwner?: string | null };

const ISSUES_SHOWN = 12;
const CUT_OFF_DAYS = 10;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => ymd(new Date(new Date(date).getTime() + days * 86400000));
/** A period from the first day of month `fromKey` ("YYYY-MM") to the last day of the month `months - 1` after it. */
function periodFor(fromKey: string, months: number): ImportPeriodSettings {
  const [y, m] = fromKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m - 1 + months, 0));
  const first = monthLabel(fromKey), last = monthLabel(monthKey(end));
  return { name: first === last ? first : `${first} to ${last}`, startDate: ymd(start), endDate: ymd(end), cutOffDate: addDays(ymd(end), CUT_OFF_DAYS) };
}
/** The period right after `last`, as many months long. */
function nextPeriod(last: ImportPeriodSettings): ImportPeriodSettings {
  const months = (Number(last.endDate.slice(0, 4)) - Number(last.startDate.slice(0, 4))) * 12 + Number(last.endDate.slice(5, 7)) - Number(last.startDate.slice(5, 7)) + 1;
  return periodFor(monthKey(addDays(last.endDate, 1)), Math.max(1, months));
}

const sameText = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export function PlanImportClient({ users: initialUsers, canRegister = false }: { users: Person[]; canRegister?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = React.useState<Person[]>(initialUsers);
  const [registeringTitle, setRegisteringTitle] = React.useState<string | null>(null);
  const [manualInvite, setManualInvite] = React.useState<{ name: string; email: string; link: string } | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ParsedWorkbook | null>(null);
  const [sheet, setSheet] = React.useState<string>("");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isReading, setIsReading] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [showAllIssues, setShowAllIssues] = React.useState(false);
  const [name, setName] = React.useState("");
  const [version, setVersion] = React.useState("1.0");
  const [startYear, setStartYear] = React.useState("");
  const [endYear, setEndYear] = React.useState("");
  const [importBreakdowns, setImportBreakdowns] = React.useState(true);
  const [periods, setPeriods] = React.useState<ImportPeriodSettings[]>([]);
  const [importReport, setImportReport] = React.useState(true);
  const [mapping, setMapping] = React.useState<Record<string, LeadOwnerMapping>>({});
  const [serverProblems, setServerProblems] = React.useState<string[]>([]);
  const [attempted, setAttempted] = React.useState(false);

  const readFile = async (chosen: File, sheetName?: string) => {
    setIsReading(true);
    setLoadError(null);
    setServerProblems([]);
    try {
      const formData = new FormData();
      formData.set("file", chosen);
      if (sheetName) formData.set("sheet", sheetName);
      const result = await previewPlanImport(formData);
      if (!result.success) {
        setPreview(null);
        setLoadError(result.message);
        return;
      }
      const p = result.preview;
      setPreview(p);
      setSheet(p.sheetName);
      setName(p.planTitle || chosen.name.replace(/\.[^.]+$/, ""));
      setStartYear(p.startYear ? String(p.startYear) : "");
      setEndYear(p.endYear ? String(p.endYear) : "");
      // Suggest the period the sheet's report covers: from the plan's first month to the month it runs to.
      const reportMonths = p.reportThroughMonth ? p.months.indexOf(p.reportThroughMonth) + 1 : 0;
      setPeriods(p.counts.withReport > 0 && reportMonths > 0 ? [periodFor(p.months[0], reportMonths)] : []);
      setImportReport(true);
      // Match each office to the person registered as holding it (Users → Lead Owner).
      setMapping(prev => {
        const next: Record<string, LeadOwnerMapping> = {};
        for (const title of p.leadOwners) {
          if (prev[title]) { next[title] = prev[title]; continue; }
          const holder = users.find(u => sameText(u.leadOwner, title));
          next[title] = { userId: holder?.id ?? "" };
        }
        return next;
      });
    } catch {
      setLoadError("The file couldn't be uploaded. Check your connection and try again.");
    } finally {
      setIsReading(false);
    }
  };

  const handleFile = (chosen: File | null) => {
    setFile(chosen);
    setPreview(null);
    setAttempted(false);
    if (chosen) readFile(chosen);
  };

  const activities = preview ? preview.pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.flatMap(i => i.activities))) : [];
  const countedWeight = activities.filter(a => a.countsTowardWeight).reduce((s, a) => s + a.weight, 0);
  const activitiesPerOwner = (title: string) => activities.filter(a => a.leadOwner === title).length;
  const errors = preview?.issues.filter(i => i.severity === "error") ?? [];
  const warnings = preview?.issues.filter(i => i.severity === "warning") ?? [];

  const hasReport = !!preview && preview.counts.withReport > 0;
  const reportPeriodIndex = preview?.reportThroughMonth ? periods.findIndex(p => !!p.endDate && monthKey(p.endDate) === preview.reportThroughMonth) : -1;
  // A report is measured against the monthly plan, so only rows whose breakdown is imported keep theirs.
  const reportsToImport = activities.filter(a => a.report && importBreakdowns && !a.breakdownProblem).length;

  const clientProblems: string[] = [];
  if (preview) {
    if (!name.trim()) clientProblems.push("Give the plan a name.");
    if (!version.trim()) clientProblems.push("Give the plan a version.");
    const sy = Number(startYear), ey = Number(endYear);
    if (!Number.isInteger(sy) || sy < 2000 || sy > 2100) clientProblems.push("Enter a valid start year.");
    if (!Number.isInteger(ey) || ey < 2000 || ey > 2100) clientProblems.push("Enter a valid end year.");
    else if (ey < sy) clientProblems.push("End year must be the same as or after the start year.");
    const unmappedUsers = preview.leadOwners.filter(t => !mapping[t]?.userId);
    if (unmappedUsers.length) clientProblems.push(`Pick a user for ${unmappedUsers.length} lead owner${unmappedUsers.length === 1 ? "" : "s"}.`);
    if (periods.some(p => !p.name.trim())) clientProblems.push("Give every reporting period a name.");
    if (periods.some(p => !p.startDate || !p.endDate || !p.cutOffDate)) clientProblems.push("Fill in every reporting period's start, end and cut-off dates.");
    if (hasReport && importReport && preview.reportThroughMonth && reportPeriodIndex < 0) {
      clientProblems.push(`Add a reporting period that ends in ${monthLabel(preview.reportThroughMonth)} for the sheet's report, or turn off the report import.`);
    }
  }

  const setPeriod = (index: number, patch: Partial<ImportPeriodSettings>) =>
    setPeriods(prev => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const addPeriod = () =>
    setPeriods(prev => [...prev, prev.length ? nextPeriod(prev[prev.length - 1]) : periodFor(preview?.months[0] ?? monthKey(new Date()), 2)]);

  const setOwner = (title: string, patch: Partial<LeadOwnerMapping>) =>
    setMapping(prev => ({ ...prev, [title]: { ...prev[title], ...patch } }));

  const fillUnmapped = (userId: string) =>
    setMapping(prev => Object.fromEntries(Object.entries(prev).map(([t, m]) => [t, m.userId ? m : { ...m, userId }])));

  /** Everything the sheet tells us about an office, shown when registering the person who holds it. */
  const officeDetails = (title: string) => {
    const owned = activities.filter(a => a.leadOwner === title);
    const initiatives = new Set(preview?.pillars.flatMap(p => p.objectives.flatMap(o => o.initiatives.filter(i => i.activities.some(a => a.leadOwner === title)).map(i => i.title))) ?? []);
    const collaborators = Array.from(new Set(owned.flatMap(a => a.collaborators.split(/\s*[,;]\s*/)).map(s => s.trim()).filter(Boolean)));
    return { owned, initiatives: Array.from(initiatives), collaborators };
  };

  const handleRegistered = (title: string, person: Person, invited: boolean) => {
    setUsers(prev => [...prev, person].sort((a, b) => a.name.localeCompare(b.name)));
    setOwner(title, { userId: person.id });
    setRegisteringTitle(null);
    toast({ title: "User registered", description: `${person.name} was created as ${title} and assigned to its ${activitiesPerOwner(title)} activities.${invited ? " They've been emailed a link to set their password." : ""}` });
  };

  const handleImport = async () => {
    setAttempted(true);
    if (!file || !preview || errors.length > 0 || clientProblems.length > 0) return;
    setIsImporting(true);
    setServerProblems([]);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("sheet", sheet);
      formData.set("options", JSON.stringify({ name, version, startYear: Number(startYear), endYear: Number(endYear), leadOwners: mapping, importBreakdowns, periods, importReport: hasReport && importReport }));
      const result = await importStrategicPlan(formData);
      if (!result.success) {
        setServerProblems(result.problems ?? [result.message]);
        toast({ title: "Import failed", description: result.message, variant: "destructive" });
        return;
      }
      toast({ title: "Plan imported", description: `"${name}" was created as a draft. Review it, then publish.` });
      router.push(`/strategic-plan/${result.planId}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/strategic-plan"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Strategic Plan</h1>
          <p className="text-muted-foreground">Create a plan from an .xlsx file.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> 1. Choose the file</CardTitle>
          <CardDescription>
            The sheet needs the columns Code, Pillar, Objective, Initiatives, Major Activities, Deliverables, Activity Weight, Lead/ Owner, Start Date, End Date, Target and one column per month. Rows are placed by their code (1 → 1.1 → 1.1.1 → 1.1.1.1). If the sheet also has the report columns ("Actual up to the reporting period", Completion Date, Accomplished Tasks, Reasons for Variation, Way Forward, Issues that need Escalation), its report can be imported too.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <a href="/api/template/plan" download>
                <Download className="mr-2 h-4 w-4" /> Download template
              </a>
            </Button>
            <Input type="file" accept=".xlsx,.xlsm,.xls" className="max-w-md" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} disabled={isReading || isImporting} />
            {isReading && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading…</span>}
          </div>
          {preview && preview.sheetNames.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <Label>Sheet</Label>
              <Select value={sheet} onValueChange={(v) => { setSheet(v); if (file) readFile(file, v); }} disabled={isReading}>
                <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
                <SelectContent>{preview.sheetNames.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">Picked automatically — change it if the plan is on another sheet.</span>
            </div>
          )}
          {loadError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{loadError}</AlertDescription></Alert>}
        </CardContent>
      </Card>

      {preview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Check what was found</CardTitle>
              <CardDescription>Sheet "{preview.sheetName}" · months {preview.months.length ? `${preview.months[0]} to ${preview.months[preview.months.length - 1]}` : "none"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Stat label="Pillars" value={preview.counts.pillars} />
                <Stat label="Objectives" value={preview.counts.objectives} />
                <Stat label="Initiatives" value={preview.counts.initiatives} />
                <Stat label="Activities" value={preview.counts.activities} sub={preview.counts.duplicates ? `${preview.counts.duplicates} shared (no weight)` : undefined} />
                <Stat label="With monthly breakdown" value={preview.counts.withBreakdown} />
                <Stat label="Total weight" value={`${countedWeight.toFixed(2)}%`} tone={Math.abs(countedWeight - 100) < 0.01 ? "good" : "bad"} sub={Math.abs(countedWeight - 100) < 0.01 ? "Ready to publish" : "Must be 100% to publish"} />
              </div>

              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{errors.length} row{errors.length === 1 ? "" : "s"} must be fixed in the file before importing</AlertTitle>
                  <AlertDescription><IssueList issues={errors} /></AlertDescription>
                </Alert>
              )}
              {warnings.length > 0 && (
                <Alert className="border-amber-500/50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle>{warnings.length} warning{warnings.length === 1 ? "" : "s"} — the import can go ahead</AlertTitle>
                  <AlertDescription>
                    <IssueList issues={showAllIssues ? warnings : warnings.slice(0, ISSUES_SHOWN)} />
                    {warnings.length > ISSUES_SHOWN && (
                      <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setShowAllIssues(s => !s)}>
                        {showAllIssues ? "Show fewer" : `Show all ${warnings.length}`}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <details className="rounded-md border p-3 text-sm">
                <summary className="cursor-pointer font-medium">Preview the structure</summary>
                <ul className="mt-2 space-y-2">
                  {preview.pillars.map(p => (
                    <li key={p.code}>
                      <span className="font-semibold">{p.title}</span>
                      <ul className="ml-4 list-disc">
                        {p.objectives.map(o => (
                          <li key={o.code}>{o.statement}
                            <ul className="ml-4 list-[circle] text-muted-foreground">
                              {o.initiatives.map(i => <li key={i.code}>{i.code} {i.title} — {i.activities.length} activit{i.activities.length === 1 ? "y" : "ies"}</li>)}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Plan details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="imp-name">Plan name</Label>
                  <Input id="imp-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="imp-start">Start year</Label>
                  <Input id="imp-start" type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="imp-end">End year</Label>
                  <Input id="imp-end" type="number" value={endYear} onChange={(e) => setEndYear(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="imp-version">Version</Label>
                  <Input id="imp-version" value={version} onChange={(e) => setVersion(e.target.value)} />
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Switch id="imp-breakdowns" checked={importBreakdowns} onCheckedChange={setImportBreakdowns} />
                <div>
                  <Label htmlFor="imp-breakdowns">Import the monthly targets as approved breakdowns</Label>
                  <p className="text-xs text-muted-foreground">
                    {importBreakdowns
                      ? `${preview.counts.withBreakdown} activities get their breakdown from the sheet, already approved. The other ${preview.counts.activities - preview.counts.withBreakdown} need a breakdown request after publishing.`
                      : "No breakdowns are imported — after publishing, send breakdown requests so each owner fills in their own."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Match lead owners to people</CardTitle>
              <CardDescription>
                The sheet names offices ("Lead/ Owner (Activity)"). Pick the person who holds each one — they become responsible for its activities and receive its breakdown and report requests.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Give every unmatched office to:</span>
                <Select onValueChange={fillUnmapped}>
                  <SelectTrigger className="w-[240px]"><SelectValue placeholder="Choose a person…" /></SelectTrigger>
                  <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead / Owner in the sheet</TableHead>
                      <TableHead className="text-right">Activities</TableHead>
                      <TableHead>Person</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.leadOwners.map(title => {
                      const m = mapping[title] ?? { userId: "" };
                      const missingUser = attempted && !m.userId;
                      return (
                        <TableRow key={title} className="align-top">
                          <TableCell className="font-medium">{title}</TableCell>
                          <TableCell className="text-right">{activitiesPerOwner(title)}</TableCell>
                          <TableCell className="min-w-[280px]">
                            <div className="flex items-center gap-2">
                              <Select value={m.userId} onValueChange={(v) => setOwner(title, { userId: v })}>
                                <SelectTrigger className={cn(missingUser && "border-destructive")}><SelectValue placeholder="Choose a person…" /></SelectTrigger>
                                <SelectContent>
                                  {users.map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                      {u.name}{u.leadOwner ? ` — ${u.leadOwner}` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {canRegister && !users.some(u => sameText(u.leadOwner, title)) && (
                                <Button type="button" variant="outline" size="sm" onClick={() => setRegisteringTitle(title)}>
                                  <UserPlus className="mr-1 h-4 w-4" /> Register
                                </Button>
                              )}
                            </div>
                            {missingUser && <p className="mt-1 text-xs text-destructive">Required — pick someone{canRegister ? " or register the person who holds this office" : ""}.</p>}
                            {m.userId && sameText(users.find(u => u.id === m.userId)?.leadOwner, title) && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" /> Registered as {title}</p>
                            )}
                            {!users.some(u => sameText(u.leadOwner, title)) && !m.userId && (
                              <p className="mt-1 text-xs text-amber-600">No one is registered as this office yet.</p>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Reporting periods</CardTitle>
              <CardDescription>
                Created with the plan — change them later in Settings → Reporting Periods. A period's report is "up to" its end date: plan and actual both count from the start of the plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasReport && (
                <div className="flex items-start gap-3 rounded-md border p-3">
                  <Switch id="imp-report" checked={importReport} onCheckedChange={setImportReport} />
                  <div>
                    <Label htmlFor="imp-report">
                      Import the sheet's report{preview.reportThroughMonth ? ` up to ${monthLabel(preview.reportThroughMonth)}` : ""} as approved reports
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {!importReport
                        ? "The report columns are ignored — send a report request after publishing instead."
                        : `${reportsToImport} of the ${preview.counts.withReport} rows with a report are imported (actual, completion date and comments) onto the period ending in ${preview.reportThroughMonth ? monthLabel(preview.reportThroughMonth) : "the report's month"}.${preview.counts.withReport > reportsToImport ? ` The other ${preview.counts.withReport - reportsToImport} have no imported breakdown to measure them against.` : ""}`}
                    </p>
                  </div>
                </div>
              )}
              {periods.length === 0 ? (
                <p className="text-sm text-muted-foreground">No periods yet — the plan can be imported without any.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Cut-off</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periods.map((p, index) => (
                        <TableRow key={index} className="align-top">
                          <TableCell className="min-w-[200px]">
                            <Input value={p.name} onChange={(e) => setPeriod(index, { name: e.target.value })} className={cn(attempted && !p.name.trim() && "border-destructive")} />
                            {hasReport && importReport && index === reportPeriodIndex && <Badge variant="secondary" className="mt-1">Gets the sheet's report</Badge>}
                          </TableCell>
                          <TableCell><Input type="date" value={p.startDate} onChange={(e) => setPeriod(index, { startDate: e.target.value })} /></TableCell>
                          <TableCell><Input type="date" value={p.endDate} onChange={(e) => setPeriod(index, { endDate: e.target.value })} /></TableCell>
                          <TableCell><Input type="date" value={p.cutOffDate} onChange={(e) => setPeriod(index, { cutOffDate: e.target.value })} /></TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${p.name || "period"}`} onClick={() => setPeriods(prev => prev.filter((_, i) => i !== index))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addPeriod}>
                <Plus className="mr-1 h-4 w-4" /> Add period
              </Button>
            </CardContent>
          </Card>

          <Dialog open={registeringTitle !== null} onOpenChange={(open) => { if (!open) setRegisteringTitle(null); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Register {registeringTitle}</DialogTitle>
                <DialogDescription>
                  Create the account for the person who holds this office. They'll be linked to it, so future imports match them automatically.
                </DialogDescription>
              </DialogHeader>
              {registeringTitle && (() => {
                const details = officeDetails(registeringTitle);
                return (
                  <>
                    <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
                      <p className="font-medium">From the plan</p>
                      <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1">
                        <dt className="text-muted-foreground">Lead / Owner</dt><dd className="font-medium">{registeringTitle}</dd>
                        <dt className="text-muted-foreground">Activities</dt><dd>{details.owned.length} in {details.initiatives.length} initiative{details.initiatives.length === 1 ? "" : "s"}</dd>
                        {details.collaborators.length > 0 && (<><dt className="text-muted-foreground">Works with</dt><dd>{details.collaborators.join(", ")}</dd></>)}
                      </dl>
                      <details>
                        <summary className="cursor-pointer text-xs text-muted-foreground">Show the activities</summary>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                          {details.owned.map(a => <li key={`${a.row}`}>{a.code} {a.title}{a.deliverable ? ` — ${a.deliverable}` : ""}</li>)}
                        </ul>
                      </details>
                    </div>
                    <UserForm
                      user={null}
                      fixedLeadOwnerName={registeringTitle}
                      submitLabel="Register & assign"
                      onCancel={() => setRegisteringTitle(null)}
                      onSubmit={async (values) => {
                        const result = await registerLeadOwnerUser({
                          name: values.name,
                          email: values.email,
                          roleId: values.roleId,
                          leadOwnerName: registeringTitle,
                        });
                        if (!result.success) return result; // shown on the form so it can be corrected
                        handleRegistered(registeringTitle, {
                          id: result.user.id,
                          name: result.user.name,
                          email: result.user.email,
                          leadOwner: result.user.leadOwner ?? registeringTitle,
                        }, result.invite.emailed);
                        if (!result.invite.emailed && result.invite.link) {
                          setManualInvite({ name: result.user.name, email: result.user.email, link: result.invite.link });
                        }
                      }}
                    />
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>
          <InviteLinkDialog invite={manualInvite} onClose={() => setManualInvite(null)} />

          <Card>
            <CardContent className="space-y-3 pt-6">
              {attempted && (clientProblems.length > 0 || errors.length > 0) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Can't import yet</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {errors.length > 0 && <li>Fix the {errors.length} row error{errors.length === 1 ? "" : "s"} listed above in the file, then choose the file again.</li>}
                      {clientProblems.map(p => <li key={p}>{p}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {serverProblems.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>The server rejected the import</AlertTitle>
                  <AlertDescription><ul className="list-disc pl-4">{serverProblems.map(p => <li key={p}>{p}</li>)}</ul></AlertDescription>
                </Alert>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  The plan is created as a <span className="font-medium text-foreground">draft</span>. Review it, then publish and send requests from the plan page.
                </p>
                <Button onClick={handleImport} disabled={isImporting || isReading}>
                  {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Import {preview.counts.activities} activities
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold", tone === "good" && "text-green-600", tone === "bad" && "text-destructive")}>
        {tone === "good" && <CheckCircle2 className="mr-1 inline h-4 w-4" />}{value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function IssueList({ issues }: { issues: ParsedWorkbook["issues"] }) {
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {issues.map((issue, index) => (
        <li key={index}>{issue.row != null && <Badge variant="outline" className="mr-2">Row {issue.row}</Badge>}{issue.message}</li>
      ))}
    </ul>
  );
}
