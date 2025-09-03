export type ActivityStatus = "Planned" | "In Progress" | "Completed" | "Delayed";

export type KPI = {
  name: string;
  target: number;
  actual: number;
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
