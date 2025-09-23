
import type { StrategicPlan as PrismaStrategicPlan, Pillar as PrismaPillar, Objective as PrismaObjective, Initiative as PrismaInitiative, Activity as PrismaActivity, User as PrismaUser } from '@prisma/client';

export type ActivityStatus = "Not Started" | "On Track" | "Completed As Per Target" | "Delayed" | "Overdue" | string;
export type ApprovalStatus = "PENDING" | "APPROVED" | "DECLINED";

export type KPI = {
  name: string;
  target: number;
  actual: number;
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

export type Activity = Omit<PrismaActivity, 'initiativeId' | 'responsibleId'> & {
    responsible: PrismaUser | string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: "Administrator" | "Manager" | "User";
  status: "Active" | "Inactive";
  createdAt: Date;
};

export type Notification = {
  id: string;
  message: string;
  date: Date;
  read: boolean;
};

export type Initiative = Omit<PrismaInitiative, 'objectiveId'> & {
    activities: Activity[];
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
