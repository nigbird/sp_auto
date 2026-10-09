"use client";

import * as React from "react";
import { format } from "date-fns";
import { DetailDrawer } from "../detail-drawer";
import { formatTargetValue } from "@/lib/monthly-breakdown";
import type { PeriodReportEntry } from "../my-activity/my-activity-report-list";

/** Activity title with its initiative underneath, truncated to one line each. */
export function ReportActivityCell({ entry }: { entry: PeriodReportEntry }) {
  const { activity } = entry;
  return (
    <td className="max-w-0 px-4 py-3">
      <p className="truncate font-medium text-foreground" title={activity.title}>{activity.title}</p>
      {activity.initiative && (
        <p className="truncate text-xs text-muted-foreground" title={activity.initiative.title}>{activity.initiative.title}</p>
      )}
    </td>
  );
}

/** The side panel for one period report: period, activity, its place in the plan, dates and target. */
export function ReportDrawer({ entry, open, onOpenChange, badge, meta, index, count, onPrev, onNext, footer, children }: {
  entry: PeriodReportEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge?: React.ReactNode;
  /** Extra line under the dates, e.g. owner and submission time. */
  meta?: React.ReactNode;
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const activity = entry?.activity;
  return (
    <DetailDrawer
      open={open && !!entry}
      onOpenChange={onOpenChange}
      eyebrow={entry?.reportingPeriod.name}
      title={activity?.title}
      badge={badge}
      description={activity && <>
        {activity.initiative && (
          <p>{activity.initiative.objective.pillar.title} → {activity.initiative.objective.statement} → {activity.initiative.title}</p>
        )}
        <p>
          {format(new Date(activity.startDate), "PP")} – {format(new Date(activity.endDate), "PP")} · Target {activity.annualTarget != null ? formatTargetValue(activity.annualTarget, activity.targetType) : "—"}
        </p>
        {meta && <p>{meta}</p>}
        {activity.deliverable && (
          <p className="pt-1 text-sm text-foreground"><span className="font-medium text-foreground/80">Deliverable:</span> {activity.deliverable}</p>
        )}
      </>}
      index={index}
      count={count}
      onPrev={onPrev}
      onNext={onNext}
      footer={footer}
    >
      {children}
    </DetailDrawer>
  );
}
