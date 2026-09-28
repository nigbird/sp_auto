"use client";

import { useEffect, useState, useTransition } from "react";
import { Award, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getRatingThresholds, resetRatingThresholds, updateRatingThresholds } from "@/actions/app-config";
import {
  DEFAULT_RATING_THRESHOLDS, RATING_THRESHOLD_FIELDS, describeRatingBands, validateRatingThresholds, type RatingThresholds,
} from "@/lib/rating-bands";

// Rating is ordinal status, so the preview uses the status family (with labels).
const BAND_COLORS: Record<string, string> = {
  Outstanding: "#0c6e3a",
  "Very Good": "#34a37a",
  Good: "#6fae8c",
  Fair: "#e8a33d",
  Unsatisfactory: "#c0392b",
};

type Draft = Record<keyof RatingThresholds, string>;
const toDraft = (t: RatingThresholds): Draft => ({
  outstanding: String(t.outstanding), veryGood: String(t.veryGood), good: String(t.good), fair: String(t.fair),
});
const fromDraft = (d: Draft): RatingThresholds => ({
  outstanding: Number(d.outstanding), veryGood: Number(d.veryGood), good: Number(d.good), fair: Number(d.fair),
});

/** Configuration → Performance Rules: the dashboard's rating bands ("Weighted Performance Range"). */
export function RatingBandsCard() {
  const [saved, setSaved] = useState<RatingThresholds | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft(DEFAULT_RATING_THRESHOLDS));
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    getRatingThresholds().then(t => { setSaved(t); setDraft(toDraft(t)); });
  }, []);

  const current = fromDraft(draft);
  const problem = validateRatingThresholds(current);
  const dirty = saved != null && (Object.keys(draft) as (keyof Draft)[]).some(k => Number(draft[k]) !== saved[k]);
  const isDefault = saved != null && (Object.keys(DEFAULT_RATING_THRESHOLDS) as (keyof RatingThresholds)[]).every(k => saved[k] === DEFAULT_RATING_THRESHOLDS[k]);

  const save = () => startTransition(async () => {
    try {
      const t = await updateRatingThresholds(current);
      setSaved(t);
      setDraft(toDraft(t));
      toast({ title: "Rating bands updated", description: "The dashboard now uses the new bands." });
    } catch (e) {
      toast({ title: "Could not update rating bands", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    }
  });

  const reset = () => startTransition(async () => {
    try {
      const t = await resetRatingThresholds();
      setSaved(t);
      setDraft(toDraft(t));
      toast({ title: "Rating bands reset", description: "Back to the defaults (90 / 80 / 70 / 50)." });
    } catch (e) {
      toast({ title: "Could not reset rating bands", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    }
  });

  // Preview scale: 0% to a little past Outstanding.
  const scaleMax = Math.max(100, (problem ? DEFAULT_RATING_THRESHOLDS : current).outstanding + 10);
  const t = problem ? null : current;
  const segments = t
    ? [
        { label: "Unsatisfactory", from: 0, to: t.fair },
        { label: "Fair", from: t.fair, to: t.good },
        { label: "Good", from: t.good, to: t.veryGood },
        { label: "Very Good", from: t.veryGood, to: t.outstanding },
        { label: "Outstanding", from: t.outstanding, to: scaleMax },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Rating Bands</CardTitle>
        <CardDescription>
          The minimum achievement for each rating on the dashboard and its exports (streams, departments and initiatives). Anything below Fair is Unsatisfactory.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RATING_THRESHOLD_FIELDS.map(f => (
            <label key={f.key} className="space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: BAND_COLORS[f.label] }} />
                {f.label} from
              </span>
              <div className="relative">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  value={draft[f.key]}
                  onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                  className="pr-8"
                  disabled={saved == null || pending}
                  aria-label={`${f.label} minimum achievement in percent`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </label>
          ))}
        </div>

        {problem ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{problem}</p>
        ) : (
          <div>
            <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
              {segments.map(s => (
                <div key={s.label} title={`${s.label}: ${s.from}% – ${s.label === "Outstanding" ? "and above" : `${s.to}%`}`} style={{ width: `${((s.to - s.from) / scaleMax) * 100}%`, background: BAND_COLORS[s.label] }} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {[...segments].reverse().map(s => (
                <span key={s.label} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: BAND_COLORS[s.label] }} />
                  <span className="font-medium text-foreground">{s.label}</span>
                  {s.label === "Outstanding" ? `≥ ${s.from}%` : s.label === "Unsatisfactory" ? `< ${s.to}%` : `${s.from}% – ${s.to}%`}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">{saved ? `Saved: ${describeRatingBands(saved)}.` : "Loading…"}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset} disabled={pending || saved == null || isDefault}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset to defaults
          </Button>
          <Button onClick={save} disabled={pending || !dirty || problem != null}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save bands
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
