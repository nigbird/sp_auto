
import { PrismaClient } from '@prisma/client';


import { Role, UserStatus, PlanStatus, ApprovalStatus } from "@prisma/client";
const prisma = new PrismaClient();

// Data from src/lib/data.ts (adapted for seeding)
const users = [
    { name: "Liam Johnson", email: "liam@corp-plan.com", avatar: "https://picsum.photos/id/1005/100", role: Role.MANAGER, status: UserStatus.ACTIVE, createdAt: new Date("2023-10-01") },
    { name: "Olivia Smith", email: "olivia@corp-plan.com", avatar: "https://picsum.photos/id/1011/100", role: Role.USER, status: UserStatus.ACTIVE, createdAt: new Date("2023-10-05") },
    { name: "Noah Williams", email: "noah@corp-plan.com", avatar: "https://picsum.photos/id/1012/100", role: Role.USER, status: UserStatus.ACTIVE, createdAt: new Date("2023-10-12") },
    { name: "Emma Brown", email: "emma@corp-plan.com", avatar: "https://picsum.photos/id/1013/100", role: Role.USER, status: UserStatus.ACTIVE, createdAt: new Date("2023-10-15") },
    { name: "Oliver Jones", email: "oliver@corp-plan.com", avatar: "https://picsum.photos/id/1014/100", role: Role.USER, status: UserStatus.INACTIVE, createdAt: new Date("2023-11-01") },
    { name: "Admin User", email: "admin@corp-plan.com", avatar: "https://picsum.photos/id/1/100", role: Role.ADMINISTRATOR, status: UserStatus.ACTIVE, createdAt: new Date("2023-09-01") },
];

const rules = [
    { id: "1", status: "Completed As Per Target", description: "Performance against target is >= 100%", min: 100, max: 1e9, isSystem: true },
    { id: "2", status: "On Track", description: "Performance against target is from 70% up to 99.99%", min: 70, max: 99.99, isSystem: false },
    { id: "3", status: "Delayed", description: "Performance against target is above 0% but less than 70%", min: 0.01, max: 69.99, isSystem: false },
    { id: "4", status: "Not Started", description: "Performance against target is 0%", min: 0, max: 0, isSystem: true },
    { id: "5", status: "Overdue", description: "Past deadline and not completed", min: 0, max: 99.99, isSystem: true },
];

const notifications = [
    { id: "1", message: "Activity 'Customer Support Training' is delayed.", date: new Date(), read: false },
    { id: "2", message: "Noah Williams completed 'Website Redesign Project'.", date: new Date(Date.now() - 1000 * 60 * 60 * 2), read: false },
    { id: "3", message: "Deadline for 'New CRM System Implementation' is approaching.", date: new Date(Date.now() - 1000 * 60 * 60 * 24), read: true },
];


async function main() {
    console.log(`Start seeding ...`);

    for (const u of users) {
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: u,
            create: u,
        });
        console.log(`Created user with id: ${user.id}`);
    }
    
    for (const r of rules) {
        await prisma.rule.upsert({
            where: { id: r.id },
            update: {
                status: r.status,
                description: r.description,
                min: r.min,
                max: r.max,
                isSystem: r.isSystem,
            },
            create: {
                id: r.id,
                status: r.status,
                description: r.description,
                min: r.min,
                max: r.max,
                isSystem: r.isSystem,
            },
        });
    }
    console.log(`Seeded ${rules.length} rules.`);
    
    // Get the first user to associate notifications
    const firstUser = await prisma.user.findFirst();
    for (const n of notifications) {
        await prisma.notification.upsert({
            where: { id: n.id },
            update: {},
            create: {
                id: n.id,
                message: n.message,
                date: n.date,
                read: n.read,
                user: {
                    connect: { id: firstUser?.id }
                }
            }
        });
    }
    console.log(`Seeded ${notifications.length} notifications.`);

    const planData = {
        planTitle: 'Corporate Strategic Plan',
        startYear: 2024,
        endYear: 2028,
        version: "1.0",
        status: PlanStatus.PUBLISHED
    };

    const strategicPlan = await prisma.strategicPlan.create({
        data: planData,
    });
    console.log(`Created strategic plan "${strategicPlan.planTitle}"`);

    // Get user emails for responsible
    const olivia = await prisma.user.findUnique({ where: { email: "olivia@corp-plan.com" } });
    const noah = await prisma.user.findUnique({ where: { email: "noah@corp-plan.com" } });
    const pillar1 = await prisma.pillar.create({
        data: {
            title: "Market Leadership",
            strategicPlanId: strategicPlan.id,
            objectives: {
                create: [
                    {
                        statement: "Increase Market Share",
                        initiatives: {
                            create: {
                                title: "Aggressive Marketing & Sales",
                                activities: {
                                    create: [
                                        {
                                            title: "Q3 Marketing Campaign Launch",
                                            description: "Launch the new marketing campaign for the fall season, including social media, email, and content marketing.",
                                            department: "Marketing",
                                            responsible: { connect: { id: olivia?.id } },
                                            startDate: new Date("2024-07-01"),
                                            endDate: new Date("2024-09-30"),
                                            status: "Delayed",
                                            weight: 40,
                                            progress: 56,
                                            approvalStatus: ApprovalStatus.PENDING,
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    {
                        statement: "Enhance Brand Presence",
                        initiatives: {
                            create: {
                                title: "Digital Presence Overhaul",
                                activities: {
                                    create: {
                                        title: "Website Redesign Project",
                                        description: "Complete redesign of the corporate website for improved user experience and mobile responsiveness.",
                                        department: "Engineering",
                                        responsible: { connect: { id: noah?.id } },
                                        startDate: new Date("2024-05-01"),
                                        endDate: new Date("2024-07-31"),
                                        status: "Completed As Per Target",
                                        weight: 30,
                                        progress: 100,
                                        approvalStatus: ApprovalStatus.APPROVED
                                    }
                                }
                            }
                        }
                    },
                ]
            }
        }
    });
    console.log(`Seeded pillar: ${pillar1.title}`);
    

    const emma = await prisma.user.findUnique({ where: { email: "emma@corp-plan.com" } });
    const oliver = await prisma.user.findUnique({ where: { email: "oliver@corp-plan.com" } });
    const pillar2 = await prisma.pillar.create({
        data: {
            title: "Operational Excellence",
            strategicPlanId: strategicPlan.id,
            objectives: {
                create: [
                    {
                        statement: "Improve Employee Satisfaction",
                        initiatives: {
                            create: {
                                title: "Workplace Wellness",
                                activities: {
                                    create: {
                                        title: "Employee Wellness Program",
                                        description: "Develop and roll out a new employee wellness program.",
                                        department: "Human Resources",
                                        responsible: { connect: { id: emma?.id } },
                                        startDate: new Date("2024-08-01"),
                                        endDate: new Date("2024-10-31"),
                                        status: "Not Started",
                                        weight: 50,
                                        progress: 0,
                                        approvalStatus: ApprovalStatus.PENDING
                                    }
                                }
                            }
                        }
                    },
                    {
                        statement: "Streamline Customer Service",
                        initiatives: {
                            create: {
                                title: "Support Enhancement",
                                activities: {
                                    create: {
                                        title: "Customer Support Training",
                                        description: "Advanced training for all customer support staff on new product features.",
                                        department: "Support",
                                        responsible: { connect: { id: oliver?.id } },
                                        startDate: new Date("2024-07-10"),
                                        endDate: new Date("2024-07-20"),
                                        status: "Delayed",
                                        weight: 50,
                                        progress: 50,
                                        approvalStatus: ApprovalStatus.DECLINED,
                                        declineReason: "The delay reason is not sufficient. Please provide a more detailed recovery plan."
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        }
    });
    console.log(`Seeded pillar: ${pillar2.title}`);

    console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

    