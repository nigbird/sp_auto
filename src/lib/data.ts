
import type { Activity, User, Notification, ActivityStatus, Pillar } from "./types";

const users: User[] = [
  { name: "Liam Johnson", email: "liam@example.com", avatar: "/avatars/01.png" },
  { name: "Olivia Smith", email: "olivia@example.com", avatar: "/avatars/02.png" },
  { name: "Noah Williams", email: "noah@example.com", avatar: "/avatars/03.png" },
  { name: "Emma Brown", email: "emma@example.com", avatar: "/avatars/04.png" },
  { name: "Oliver Jones", email: "oliver@example.com", avatar: "/avatars/05.png" },
];

const activities: Activity[] = [
  {
    id: "ACT-001",
    title: "Q3 Marketing Campaign Launch",
    description: "Launch the new marketing campaign for the fall season, including social media, email, and content marketing.",
    department: "Marketing",
    responsible: "Olivia Smith",
    startDate: new Date("2024-07-01"),
    endDate: new Date("2024-09-30"),
    status: "Delayed",
    kpis: [
      { name: "Leads Generated", target: 5000, actual: 2800 },
      { name: "Website Traffic Increase", target: 20, actual: 15 },
    ],
    lastUpdated: { user: "Olivia Smith", date: new Date("2024-07-20T10:00:00Z") },
    updates: [{ user: "Olivia Smith", date: new Date("2024-07-20T10:00:00Z"), comment: "Initial progress report. Social media campaign is live." }],
    weight: 40,
    progress: 56,
  },
  {
    id: "ACT-002",
    title: "New CRM System Implementation",
    description: "Implement a new CRM system to improve sales tracking and customer relationship management.",
    department: "Sales",
    responsible: "Liam Johnson",
    startDate: new Date("2024-06-15"),
    endDate: new Date("2024-08-31"),
    status: "On Track",
    kpis: [
      { name: "System Adoption Rate", target: 90, actual: 65 },
      { name: "Data Migration Complete", target: 100, actual: 80 },
    ],
    lastUpdated: { user: "Liam Johnson", date: new Date("2024-07-18T14:30:00Z") },
    updates: [{ user: "Liam Johnson", date: new Date("2024-07-18T14:30:00Z"), comment: "Data migration is on track. User training scheduled." }],
    weight: 30,
    progress: 72
  },
  {
    id: "ACT-003",
    title: "Website Redesign Project",
    description: "Complete redesign of the corporate website for improved user experience and mobile responsiveness.",
    department: "Engineering",
    responsible: "Noah Williams",
    startDate: new Date("2024-05-01"),
    endDate: new Date("2024-07-31"),
    status: "Completed As Per Target",
    kpis: [
      { name: "Page Load Speed (s)", target: 2, actual: 1.8 },
      { name: "Mobile Bounce Rate (%)", target: 40, actual: 35 },
    ],
    lastUpdated: { user: "Noah Williams", date: new Date("2024-07-25T11:00:00Z") },
    updates: [{ user: "Noah Williams", date: new Date("2024-07-25T11:00:00Z"), comment: "Project complete and deployed." }],
    weight: 30,
    progress: 100
  },
  {
    id: "ACT-004",
    title: "Employee Wellness Program",
    description: "Develop and roll out a new employee wellness program.",
    department: "Human Resources",
    responsible: "Emma Brown",
    startDate: new Date("2024-08-01"),
    endDate: new Date("2024-10-31"),
    status: "Not Started",
    kpis: [
      { name: "Participation Rate", target: 60, actual: 0 },
    ],
    lastUpdated: { user: "Admin", date: new Date("2024-07-15T09:00:00Z") },
    updates: [{ user: "Admin", date: new Date("2024-07-15T09:00:00Z"), comment: "Activity created." }],
    weight: 50,
    progress: 0
  },
  {
    id: "ACT-005",
    title: "Customer Support Training",
    description: "Advanced training for all customer support staff on new product features.",
    department: "Support",
    responsible: "Oliver Jones",
    startDate: new Date("2024-07-10"),
    endDate: new Date("2024-07-20"),
    status: "Delayed",
    kpis: [
        { name: "Staff Certified", target: 100, actual: 50 },
    ],
    lastUpdated: { user: "Oliver Jones", date: new Date("2024-07-22T16:00:00Z") },
    updates: [{ user: "Oliver Jones", date: new Date("2024-07-22T16:00:00Z"), comment: "Training delayed due to unforeseen circumstances." }],
    weight: 50,
    progress: 50,
  },
   {
    id: "ACT-006",
    title: "Q4 Product Feature Rollout",
    description: "Plan and execute the rollout of new product features for Q4.",
    department: "Engineering",
    responsible: "Noah Williams",
    startDate: new Date("2024-09-01"),
    endDate: new Date("2024-12-15"),
    status: "Not Started",
    kpis: [
      { name: "Feature Specs Defined", target: 100, actual: 0 },
      { name: "Initial Prototyping", target: 100, actual: 0 },
    ],
    lastUpdated: { user: "Admin", date: new Date("2024-07-28T11:00:00Z") },
    updates: [{ user: "Admin", date: new Date("2024-07-28T11:00:00Z"), comment: "Activity created." }],
    weight: 60,
    progress: 0,
  },
  {
    id: "ACT-007",
    title: "Annual Financial Audit",
    description: "Prepare for and complete the annual financial audit.",
    department: "Finance",
    responsible: "Liam Johnson",
    startDate: new Date("2024-08-15"),
    endDate: new Date("2024-09-15"),
    status: "Delayed",
    kpis: [
      { name: "Documents Prepared", target: 100, actual: 10 },
    ],
    lastUpdated: { user: "Liam Johnson", date: new Date("2024-07-30T15:00:00Z") },
    updates: [{ user: "Liam Johnson", date: new Date("2024-07-30T15:00:00Z"), comment: "Initial document gathering started." }],
    weight: 40,
    progress: 10
  },
];

const reportData: Pillar[] = [
    {
        id: "PILLAR-01",
        title: "Market Leadership",
        objectives: [
            {
                id: "OBJ-01",
                title: "Increase Market Share",
                weight: 60,
                initiatives: [
                    {
                        id: "INIT-01",
                        title: "Aggressive Marketing & Sales",
                        weight: 100,
                        activities: [activities.find(a=>a.id==='ACT-001')!, activities.find(a=>a.id==='ACT-002')!]
                    }
                ]
            },
            {
                id: "OBJ-02",
                title: "Enhance Brand Presence",
                weight: 40,
                initiatives: [
                    {
                        id: "INIT-02",
                        title: "Digital Presence Overhaul",
                        weight: 100,
                        activities: [activities.find(a=>a.id==='ACT-003')!]
                    }
                ]
            }
        ]
    },
    {
        id: "PILLAR-02",
        title: "Operational Excellence",
        objectives: [
            {
                id: "OBJ-03",
                title: "Improve Employee Satisfaction",
                weight: 50,
                initiatives: [
                    {
                        id: "INIT-03",
                        title: "Workplace Wellness",
                        weight: 100,
                        activities: [activities.find(a=>a.id==='ACT-004')!]
                    }
                ]
            },
            {
                id: "OBJ-04",
                title: "Streamline Customer Service",
                weight: 50,
                initiatives: [
                    {
                        id: "INIT-04",
                        title: "Support Enhancement",
                        weight: 100,
                        activities: [activities.find(a=>a.id==='ACT-005')!]
                    }
                ]
            }
        ]
    },
    {
        id: "PILLAR-03",
        title: "Product Innovation",
        objectives: [
            {
                id: "OBJ-05",
                title: "Launch Next-Gen Features",
                weight: 70,
                initiatives: [
                    {
                        id: "INIT-05",
                        title: "Core Product Updates",
                        weight: 100,
                        activities: [activities.find(a=>a.id==='ACT-006')!]
                    }
                ]
            },
            {
                id: "OBJ-06",
                title: "Ensure Compliance and Governance",
                weight: 30,
                initiatives: [
                    {
                        id: "INIT-06",
                        title: "Audit and Compliance Readiness",
                        weight: 100,
                        activities: [activities.find(a=>a.id==='ACT-007')!]
                    }
                ]
            }
        ]
    }
]


const notifications: Notification[] = [
    { id: "1", message: "Activity 'Customer Support Training' is delayed.", date: new Date(), read: false },
    { id: "2", message: "Noah Williams completed 'Website Redesign Project'.", date: new Date(Date.now() - 1000 * 60 * 60 * 2), read: false },
    { id: "3", message: "Deadline for 'New CRM System Implementation' is approaching.", date: new Date(Date.now() - 1000 * 60 * 60 * 24), read: true },
];

export async function getActivities(): Promise<Activity[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return activities;
}

export async function getUsers(): Promise<User[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return users;
}

export async function getNotifications(): Promise<Notification[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return notifications;
}

export async function getReportData(): Promise<Pillar[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return reportData;
}
