
import type { StrategicPlan as PrismaStrategicPlan, Pillar as PrismaPillar, Objective as PrismaObjective, Initiative as PrismaInitiative, Activity as PrismaActivity, User as PrismaUser } from '@prisma/client';

export type ActivityStatus = "Not Started" | "On Track" | "Completed As Per Target" | "Delayed" | "Overdue" | string;
export type ApprovalStatus = "PENDING" | "APPROVED" | "DECLINED";

export type KPI = {
  id?: string;
  name: string;
  unit?: string | null;
  target: number | null;
  actual: number | null;
  hasTarget: boolean;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  weight?: number;
};

export type Deliverable = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | Date | null;
  isDelivered: boolean;
  deliveredDate?: string | Date | null;
};

export type ActivityUpdate = {
  user: string;
  date: Date;
  comment: string;
};

export type PendingUpdate = {
  user: string;
  date: Date;
  comment: string;
  progress: number;
}

export type Activity = Omit<PrismaActivity, 'responsibleId'> & {
    responsible: PrismaUser | string;
    kpis: KPI[];
    deliverables: Deliverable[];
    updates: ActivityUpdate[];
    reportingPeriod?: ReportingPeriod | null;
    monthlyTargets?: ActivityMonthlyTarget[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  roleId: string;
  status: "Active" | "Inactive";
  createdAt: Date;
};

export type Notification = {
  id: string;
  type: string;
  message: string;
  date: Date;
  read: boolean;
  activityId?: string | null;
  reportingPeriodId?: string | null;
};

export type Milestone = {
  id: string;
  title: string;
  targetDate: string | Date;
  isAchieved: boolean;
  achievedDate?: string | Date | null;
};

export type Initiative = Omit<PrismaInitiative, 'objectiveId' | 'ownerId'> & {
    owner: PrismaUser;
    activities: Activity[];
    milestones: Milestone[];
    weight?: number;
}

export type Objective = Omit<PrismaObjective, 'pillarId'> & {
    initiatives: Initiative[];
    weight?: number;
    statement: string; // Ensure statement is always present
    title?: string; // For compatibility with older data if needed
}

export type Pillar = Omit<PrismaPillar, 'strategicPlanId'> & {
    objectives: Objective[];
    weight?: number;
}

export type Rule = {
  id: string;
  status: string;
  description: string;
  min: number;
  max: number;
  isSystem: boolean;
  condition?: (activity: Activity) => boolean;
};

export type StrategicPlan = Omit<PrismaStrategicPlan, 'status'> & {
  status: 'DRAFT' | 'PUBLISHED';
  pillars: Pillar[];
}

export type ReportingPeriod = {
  id: string;
  strategicPlanId: string;
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  cutOffDate: string | Date;
  status: 'OPEN' | 'CLOSED';
};

export type ActivityPeriodEntry = {
  id: string;
  activityId: string;
  reportingPeriodId: string;
  reportingPeriod?: ReportingPeriod;
  plannedProgress: number;
  actualProgress: number | null;
  pendingActualProgress: number | null;
  comment?: string | null;
  reasonForVariation?: string | null;
  wayForward?: string | null;
  escalationIssues?: string | null;
  approvalStatus: ApprovalStatus;
  declineReason?: string | null;
  submittedById?: string | null;
  submittedAt?: string | Date | null;
  approvedById?: string | null;
  approvedAt?: string | Date | null;
};

export type ActivityMonthlyTarget = {
  id: string;
  activityId: string;
  month: string | Date;
  value: number;
};
