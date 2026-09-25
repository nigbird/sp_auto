"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { planFormSchema, zodIssuesToPlanIssues, describePlanPath, type PlanIssue } from "@/lib/plan-schema";
import { scrollToAndHighlight } from "@/lib/form-focus";

const COLLECTION_KEYS = new Set(["pillars", "objectives", "initiatives", "activities"]);

/** An issue about a list as a whole ("add at least one activity"), not one input. */
export function isListIssue(issue: PlanIssue) {
  const last = issue.path.split(".").pop() ?? "";
  return COLLECTION_KEYS.has(last);
}

/** Runs the shared schema against the current form values. */
export function collectPlanIssues(values: unknown): PlanIssue[] {
  const parsed = planFormSchema.safeParse(values);
  return parsed.success ? [] : zodIssuesToPlanIssues(parsed.error);
}

/**
 * Puts field-level issues on their inputs (so each shows its own red message)
 * and returns the list-level ones, which have no input of their own and are
 * shown by <ListIssue>.
 */
export function applyIssuesToForm(form: UseFormReturn<any>, issues: PlanIssue[]) {
  form.clearErrors();
  for (const issue of issues) {
    if (isListIssue(issue) || issue.path.startsWith("_")) continue;
    form.setError(issue.path as any, { type: "manual", message: issue.message });
  }
}

const ListIssuesContext = React.createContext<Map<string, string>>(new Map());
const ExpandSignalContext = React.createContext(0);

/**
 * Shares list-level issues with <ListIssue>, and an "expand everything" signal
 * with every section using useAutoOpenAccordion — bump `expandSignal` before
 * focusing an issue so it isn't hidden inside a collapsed section.
 */
export function PlanFormIssuesProvider({ issues, expandSignal, children }: { issues: PlanIssue[]; expandSignal: number; children: React.ReactNode }) {
  const map = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const issue of issues) if (isListIssue(issue) && !m.has(issue.path)) m.set(issue.path, issue.message);
    return m;
  }, [issues]);
  return (
    <ExpandSignalContext.Provider value={expandSignal}>
      <ListIssuesContext.Provider value={map}>{children}</ListIssuesContext.Provider>
    </ExpandSignalContext.Provider>
  );
}

/** Shows the "this list is empty" message for `path` (e.g. "pillars.0.objectives"), if there is one. */
export function ListIssue({ path }: { path: string }) {
  const message = React.useContext(ListIssuesContext).get(path);
  if (!message) return null;
  return (
    <p data-issue-path={path} className="text-sm font-medium text-destructive flex items-center gap-1.5">
      <AlertCircle className="h-4 w-4" /> {message}
    </p>
  );
}

/**
 * Scrolls to and flashes the input (or list message) for an issue. Returns
 * false if it isn't on screen — e.g. inside a collapsed section.
 */
export function focusIssue(issue: PlanIssue): boolean {
  if (typeof document === "undefined") return false;
  if (issue.path === "_weight") {
    const summary = document.querySelector("[data-weight-summary]");
    scrollToAndHighlight(summary);
    return !!summary;
  }
  const el = (document.querySelector(`[name="${CSS.escape(issue.path)}"]`)
    ?? document.querySelector(`[data-field-path="${CSS.escape(issue.path)}"]`)
    ?? document.querySelector(`[data-issue-path="${CSS.escape(issue.path)}"]`)) as HTMLElement | null;
  if (!el) return false;
  if (typeof el.focus === "function") el.focus({ preventScroll: true });
  scrollToAndHighlight(el);
  return true;
}

const MAX_LISTED = 8;

/** A list of everything that's blocking; each row jumps to its field. */
export function IssueSummary({ issues, title = "Please fix these before continuing", onSelect }: { issues: PlanIssue[]; title?: string; onSelect?: (issue: PlanIssue) => void }) {
  if (issues.length === 0) return null;
  const shown = issues.slice(0, MAX_LISTED);
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title} ({issues.length})</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1 text-sm">
          {shown.map((issue, index) => (
            <li key={`${issue.path}-${index}`}>
              <button
                type="button"
                className="text-left underline-offset-2 hover:underline"
                onClick={() => (onSelect ? onSelect(issue) : focusIssue(issue))}
              >
                <span className="font-semibold">{describePlanPath(issue.path)}:</span> {issue.message}
              </button>
            </li>
          ))}
          {issues.length > shown.length && <li>…and {issues.length - shown.length} more.</li>}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Open/closed state for a multi-accordion whose items can be added: starts
 * with everything open, opens newly added items automatically, and reopens
 * everything whenever the provider's expand signal changes.
 */
export function useAutoOpenAccordion(ids: string[]) {
  const expandSignal = React.useContext(ExpandSignalContext);
  const [open, setOpen] = React.useState<string[]>(ids);
  const known = React.useRef(new Set(ids));
  const idsKey = ids.join("|");

  React.useEffect(() => {
    const added = ids.filter(id => !known.current.has(id));
    known.current = new Set(ids);
    if (added.length > 0) setOpen(prev => [...prev, ...added]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  React.useEffect(() => {
    if (expandSignal > 0) setOpen(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandSignal]);

  return { value: open, onValueChange: setOpen };
}
