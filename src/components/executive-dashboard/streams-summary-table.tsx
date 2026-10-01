"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Rating, StreamSummary } from "@/lib/dashboard-metrics";
import { MeterBar, RatingChip, pct, weightPct } from "./primitives";
import { FilterChip } from "./initiatives-table";
import { ExportCsvButton } from "./export-csv-button";

const RATING_ORDER: Rating[] = ["Outstanding", "Very Good", "Good", "Fair", "Unsatisfactory", "No Target"];
// Same hues as RatingChip (emerald, teal, amber, red).
const RATING_DOT: Record<Rating, string> = {
  Outstanding: "#059669",
  "Very Good": "#10b981",
  Good: "#14b8a6",
  Fair: "#f59e0b",
  Unsatisfactory: "#ef4444",
  "No Target": "#a8a29a",
};

type SortKey = "achievement" | "score" | "plan" | "name";

/**
 * The streams table cut down to the scoring columns — plan, actual,
 * achievement, after delays, score and rating — with search, rating filter
 * and sorting. Same data as the full table beside it.
 */
export function StreamsSummaryTable({ streams }: { streams: StreamSummary[] }) {
  const [query, setQuery] = useState("");
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "achievement", dir: -1 });

  const counts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const c = Object.fromEntries(RATING_ORDER.map(r => [r, 0])) as Record<Rating, number>;
    for (const s of streams) if (!q || s.name.toLowerCase().includes(q)) c[s.rating]++;
    return c;
  }, [streams, query]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasPlan = (s: StreamSummary) => s.summary.rollup.weightedPlan > 0 && s.summary.coverage.approved > 0;
    const value = (s: StreamSummary): number | string => {
      switch (sort.key) {
        case "name": return s.name.toLowerCase();
        case "plan": return s.summary.rollup.weightedPlan;
        case "score": return s.score30 ?? -1;
        default: return hasPlan(s) ? s.summary.rollup.achievedResult ?? -1 : -2;
      }
    };
    return streams
      .filter(s => ratings.length === 0 || ratings.includes(s.rating))
      .filter(s => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = value(a), vb = value(b);
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir || a.name.localeCompare(b.name);
      });
  }, [streams, ratings, query, sort]);

  const sortBy = (key: SortKey) => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }));
  const toggleRating = (r: Rating) => setRatings(prev => (prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]));

  const csvHeaders = ["#", "Stream / director", "Plan %", "Actual %", "Achievement %", "After delays %", "Score (of 30%)", "Rating"];
  const csvRows = rows.map((s, i) => {
    const { rollup, coverage } = s.summary;
    const hasPlan = rollup.weightedPlan > 0 && coverage.approved > 0;
    return [i + 1, s.name, weightPct(rollup.weightedPlan), weightPct(rollup.weightedActual),
      hasPlan ? pct(rollup.achievedResult) : "—", hasPlan ? pct(rollup.achievedWithDelay) : "—",
      s.score30 == null ? "—" : `${s.score30.toFixed(1)}%`, s.rating];
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search stream or director"
            className="h-9 w-64 rounded-xl border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="ml-auto">
          <ExportCsvButton filename="streams-scores" headers={csvHeaders} rows={csvRows} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={ratings.length === 0} onClick={() => setRatings([])} label="All ratings" count={Object.values(counts).reduce((s, n) => s + n, 0)} />
        {RATING_ORDER.filter(r => counts[r] > 0 || ratings.includes(r)).map(r => (
          <FilterChip key={r} active={ratings.includes(r)} onClick={() => toggleRating(r)} label={r} count={counts[r]} color={RATING_DOT[r]} />
        ))}
      </div>

      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-2 pb-3 font-medium">#</th>
              <SortTh label="Stream / director" k="name" sort={sort} onSort={sortBy} />
              <SortTh label="Plan" k="plan" sort={sort} onSort={sortBy} right />
              <th className="px-2 pb-3 text-right font-medium">Actual</th>
              <SortTh label="Achievement" k="achievement" sort={sort} onSort={sortBy} className="w-44" />
              <th className="px-2 pb-3 text-right font-medium">After delays</th>
              <SortTh label="Score (of 30%)" k="score" sort={sort} onSort={sortBy} right />
              <th className="px-2 pb-3 font-medium">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((s, i) => {
              const { rollup, coverage } = s.summary;
              const hasPlan = rollup.weightedPlan > 0 && coverage.approved > 0;
              return (
                <tr key={s.name} className="transition hover:bg-muted/40">
                  <td className="px-2 py-3 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="max-w-[300px] px-2 py-3"><p className="truncate font-medium" title={s.name}>{s.name}</p></td>
                  <td className="px-2 py-3 text-right tabular-nums">{weightPct(rollup.weightedPlan)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{weightPct(rollup.weightedActual)}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <MeterBar value={hasPlan ? rollup.achievedResult : null} className="h-1.5" />
                      <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{hasPlan ? pct(rollup.achievedResult) : "—"}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{hasPlan ? pct(rollup.achievedWithDelay) : "—"}</td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums">{s.score30 == null ? "—" : `${s.score30.toFixed(1)}%`}</td>
                  <td className="px-2 py-3"><RatingChip rating={s.rating} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-2 py-10 text-center text-sm text-muted-foreground">No streams match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortTh({ label, k, sort, onSort, right, className }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; right?: boolean; className?: string }) {
  const active = sort.key === k;
  return (
    <th className={cn("px-2 pb-3 font-medium", right && "text-right", className)} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-foreground", active && "text-foreground")}>
        {label}{active && <span aria-hidden>{sort.dir === 1 ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
