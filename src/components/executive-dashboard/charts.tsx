"use client";

import { useState, type ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { QuarterBucket } from "@/lib/dashboard-metrics";

// Chart colours are hex (SVG attributes don't reliably resolve CSS variables).
// Magnitude = brand gold; the comparison series ("plan", "expected") = warm neutral.
export const GOLD = "#df9a3a";
export const NEUTRAL = "#c9bdac";
const GRID = "rgba(120, 110, 100, 0.16)";
const AXIS_TICK = { fontSize: 11, fill: "currentColor" };

const pctText = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(digits)}%`);

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function TipBox({ title, rows }: { title: ReactNode; rows: [string, string][] }) {
  return (
    <div className="min-w-[190px] rounded-xl border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg">
      <p className="mb-1.5 max-w-[260px] font-semibold leading-snug">{title}</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-6 py-0.5">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

function SeriesLegend({ items, className }: { items: { label: string; color: string }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} /> {i.label}
        </span>
      ))}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-full bg-muted p-0.5">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", value === o.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut (part-to-whole) with an HTML legend carrying every value
// ---------------------------------------------------------------------------

export interface DonutSlice { key: string; label: string; sublabel?: string; value: number; color: string; display: string; tip?: [string, string][] }

export function Donut({ slices, centerValue, centerLabel, emptyText = "Nothing to show yet." }: {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  emptyText?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const visible = slices.filter(s => s.value > 0);
  const total = visible.reduce((s, x) => s + x.value, 0);

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr]">
      <div className="relative mx-auto h-[220px] w-[220px]">
        {total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={visible}
                dataKey="value"
                nameKey="label"
                innerRadius={70}
                outerRadius={104}
                paddingAngle={visible.length > 1 ? 2 : 0}
                cornerRadius={4}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                onMouseEnter={(_, i) => setActive(visible[i]?.key ?? null)}
                onMouseLeave={() => setActive(null)}
                isAnimationActive
              >
                {visible.map(s => (
                  <Cell key={s.key} fill={s.color} opacity={active && active !== s.key ? 0.35 : 1} className="transition-opacity" />
                ))}
              </Pie>
              <Tooltip
                content={({ active: on, payload }) => {
                  if (!on || !payload?.length) return null;
                  const s = payload[0].payload as DonutSlice;
                  return <TipBox title={s.label} rows={s.tip ?? [["Value", s.display], ["Share", pctText(s.value / total)]]} />;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-full border-[18px] border-muted" />
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tracking-tight">{centerValue}</span>
          <span className="max-w-[110px] text-[11px] leading-tight text-muted-foreground">{centerLabel}</span>
        </div>
      </div>

      {total > 0 ? (
        <ul className="min-w-0 space-y-1">
          {slices.map(s => (
            <li
              key={s.key}
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
              className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5 transition", active === s.key ? "bg-muted" : "", s.value <= 0 && "opacity-60")}
            >
              <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: s.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={s.label}>{s.label}</p>
                {s.sublabel && <p className="truncate text-[11px] text-muted-foreground">{s.sublabel}</p>}
              </div>
              <span className="text-sm font-semibold">{s.display}</span>
              <span className="w-12 text-right text-xs text-muted-foreground">{pctText(s.value / total, 0)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan vs actual weight by pillar (grouped columns)
// ---------------------------------------------------------------------------

export function PlanActualBars({ data }: { data: { code: string; title: string; plan: number; actual: number; achieved: number | null }[] }) {
  return (
    <div>
      <SeriesLegend items={[{ label: "Weighted plan", color: NEUTRAL }, { label: "Weighted actual", color: GOLD }]} className="mb-3" />
      <div className="h-[260px] w-full text-muted-foreground">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 18, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="code" tickLine={false} axisLine={false} tick={AXIS_TICK} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={v => `${v}%`} width={48} />
            <Tooltip
              cursor={{ fill: "rgba(120,110,100,0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return <TipBox title={`${d.code} · ${d.title}`} rows={[["Weighted plan", `${d.plan.toFixed(2)}%`], ["Weighted actual", `${d.actual.toFixed(2)}%`], ["Achievement", pctText(d.achieved)]]} />;
              }}
            />
            <Bar dataKey="plan" fill={NEUTRAL} radius={[4, 4, 0, 0]} maxBarSize={34} />
            <Bar dataKey="actual" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={34}>
              <LabelList dataKey="achieved" position="top" formatter={(v: number | null) => (v == null ? "" : pctText(v, 0))} style={{ fontSize: 11, fontWeight: 600, fill: "currentColor" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expected vs completed by fiscal quarter
// ---------------------------------------------------------------------------

export function QuarterChart({ initiatives, activities, fiscalYear }: { initiatives: QuarterBucket[]; activities: QuarterBucket[]; fiscalYear: string }) {
  const [which, setWhich] = useState<"initiatives" | "activities">("initiatives");
  const data = (which === "initiatives" ? initiatives : activities)
    .filter(q => q.key.startsWith("q") || q.expected > 0)
    .map(q => ({ ...q, short: q.label.split(" · ")[0] }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SeriesLegend items={[{ label: "Expected to complete", color: NEUTRAL }, { label: "Completed", color: GOLD }]} />
        <Segmented value={which} onChange={setWhich} label="Items" options={[{ id: "initiatives", label: "Initiatives" }, { id: "activities", label: "Activities" }]} />
      </div>
      <div className="h-[260px] w-full text-muted-foreground">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="30%" margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="short" tickLine={false} axisLine={false} tick={AXIS_TICK} tickMargin={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} width={40} />
            <Tooltip
              cursor={{ fill: "rgba(120,110,100,0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const q = payload[0].payload as QuarterBucket;
                return <TipBox title={`${q.label} · ${fiscalYear}`} rows={[["Expected to complete", String(q.expected)], ["Completed", String(q.completed)], ["Completion rate", q.expected ? pctText(q.completed / q.expected, 0) : "—"]]} />;
              }}
            />
            <Bar dataKey="expected" fill={NEUTRAL} radius={[4, 4, 0, 0]} maxBarSize={38}>
              <LabelList dataKey="expected" position="top" style={{ fontSize: 11, fill: "currentColor" }} />
            </Bar>
            <Bar dataKey="completed" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={38}>
              <LabelList dataKey="completed" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "currentColor" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Streams: achievement ranking and delivery (horizontal bars)
// ---------------------------------------------------------------------------

const shorten = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Single-line category label (recharts wraps long ticks); the full name shows on hover. */
function NameTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const name = payload?.value ?? "";
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill="currentColor">
      <title>{name}</title>
      {shorten(name, 32)}
    </text>
  );
}

export function StreamAchievementChart({ data }: { data: { name: string; achieved: number | null; withDelay: number | null; plan: number; actual: number; rating: string }[] }) {
  const rows = data.filter(d => d.achieved != null).map(d => ({ ...d, value: (d.achieved ?? 0) * 100 }));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No stream has a measured plan this period.</p>;
  return (
    <div className="w-full text-muted-foreground" style={{ height: Math.max(160, rows.length * 38 + 24) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, left: 8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <YAxis type="category" dataKey="name" width={210} tickLine={false} axisLine={false} tick={<NameTick />} />
          <ReferenceLine x={80} stroke={GOLD} strokeOpacity={0.5} />
          <Tooltip
            cursor={{ fill: "rgba(120,110,100,0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof rows)[number];
              return <TipBox title={d.name} rows={[["Achievement", pctText(d.achieved)], ["After delays", pctText(d.withDelay)], ["Weighted plan", `${d.plan.toFixed(2)}%`], ["Weighted actual", `${d.actual.toFixed(2)}%`], ["Rating", d.rating]]} />;
            }}
          />
          <Bar dataKey="value" fill={GOLD} radius={[0, 4, 4, 0]} maxBarSize={20} background={{ fill: "rgba(120,110,100,0.07)", radius: 4 }}>
            <LabelList dataKey="value" position="right" formatter={(v: number) => `${v.toFixed(1)}%`} style={{ fontSize: 11, fontWeight: 600, fill: "currentColor" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StreamDeliveryChart({ data }: { data: { name: string; due: number; completed: number }[] }) {
  const rows = data.filter(d => d.due > 0 || d.completed > 0);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No activities are due yet in any stream.</p>;
  return (
    <div>
      <SeriesLegend items={[{ label: "Due by period end", color: NEUTRAL }, { label: "Completed", color: GOLD }]} className="mb-3" />
      <div className="w-full text-muted-foreground" style={{ height: Math.max(160, rows.length * 44 + 24) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 32, left: 8, bottom: 0 }} barGap={2} barCategoryGap="24%">
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis type="category" dataKey="name" width={210} tickLine={false} axisLine={false} tick={<NameTick />} />
            <Tooltip
              cursor={{ fill: "rgba(120,110,100,0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof rows)[number];
                return <TipBox title={d.name} rows={[["Due by period end", String(d.due)], ["Completed", String(d.completed)], ["Deviation", String(d.completed - d.due)]]} />;
              }}
            />
            <Bar dataKey="due" fill={NEUTRAL} radius={[0, 4, 4, 0]} maxBarSize={14}>
              <LabelList dataKey="due" position="right" style={{ fontSize: 11, fill: "currentColor" }} />
            </Bar>
            <Bar dataKey="completed" fill={GOLD} radius={[0, 4, 4, 0]} maxBarSize={14}>
              <LabelList dataKey="completed" position="right" style={{ fontSize: 11, fontWeight: 600, fill: "currentColor" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Initiatives: achievement vs planned weight (one hue — pillar is in the tooltip)
// ---------------------------------------------------------------------------

export interface ScatterPoint { code: string; title: string; pillarCode: string; owner: string; achieved: number; plannedWeight: number; totalWeight: number; status: string }

export function InitiativeScatter({ points }: { points: ScatterPoint[] }) {
  if (points.length === 0) return <p className="text-sm text-muted-foreground">No initiative has a measured plan this period.</p>;
  const data = points.map(p => ({ ...p, x: Math.min(p.achieved, 1.2) * 100, y: p.plannedWeight }));
  return (
    <div className="h-[300px] w-full text-muted-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, left: -6, bottom: 8 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis type="number" dataKey="x" domain={[0, 110]} ticks={[0, 25, 50, 75, 100]} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} tick={AXIS_TICK}
            label={{ value: "Achievement this period", position: "insideBottom", offset: -4, fontSize: 11, fill: "currentColor" }} />
          <YAxis type="number" dataKey="y" tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} tick={AXIS_TICK} width={48}
            label={{ value: "Planned weight", angle: -90, position: "insideLeft", offset: 16, fontSize: 11, fill: "currentColor" }} />
          <ZAxis type="number" dataKey="totalWeight" range={[70, 520]} />
          <ReferenceLine x={75} stroke={NEUTRAL} strokeDasharray="0" />
          <ReferenceLine x={100} stroke={GOLD} strokeOpacity={0.6} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ScatterPoint;
              return <TipBox title={`${p.code} · ${p.title}`} rows={[["Pillar", p.pillarCode], ["Lead owner", p.owner], ["Achievement", pctText(p.achieved)], ["Planned weight", `${p.plannedWeight.toFixed(2)}%`], ["Total weight", `${p.totalWeight.toFixed(2)}%`], ["Status", p.status]]} />;
            }}
          />
          <Scatter data={data} fill={GOLD} fillOpacity={0.7} stroke="#ffffff" strokeWidth={1.5} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
