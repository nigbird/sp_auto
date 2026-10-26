import type { SummaryTable } from '@/lib/summary-tables';

/** What both summary exports (Word and PDF) are built from: the saved, edited sections and their tables, built from live data. */
export interface SummaryDocument {
  planName: string;
  planVersion: string;
  periodName: string;
  periodEndDate: Date;
  sections: { key: string; level: number; heading: string; body: string; tables: string[] }[];
  tables: Record<string, SummaryTable>;
}

export const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The section's tables in order, numbered across the whole document ("Table 3. …"). */
export function numberedTables(doc: SummaryDocument): Map<string, { number: number; table: SummaryTable }[]> {
  const out = new Map<string, { number: number; table: SummaryTable }[]>();
  let n = 0;
  for (const s of doc.sections) {
    out.set(s.key, s.tables.flatMap(k => (doc.tables[k] ? [{ number: ++n, table: doc.tables[k] }] : [])));
  }
  return out;
}
