"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { INITIATIVE_STATUS_LABEL, INITIATIVE_STATUS_ORDER, type InitiativeStatus, type InitiativeSummary, type NarrativeItem } from "@/lib/dashboard-metrics";
import { overlapsDateRange, type DateRangeValue } from "@/lib/list-filters";
import { DateRangeFilter, Pagination, usePagination } from "../list-controls";
import { MeterBar, RatingChip, STATUS_COLOR, StatusPill, pct, pillarColor, shortDate, weightPct } from "./primitives";
import { ExportCsvButton } from "./export-csv-button";

type SortKey = "code" | "achieved" | "planned" | "total" | "due";

const NARRATIVES: { key: keyof InitiativeSummary["narratives"]; label: string }[] = [
  { key: "accomplished", label: "Accomplished tasks" },
  { key: "variation", label: "Reasons for variation / gap" },
  { key: "wayForward", label: "Recommendations / way forward" },
  { key: "escalation", label: "Critical issues for management" },
];

/** The Excel's "Initiatives Summary (Detail)": every initiative, filterable, with its narratives on expand. */
export function InitiativesTable({ initiatives }: { initiatives: InitiativeSummary[] }) {
  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState<string>("all");
  const [status, setStatus] = useState<InitiativeStatus | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "code", dir: 1 });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<DateRangeValue>({});

  const pillars = useMemo(() => [...new Set(initiatives.map(i => i.pillarCode))], [initiatives]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(INITIATIVE_STATUS_ORDER.map(s => [s, 0])) as Record<InitiativeStatus, number>;
    for (const i of initiatives) if (pillar === "all" || i.pillarCode === pillar) c[i.status]++;
    return c;
  }, [initiatives, pillar]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const value = (i: InitiativeSummary): number | string => {
      switch (sort.key) {
        case "achieved": return i.summary.rollup.weightedPlan > 0 ? i.summary.rollup.achievedResult ?? -1 : -2;
        case "planned": return i.summary.rollup.weightedPlan;
        case "total": return i.summary.totalWeight;
        case "due": return i.dueDate ?? "9999";
        default: return i.code.split(".").map(n => n.padStart(3, "0")).join(".");
      }
    };
    return initiatives
      .filter(i => pillar === "all" || i.pillarCode === pillar)
      .filter(i => status === "all" || i.status === status)
      .filter(i => !q || `${i.code} ${i.title} ${i.owner}`.toLowerCase().includes(q))
      .filter(i => overlapsDateRange(i.startDate, i.dueDate, range))
      .sort((a, b) => {
        const va = value(a), vb = value(b);
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      });
  }, [initiatives, pillar, status, query, sort, range]);
  const pagination = usePagination(rows, `${query}|${pillar}|${status}|${range.from}|${range.to}|${sort.key}|${sort.dir}`, 25);

  const csvHeaders = ["Code", "Initiative", "Owner", "Pillar", "Start", "Due", "Total weight %", "Planned weight %", "Attained weight %", "Achievement %", "Reports approved", "Reports planned", "Status", "Overall", "Rating"];
  const csvRows = rows.map(i => {
    const { rollup, totalWeight, coverage } = i.summary;
    const hasPlan = rollup.weightedPlan > 0;
    return [
      i.code, i.title, i.owner, i.pillarCode,
      i.startDate ? shortDate(i.startDate) : "", i.dueDate ? shortDate(i.dueDate) : "",
      weightPct(totalWeight), weightPct(rollup.weightedPlan), weightPct(rollup.weightedActual),
      hasPlan ? pct(rollup.achievedResult) : "—", coverage.approved, coverage.planned,
      INITIATIVE_STATUS_LABEL[i.status], i.completed ? "Completed" : "Not completed", i.rating,
    ];
  });

  const toggle = (id: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const sortBy = (key: SortKey) => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "code" ? 1 : -1 }));

  return (
    <div>
      {/* Filters: one row, above the table */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search initiative or owner"
            className="h-9 w-64 rounded-xl border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <DateRangeFilter value={range} onChange={setRange} label="Any dates" hint="Shows initiatives whose activities run at any point in this range." className="h-9 rounded-xl" />
        <div className="inline-flex flex-wrap rounded-xl bg-muted p-0.5">
          {["all", ...pillars].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPillar(p)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition", pillar === p ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {p !== "all" && <span className="h-2 w-2 rounded-[2px]" style={{ background: pillarColor(p) }} />}
              {p === "all" ? "All pillars" : p}
            </button>
          ))}
        </div>
        <ExportCsvButton className="ml-auto" filename="initiatives" headers={csvHeaders} rows={csvRows} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={status === "all"} onClick={() => setStatus("all")} label="All" count={Object.values(counts).reduce((s, n) => s + n, 0)} />
        {INITIATIVE_STATUS_ORDER.map(s => (
          <FilterChip key={s} active={status === s} onClick={() => setStatus(s)} label={INITIATIVE_STATUS_LABEL[s]} count={counts[s]} color={STATUS_COLOR[s]} />
        ))}
      </div>

      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="w-8 px-2 pb-3" />
              <SortTh label="Code" k="code" sort={sort} onSort={sortBy} />
              <th className="px-2 pb-3 font-medium">Initiative</th>
              <th className="px-2 pb-3 font-medium">Dates</th>
              <SortTh label="Total wt" k="total" sort={sort} onSort={sortBy} right />
              <SortTh label="Planned wt" k="planned" sort={sort} onSort={sortBy} right />
              <th className="px-2 pb-3 text-right font-medium">Attained wt</th>
              <SortTh label="Achieved" k="achieved" sort={sort} onSort={sortBy} />
              <th className="px-2 pb-3 font-medium">Status</th>
              <th className="px-2 pb-3 font-medium">Overall</th>
              <th className="px-2 pb-3 font-medium">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pagination.items.map(i => {
              const { rollup, totalWeight, coverage } = i.summary;
              const hasPlan = rollup.weightedPlan > 0;
              const isOpen = open.has(i.id);
              const narrativeCount = NARRATIVES.reduce((s, n) => s + i.narratives[n.key].length, 0);
              return (
                <Fragment key={i.id}>
                  <tr className={cn("cursor-pointer transition hover:bg-muted/40", isOpen && "bg-muted/30")} onClick={() => toggle(i.id)}>
                    <td className="px-2 py-3 text-muted-foreground">
                      <button type="button" aria-expanded={isOpen} aria-label={isOpen ? "Hide details" : "Show details"} className="rounded p-0.5 hover:bg-muted" onClick={e => { e.stopPropagation(); toggle(i.id); }}>
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-[2px]" style={{ background: pillarColor(i.pillarCode) }} />{i.code}
                      </span>
                    </td>
                    <td className="max-w-[300px] px-2 py-3">
                      <p className="truncate font-medium" title={i.title}>{i.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{i.owner} · {i.activities} activities{narrativeCount ? ` · ${narrativeCount} notes` : ""}</p>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-xs text-muted-foreground">
                      {i.startDate ? shortDate(i.startDate) : "—"}<br />{i.dueDate ? `→ ${shortDate(i.dueDate)}` : ""}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{weightPct(totalWeight)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{weightPct(rollup.weightedPlan)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{weightPct(rollup.weightedActual)}</td>
                    <td className="w-40 px-2 py-3">
                      <div className="flex items-center gap-2">
                        <MeterBar value={hasPlan ? rollup.achievedResult : null} className="h-1.5" />
                        <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{hasPlan ? pct(rollup.achievedResult) : "—"}</span>
                      </div>
                      {hasPlan && <p className="mt-0.5 text-[11px] text-muted-foreground">{coverage.approved}/{coverage.planned} reports approved</p>}
                    </td>
                    <td className="px-2 py-3"><StatusPill status={i.status} /></td>
                    <td className="whitespace-nowrap px-2 py-3 text-xs">
                      {i.completed ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">Completed</span> : <span className="text-muted-foreground">Not completed</span>}
                    </td>
                    <td className="px-2 py-3"><RatingChip rating={i.rating} /></td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-muted/20">
                      <td />
                      <td colSpan={10} className="px-2 pb-5 pt-2">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {NARRATIVES.map(n => <NarrativeBlock key={n.key} label={n.label} items={i.narratives[n.key]} />)}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Planned weight is {pct(i.summary.planShareOfTotal)} of the initiative's total; full-year progress {pct(i.summary.yearProgress)}; achievement after delays {pct(rollup.achievedWithDelay)}.
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={11} className="px-2 py-10 text-center text-sm text-muted-foreground">No initiatives match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination state={pagination} noun="initiatives" className="mt-4" />
    </div>
  );
}

function NarrativeBlock({ label, items }: { label: string; items: NarrativeItem[] }) {
  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">Nothing reported.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, idx) => (
            <li key={idx}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.text}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={item.activity}>{item.activity}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FilterChip({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        active ? "border-primary/50 bg-primary/10 text-foreground" : "bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
      <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-foreground/70">{count}</span>
    </button>
  );
}

function SortTh({ label, k, sort, onSort, right }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; right?: boolean }) {
  const active = sort.key === k;
  return (
    <th className={cn("px-2 pb-3 font-medium", right && "text-right")} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-foreground", active && "text-foreground")}>
        {label}{active && <span aria-hidden>{sort.dir === 1 ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
