

export type ActivityStatus = "Not Started" | "On Track" | "Completed As Per Target" | "Delayed" | "Overdue" | string;
export type ApprovalStatus = "Pending" | "Approved" | "Declined";

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

export type Activity = {
  id: string;
  title: string;
  description:string;
  department: string;
  responsible: string;
  owner?: string;
  collaborators?: string[];
  startDate: Date | string;
  endDate: Date | string;
  status: ActivityStatus;
  kpis?: KPI[];
  lastUpdated?: {
    user: string;
    date: Date;
  };
  updates: ActivityUpdate[];
  weight: number;
  progress: number;
  pendingUpdate?: PendingUpdate;
  approvalStatus?: ApprovalStatus;
  declineReason?: string;
};

export type User = {
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

export type Initiative = {
    id?: string;
    title: string;
    description?: string;
    weight?: number; // Calculated field
    activities: Activity[];
    owner?: string;
    collaborators?: string[];
}

export type Objective = {
    id?: string;
    title?: string; 
    statement: string;
    weight?: number; // Calculated field
    initiatives: Initiative[];
}

export type Pillar = {
    id?: string;
    title: string;
    description?: string;
    weight?: number; // Calculated field
    objectives: Objective[];
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

export type StrategicPlan = {
  planTitle: string;
  startYear: number;
  endYear: number;
  version: string;
  pillars: Pillar[];
  status: 'draft' | 'published';
}
