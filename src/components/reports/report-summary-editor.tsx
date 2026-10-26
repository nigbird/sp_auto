"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, Check, Filter, Loader2, Pencil, Plus, RotateCcw, Search, Sparkles, SpellCheck, Table2, Trash2, X } from "lucide-react";
import { deleteReportSummary, generateReportSummary, resetSummarySection, saveSummarySection, setSectionTables, updateSummaryCorrections } from "@/actions/report-summary";
import { parseBody, type SummaryCorrection } from "@/lib/report-summary";
import { delayFilterOfKey, delayTableKey, isDelayTableKey, type SummaryTable, type TableOption } from "@/lib/summary-tables";
import { ACTIVITY_STATUS_ORDER, DELIVERY_STATE_LABEL } from "@/lib/dashboard-metrics";
import { DELIVERY_ORDER, EMPTY_DELAY_FILTER, type DelayTableFilter } from "@/lib/activity-delay-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  /** Work streams the activity delay filter can narrow to. */
  delayStreams: string[];
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
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
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

  const remove = async () => {
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
            {canEdit && " Regenerating keeps edited sections unless you choose to replace them."}
          </p>
          <div className="space-y-3">
            {summary.sections.map(section => (
              <SectionCard key={section.id} section={section} canEdit={canEdit} tables={data.tables} catalog={data.tableCatalog} delayStreams={data.delayStreams} />
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
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete summary
            </Button>
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

function SectionCard({ section, canEdit, tables, catalog, delayStreams }: { section: SummarySection; canEdit: boolean; tables: Record<string, SummaryTable>; catalog: TableOption[]; delayStreams: string[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(section.body);
  const [busy, setBusy] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  /** The activity delay filter being chosen: for a new table (index null), or for the table at `index`. */
  const [filterTarget, setFilterTarget] = React.useState<{ index: number | null; initial: DelayTableFilter } | null>(null);

  const applyFilter = (filter: DelayTableFilter) => {
    if (!filterTarget) return;
    const key = delayTableKey(filter);
    const next = filterTarget.index == null
      ? [...section.tables, key]
      : section.tables.map((k, n) => (n === filterTarget.index ? key : k));
    const added = filterTarget.index == null;
    setFilterTarget(null);
    run(() => setSectionTables(section.id, next, section.updatedAt), added ? "Table added" : "Filter updated");
  };

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
                  {isDelayTableKey(key) && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => setFilterTarget({ index: n, initial: delayFilterOfKey(key) })}>
                      <Filter className="mr-1 h-3.5 w-3.5" /> Filter
                    </Button>
                  )}
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
          onAdd={key => { setPickerOpen(false); run(() => setSectionTables(section.id, [...section.tables, key], section.updatedAt), "Table added"); }}
          onConfigure={() => { setPickerOpen(false); setFilterTarget({ index: null, initial: { ...EMPTY_DELAY_FILTER, statuses: ["In Good Progress", "Not In Good Progress"] } }); }}
        />
      )}

      {canEdit && (
        <DelayFilterDialog
          open={filterTarget !== null}
          onOpenChange={open => { if (!open) setFilterTarget(null); }}
          adding={filterTarget?.index == null}
          initial={filterTarget?.initial ?? EMPTY_DELAY_FILTER}
          streams={delayStreams}
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

function TablePickerDialog({ open, onOpenChange, sectionHeading, catalog, added, onAdd, onConfigure }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionHeading: string;
  catalog: TableOption[];
  added: string[];
  onAdd: (key: string) => void;
  /** For a filterable table: choose its filter before adding. */
  onConfigure: (key: string) => void;
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
            Shown under “{sectionHeading}”. Tables are filled from the dashboard and the approved reports each time the summary is opened or exported.
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
                // A filterable table can be added more than once, with different filters.
                const isAdded = !o.filterable && added.includes(o.key);
                return (
                  <button
                    key={o.key}
                    type="button"
                    disabled={isAdded}
                    onClick={() => (o.filterable ? onConfigure(o.key) : onAdd(o.key))}
                    className="flex w-full items-start gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60 disabled:hover:border-border/60 disabled:hover:bg-transparent"
                  >
                    <Table2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{o.label}</span>
                      <span className="block text-xs text-muted-foreground">{o.description}</span>
                    </span>
                    {isAdded
                      ? <Badge variant="secondary" className="shrink-0"><Check className="mr-1 h-3 w-3" /> Added</Badge>
                      : <span className="shrink-0 text-xs font-medium text-primary">{o.filterable ? "Choose filter…" : "Add"}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ALL_STREAMS = "__all__";
const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

/** Chooses the filter of an activity delay table: activity status, delivery, work stream and search, as on the dashboard. */
function DelayFilterDialog({ open, onOpenChange, adding, initial, streams, onApply }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adding: boolean;
  initial: DelayTableFilter;
  streams: string[];
  onApply: (filter: DelayTableFilter) => void;
}) {
  const [filter, setFilter] = React.useState<DelayTableFilter>(initial);
  React.useEffect(() => { if (open) setFilter(initial); }, [open, initial]);
  const update = (patch: Partial<DelayTableFilter>) => setFilter(f => ({ ...f, ...patch }));
  const inProgressOnly = filter.statuses.length === 2 && filter.statuses.includes("In Good Progress") && filter.statuses.includes("Not In Good Progress");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{adding ? "Add activity delay table" : "Filter activity delay table"}</DialogTitle>
          <DialogDescription>
            Same rows as the dashboard&apos;s activity delay table. Leave a group empty to include everything in it.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">Activity status</h3>
              <Button
                type="button"
                variant={inProgressOnly ? "secondary" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => update({ statuses: ["In Good Progress", "Not In Good Progress"] })}
              >
                In progress only
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ACTIVITY_STATUS_ORDER.map(s => (
                <Label key={s} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm font-normal hover:bg-muted/50">
                  <Checkbox checked={filter.statuses.includes(s)} onCheckedChange={() => update({ statuses: toggleIn(filter.statuses, s) })} />
                  {s}
                </Label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Delivery</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {DELIVERY_ORDER.map(d => (
                <Label key={d} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm font-normal hover:bg-muted/50">
                  <Checkbox checked={filter.deliveries.includes(d)} onCheckedChange={() => update({ deliveries: toggleIn(filter.deliveries, d) })} />
                  {DELIVERY_STATE_LABEL[d]}
                </Label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Work stream</h3>
              <Select value={filter.stream || ALL_STREAMS} onValueChange={v => update({ stream: v === ALL_STREAMS ? "" : v })}>
                <SelectTrigger aria-label="Work stream"><SelectValue placeholder="All work streams" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STREAMS}>All work streams</SelectItem>
                  {streams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">Search</h3>
              <Input value={filter.search} onChange={e => update({ search: e.target.value })} placeholder="Activity, initiative or stream" maxLength={100} aria-label="Search activities" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => setFilter(EMPTY_DELAY_FILTER)}>Clear filters</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => onApply(filter)}>{adding ? "Add table" : "Apply filter"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CorrectionsDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (open: boolean) => void; initial: SummaryCorrection[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SummaryCorrection[]>(initial);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (open) setRows(initial.length ? initial : [{ find: "", replace: "" }]); }, [open, initial]);

  const update = (n: number, patch: Partial<SummaryCorrection>) => setRows(rs => rs.map((r, m) => (m === n ? { ...r, ...patch } : r)));
  const filled = rows.filter(r => r.find.trim()).length;

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
