"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter, ListToolbar, Pagination, SearchBox, type PaginationState } from "@/components/list-controls";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { exportAuditLog, getAuditActors, getAuditLog, type AuditLogFilters, type AuditLogRow } from "@/actions/audit-log";
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, auditActionCategory, auditActionLabel, auditActionsIn, type AuditAction, type AuditCategory } from "@/lib/audit-actions";
import { isRangeSet, type DateRangeValue } from "@/lib/list-filters";
import { downloadCsv } from "@/lib/csv-export";
import { cn } from "@/lib/utils";

const ALL = "__all__";

const CATEGORY_TONE: Record<AuditCategory, string> = {
  "Sign-in & security": "border-slate-300 bg-slate-50 text-slate-700",
  "Users & roles": "border-violet-200 bg-violet-50 text-violet-700",
  "Strategic plans": "border-blue-200 bg-blue-50 text-blue-700",
  Activities: "border-cyan-200 bg-cyan-50 text-cyan-700",
  "Plan approvals": "border-amber-200 bg-amber-50 text-amber-800",
  Reporting: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Configuration: "border-orange-200 bg-orange-50 text-orange-700",
  Exports: "border-pink-200 bg-pink-50 text-pink-700",
};

const RECORD_LABELS: Record<string, string> = {
  User: "User", Role: "Role", StrategicPlan: "Strategic plan", Activity: "Activity", Deliverable: "Deliverable",
  ReportingPeriod: "Reporting period", ReportEntry: "Period report", Evidence: "Evidence file", Rule: "Status rule",
  AppConfig: "App settings", Department: "Department", LeadOwner: "Lead owner", AuditLog: "Audit log",
};
const recordLabel = (type: string | null) => (type ? RECORD_LABELS[type] ?? type : "");

/** The picked days as the viewer's local start/end of day. */
function rangeToIso(range: DateRangeValue): Pick<AuditLogFilters, "from" | "to"> {
  return {
    from: range.from ? new Date(`${range.from}T00:00:00`).toISOString() : undefined,
    to: range.to ? new Date(`${range.to}T23:59:59.999`).toISOString() : undefined,
  };
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function actorText(row: AuditLogRow) {
  if (row.actor) return row.actor.name;
  if (row.subject && ["LOGIN_SUCCESS", "LOGOUT", "PASSWORD_SET", "PASSWORD_CHANGE"].includes(row.action)) return row.subject.name;
  return row.identifier ?? "System";
}

export function AuditLogView({ canExport }: { canExport: boolean }) {
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [range, setRange] = React.useState<DateRangeValue>({});
  const [category, setCategory] = React.useState<string>(ALL);
  const [action, setAction] = React.useState<string>(ALL);
  const [actorId, setActorId] = React.useState<string>(ALL);
  const [outcome, setOutcome] = React.useState<string>(ALL);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const [rows, setRows] = React.useState<AuditLogRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [actors, setActors] = React.useState<{ id: string; name: string; email: string }[]>([]);
  const [selected, setSelected] = React.useState<AuditLogRow | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const debouncedQuery = useDebounced(query, 300);
  const filters = React.useMemo<AuditLogFilters>(() => ({
    q: debouncedQuery,
    category: category === ALL ? null : (category as AuditCategory),
    action: action === ALL ? null : (action as AuditAction),
    actorId: actorId === ALL ? null : actorId,
    outcome: outcome === ALL ? null : (outcome as "success" | "failure"),
    ...rangeToIso(range),
  }), [debouncedQuery, category, action, actorId, outcome, range]);
  const filterKey = JSON.stringify(filters);

  React.useEffect(() => { getAuditActors().then(setActors).catch(() => {}); }, []);
  React.useEffect(() => { setPage(1); }, [filterKey]);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getAuditLog(filters, page, pageSize)
      .then((result) => { if (!cancelled) { setRows(result.rows); setTotal(result.total); } })
      .catch(() => { if (!cancelled) toast({ title: "Could not load the audit log", variant: "destructive" }); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page, pageSize]);

  const actionOptions = category === ALL ? AUDIT_CATEGORIES.map((c) => [c, auditActionsIn(c)] as const) : [[category as AuditCategory, auditActionsIn(category as AuditCategory)] as const];
  const narrowed = !!query || isRangeSet(range) || category !== ALL || action !== ALL || actorId !== ALL || outcome !== ALL;
  const resetFilters = () => { setQuery(""); setRange({}); setCategory(ALL); setAction(ALL); setActorId(ALL); setOutcome(ALL); };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pagination: PaginationState<AuditLogRow> = {
    page, pageSize, pageCount, total, items: rows,
    setPage: (p) => setPage(Math.max(1, Math.min(p, pageCount))),
    setPageSize: (s) => { setPageSize(s); setPage(1); },
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { rows: all, truncated } = await exportAuditLog(filters);
      downloadCsv(
        `audit-log-${format(new Date(), "yyyy-MM-dd-HHmm")}`,
        ["Date & time", "Category", "Action", "Outcome", "Performed by", "Performed by email", "About user", "Summary", "Record", "Device", "Details"],
        all.map((r) => [
          format(new Date(r.createdAt), "yyyy-MM-dd HH:mm:ss"),
          auditActionCategory(r.action) ?? "",
          auditActionLabel(r.action),
          r.success ? "Success" : "Failed",
          actorText(r),
          r.actor?.email ?? r.identifier ?? "",
          r.subject && r.subject.id !== r.actor?.id ? r.subject.name : "",
          r.summary ?? "",
          recordLabel(r.entityType),
          r.device ?? "",
          r.metadata ? JSON.stringify(r.metadata) : "",
        ]),
      );
      toast({
        title: "Audit log exported",
        description: truncated ? `The first ${all.length.toLocaleString()} matching entries were exported. Narrow the filters to export the rest.` : `${all.length.toLocaleString()} entries exported.`,
      });
    } catch (error) {
      toast({ title: "Could not export the audit log", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="rounded-xl border-border/50 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_4px_12px_-8px_rgba(16,24,40,0.06)]">
      <CardContent className="space-y-4 pt-6">
        <ListToolbar count={isLoading ? "Loading…" : `${total.toLocaleString()} ${total === 1 ? "entry" : "entries"}`}>
          <SearchBox value={query} onChange={setQuery} placeholder="Search summary or email" className="sm:w-80" />
          <DateRangeFilter value={range} onChange={setRange} label="Any date" hint="Shows actions taken in this range." />
          <Select value={category} onValueChange={(v) => { setCategory(v); setAction(ALL); }}>
            <SelectTrigger className="h-9 w-[180px]" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {AUDIT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-9 w-[220px]" aria-label="Action"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              {actionOptions.map(([group, actions]) => (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {actions.map((a) => <SelectItem key={a} value={a}>{AUDIT_ACTIONS[a].label}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Select value={actorId} onValueChange={setActorId}>
            <SelectTrigger className="h-9 w-[200px]" aria-label="Performed by"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Anyone</SelectItem>
              {actors.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Outcome"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any outcome</SelectItem>
              <SelectItem value="success">Succeeded</SelectItem>
              <SelectItem value="failure">Failed</SelectItem>
            </SelectContent>
          </Select>
          {narrowed && <Button variant="ghost" className="h-9 px-3" onClick={resetFilters}>Reset</Button>}
          {canExport && (
            <Button variant="outline" className="h-9" onClick={handleExport} disabled={isExporting || total === 0}>
              <Download className="mr-2 h-4 w-4" /> {isExporting ? "Exporting…" : "Export CSV"}
            </Button>
          )}
        </ListToolbar>

        {!isLoading && rows.length === 0 ? (
          <EmptyState
            art="inbox"
            title={narrowed ? "No entries match these filters" : "Nothing recorded yet"}
            description={narrowed ? "Try a wider date range or fewer filters." : "Important actions will appear here as people use the app."}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["When", "Performed by", "Action", "Details"].map((h) => (
                    <TableHead key={h} className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className={cn(isLoading && "opacity-60")}>
                {rows.map((row) => {
                  const category = auditActionCategory(row.action);
                  return (
                    <TableRow key={row.id} className="cursor-pointer border-border/50 hover:bg-muted/30" onClick={() => setSelected(row)}>
                      <TableCell className="whitespace-nowrap py-3 align-top">
                        <div className="text-sm text-foreground">{format(new Date(row.createdAt), "d MMM yyyy, HH:mm")}</div>
                        <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</div>
                      </TableCell>
                      <TableCell className="py-3 align-top">
                        <div className="text-sm font-medium text-foreground">{actorText(row)}</div>
                        {row.actor && <div className="text-xs text-muted-foreground">{row.actor.email}</div>}
                      </TableCell>
                      <TableCell className="py-3 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm text-foreground">{auditActionLabel(row.action)}</span>
                          {!row.success && <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Failed</Badge>}
                        </div>
                        {category && <Badge variant="outline" className={cn("mt-1 font-medium", CATEGORY_TONE[category])}>{category}</Badge>}
                      </TableCell>
                      <TableCell className="max-w-[420px] py-3 align-top text-sm text-muted-foreground">{row.summary ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <Pagination state={pagination} noun="entries" />
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{auditActionLabel(selected.action)}</DialogTitle>
                <DialogDescription>{selected.summary ?? "No summary was recorded for this entry."}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
                <Detail label="When">{format(new Date(selected.createdAt), "EEEE d MMMM yyyy, HH:mm:ss")}</Detail>
                <Detail label="Outcome">{selected.success ? "Succeeded" : "Failed"}</Detail>
                <Detail label="Performed by">{selected.actor ? `${selected.actor.name} (${selected.actor.email})` : actorText(selected)}</Detail>
                {selected.subject && selected.subject.id !== selected.actor?.id && (
                  <Detail label="About user">{`${selected.subject.name} (${selected.subject.email})`}</Detail>
                )}
                {selected.entityType && <Detail label="Record">{recordLabel(selected.entityType)}</Detail>}
                <Detail label="Device">{selected.device ?? "—"}</Detail>
              </dl>
              {selected.metadata != null && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Details</p>
                  <pre className="max-h-72 overflow-auto rounded-lg bg-muted/60 p-3 text-xs">{JSON.stringify(selected.metadata, null, 2)}</pre>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </>
  );
}
