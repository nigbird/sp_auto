"use client";

import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { CheckCircle2, ChevronDown, Loader2, Send, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/list-filters";
import { isCutOffPassed } from "@/lib/reporting-period";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchBox } from "@/components/list-controls";
import { useToast } from "@/hooks/use-toast";
import { getReportRequestRecipients, sendReportRequest, type ReportRecipient, type ReportRequestState } from "@/actions/period-reports";
import type { ReportingPeriod } from "@/lib/types";

export interface ReportSummary { requested: number; submitted: number; approved: number; returned: number; total: number }

/**
 * Progress of a period's reports once its request has gone out: one stacked
 * bar plus a single line of counts, so the cell stays the same size however
 * many reports there are. Past the cut-off, everything still with the owner
 * (not submitted or returned) is shown as overdue.
 */
export function ReportProgress({ summary, overdue }: { summary?: ReportSummary; overdue?: boolean }) {
  if (!summary || summary.total === 0) return <span className="text-xs text-muted-foreground">Not requested yet</span>;
  const { total, approved, submitted, requested, returned } = summary;
  const segments = [
    { key: "approved", label: "approved", count: approved, bar: "bg-emerald-500", dot: "bg-emerald-500" },
    { key: "submitted", label: "to review", count: submitted, bar: "bg-blue-500", dot: "bg-blue-500" },
    ...(overdue
      ? [{ key: "overdue", label: "overdue", count: requested + returned, bar: "bg-red-500", dot: "bg-red-500" }]
      : [
          { key: "returned", label: "returned", count: returned, bar: "bg-red-400", dot: "bg-red-400" },
          { key: "requested", label: "not submitted", count: requested, bar: "bg-muted-foreground/25", dot: "bg-muted-foreground/40" },
        ]),
  ];
  const pct = Math.round((approved / total) * 100);
  return (
    <div className="w-full min-w-[200px] max-w-[280px] space-y-1.5" title={segments.map(s => `${s.count} ${s.label}`).join(" · ")}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium tabular-nums text-foreground">{approved}/{total} approved</span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {segments.map(s => s.count > 0 && <div key={s.key} className={s.bar} style={{ width: `${(s.count / total) * 100}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {segments.filter(s => s.key !== "approved" && s.count > 0).map(s => (
          <span key={s.key} className={cn("inline-flex items-center gap-1 tabular-nums", s.key === "overdue" && "font-medium text-red-700")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />{s.count} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const STATE: Record<ReportRequestState, { label: string; className: string }> = {
  waiting: { label: "Not sent", className: "border-border/60 bg-muted/60 text-muted-foreground" },
  requested: { label: "Requested", className: "border-blue-500/25 bg-blue-500/[0.06] text-blue-700" },
  submitted: { label: "Submitted", className: "border-blue-500/25 bg-blue-500/[0.06] text-blue-700" },
  approved: { label: "Approved", className: "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-700" },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const waitingOf = (o: ReportRecipient) => o.activities.filter(a => a.state === "waiting").length;

type Result = { sent: { owner: ReportRecipient; count: number }[]; leftOut: { owner: ReportRecipient; count: number }[] };

/**
 * The period's "Send Report Request" step. The dialog lists everyone who has
 * an activity needing a report this period; you choose who to send to and
 * write the message, and afterwards it shows who was sent and who was left out.
 */
export function ReportRequestButton({ period, disabledReason, onSent }: { period: ReportingPeriod & { reportRequestMessage?: string | null; reportRequestSentAt?: string | Date | null }; disabledReason?: string; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [owners, setOwners] = useState<ReportRecipient[] | null>(null);
  const [message, setMessage] = useState(period.reportRequestMessage ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const { toast } = useToast();
  const alreadySent = !!period.reportRequestSentAt;
  const pastCutOff = isCutOffPassed(period);

  const handleOpen = async () => {
    setMessage(period.reportRequestMessage ?? `Please submit your ${period.name} performance report by ${format(new Date(period.cutOffDate), "PP")}.`);
    setError(null);
    setQuery("");
    setExpanded(new Set());
    setResult(null);
    setOwners(null);
    setOpen(true);
    const res = await getReportRequestRecipients(period.id);
    if (!res.success) {
      setError(res.message);
      setOwners([]);
      return;
    }
    setOwners(res.owners);
    setSelected(new Set(res.owners.filter(o => waitingOf(o) > 0).map(o => o.id)));
  };

  const waitingOwners = (owners ?? []).filter(o => waitingOf(o) > 0);
  const doneOwners = (owners ?? []).filter(o => waitingOf(o) === 0);
  const matches = (o: ReportRecipient) => matchesSearch(query, o.name, o.office, ...o.activities.map(a => a.title));
  const shownWaiting = waitingOwners.filter(matches);
  const shownDone = doneOwners.filter(matches);
  const chosen = waitingOwners.filter(o => selected.has(o.id));
  const chosenActivities = chosen.reduce((n, o) => n + waitingOf(o), 0);

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };
  const allShownSelected = shownWaiting.length > 0 && shownWaiting.every(o => selected.has(o.id));
  const toggleAllShown = () => setSelected(prev => {
    const next = new Set(prev);
    for (const o of shownWaiting) if (allShownSelected) next.delete(o.id); else next.add(o.id);
    return next;
  });

  const handleSend = async () => {
    if (!message.trim()) {
      setError("Write a short message for the activity owners.");
      return;
    }
    setIsSending(true);
    try {
      const res = await sendReportRequest(period.id, message, chosen.map(o => o.id));
      if (!res.success) {
        setError(res.fieldErrors?.message ?? res.message);
        return;
      }
      const byOwner = res.sentByOwner ?? {};
      setResult({
        sent: chosen.filter(o => byOwner[o.id]).map(o => ({ owner: o, count: byOwner[o.id] })),
        leftOut: waitingOwners.filter(o => !byOwner[o.id]).map(o => ({ owner: o, count: waitingOf(o) })),
      });
      toast({ title: "Report request sent", description: `${plural(res.count ?? 0, "activity", "activities")} sent for "${period.name}".` });
      onSent();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        <Button size="sm" variant={alreadySent ? "outline" : "default"} className="h-8" onClick={handleOpen} disabled={!!disabledReason} title={disabledReason}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> {alreadySent ? "Send again" : "Send request"}
        </Button>
        {disabledReason
          ? <span className="max-w-[160px] text-[11px] leading-tight text-muted-foreground">{disabledReason}</span>
          : alreadySent && <span className="text-[11px] text-muted-foreground">Last sent {format(new Date(period.reportRequestSentAt!), "MMM d")}</span>}
      </div>
      <Dialog open={open} onOpenChange={o => { if (!isSending) setOpen(o); }}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl">
          {result ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Report requests sent</DialogTitle>
                <DialogDescription>
                  {plural(result.sent.reduce((n, s) => n + s.count, 0), "activity", "activities")} sent to {plural(result.sent.length, "person", "people")}. They&apos;ll find it under Reporting → My Reports.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                <ResultList title="Sent to" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} items={result.sent} empty="No one." />
                <ResultList title="Left out — not sent" icon={<UserX className="h-4 w-4 text-amber-600" />} items={result.leftOut} empty="No one was left out." hint="You can send to them later with Send again." />
              </div>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Request reports for {period.name}</DialogTitle>
                <DialogDescription>
                  {format(new Date(period.startDate), "PP")} – {format(new Date(period.endDate), "PP")}. Only activities with a planned target in this period&apos;s months are listed.
                  {" "}Choose who to send to — each person gets one notification for all their activities.
                  {pastCutOff && " The cut-off date has already passed, so these reports will show as overdue — owners can still submit them."}
                </DialogDescription>
              </DialogHeader>

              {owners == null ? (
                <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Finding who needs to report…</p>
              ) : owners.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
                  {error ?? "No activity needs a report for this period. Activities need an approved monthly breakdown with a planned target in this period's months."}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <SearchBox value={query} onChange={setQuery} placeholder="Search person, office or activity" className="sm:w-72" />
                    {shownWaiting.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-9" onClick={toggleAllShown}>
                        {allShownSelected ? "Clear selection" : "Select all"}
                      </Button>
                    )}
                    <p className="ml-auto text-xs text-muted-foreground">
                      {plural(waitingOwners.length, "person", "people")} waiting · {plural(doneOwners.length, "person", "people")} already sent
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                    {waitingOwners.length > 0 && (
                      <OwnerSection title={`Waiting for a request (${shownWaiting.length})`}>
                        {shownWaiting.map(o => (
                          <OwnerRow
                            key={o.id}
                            owner={o}
                            expanded={expanded.has(o.id)}
                            onExpand={() => setExpanded(prev => toggle(prev, o.id))}
                            checkbox={<Checkbox checked={selected.has(o.id)} onCheckedChange={() => setSelected(prev => toggle(prev, o.id))} aria-label={`Send to ${o.name}`} />}
                            summary={`${plural(waitingOf(o), "activity", "activities")} to send`}
                          />
                        ))}
                      </OwnerSection>
                    )}
                    {doneOwners.length > 0 && (
                      <OwnerSection title={`Already sent (${shownDone.length})`}>
                        {shownDone.map(o => (
                          <OwnerRow
                            key={o.id}
                            owner={o}
                            expanded={expanded.has(o.id)}
                            onExpand={() => setExpanded(prev => toggle(prev, o.id))}
                            summary={plural(o.activities.length, "activity", "activities")}
                          />
                        ))}
                      </OwnerSection>
                    )}
                    {shownWaiting.length + shownDone.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No one matches “{query.trim()}”.</p>}
                  </div>

                  {waitingOwners.length > 0 && (
                    <div className="space-y-1">
                      <Label htmlFor={`report-msg-${period.id}`}>Message to activity owners</Label>
                      <Textarea id={`report-msg-${period.id}`} rows={3} value={message} onChange={(e) => { setMessage(e.target.value); setError(null); }} />
                      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                    </div>
                  )}
                </>
              )}

              <DialogFooter className="items-center gap-2 sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {waitingOwners.length > 0 && `${plural(waitingOwners.length - chosen.length, "person", "people")} will be left out.`}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={isSending}>{waitingOwners.length > 0 ? "Cancel" : "Close"}</Button>
                  {waitingOwners.length > 0 && (
                    <Button onClick={handleSend} disabled={isSending || chosen.length === 0}>
                      {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send to {plural(chosen.length, "person", "people")} ({plural(chosenActivities, "activity", "activities")})
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OwnerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">{title}</h3>
      <div className="divide-y divide-border/50 rounded-xl border border-border/50">{children}</div>
    </section>
  );
}

function OwnerRow({ owner, checkbox, summary, expanded, onExpand }: { owner: ReportRecipient; checkbox?: ReactNode; summary: string; expanded: boolean; onExpand: () => void }) {
  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {checkbox}
        <button type="button" onClick={onExpand} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{owner.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{owner.office}</span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{summary}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !expanded && "-rotate-90")} />
        </button>
      </div>
      {expanded && (
        <ul className="space-y-1.5 border-t border-border/40 bg-muted/20 px-3 py-2.5 pl-10">
          {owner.activities.map(a => (
            <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0 text-foreground/90">{a.title}</span>
              <Badge variant="outline" className={cn("shrink-0 whitespace-nowrap font-medium", STATE[a.state].className)}>{STATE[a.state].label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultList({ title, icon, items, empty, hint }: { title: string; icon: ReactNode; items: { owner: ReportRecipient; count: number }[]; empty: string; hint?: string }) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">{icon}{title} ({items.length})</h3>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y divide-border/50 rounded-xl border border-border/50">
          {items.map(({ owner, count }) => (
            <div key={owner.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{owner.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{owner.office}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{plural(count, "activity", "activities")}</span>
            </div>
          ))}
        </div>
      )}
      {hint && items.length > 0 && <p className="text-xs text-muted-foreground">{hint}</p>}
    </section>
  );
}
