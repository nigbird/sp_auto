/**
 * Shared helpers so validation failures in the strategic-plan wizards never
 * fail silently: every blocking error gets a specific, human-readable
 * location plus a best-effort scroll-and-flash on the actual field/row, so
 * the user's attention is pulled straight to the problem instead of just a
 * toast they might miss.
 */

const HIGHLIGHT_CLASSES = ["ring-2", "ring-destructive", "ring-offset-2", "rounded-md"];
const HIGHLIGHT_DURATION_MS = 2500;

export function scrollToAndHighlight(el: Element | null | undefined) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add(...HIGHLIGHT_CLASSES);
  setTimeout(() => el.classList.remove(...HIGHLIGHT_CLASSES), HIGHLIGHT_DURATION_MS);
}

/** Finds the dotted field path (e.g. "pillars.0.objectives.1.statement") of the first leaf error in a react-hook-form errors tree. */
export function findFirstErrorPath(errors: unknown, prefix = ""): string | null {
  return findFirstError(errors, prefix)?.path ?? null;
}

/** Like findFirstErrorPath, but also returns the leaf error's own message. */
export function findFirstError(errors: unknown, prefix = ""): { path: string; message: string } | null {
  if (!errors || typeof errors !== "object") return null;
  for (const key of Object.keys(errors)) {
    const value = (errors as Record<string, unknown>)[key];
    if (!value || typeof value !== "object") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const node = value as { type?: unknown; message?: unknown };
    if (typeof node.message === "string" && typeof node.type === "string") {
      return { path, message: node.message };
    }
    const nested = findFirstError(value, path);
    if (nested) return nested;
  }
  return null;
}

const PATH_LABELS: Record<string, string> = {
  pillars: "Pillar",
  objectives: "Objective",
  initiatives: "Initiative",
  activities: "Activity",
};

/** Turns "pillars.0.objectives.1.statement" into "Pillar 1 → Objective 2" for use in toast copy. */
export function describeFieldPath(path: string): string {
  const parts = path.split(".");
  const crumbs: string[] = [];
  for (let i = 0; i < parts.length - 1; i += 2) {
    const label = PATH_LABELS[parts[i]];
    const idx = Number(parts[i + 1]);
    if (label && !Number.isNaN(idx)) {
      crumbs.push(`${label} ${idx + 1}`);
    }
  }
  return crumbs.length ? crumbs.join(" → ") : "This field";
}

/**
 * Best-effort focus+scroll+highlight on the DOM input matching a react-hook-form
 * field path. Returns false (without throwing) if the field isn't currently
 * mounted — e.g. its accordion section is collapsed — so callers can fall
 * back to naming the location in a toast instead.
 */
export function focusFieldByPath(path: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.querySelector(`[name="${CSS.escape(path)}"]`) as HTMLElement | null;
  if (!el) return false;
  el.focus({ preventScroll: true });
  scrollToAndHighlight(el);
  return true;
}

/** Pulls the first "quoted" substring out of a server error message (e.g. an activity title named in a department-mismatch error). */
export function extractQuoted(message: string): string | null {
  const match = message.match(/"([^"]+)"/);
  return match ? match[1] : null;
}

/** Best-effort: scrolls to and highlights the first <li> under `root` whose text includes `text`. */
export function scrollToListItemContaining(root: Element | Document, text: string): boolean {
  if (!text) return false;
  const items = root.querySelectorAll("li");
  for (const item of Array.from(items)) {
    if (item.textContent?.includes(text)) {
      scrollToAndHighlight(item);
      return true;
    }
  }
  return false;
}
