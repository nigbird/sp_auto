"use client";

import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/lib/dashboard-data";

type Series = "achieved" | "yearProgress";

const SERIES: { id: Series; label: string; hint: string }[] = [
  { id: "achieved", label: "Achievement", hint: "Weighted actual ÷ weighted plan, as of each period's end" },
  { id: "yearProgress", label: "Full-year progress", hint: "Weighted actual ÷ total plan weight" },
];

const fmt = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`);

/**
 * Execution over the plan's reporting periods. One series at a time (they answer
 * different questions), with a crosshair tooltip; the selected period is the last point.
 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [series, setSeries] = useState<Series>("achieved");
  const gradientId = `trend-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const data = points.map(p => ({ ...p, value: p[series] == null ? null : (p[series] as number) * 100 }));
  const max = Math.max(100, ...data.map(d => d.value ?? 0));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{SERIES.find(s => s.id === series)?.hint}</p>
        <div role="tablist" aria-label="Trend measure" className="inline-flex rounded-full bg-muted p-0.5">
          {SERIES.map(s => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={series === s.id}
              onClick={() => setSeries(s.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                series === s.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              domain={[0, Math.ceil(max / 25) * 25]}
              tickFormatter={v => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.35 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as TrendPoint & { value: number | null };
                return (
                  <div className="min-w-[200px] rounded-xl border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg">
                    <p className="mb-1.5 font-semibold">{p.name}</p>
                    <Row label="Achievement" value={fmt(p.achieved)} />
                    <Row label="After delays" value={fmt(p.achievedWithDelay)} />
                    <Row label="Full-year progress" value={fmt(p.yearProgress)} />
                    <Row label="Weighted plan / actual" value={`${p.weightedPlan.toFixed(2)}% / ${p.weightedActual.toFixed(2)}%`} />
                    <Row label="Reports approved" value={`${p.approved} of ${p.planned}`} />
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              connectNulls
              dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
              activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(var(--card))" }}
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {points.length < 2 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">The trend fills in as more reporting periods are reported.</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
