"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Loader2, Send, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/list-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchBox } from "@/components/list-controls";
import { useToast } from "@/hooks/use-toast";
import { sendPlanRequestsForPlan } from "@/actions/activity-plan-submissions";

/** Where an activity's breakdown request stands. */
export type RequestState = "waiting" | "sent" | "accepted";

export interface BreakdownOwner {
  id: string;
  name: string;
  /** Lead-owner office or department, to tell people apart. */
  office: string;
  activities: { id: string; title: string; state: RequestState }[];
}

const STATE: Record<RequestState, { label: string; className: string }> = {
  waiting: { label: "Not sent", className: "border-border/60 bg-muted/60 text-muted-foreground" },
  sent: { label: "Sent", className: "border-blue-500/25 bg-blue-500/[0.06] text-blue-700" },
  accepted: { label: "Accepted", className: "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-700" },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const waitingOf = (o: BreakdownOwner) => o.activities.filter(a => a.state === "waiting").length;

type Result = { sent: { owner: BreakdownOwner; count: number }[]; leftOut: { owner: BreakdownOwner; count: number }[] };

/**
 * On a published plan: asks activity owners to fill in their monthly
 * breakdown. The dialog lists everyone with their activities; you choose who
 * to send to, and afterwards it shows who was sent requests and who was left out.
 * Opening it when everything is sent shows where each person's requests stand.
 */
export function SendBreakdownRequestsButton({ planId, owners }: { planId: string; owners: BreakdownOwner[] }) {
  const waitingOwners = useMemo(() => owners.filter(o => waitingOf(o) > 0), [owners]);
  const doneOwners = useMemo(() => owners.filter(o => waitingOf(o) === 0), [owners]);
  const sendableCount = waitingOwners.reduce((n, o) => n + waitingOf(o), 0);

  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const open = () => {
    setSelected(new Set(waitingOwners.map(o => o.id)));
    setExpanded(new Set());
    setQuery("");
    setResult(null);
    setIsOpen(true);
  };

  const matches = (o: BreakdownOwner) => matchesSearch(query, o.name, o.office, ...o.activities.map(a => a.title));
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
    setIsSending(true);
    try {
      const res = await sendPlanRequestsForPlan(planId, chosen.map(o => o.id));
      if (!res.success) {
        toast({ title: "Couldn't send requests", description: res.message, variant: "destructive" });
        return;
      }
      const byOwner = res.sentByOwner ?? {};
      setResult({
        sent: chosen.filter(o => byOwner[o.id]).map(o => ({ owner: o, count: byOwner[o.id] })),
        leftOut: waitingOwners.filter(o => !byOwner[o.id]).map(o => ({ owner: o, count: waitingOf(o) })),
      });
      router.refresh();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={open} disabled={owners.length === 0}>
        <Send className="mr-2 h-4 w-4" />
        {sendableCount === 0 ? "Breakdown requests sent" : `Send Monthly Breakdown Requests (${sendableCount})`}
      </Button>

      <Dialog open={isOpen} onOpenChange={o => { if (!isSending) setIsOpen(o); }}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-2xl">
          {result ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Breakdown requests sent</DialogTitle>
                <DialogDescription>
                  {plural(result.sent.reduce((n, s) => n + s.count, 0), "activity", "activities")} sent to {plural(result.sent.length, "person", "people")}. They&apos;ll find it under My Plan → Monthly Breakdown.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                <ResultList title="Sent to" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} items={result.sent} empty="No one." />
                <ResultList title="Left out — not sent" icon={<UserX className="h-4 w-4 text-amber-600" />} items={result.leftOut} empty="No one was left out." hint="You can send to them later from this button." />
              </div>
              <DialogFooter>
                <Button onClick={() => setIsOpen(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Send monthly breakdown requests</DialogTitle>
                <DialogDescription>
                  {waitingOwners.length > 0
                    ? "Choose who to send to. Each person gets one notification for all their activities, fills in the annual target and months, and it then goes to Approvals."
                    : "Every activity already has a request. Here is where each person stands."}
                </DialogDescription>
              </DialogHeader>

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
                    {shownDone.map(o => {
                      const accepted = o.activities.filter(a => a.state === "accepted").length;
                      return (
                        <OwnerRow
                          key={o.id}
                          owner={o}
                          expanded={expanded.has(o.id)}
                          onExpand={() => setExpanded(prev => toggle(prev, o.id))}
                          summary={`${o.activities.length - accepted} sent · ${accepted} accepted`}
                        />
                      );
                    })}
                  </OwnerSection>
                )}
                {shownWaiting.length + shownDone.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No one matches “{query.trim()}”.</p>}
              </div>

              <DialogFooter className="items-center gap-2 sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {waitingOwners.length > 0 && `${plural(waitingOwners.length - chosen.length, "person", "people")} will be left out.`}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSending}>{waitingOwners.length > 0 ? "Cancel" : "Close"}</Button>
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

function OwnerRow({ owner, checkbox, summary, expanded, onExpand }: { owner: BreakdownOwner; checkbox?: ReactNode; summary: string; expanded: boolean; onExpand: () => void }) {
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

function ResultList({ title, icon, items, empty, hint }: { title: string; icon: ReactNode; items: { owner: BreakdownOwner; count: number }[]; empty: string; hint?: string }) {
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
