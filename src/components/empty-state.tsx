import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./empty-state.css";

export type EmptyStateArt = "writing" | "plan" | "inbox" | "chart";

/**
 * What a page shows when it has nothing to list yet: a small looping
 * illustration that fits the page, a title, a line of explanation and an
 * optional next step. The animation stops for people who ask for reduced motion.
 */
export function EmptyState({ art, title, description, action, children, className }: {
  art: EmptyStateArt;
  title: string;
  description?: ReactNode;
  action?: { href: string; label: string };
  children?: ReactNode;
  className?: string;
}) {
  const Art = ARTS[art];
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <Art />
      <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Link href={action.href} className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
          {action.label}
        </Link>
      )}
      {children}
    </div>
  );
}

function WritingArt() {
  return (
    <svg className="es-art" viewBox="0 0 160 120" aria-hidden="true">
      <ellipse className="es-shadow" cx="80" cy="112" rx="44" ry="5" />
      <rect className="es-paper" x="40" y="14" width="80" height="92" rx="7" />
      <rect className="es-soft" x="52" y="24" width="28" height="6" rx="3" />
      <g className="es-ink">
        <line className="es-write-line" x1="56" y1="40" x2="104" y2="40" />
        <line className="es-write-line" x1="56" y1="54" x2="104" y2="54" />
        <line className="es-write-line" x1="56" y1="68" x2="104" y2="68" />
        <line className="es-write-line es-short" x1="56" y1="82" x2="88" y2="82" />
      </g>
      <g className="es-pencil">
        <g transform="rotate(40)">
          <path className="es-muted" d="M0 0 L-3.5 -9 L3.5 -9 Z" />
          <rect className="es-accent" x="-3.5" y="-34" width="7" height="25" rx="1" />
          <rect className="es-muted" x="-3.5" y="-39" width="7" height="5" rx="1.5" />
        </g>
      </g>
    </svg>
  );
}

function PlanArt() {
  return (
    <svg className="es-art" viewBox="0 0 160 120" aria-hidden="true">
      <ellipse className="es-shadow" cx="80" cy="112" rx="44" ry="5" />
      <rect className="es-paper" x="42" y="16" width="76" height="90" rx="7" />
      <rect className="es-accent" x="64" y="10" width="32" height="12" rx="4" />
      {[40, 60, 80].map(y => (
        <g key={y}>
          <rect className="es-paper" x="54" y={y - 6} width="12" height="12" rx="3" />
          <line className="es-ink" x1="74" y1={y} x2={y === 80 ? 94 : 106} y2={y} />
        </g>
      ))}
      <g className="es-accent-stroke">
        <path className="es-tick" d="M56.5 40 L59.5 43 L64 37" />
        <path className="es-tick" d="M56.5 60 L59.5 63 L64 57" />
        <path className="es-tick" d="M56.5 80 L59.5 83 L64 77" />
      </g>
    </svg>
  );
}

function InboxArt() {
  return (
    <svg className="es-art" viewBox="0 0 160 120" aria-hidden="true">
      <ellipse className="es-shadow" cx="80" cy="112" rx="48" ry="5" />
      <path className="es-paper" d="M36 72 L50 50 H110 L124 72 V100 a6 6 0 0 1 -6 6 H42 a6 6 0 0 1 -6 -6 Z" />
      <path className="es-paper" d="M36 72 H62 a18 10 0 0 0 36 0 H124" />
      <g className="es-float">
        <circle className="es-accent" cx="80" cy="30" r="14" />
        <path d="M73 30 L78 35 L87 25" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="es-accent">
        <path className="es-spark" d="M52 22 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" />
        <path className="es-spark" d="M110 16 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" />
        <path className="es-spark" d="M114 44 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2 Z" />
      </g>
    </svg>
  );
}

function ChartArt() {
  return (
    <svg className="es-art" viewBox="0 0 160 120" aria-hidden="true">
      <ellipse className="es-shadow" cx="80" cy="112" rx="48" ry="5" />
      <rect className="es-paper" x="32" y="14" width="96" height="92" rx="7" />
      <line className="es-ink" x1="46" y1="92" x2="114" y2="92" strokeWidth="2" />
      <g>
        <rect className="es-bar es-soft" x="50" y="44" width="11" height="44" rx="3" />
        <rect className="es-bar es-accent" x="66" y="36" width="11" height="52" rx="3" />
        <rect className="es-bar es-soft" x="82" y="52" width="11" height="36" rx="3" />
        <rect className="es-bar es-accent" x="98" y="30" width="11" height="58" rx="3" />
      </g>
    </svg>
  );
}

const ARTS: Record<EmptyStateArt, () => JSX.Element> = {
  writing: WritingArt,
  plan: PlanArt,
  inbox: InboxArt,
  chart: ChartArt,
};
