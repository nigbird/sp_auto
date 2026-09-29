import type { ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Award, CheckCircle2, CircleDashed, Clock, Minus, MinusCircle, PauseCircle, ThumbsUp, TrendingUp, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { INITIATIVE_STATUS_LABEL, type InitiativeStatus, type Rating } from "@/lib/dashboard-metrics";

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function pct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** Weights are stored as percentages of the whole plan (0.5 = 0.5%). */
export function weightPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// Status and pillar palettes live in lib/dashboard-colors (shared with the exports).
// Status colours are reserved for status; magnitude bars use the brand gold.
// Every status mark ships with an icon + label, never colour alone.
// ---------------------------------------------------------------------------

import { PILLAR_COLORS, STATUS_COLOR, pillarColor } from "@/lib/dashboard-colors";
export { PILLAR_COLORS, STATUS_COLOR, pillarColor };

const STATUS_ICON: Record<InitiativeStatus, typeof CheckCircle2> = {
  achieved: CheckCircle2,
  onTrack: TrendingUp,
  behind: AlertTriangle,
  notStarted: XCircle,
  awaiting: Clock,
  noTarget: MinusCircle,
};

export function StatusLabel({ status, className }: { status: InitiativeStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: STATUS_COLOR[status] }} aria-hidden />
      {INITIATIVE_STATUS_LABEL[status]}
    </span>
  );
}

const RATING_STYLE: Record<Rating, { icon: typeof Award; className: string }> = {
  Outstanding: { icon: Award, className: "bg-emerald-600/10 text-emerald-800 ring-emerald-600/20 dark:text-emerald-300" },
  "Very Good": { icon: ThumbsUp, className: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300" },
  Good: { icon: CheckCircle2, className: "bg-teal-500/10 text-teal-800 ring-teal-500/20 dark:text-teal-300" },
  Fair: { icon: PauseCircle, className: "bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-300" },
  Unsatisfactory: { icon: AlertTriangle, className: "bg-red-500/10 text-red-800 ring-red-500/20 dark:text-red-300" },
  "No Target": { icon: CircleDashed, className: "bg-muted text-muted-foreground ring-border" },
};

export function RatingChip({ rating, className }: { rating: Rating; className?: string }) {
  const { icon: Icon, className: tone } = RATING_STYLE[rating];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", tone, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {rating}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** The card surface used across the dashboard: soft, borderless-looking, generous padding. */
export const CARD = "rounded-2xl border border-border/40 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.03),0_6px_16px_-12px_rgba(16,24,40,0.08)]";

export function SectionCard({ title, description, action, children, className }: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(CARD, "p-5 sm:p-6", className)}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** A tinted pill with a status dot; the text stays in ink, the dot carries the colour. */
export function StatusPill({ status }: { status: InitiativeStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium text-foreground/80"
      style={{ background: `${STATUS_COLOR[status]}1f` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
      {INITIATIVE_STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Change against the previous period. Up is good for every measure shown here,
 * so it wears the "good" status; down wears "critical". Always paired with an arrow and a number.
 */
export function DeltaChip({ value, unit = "pts", className }: { value: number | null; unit?: "pts" | "count"; className?: string }) {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = unit === "pts" ? Math.round(value * 1000) / 10 : Math.round(value);
  const flat = rounded === 0;
  const up = rounded > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const text = unit === "pts" ? `${Math.abs(rounded).toFixed(1)} pts` : `${Math.abs(rounded)}`;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
      flat ? "bg-muted text-muted-foreground" : up ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400",
      className
    )}>
      <Icon className="h-3 w-3" aria-hidden />
      <span className="sr-only">{flat ? "No change" : up ? "Up" : "Down"}</span>
      {text}
    </span>
  );
}

/** A semicircle gauge for a single headline ratio (0–100%). */
export function Gauge({ value, label, caption }: { value: number | null; label: string; caption?: string }) {
  const clamped = value == null ? 0 : Math.max(0, Math.min(1, value));
  const arc = "M 16 96 A 80 80 0 0 1 176 96";
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[108px] w-[192px]">
        <svg viewBox="0 0 192 104" className="h-full w-full" aria-hidden>
          <path d={arc} fill="none" stroke="hsl(var(--muted))" strokeWidth={14} strokeLinecap="round" />
          <path
            d={arc}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={14}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${clamped * 100} 100`}
            className="transition-[stroke-dasharray] duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-3xl font-bold tracking-tight">{pct(value)}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
      {caption && <p className="mt-2 text-center text-[11px] text-muted-foreground">{caption}</p>}
    </div>
  );
}

/** Initials for a name, e.g. "Chief Strategy Officer" → "CS". */
export function initials(name: string): string {
  const words = name.replace(/[^A-Za-z\s&]/g, " ").split(/\s+/).filter(w => w && w !== "&" && !/^(of|the|and)$/i.test(w));
  return (words[0]?.[0] ?? "?").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

/**
 * Hover/focus tooltip. The row it wraps is the hit target, so it is far larger
 * than the mark; every value in a tooltip is also shown as text elsewhere.
 */
export function Tip({ content, children, className }: { content: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("group/tip relative outline-none", className)} tabIndex={0}>
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-[280px] -translate-x-1/2 translate-y-1 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-lg transition-all duration-150 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-focus-visible/tip:translate-y-0 group-focus-visible/tip:opacity-100"
      >
        {content}
      </div>
    </div>
  );
}

export function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** A thin magnitude bar in the brand gold, with a subtle 100% end. */
export function MeterBar({ value, tone = "primary", className }: { value: number | null; tone?: "primary" | "soft"; className?: string }) {
  const width = value == null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone === "primary" ? "bg-primary" : "bg-primary/45")}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/** A stacked bar of initiative statuses; 2px gaps between segments, labels live in the legend. */
export function StatusStack({ counts, order, className, height = "h-2.5" }: {
  counts: Record<InitiativeStatus, number>;
  order: InitiativeStatus[];
  className?: string;
  height?: string;
}) {
  const total = order.reduce((s, k) => s + counts[k], 0);
  if (total === 0) return <div className={cn("w-full rounded-full bg-muted", height, className)} />;
  return (
    <div className={cn("flex w-full gap-[2px] overflow-hidden rounded-full", height, className)}>
      {order.filter(k => counts[k] > 0).map(k => (
        <div key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: STATUS_COLOR[k] }} className="h-full first:rounded-l-full last:rounded-r-full" />
      ))}
    </div>
  );
}
