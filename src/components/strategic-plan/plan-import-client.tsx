"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, Loader2, AlertCircle, AlertTriangle, Upload, CheckCircle2 } from "lucide-react";
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
import type { ParsedWorkbook } from "@/lib/plan-import/parse-workbook";

type Person = { id: string; name: string };

const ISSUES_SHOWN = 12;

export function PlanImportClient({ users, departments }: { users: Person[]; departments: string[] }) {
  const router = useRouter();
  const { toast } = useToast();
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
      // Suggest a department with the same name as the lead-owner title when one exists.
      setMapping(prev => {
        const next: Record<string, LeadOwnerMapping> = {};
        for (const title of p.leadOwners) {
          const existingDept = departments.find(d => d.toLowerCase() === title.toLowerCase());
          next[title] = prev[title] ?? { userId: "", department: existingDept ?? title };
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
    const noDept = preview.leadOwners.filter(t => !mapping[t]?.department?.trim());
    if (noDept.length) clientProblems.push(`Enter a department for ${noDept.length} lead owner${noDept.length === 1 ? "" : "s"}.`);
  }

  const setOwner = (title: string, patch: Partial<LeadOwnerMapping>) =>
    setMapping(prev => ({ ...prev, [title]: { ...prev[title], ...patch } }));

  const fillUnmapped = (userId: string) =>
    setMapping(prev => Object.fromEntries(Object.entries(prev).map(([t, m]) => [t, m.userId ? m : { ...m, userId }])));

  const handleImport = async () => {
    setAttempted(true);
    if (!file || !preview || errors.length > 0 || clientProblems.length > 0) return;
    setIsImporting(true);
    setServerProblems([]);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("sheet", sheet);
      formData.set("options", JSON.stringify({ name, version, startYear: Number(startYear), endYear: Number(endYear), leadOwners: mapping, importBreakdowns }));
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
          <p className="text-muted-foreground">Create a plan from the cascaded initiatives workbook (pillars, objectives, initiatives, activities and monthly targets).</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> 1. Choose the workbook</CardTitle>
          <CardDescription>
            The sheet needs the columns Code, Pillar, Objective, Initiatives, Major Activities, Deliverables, Activity Weight, Lead/ Owner, Start Date, End Date, Target and one column per month. Rows are placed by their code (1 → 1.1 → 1.1.1 → 1.1.1.1).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
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
                  <AlertTitle>{errors.length} row{errors.length === 1 ? "" : "s"} must be fixed in the workbook before importing</AlertTitle>
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
                The sheet names offices ("Lead/ Owner (Activity)"). Pick the person who holds each one — they become responsible for its activities and receive its breakdown and report requests. Departments that don't exist yet are created.
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
              <datalist id="import-departments">{departments.map(d => <option key={d} value={d} />)}</datalist>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead / Owner in the sheet</TableHead>
                      <TableHead className="text-right">Activities</TableHead>
                      <TableHead>Person</TableHead>
                      <TableHead>Department</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.leadOwners.map(title => {
                      const m = mapping[title] ?? { userId: "", department: "" };
                      const missingUser = attempted && !m.userId;
                      const missingDept = attempted && !m.department?.trim();
                      const isNewDept = !!m.department?.trim() && !departments.some(d => d.toLowerCase() === m.department.trim().toLowerCase());
                      return (
                        <TableRow key={title} className="align-top">
                          <TableCell className="font-medium">{title}</TableCell>
                          <TableCell className="text-right">{activitiesPerOwner(title)}</TableCell>
                          <TableCell className="min-w-[220px]">
                            <Select value={m.userId} onValueChange={(v) => setOwner(title, { userId: v })}>
                              <SelectTrigger className={cn(missingUser && "border-destructive")}><SelectValue placeholder="Choose a person…" /></SelectTrigger>
                              <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                            </Select>
                            {missingUser && <p className="mt-1 text-xs text-destructive">Required</p>}
                          </TableCell>
                          <TableCell className="min-w-[260px]">
                            <Input list="import-departments" value={m.department} onChange={(e) => setOwner(title, { department: e.target.value })} className={cn(missingDept && "border-destructive")} />
                            {missingDept && <p className="mt-1 text-xs text-destructive">Required</p>}
                            {isNewDept && <p className="mt-1 text-xs text-muted-foreground">New department — it will be created.</p>}
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
            <CardContent className="space-y-3 pt-6">
              {attempted && (clientProblems.length > 0 || errors.length > 0) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Can't import yet</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {errors.length > 0 && <li>Fix the {errors.length} row error{errors.length === 1 ? "" : "s"} listed above in the workbook, then choose the file again.</li>}
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
