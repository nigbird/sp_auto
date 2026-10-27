"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Check, Filter, Loader2, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Sparkles, SpellCheck, Table2, Trash2, Type, X } from "lucide-react";
import {
  addSummarySection, deleteReportSummary, deleteSummarySection, generateReportSummary, renameSummarySection, resetSummarySection,
  restoreSummarySection, saveSummarySection, setSectionTables, updateSummaryCorrections,
} from "@/actions/report-summary";
import { parseBody, type SummaryCorrection } from "@/lib/report-summary";
import { parseTableKey, tableKeyOf, type FilterField, type FilterValues, type SummaryTable, type TableOption } from "@/lib/summary-tables";
import { describeError } from "@/lib/action-error";
import { useToast } from "@/hooks/use-toast";
import { ExportMenu } from "@/components/export-menu";
import { EmptyState } from "@/components/empty-state";
import { PeriodSelect, type PeriodSelectOption } from "./period-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface SummarySection {
  id: string;
  key: string;
  level: number;
  heading: string;
  body: string;
  tables: string[];
  /** Added by someone rather than generated. */
  custom: boolean;
  headingEdited: boolean;
  edited: boolean;
  editedAt: string | null;
  updatedAt: string;
}

export interface SummaryPageData {
  periods: (PeriodSelectOption & { startDate: string; endDate: string })[];
  selected: (PeriodSelectOption & { startDate: string; endDate: string }) | null;
  hasReports: boolean;
  summary: { id: string; generatedAt: string; sections: SummarySection[]; removed: { id: string; heading: string }[] } | null;
  /** Built from live data for the tables the sections use. */
  tables: Record<string, SummaryTable>;
  tableCatalog: TableOption[];
  corrections: SummaryCorrection[];
  canEdit: boolean;
  canExport: boolean;
}

type ActionResult = { success: boolean; message?: string };

/** Runs a server action with a busy flag and a toast, then refreshes the page. */
function useAction() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(async (action: () => Promise<ActionResult>, done: string, onDone?: () => void) => {
    setBusy(true);
    try {
      const result = await action();
      if (!result.success) { toast({ title: "Not saved", description: result.message, variant: "destructive" }); return false; }
      toast({ title: done });
      onDone?.();
      router.refresh();
      return true;
    } catch (error) {
      toast({ title: "Not saved", description: describeError(error), variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  }, [router, toast]);
  return { busy, run };
}

type SectionDialogState = { mode: "add"; afterId: string | null } | { mode: "rename"; section: SummarySection };

/** The report summary for one period: generate it, edit and arrange its sections and tables, and export it to Word or PDF. */
export function ReportSummaryEditor({ planId, data }: { planId: string; data: SummaryPageData }) {
  const router = useRouter();
  const { toast } = useToast();
  const { busy, run } = useAction();
  const [generating, setGenerating] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [correctionsOpen, setCorrectionsOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [sectionDialog, setSectionDialog] = React.useState<SectionDialogState | null>(null);
  const [removing, setRemoving] = React.useState<SummarySection | null>(null);
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

  const onGenerateClick = () => (editedCount > 0 || (summary?.removed.length ?? 0) > 0 ? setConfirmOpen(true) : generate(false));

  const removeSummary = async () => {
    setDeleting(true);
    try {
      const result = await deleteReportSummary(selected.id);
      if (!result.success) { toast({ title: "Couldn't delete the summary", description: result.message, variant: "destructive" }); return; }
      setDeleteOpen(false);
      toast({ title: "Summary deleted", description: `You can generate a new one for ${selected.name} at any time.` });
      router.refresh();
    } catch (error) {
      toast({ title: "Couldn't delete the summary", description: describeError(error), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

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
          {canEdit && summary && (
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)} disabled={generating || deleting}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
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
            {canEdit && " Regenerating keeps your edits, renamed titles, removed sections and the sections you added, unless you choose to replace them."}
          </p>
          <div className="space-y-3">
            {summary.sections.map(section => (
              <SectionCard
                key={section.id}
                section={section}
                canEdit={canEdit}
                tables={data.tables}
                catalog={data.tableCatalog}
                onRename={() => setSectionDialog({ mode: "rename", section })}
                onAddBelow={() => setSectionDialog({ mode: "add", afterId: section.id })}
                onDelete={() => setRemoving(section)}
              />
            ))}
          </div>

          {canEdit && (
            <Button variant="outline" className="w-full border-dashed" onClick={() => setSectionDialog({ mode: "add", afterId: null })}>
              <Plus className="mr-2 h-4 w-4" /> Add section
            </Button>
          )}

          {canEdit && summary.removed.length > 0 && (
            <div className="rounded-xl border border-dashed border-border/70 p-4">
              <h3 className="text-sm font-medium text-foreground">Removed sections ({summary.removed.length})</h3>
              <p className="mb-2 text-xs text-muted-foreground">Left out of the summary and its exports. Regenerating won&apos;t bring them back; restore them here.</p>
              <ul className="space-y-1">
                {summary.removed.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
                    <span className="min-w-0 truncate text-muted-foreground">{r.heading}</span>
                    <Button variant="ghost" size="sm" className="h-7 shrink-0" disabled={busy} onClick={() => run(() => restoreSummarySection(r.id), "Section restored")}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate the summary?</AlertDialogTitle>
            <AlertDialogDescription>
              You can keep your changes (edited text, renamed titles, removed sections and chosen tables) and refresh only the rest, or replace everything with a fresh draft. Sections you added yourself are kept either way.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => generate(true)}>Replace everything</Button>
            <AlertDialogAction onClick={() => generate(false)}>Keep my changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={open => { if (!deleting) setDeleteOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the {selected.name} summary?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all {summary?.sections.length ?? 0} sections{editedCount > 0 ? `, including edits in ${editedCount} section${editedCount === 1 ? "" : "s"},` : ""} and the tables chosen for them. It can&apos;t be undone. The approved reports aren&apos;t affected, and you can generate a new summary afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={removeSummary} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete summary
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removing !== null} onOpenChange={open => { if (!open && !busy) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removing?.custom ? "Delete" : "Remove"} “{removing?.heading}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.custom
                ? "This section and its text and tables are deleted. It can't be undone."
                : "The section is left out of the summary and its exports, and regenerating won't bring it back. You can restore it from “Removed sections” at the bottom of the page."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => removing && run(() => deleteSummarySection(removing.id), removing.custom ? "Section deleted" : "Section removed", () => setRemoving(null))}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {removing?.custom ? "Delete section" : "Remove section"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canEdit && <SectionDialog state={sectionDialog} periodId={selected.id} onClose={() => setSectionDialog(null)} />}
      {canEdit && <CorrectionsDialog open={correctionsOpen} onOpenChange={setCorrectionsOpen} initial={data.corrections} />}
    </div>
  );
}

function SectionBody({ body }: { body: string }) {
  const blocks = parseBody(body);
  if (blocks.length === 0) return <p className="text-sm italic text-muted-foreground">This section has no text yet.</p>;
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground">
      {blocks.map((b, n) => b.type === "paragraph"
        ? <p key={n} className="text-justify">{b.text}</p>
        : <ul key={n} className="list-disc space-y-1 pl-5">{b.items.map((item, m) => <li key={m}>{item}</li>)}</ul>)}
    </div>
  );
}

/** The catalog entry for a table key (its name without the filter). */
const optionFor = (catalog: TableOption[], key: string) => catalog.find(o => o.key === parseTableKey(key).base);

function SectionCard({ section, canEdit, tables, catalog, onRename, onAddBelow, onDelete }: {
  section: SummarySection;
  canEdit: boolean;
  tables: Record<string, SummaryTable>;
  catalog: TableOption[];
  onRename: () => void;
  onAddBelow: () => void;
  onDelete: () => void;
}) {
  const { busy, run } = useAction();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(section.body);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  /** The table whose filter is being chosen: a new one (index null) or the one at `index`. */
  const [filterTarget, setFilterTarget] = React.useState<{ option: TableOption; index: number | null; initial: FilterValues } | null>(null);

  React.useEffect(() => { if (!editing) setDraft(section.body); }, [section.body, editing]);

  const saveTables = (next: string[], done: string) => run(() => setSectionTables(section.id, next, section.updatedAt), done);

  const applyFilter = (values: FilterValues) => {
    if (!filterTarget) return;
    const key = tableKeyOf(filterTarget.option.key, values);
    const next = filterTarget.index == null
      ? [...section.tables, key]
      : section.tables.map((k, n) => (n === filterTarget.index ? key : k));
    const adding = filterTarget.index == null;
    setFilterTarget(null);
    saveTables(next, adding ? "Table added" : "Filter updated");
  };

  return (
    <section className={`rounded-xl border border-border/60 bg-card p-4 ${section.level === 2 ? "sm:ml-6" : ""}`}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className={section.level === 1 ? "text-base font-semibold text-foreground" : "text-sm font-semibold text-foreground"}>{section.heading}</h2>
          {section.custom && <Badge variant="outline">Added section</Badge>}
          {section.edited && <Badge variant="secondary">Edited{section.editedAt ? ` ${format(new Date(section.editedAt), "PP")}` : ""}</Badge>}
        </div>
        {canEdit && !editing && (
          <div className="flex items-center gap-1">
            {section.edited && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => resetSummarySection(section.id), "Section reset to the generated text")}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit text
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`More actions for ${section.heading}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={onRename}><Type className="mr-2 h-4 w-4" /> Rename title</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPickerOpen(true)} disabled={section.tables.length >= 10}><Table2 className="mr-2 h-4 w-4" /> Add table</DropdownMenuItem>
                <DropdownMenuItem onSelect={onAddBelow}><Plus className="mr-2 h-4 w-4" /> Add section below</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> {section.custom ? "Delete section" : "Remove section"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <Button size="sm" disabled={busy} onClick={() => run(() => saveSummarySection(section.id, draft, section.updatedAt), "Section saved", () => setEditing(false))}>
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
        const option = optionFor(catalog, key);
        const filterable = !!option?.filters?.length;
        const filtered = Object.keys(parseTableKey(key).values).length > 0;
        const move = (to: number) => {
          const next = [...section.tables];
          next.splice(n, 1);
          next.splice(to, 0, key);
          return next;
        };
        return (
          <div key={key} className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="text-sm font-medium text-foreground">{table?.title ?? option?.label ?? "Table"}</h3>
                {filtered && <Badge variant="secondary" className="shrink-0"><Filter className="mr-1 h-3 w-3" /> Filtered</Badge>}
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-0.5">
                  {filterable && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => setFilterTarget({ option: option!, index: n, initial: parseTableKey(key).values })}>
                      <Filter className="mr-1 h-3.5 w-3.5" /> Filter
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy || n === 0} onClick={() => saveTables(move(n - 1), "Table moved")} aria-label="Move table up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy || n === section.tables.length - 1} onClick={() => saveTables(move(n + 1), "Table moved")} aria-label="Move table down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} onClick={() => saveTables(section.tables.filter(k => k !== key), "Table removed")} aria-label="Remove table"><X className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
            {table ? <SummaryTableView table={table} /> : <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">No data for this table in this period; it is left out of the export.</p>}
          </div>
        );
      })}

      {canEdit && !editing && (
        <Button variant="outline" size="sm" className="mt-3" disabled={busy || section.tables.length >= 10} onClick={() => setPickerOpen(true)}>
          <Table2 className="mr-1.5 h-3.5 w-3.5" /> Add table
        </Button>
      )}

      {canEdit && (
        <TablePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          sectionHeading={section.heading}
          catalog={catalog}
          added={section.tables}
          onAdd={key => { setPickerOpen(false); saveTables([...section.tables, key], "Table added"); }}
          onAddFiltered={option => {
            setPickerOpen(false);
            // Activity delays usually goes in filtered to the activities still in progress.
            const initial: FilterValues = option.key === "activity-delays" ? { status: ["In Good Progress", "Not In Good Progress"] } : {};
            setFilterTarget({ option, index: null, initial });
          }}
        />
      )}

      {canEdit && (
        <TableFilterDialog
          target={filterTarget}
          onClose={() => setFilterTarget(null)}
          onApply={applyFilter}
        />
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
              {row.map((v, c) => <TableCell key={c} className={`whitespace-pre-line align-top ${center(c)} ${/^[-−]\d/.test(v) ? "text-red-600" : ""}`}>{v}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {table.note && <p className="px-3 py-2 text-xs text-muted-foreground">{table.note}</p>}
    </div>
  );
}

/** Adds a section of your own, or renames a section and sets its heading level. */
function SectionDialog({ state, periodId, onClose }: { state: SectionDialogState | null; periodId: string; onClose: () => void }) {
  const { busy, run } = useAction();
  const [heading, setHeading] = React.useState("");
  const [level, setLevel] = React.useState("1");
  const [body, setBody] = React.useState("");

  React.useEffect(() => {
    if (!state) return;
    setHeading(state.mode === "rename" ? state.section.heading : "");
    setLevel(String(state.mode === "rename" ? state.section.level : 1));
    setBody("");
  }, [state]);

  const adding = state?.mode === "add";
  const save = () => {
    if (!state) return;
    if (state.mode === "rename") {
      run(() => renameSummarySection(state.section.id, heading, Number(level), state.section.updatedAt), "Title saved", onClose);
    } else {
      run(() => addSummarySection(periodId, { heading, level: Number(level), body, afterSectionId: state.afterId }), "Section added", onClose);
    }
  };

  return (
    <Dialog open={state !== null} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{adding ? "Add a section" : "Rename section"}</DialogTitle>
          <DialogDescription>
            {adding
              ? "Your own section, for anything the generated summary doesn't cover. Regenerating never changes or removes it. You can add tables to it afterwards."
              : "The new title is kept when the summary is regenerated."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="section-heading">Title</Label>
            <Input id="section-heading" value={heading} onChange={e => setHeading(e.target.value)} maxLength={300} placeholder="e.g. Key achievements of the quarter" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Shown as</Label>
            <RadioGroup value={level} onValueChange={setLevel} className="flex gap-4">
              <Label className="flex cursor-pointer items-center gap-2 font-normal"><RadioGroupItem value="1" /> Main heading</Label>
              <Label className="flex cursor-pointer items-center gap-2 font-normal"><RadioGroupItem value="2" /> Sub-heading</Label>
            </RadioGroup>
          </div>
          {adding && (
            <div className="space-y-1.5">
              <Label htmlFor="section-body">Text <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id="section-body" value={body} onChange={e => setBody(e.target.value)} rows={6} maxLength={20000} className="text-sm leading-relaxed" />
              <p className="text-xs text-muted-foreground">Leave a blank line between paragraphs. Start a line with “- ” to make it a bullet point.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !heading.trim()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {adding ? "Add section" : "Save title"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TablePickerDialog({ open, onOpenChange, sectionHeading, catalog, added, onAdd, onAddFiltered }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionHeading: string;
  catalog: TableOption[];
  added: string[];
  onAdd: (key: string) => void;
  onAddFiltered: (option: TableOption) => void;
}) {
  const [query, setQuery] = React.useState("");
  React.useEffect(() => { if (open) setQuery(""); }, [open]);

  const q = query.trim().toLowerCase();
  const matches = catalog.filter(o => !q || o.label.toLowerCase().includes(q) || o.description.toLowerCase().includes(q));
  const groups = [
    { title: "Report tables", options: matches.filter(o => !o.key.startsWith("objective-execution:")) },
    { title: "Execution status by objective", options: matches.filter(o => o.key.startsWith("objective-execution:")) },
  ].filter(g => g.options.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a table</DialogTitle>
          <DialogDescription>
            Shown under “{sectionHeading}”. Tables are filled from the dashboard and the approved reports each time the summary is opened or exported. Tables marked with a filter can show just part of their rows.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tables" className="pl-9" aria-label="Search tables" />
        </div>
        <div className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-1">
          {groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No tables match “{query.trim()}”.</p>}
          {groups.map(g => (
            <div key={g.title} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</h3>
              {g.options.map(o => {
                const filterable = !!o.filters?.length;
                // The unfiltered table can be added once; filtered versions as often as needed.
                const isAdded = added.includes(o.key);
                return (
                  <div key={o.key} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                    <Table2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{o.label}</span>
                        {filterable && <Badge variant="outline" className="text-[10px]"><Filter className="mr-1 h-2.5 w-2.5" /> {o.filters!.map(f => f.label.toLowerCase()).join(", ")}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{o.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                      {filterable && (
                        <Button variant="outline" size="sm" className="h-8" onClick={() => onAddFiltered(o)}>
                          <Filter className="mr-1.5 h-3.5 w-3.5" /> Add filtered
                        </Button>
                      )}
                      {isAdded
                        ? <Badge variant="secondary" className="h-8"><Check className="mr-1 h-3 w-3" /> Added</Badge>
                        : <Button size="sm" className="h-8" onClick={() => onAdd(o.key)}>Add</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ANY = "__any__";
const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

/** Chooses which rows a table shows, using the fields that table can be filtered by. */
function TableFilterDialog({ target, onClose, onApply }: {
  target: { option: TableOption; index: number | null; initial: FilterValues } | null;
  onClose: () => void;
  onApply: (values: FilterValues) => void;
}) {
  const [values, setValues] = React.useState<FilterValues>({});
  React.useEffect(() => { if (target) setValues(target.initial); }, [target]);
  const set = (name: string, list: string[]) => setValues(v => ({ ...v, [name]: list }));
  const fields: FilterField[] = target?.option.filters ?? [];
  const adding = target?.index == null;

  const field = (f: FilterField) => {
    const chosen = values[f.name] ?? [];
    if (f.kind === "text") {
      return <Input value={chosen[0] ?? ""} onChange={e => set(f.name, e.target.value ? [e.target.value] : [])} placeholder="Activity, initiative or work stream" maxLength={100} aria-label={f.label} />;
    }
    if (f.kind === "select") {
      return (
        <Select value={chosen[0] ?? ANY} onValueChange={v => set(f.name, v === ANY ? [] : [v])}>
          <SelectTrigger aria-label={f.label}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All</SelectItem>
            {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (f.options.length === 0) return <p className="text-xs text-muted-foreground">Nothing to choose from in this period.</p>;
    return (
      <div className={`grid gap-2 ${f.options.length > 6 ? "max-h-56 overflow-y-auto pr-1" : ""} sm:grid-cols-2`}>
        {f.options.map(o => (
          <Label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm font-normal hover:bg-muted/50">
            <Checkbox checked={chosen.includes(o.value)} onCheckedChange={() => set(f.name, toggleIn(chosen, o.value))} />
            <span className="min-w-0">{o.label}</span>
          </Label>
        ))}
      </div>
    );
  };

  const statusField = fields.find(f => f.name === "status" && f.options.some(o => o.value === "In Good Progress"));
  const inProgress = ["In Good Progress", "Not In Good Progress"];

  return (
    <Dialog open={target !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{adding ? "Add filtered table" : "Filter table"}: {target?.option.label}</DialogTitle>
          <DialogDescription>Choose which rows to show. Leave a group empty to include everything in it.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-1">
          {fields.map(f => (
            <div key={f.name} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">{f.label}</h3>
                <div className="flex gap-1">
                  {f === statusField && (
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => set(f.name, inProgress)}>In progress only</Button>
                  )}
                  {f.kind === "multi" && (values[f.name]?.length ?? 0) > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => set(f.name, [])}>Clear</Button>
                  )}
                </div>
              </div>
              {field(f)}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setValues({})}>Clear all filters</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onApply(values)}>{adding ? "Add table" : "Apply filter"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CorrectionsDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (open: boolean) => void; initial: SummaryCorrection[] }) {
  const { busy, run } = useAction();
  const [rows, setRows] = React.useState<SummaryCorrection[]>(initial);

  React.useEffect(() => { if (open) setRows(initial.length ? initial : [{ find: "", replace: "" }]); }, [open, initial]);

  const update = (n: number, patch: Partial<SummaryCorrection>) => setRows(rs => rs.map((r, m) => (m === n ? { ...r, ...patch } : r)));
  const filled = rows.filter(r => r.find.trim()).length;
  const save = () => run(() => updateSummaryCorrections(rows.filter(r => r.find.trim())), "Wording corrections saved — they apply the next time the summary is generated", () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Wording corrections</DialogTitle>
          <DialogDescription>
            Recurring typos or terms to fix in owners&apos; comments when the summary is generated. Whole words only, ignoring case. Applies to every plan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col rounded-lg border border-border/60">
          <div className="grid grid-cols-[1fr_1.5rem_1fr_2.25rem] items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Find</span>
            <span />
            <span>Replace with</span>
            <span />
          </div>
          <div className="max-h-[45vh] space-y-2 overflow-y-auto p-3">
            {rows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No corrections yet. Add one for each typo that keeps coming back.</p>}
            {rows.map((r, n) => (
              <div key={n} className="grid grid-cols-[1fr_1.5rem_1fr_2.25rem] items-center gap-2">
                <Input value={r.find} onChange={e => update(n, { find: e.target.value })} placeholder="e.g. pain pints" maxLength={100} aria-label={`Correction ${n + 1}: find`} />
                <span className="text-center text-muted-foreground" aria-hidden>→</span>
                <Input value={r.replace} onChange={e => update(n, { replace: e.target.value })} placeholder="e.g. pain points" maxLength={200} aria-label={`Correction ${n + 1}: replace with`} />
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => setRows(rs => rs.filter((_, m) => m !== n))} aria-label={`Remove correction ${n + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
            <Button variant="ghost" size="sm" onClick={() => setRows(rs => [...rs, { find: "", replace: "" }])}>
              <Plus className="mr-1.5 h-4 w-4" /> Add correction
            </Button>
            <span className="text-xs text-muted-foreground">{filled} correction{filled === 1 ? "" : "s"}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
