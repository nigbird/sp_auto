export type ActivityStatus = "Planned" | "In Progress" | "Completed" | "Delayed";

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

export type Activity = {
  id: string;
  title: string;
  description: string;
  department: string;
  responsible: string;
  startDate: Date;
  endDate: Date;
  status: ActivityStatus;
  kpis: KPI[];
  lastUpdated: {
    user: string;
    date: Date;
  };
  updates: ActivityUpdate[];
  weight: number;
  progress: number;
};

export type User = {
  name: string;
  email: string;
  avatar: string;
};

export type Notification = {
  id: string;
  message: string;
  date: Date;
  read: boolean;
};

export type Initiative = {
    id: string;
    title: string;
    weight: number;
    activities: Activity[];
}

export type Objective = {
    id: string;
    title: string;
    weight: number;
    initiatives: Initiative[];
}

export type Pillar = {
    id: string;
    title: string;
    objectives: Objective[];
}
