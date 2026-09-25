import * as z from "zod";

/**
 * The one validation schema for a strategic plan's pillar → objective →
 * initiative → activity tree. The create wizard, the edit screen and the
 * server actions all use it, so a plan that passes in the browser can't be
 * rejected by the server for a different reason (and vice versa).
 */

const isValidDate = (value: string) => !Number.isNaN(new Date(value).getTime());

export const planActivitySchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Activity title is required"),
  weight: z.coerce
    .number({ invalid_type_error: "Weight must be a number" })
    .min(0, "Weight can't be negative")
    .max(100, "Weight can't be more than 100%"),
  startDate: z.string().min(1, "Start date is required").refine(isValidDate, "Start date is not a valid date"),
  endDate: z.string().min(1, "End date is required").refine(isValidDate, "End date is not a valid date"),
  department: z.string().min(1, "Department is required"),
  responsible: z.string().min(1, "Responsible person is required"),
  description: z.string().optional(),
  deliverable: z.string().max(1000, "Deliverable must be 1000 characters or less").optional(),
  countsTowardWeight: z.boolean().optional(),
}).refine((data) => !isValidDate(data.startDate) || !isValidDate(data.endDate) || new Date(data.endDate) > new Date(data.startDate), {
  message: "End date must be after the start date",
  path: ["endDate"],
});

export const planInitiativeSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Initiative title is required"),
  description: z.string().optional(),
  owners: z.array(z.string()).min(1, "Select at least one lead/owner"),
  collaborators: z.array(z.string()).optional(),
  activities: z.array(planActivitySchema).min(1, "Add at least one activity to this initiative"),
});

export const planObjectiveSchema = z.object({
  id: z.string().optional(),
  statement: z.string().trim().min(1, "Objective statement is required"),
  initiatives: z.array(planInitiativeSchema).min(1, "Add at least one initiative to this objective"),
});

export const planPillarSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Pillar title is required"),
  description: z.string().optional(),
  objectives: z.array(planObjectiveSchema).min(1, "Add at least one objective to this pillar"),
});

export const planFormSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required"),
  startYear: z.coerce.number({ invalid_type_error: "Start year must be a number" }).int("Start year must be a whole number").min(2000, "Start year must be 2000 or later").max(2100, "Start year must be 2100 or earlier"),
  endYear: z.coerce.number({ invalid_type_error: "End year must be a number" }).int("End year must be a whole number").min(2000, "End year must be 2000 or later").max(2100, "End year must be 2100 or earlier"),
  version: z.string().trim().min(1, "Version is required"),
  pillars: z.array(planPillarSchema).min(1, "Add at least one pillar"),
}).refine(data => data.endYear >= data.startYear, {
  message: "End year must be the same as or after the start year",
  path: ["endYear"],
});

export type PlanFormValues = z.infer<typeof planFormSchema>;

export interface PlanIssue {
  /** Dotted react-hook-form path, e.g. "pillars.0.objectives.1.statement". */
  path: string;
  message: string;
}

export function zodIssuesToPlanIssues(error: z.ZodError): PlanIssue[] {
  return error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }));
}

const COLLECTIONS = ['pillars', 'objectives', 'initiatives', 'activities'] as const;
export type PlanSection = 'plan-info' | typeof COLLECTIONS[number];

/**
 * Which wizard step owns an issue: the deepest collection in its path. An
 * array-level issue ("pillars.0.objectives" has none) belongs to the step
 * where you'd add the missing item.
 */
export function sectionOfPath(path: string): PlanSection {
  const parts = path.split('.');
  for (let i = parts.length - 1; i >= 0; i--) {
    if ((COLLECTIONS as readonly string[]).includes(parts[i])) return parts[i] as PlanSection;
  }
  return 'plan-info';
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Plan name',
  startYear: 'Start year',
  endYear: 'End year',
  version: 'Version',
  title: 'Title',
  statement: 'Statement',
  description: 'Description',
  owners: 'Lead/Owner',
  collaborators: 'Collaborators',
  weight: 'Weight',
  startDate: 'Start date',
  endDate: 'End date',
  department: 'Department',
  responsible: 'Responsible',
  deliverable: 'Deliverable',
  _weight: 'Total weight',
};

/**
 * "pillars.0.objectives.1.initiatives.0.activities.2.endDate" →
 * "Pillar 1 → Objective 1.2 → Initiative 1.2.1 → Activity 1.2.1.3 → End date",
 * numbered the same way the wizard's cards are.
 */
export function describePlanPath(path: string): string {
  const parts = path.split('.');
  const crumbs: string[] = [];
  const numbers: number[] = [];
  const labels: Record<string, string> = { pillars: 'Pillar', objectives: 'Objective', initiatives: 'Initiative', activities: 'Activity' };
  let field: string | undefined;
  for (let i = 0; i < parts.length; i++) {
    const label = labels[parts[i]];
    const index = Number(parts[i + 1]);
    if (label && !Number.isNaN(index)) {
      numbers.push(index + 1);
      crumbs.push(`${label} ${numbers.join('.')}`);
      i++;
    } else if (!label && parts[i] !== 'root') {
      field = FIELD_LABELS[parts[i]] ?? parts[i];
    }
  }
  if (field) crumbs.push(field);
  return crumbs.length ? crumbs.join(' → ') : 'Plan';
}

export function formatPlanIssue(issue: PlanIssue): string {
  return `${describePlanPath(issue.path)}: ${issue.message}`;
}
