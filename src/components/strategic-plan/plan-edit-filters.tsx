"use client";

import * as React from "react";
import { AlertCircle, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListToolbar, SearchBox } from "@/components/list-controls";
import { matchesSearch } from "@/lib/list-filters";
import { cn } from "@/lib/utils";
import type { PlanFormValues, PlanIssue } from "@/lib/plan-schema";

/**
 * Search and filters for the plan editor. Rows that don't match are hidden
 * with CSS rather than removed, so their fields stay registered (nothing typed
 * is lost) and totals still count the whole plan. Visibility is keyed by form
 * path ("pillars.0.objectives.1…"), the same paths validation issues use.
 */

export interface EditFilters {
  q: string;
  pillar: string;
  leadOwner: string;
  responsible: string;
  problemsOnly: boolean;
}

export const NO_FILTERS: EditFilters = { q: "", pillar: "", leadOwner: "", responsible: "", problemsOnly: false };

export const filtersActive = (f: EditFilters) => !!(f.q.trim() || f.pillar || f.leadOwner || f.responsible || f.problemsOnly);

export interface EditVisibility {
  active: boolean;
  /** Paths of every pillar, objective, initiative and activity to show. */
  visible: Set<string>;
  matched: number;
  total: number;
}

const blank = (s?: string | null) => !(s ?? "").trim();

export function computeVisibility(pillars: PlanFormValues["pillars"] = [], f: EditFilters, issues: PlanIssue[], userNames: Map<string, string>): EditVisibility {
  const visible = new Set<string>();
  let matched = 0, total = 0;
  const active = filtersActive(f);
  const q = f.q.trim();
  const hasIssue = (path: string) => issues.some(i => i.path === path || i.path.startsWith(`${path}.`));

  pillars.forEach((p, pi) => {
    const pPath = `pillars.${pi}`;
    const pillarOk = !f.pillar || p.id === f.pillar;
    const pHit = !!q && matchesSearch(q, p.title);
    p.objectives?.forEach((o, oi) => {
      const oPath = `${pPath}.objectives.${oi}`;
      const oHit = pHit || (!!q && matchesSearch(q, o.statement));
      o.initiatives?.forEach((i, ii) => {
        const iPath = `${oPath}.initiatives.${ii}`;
        const iHit = oHit || (!!q && matchesSearch(q, i.title));
        i.activities?.forEach((a, ai) => {
          const aPath = `${iPath}.activities.${ai}`;
          total++;
          const ok = !active || (
            pillarOk &&
            (!q || iHit || matchesSearch(q, a.title, a.deliverable, a.leadOwner, ...(a.collaborators ?? []), userNames.get(a.responsible))) &&
            (!f.leadOwner || a.leadOwner === f.leadOwner || (a.collaborators ?? []).includes(f.leadOwner)) &&
            (!f.responsible || a.responsible === f.responsible) &&
            (!f.problemsOnly || hasIssue(aPath))
          );
          if (ok) matched++;
          // A just-added activity has no title yet; keep it on screen so it doesn't vanish while being filled in.
          if (ok || blank(a.title)) visible.add(aPath);
        });
        // A group shows when something inside it matches, when it was matched
        // itself, or when it has a problem of its own (e.g. a missing title).
        const groupOk = !active || blank(i.title) || [...visible].some(v => v.startsWith(`${iPath}.`))
          || (pillarOk && !f.leadOwner && !f.responsible && ((!!q && iHit && !f.problemsOnly) || (f.problemsOnly && hasIssue(iPath) && (!q || iHit))));
        if (groupOk) visible.add(iPath);
      });
      if (!active || blank(o.statement) || [...visible].some(v => v.startsWith(`${oPath}.`)) || (pillarOk && f.problemsOnly && !q && !f.leadOwner && !f.responsible && hasIssue(oPath))) visible.add(oPath);
    });
    if (!active || blank(p.title) || [...visible].some(v => v.startsWith(`${pPath}.`)) || (pillarOk && f.problemsOnly && !q && !f.leadOwner && !f.responsible && hasIssue(pPath))) visible.add(pPath);
  });

  return { active, visible, matched, total };
}

const VisibilityContext = React.createContext<EditVisibility | null>(null);
export const EditVisibilityProvider = VisibilityContext.Provider;

/** "hidden" when the row at `path` is filtered out; nothing otherwise. */
export function useHiddenClass(path: string) {
  const v = React.useContext(VisibilityContext);
  return v && v.active && !v.visible.has(path) ? "hidden" : "";
}

const ALL = "__all__";

export function PlanEditToolbar({ filters, onChange, pillars, users, visibility, issueCount, anyCollapsed, onToggleAll }: {
  filters: EditFilters;
  onChange: (f: EditFilters) => void;
  pillars: PlanFormValues["pillars"];
  users: { id: string; name: string }[];
  visibility: EditVisibility;
  issueCount: number;
  anyCollapsed: boolean;
  onToggleAll: () => void;
}) {
  const activities = (pillars ?? []).flatMap(p => (p.objectives ?? []).flatMap(o => (o.initiatives ?? []).flatMap(i => i.activities ?? [])));
  const offices = [...new Set(activities.flatMap(a => [a.leadOwner, ...(a.collaborators ?? [])]).map(s => (s ?? "").trim()).filter(Boolean))].sort();
  const responsibleIds = new Set(activities.map(a => a.responsible));
  const people = users.filter(u => responsibleIds.has(u.id));
  const set = (patch: Partial<EditFilters>) => onChange({ ...filters, ...patch });
  const pick = (v: string) => (v === ALL ? "" : v);

  return (
    <ListToolbar count={visibility.active ? `${visibility.matched} of ${visibility.total} activities match` : `${visibility.total} activities`}>
      <SearchBox value={filters.q} onChange={q => set({ q })} placeholder="Search activity, owner, deliverable or initiative" className="sm:w-80" />
      <Select value={filters.pillar || ALL} onValueChange={v => set({ pillar: pick(v) })}>
        <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Pillar"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All pillars</SelectItem>
          {(pillars ?? []).map((p, i) => p.id && <SelectItem key={p.id} value={p.id}>{p.title || `Pillar ${i + 1}`}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.leadOwner || ALL} onValueChange={v => set({ leadOwner: pick(v) })}>
        <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Lead owner"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All lead owners</SelectItem>
          {offices.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.responsible || ALL} onValueChange={v => set({ responsible: pick(v) })}>
        <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Responsible"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Anyone responsible</SelectItem>
          {people.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {(issueCount > 0 || filters.problemsOnly) && (
        <Button type="button" variant="outline" aria-pressed={filters.problemsOnly} onClick={() => set({ problemsOnly: !filters.problemsOnly })}
          className={cn("h-9 gap-2", filters.problemsOnly && "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive")}>
          <AlertCircle className="h-4 w-4" /> Only rows with problems{issueCount > 0 && ` (${issueCount})`}
        </Button>
      )}
      {visibility.active
        ? <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => onChange(NO_FILTERS)}>Reset</Button>
        : (
          <Button type="button" variant="outline" className="h-9 gap-2" onClick={onToggleAll}>
            {anyCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
            {anyCollapsed ? "Expand all" : "Collapse all"}
          </Button>
        )}
    </ListToolbar>
  );
}

/** For lists that render many rows in one component: tells whether the row at a path is filtered out. */
export function useIsFilteredOut() {
  const v = React.useContext(VisibilityContext);
  return (path: string) => !!v && v.active && !v.visible.has(path);
}
