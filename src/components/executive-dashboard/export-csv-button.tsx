"use client";

import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";

export function ExportCsvButton({
  filename,
  headers,
  rows,
  className,
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, headers, rows)}
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
    >
      <Download className="h-3.5 w-3.5" /> Export CSV
    </button>
  );
}
