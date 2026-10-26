"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, RotateCcw, Sparkles, SpellCheck, Table2, Trash2, X } from "lucide-react";
import { generateReportSummary, resetSummarySection, saveSummarySection, setSectionTables, updateSummaryCorrections } from "@/actions/report-summary";
import { parseBody, type SummaryCorrection } from "@/lib/report-summary";
import type { SummaryTable, TableOption } from "@/lib/summary-tables";
import { describeError } from "@/lib/action-error";
import { useToast } from "@/hooks/use-toast";
import { ExportMenu } from "@/components/export-menu";
import { EmptyState } from "@/components/empty-state";
import { PeriodSelect, type PeriodSelectOption } from "./period-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface SummarySection { id: string; key: string; level: number; heading: string; body: string; tables: string[]; edited: boolean; editedAt: string | null; updatedAt: string }

export interface SummaryPageData {
  periods: (PeriodSelectOption & { startDate: string; endDate: string })[];
  selected: (PeriodSelectOption & { startDate: string; endDate: string }) | null;
  hasReports: boolean;
  summary: { id: string; generatedAt: string; sections: SummarySection[] } | null;
  /** Built from live data for the tables the sections use. */
  tables: Record<string, SummaryTable>;
  tableCatalog: TableOption[];
  corrections: SummaryCorrection[];
  canEdit: boolean;
  canExport: boolean;
}

/** The report summary for one period: generate it, edit each section, and export it to Word or PDF. */
export function ReportSummaryEditor({ planId, data }: { planId: string; data: SummaryPageData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [generating, setGenerating] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [correctionsOpen, setCorrectionsOpen] = React.useState(false);
  const { selected, summary, canEdit } = data;

  if (!selected) {
    return <EmptyState art="chart" title="No reporting periods yet" description="Create a reporting period and send a report request first; the summary is written from the approved reports." className="rounded-xl border border-dashed border-border/70 bg-card/60" />;
  }

  const editedCount = summary?.sections.filter(s => s.edited).length ?? 0;

  const generate = async (overwriteEdited: boolean) => {
    setConfirmOpen(false);
    setGenerating(true);
    try {
      const result = await generateReportSummary(selected.id, { overwriteEdited });
      if (!result.success) { toast({ title: "Couldn't generate the summary", description: result.message, variant: "destructive" }); return; }
      toast({ title: summary ? "Summary regenerated" : "Summary generated", description: result.kept ? `Your edits in ${result.kept} section${result.kept === 1 ? " were" : "s were"} kept.` : "Review each section and edit it where needed." });
      router.refresh();
    } catch (error) {
      toast({ title: "Couldn't generate the summary", description: describeError(error), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const onGenerateClick = () => (editedCount > 0 ? setConfirmOpen(true) : generate(false));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Reporting period:</span>
          <PeriodSelect periods={data.periods} value={selected.id} planId={planId} basePath="/reports/summary" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setCorrectionsOpen(true)}>
              <SpellCheck className="mr-2 h-4 w-4" /> Wording corrections
            </Button>
          )}
          {canEdit && data.hasReports && (
            <Button size="sm" onClick={onGenerateClick} disabled={generating}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {summary ? "Regenerate" : "Generate summary"}
            </Button>
          )}
          {data.canExport && summary && (
            <ExportMenu options={[
              { kind: "word", label: `${selected.name} summary (Word)`, description: "Editable .docx with cover page, contents and every section as edited here.", href: `/api/export/summary/${selected.id}?format=docx` },
              { kind: "pdf", label: `${selected.name} summary (PDF)`, description: "The same summary, ready to share.", href: `/api/export/summary/${selected.id}?format=pdf` },
            ]} />
          )}
        </div>
      </div>

      {!summary ? (
        <EmptyState
          art="writing"
          title={data.hasReports ? "No summary yet" : "No reports yet"}
          description={data.hasReports
            ? (canEdit
                ? <>Generate a first draft from {selected.name}&apos;s approved reports. Each section can then be edited before you export it.</>
                : <>No summary has been written for {selected.name} yet. Someone with permission to edit the report summary needs to generate it.</>)
            : <>No reports have been requested for {selected.name} yet. Send a report request first; the summary is written from the approved reports.</>}
          className="rounded-xl border border-dashed border-border/70 bg-card/60"
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Generated {format(new Date(summary.generatedAt), "PPp")} from approved reports.
            {editedCount > 0 && ` ${editedCount} section${editedCount === 1 ? " has" : "s have"} been edited.`}
            {canEdit && " Regenerating keeps edited sections unless you choose to replace them."}
          </p>
          <div className="space-y-3">
            {summary.sections.map(section => (
              <SectionCard key={section.id} section={section} canEdit={canEdit} tables={data.tables} catalog={data.tableCatalog} />
            ))}
          </div>
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate the summary?</AlertDialogTitle>
            <AlertDialogDescription>
              {editedCount} section{editedCount === 1 ? " has" : "s have"} been edited. You can keep those edits and refresh only the other sections, or replace everything with newly generated text.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => generate(true)}>Replace edited sections too</Button>
            <AlertDialogAction onClick={() => generate(false)}>Keep my edits</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canEdit && <CorrectionsDialog open={correctionsOpen} onOpenChange={setCorrectionsOpen} initial={data.corrections} />}
    </div>
  );
}

function SectionBody({ body }: { body: string }) {
  const blocks = parseBody(body);
  if (blocks.length === 0) return <p className="text-sm italic text-muted-foreground">This section is empty.</p>;
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground">
      {blocks.map((b, n) => b.type === "paragraph"
        ? <p key={n} className="text-justify">{b.text}</p>
        : <ul key={n} className="list-disc space-y-1 pl-5">{b.items.map((item, m) => <li key={m}>{item}</li>)}</ul>)}
    </div>
  );
}

function SectionCard({ section, canEdit, tables, catalog }: { section: SummarySection; canEdit: boolean; tables: Record<string, SummaryTable>; catalog: TableOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(section.body);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (!editing) setDraft(section.body); }, [section.body, editing]);

  const run = async (action: () => Promise<{ success: boolean; message?: string }>, done: string) => {
    setBusy(true);
    try {
      const result = await action();
      if (!result.success) { toast({ title: "Not saved", description: result.message, variant: "destructive" }); return; }
      toast({ title: done });
      setEditing(false);
      router.refresh();
    } catch (error) {
      toast({ title: "Not saved", description: describeError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`rounded-xl border border-border/60 bg-card p-4 ${section.level === 2 ? "sm:ml-6" : ""}`}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={section.level === 1 ? "text-base font-semibold text-foreground" : "text-sm font-semibold text-foreground"}>{section.heading}</h2>
          {section.edited && <Badge variant="secondary">Edited{section.editedAt ? ` ${format(new Date(section.editedAt), "PP")}` : ""}</Badge>}
        </div>
        {canEdit && !editing && (
          <div className="flex gap-1">
            {section.edited && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => resetSummarySection(section.id), "Section reset to the generated text")}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={Math.min(24, Math.max(6, draft.split("\n").length + Math.ceil(draft.length / 110)))}
            className="font-[inherit] text-sm leading-relaxed"
            aria-label={`Text of ${section.heading}`}
            maxLength={20000}
          />
          <p className="text-xs text-muted-foreground">Leave a blank line between paragraphs. Start a line with “- ” to make it a bullet point.</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => saveSummarySection(section.id, draft, section.updatedAt), "Section saved")}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setDraft(section.body); setEditing(false); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <SectionBody body={section.body} />
      )}

      {section.tables.map((key, n) => {
        const table = tables[key];
        const option = catalog.find(o => o.key === key);
        const move = (to: number) => {
          const next = [...section.tables];
          next.splice(n, 1);
          next.splice(to, 0, key);
          return next;
        };
        return (
          <div key={key} className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">{table?.title ?? option?.label ?? "Table"}</h3>
              {canEdit && (
                <div className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy || n === 0} onClick={() => run(() => setSectionTables(section.id, move(n - 1), section.updatedAt), "Table moved")} aria-label="Move table up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy || n === section.tables.length - 1} onClick={() => run(() => setSectionTables(section.id, move(n + 1), section.updatedAt), "Table moved")} aria-label="Move table down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} onClick={() => run(() => setSectionTables(section.id, section.tables.filter(k => k !== key), section.updatedAt), "Table removed")} aria-label="Remove table"><X className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
            {table ? <SummaryTableView table={table} /> : <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">No data for this table in this period; it is left out of the export.</p>}
          </div>
        );
      })}

      {canEdit && !editing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="mt-3" disabled={busy || section.tables.length >= 10}>
              <Table2 className="mr-1.5 h-3.5 w-3.5" /> Add table
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[60vh] w-96 overflow-y-auto">
            <DropdownMenuLabel>Tables from the dashboard and report</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {catalog.filter(o => !section.tables.includes(o.key)).map(o => (
              <DropdownMenuItem key={o.key} className="flex-col items-start gap-0.5" onSelect={() => run(() => setSectionTables(section.id, [...section.tables, o.key], section.updatedAt), "Table added")}>
                <span className="font-medium">{o.label}</span>
                <span className="text-xs text-muted-foreground">{o.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </section>
  );
}

function SummaryTableView({ table }: { table: SummaryTable }) {
  const center = (c: number) => (table.center?.includes(c) ? "text-center" : "");
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            {table.head.map((h, c) => <TableHead key={c} className={`whitespace-nowrap ${center(c)}`}>{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row, n) => (
            <TableRow key={n} className={table.boldRows?.includes(n) ? "font-semibold" : ""}>
              {row.map((v, c) => <TableCell key={c} className={`whitespace-pre-line align-top ${center(c)} ${/^-\d/.test(v) ? "text-red-600" : ""}`}>{v}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {table.note && <p className="px-3 py-2 text-xs text-muted-foreground">{table.note}</p>}
    </div>
  );
}

function CorrectionsDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (open: boolean) => void; initial: SummaryCorrection[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SummaryCorrection[]>(initial);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (open) setRows(initial.length ? initial : [{ find: "", replace: "" }]); }, [open, initial]);

  const update = (n: number, patch: Partial<SummaryCorrection>) => setRows(rs => rs.map((r, m) => (m === n ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true);
    try {
      const result = await updateSummaryCorrections(rows.filter(r => r.find.trim()));
      if (!result.success) { toast({ title: "Not saved", description: result.message, variant: "destructive" }); return; }
      toast({ title: "Wording corrections saved", description: "They apply the next time the summary is generated." });
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast({ title: "Not saved", description: describeError(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Wording corrections</DialogTitle>
          <DialogDescription>
            Recurring typos or terms to fix in owners&apos; comments when the summary is generated, e.g. “pain pints” → “pain points”. Matches whole words, ignoring case. Applies to every plan.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {rows.map((r, n) => (
            <div key={n} className="flex items-center gap-2">
              <Input value={r.find} onChange={e => update(n, { find: e.target.value })} placeholder="Find" maxLength={100} aria-label={`Correction ${n + 1}: find`} />
              <span className="text-muted-foreground">→</span>
              <Input value={r.replace} onChange={e => update(n, { replace: e.target.value })} placeholder="Replace with" maxLength={200} aria-label={`Correction ${n + 1}: replace with`} />
              <Button variant="ghost" size="icon" onClick={() => setRows(rs => rs.filter((_, m) => m !== n))} aria-label={`Remove correction ${n + 1}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows(rs => [...rs, { find: "", replace: "" }])}>
            <Plus className="mr-1.5 h-4 w-4" /> Add correction
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
