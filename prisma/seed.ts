
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/lib/auth/permissions';
import { checkPasswordStrength } from '../src/lib/auth/password-policy';


import { UserStatus, PlanStatus, ApprovalStatus } from "@prisma/client";
const prisma = new PrismaClient();

// Demo data: never written into a production database by accident.
if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    console.error('Refusing to seed demo users and plans into a production database. Set SEED_ALLOW_PRODUCTION=true if you really mean to.');
    process.exit(1);
}

/**
 * The password for the demo accounts this script creates: SEED_USER_PASSWORD
 * from the environment, or a fresh random one printed once below. There is no
 * password in the source code. Existing accounts keep their passwords.
 */
function seedPassword(): string {
    const fromEnv = process.env.SEED_USER_PASSWORD;
    if (fromEnv) {
        const weakness = checkPasswordStrength(fromEnv);
        if (weakness) throw new Error(`SEED_USER_PASSWORD is too weak: ${weakness}`);
        return fromEnv;
    }
    // Random letters/digits plus fixed character classes, so it always meets the password policy.
    return `${randomBytes(12).toString('base64url')}-Aa9`;
}

const SEED_PASSWORD = seedPassword();
const devPasswordHash = bcrypt.hashSync(SEED_PASSWORD, 12);

// Data from src/lib/data.ts (adapted for seeding)
const users = [
    { name: "Abebe Kebede", email: "liam@corp-plan.com", avatar: "", roleName: "Manager", status: UserStatus.ACTIVE, passwordHash: devPasswordHash },
    { name: "Almaz Tesfaye", email: "olivia@corp-plan.com", avatar: "", roleName: "User", status: UserStatus.ACTIVE, passwordHash: devPasswordHash },
    { name: "Dawit Bekele", email: "noah@corp-plan.com", avatar: "", roleName: "User", status: UserStatus.ACTIVE, passwordHash: devPasswordHash },
    { name: "Hana Girma", email: "emma@corp-plan.com", avatar: "", roleName: "User", status: UserStatus.ACTIVE, passwordHash: devPasswordHash },
    { name: "Yonas Alemu", email: "oliver@corp-plan.com", avatar: "", roleName: "User", status: UserStatus.INACTIVE, passwordHash: devPasswordHash },
    { name: "Selamawit Assefa", email: "admin@corp-plan.com", avatar: "", roleName: "Administrator", status: UserStatus.ACTIVE, passwordHash: devPasswordHash },
];

const rules = [
    { status: "Completed As Per Target", description: "Performance against target is >= 100%", min: 100, max: 1e9, isSystem: true },
    { status: "On Track", description: "Performance against target is from 70% up to 99.99%", min: 70, max: 99.99, isSystem: false },
    { status: "Delayed", description: "Performance against target is above 0% but less than 70%", min: 0.01, max: 69.99, isSystem: false },
    { status: "Not Started", description: "Performance against target is 0%", min: 0, max: 0, isSystem: true },
    { status: "Overdue", description: "Past deadline and not completed", min: 0, max: 99.99, isSystem: true },
];

const notifications = [
    { message: "Activity 'Customer Support Training' is delayed.", date: new Date(), read: false },
    { message: "Dawit Bekele completed 'Website Redesign Project'.", date: new Date(Date.now() - 1000 * 60 * 60 * 2), read: false },
    { message: "Deadline for 'New CRM System Implementation' is approaching.", date: new Date(Date.now() - 1000 * 60 * 60 * 24), read: true },
];


async function main() {
    console.log(`Start seeding ...`);

    const builtInRoles = [
        { name: "Administrator", isSystem: true },
        { name: "Manager", isSystem: true },
        { name: "User", isSystem: true },
    ];
    const roleByName = new Map<string, string>();
    for (const r of builtInRoles) {
        const role = await prisma.role.upsert({
            where: { name: r.name },
            update: {},
            create: r,
        });
        roleByName.set(r.name, role.id);
    }
    console.log(`Seeded ${builtInRoles.length} built-in roles.`);

    let createdUsers = 0;
    for (const u of users) {
        const { roleName, ...rest } = u;
        const existing = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
        if (existing) continue; // never reset the password of an account that already exists
        const user = await prisma.user.create({ data: { ...rest, roleId: roleByName.get(roleName)! } });
        createdUsers++;
        console.log(`Created user with id: ${user.id}`);
    }
    if (createdUsers > 0 && !process.env.SEED_USER_PASSWORD) {
        console.log(`\nPassword for the ${createdUsers} new demo account(s): ${SEED_PASSWORD}\n(Shown only now. Change it after signing in, or set SEED_USER_PASSWORD to choose it.)\n`);
    }

    // Use a transaction to ensure all rules are created or none are.
    await prisma.$transaction(
      rules.map((r) =>
        prisma.rule.upsert({
          where: { status: r.status }, // Using a unique field for where clause
          update: {
            description: r.description,
            min: r.min,
            max: r.max,
            isSystem: r.isSystem,
          },
          create: {
            status: r.status,
            description: r.description,
            min: r.min,
            max: r.max,
            isSystem: r.isSystem,
          },
        })
      )
    );
    console.log(`Seeded ${rules.length} rules.`);

    const baseLeadOwners = ["Chief Marketing Officer", "Chief Information Officer", "Chief Human Capital Officer", "Chief Operations Officer"];
    for (const name of baseLeadOwners) {
        await prisma.leadOwner.upsert({ where: { name }, update: {}, create: { name } });
    }
    console.log(`Seeded ${baseLeadOwners.length} lead owners.`);

    for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        const roleId = roleByName.get(roleName)!;
        for (const permission of permissions) {
            await prisma.rolePermission.upsert({
                where: { roleId_permission: { roleId, permission } },
                update: {},
                create: { roleId, permission },
            });
        }
    }
    console.log(`Seeded role permissions for ${Object.keys(DEFAULT_ROLE_PERMISSIONS).length} roles.`);

    // Get the first user to associate notifications
    const firstUser = await prisma.user.findFirst();
    if(firstUser) {
        for (const n of notifications) {
             await prisma.notification.create({
                data: {
                    message: n.message,
                    date: n.date,
                    read: n.read,
                    userId: firstUser.id,
                }
            });
        }
        console.log(`Seeded ${notifications.length} notifications.`);
    }


    const planData = {
        name: 'Corporate Strategic Plan',
        startYear: 2024,
        endYear: 2028,
        version: "1.0",
        status: PlanStatus.PUBLISHED
    };

    const strategicPlan = await prisma.strategicPlan.create({
        data: planData,
    });
    console.log(`Created strategic plan "${strategicPlan.name}"`);

    // Get user emails for responsible
    const olivia = await prisma.user.findUnique({ where: { email: "olivia@corp-plan.com" } });
    const noah = await prisma.user.findUnique({ where: { email: "noah@corp-plan.com" } });
    const admin = await prisma.user.findUnique({ where: { email: "admin@corp-plan.com" } });
    if (!olivia || !noah || !admin) {
        console.error("Could not find required users for seeding pillars");
        return;
    }

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
                                ownerId: admin.id,
                                collaborators: ['Almaz Tesfaye'],
                                activities: {
                                    create: [
                                        {
                                            title: "Q3 Marketing Campaign Launch",
                                            description: "Launch the new marketing campaign for the fall season, including social media, email, and content marketing.",
                                            leadOwner: "Chief Marketing Officer",
                                            responsibleId: olivia.id,
                                            startDate: new Date("2024-07-01"),
                                            endDate: new Date("2024-09-30"),
                                            status: "Delayed",
                                            weight: 24,
                                            progress: 56,
                                            approvalStatus: ApprovalStatus.PENDING,
                                            strategicPlanId: strategicPlan.id,
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
                                ownerId: admin.id,
                                collaborators: ['Dawit Bekele'],
                                activities: {
                                    create: {
                                        title: "Website Redesign Project",
                                        description: "Complete redesign of the corporate website for improved user experience and mobile responsiveness.",
                                        leadOwner: "Chief Information Officer",
                                        responsibleId: noah.id,
                                        startDate: new Date("2024-05-01"),
                                        endDate: new Date("2024-07-31"),
                                        status: "Completed As Per Target",
                                        weight: 18,
                                        progress: 100,
                                        approvalStatus: ApprovalStatus.APPROVED,
                                        strategicPlanId: strategicPlan.id,
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
    if (!emma || !oliver) {
        console.error("Could not find required users for seeding pillars");
        return;
    }

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
                                ownerId: admin.id,
                                collaborators: ['Hana Girma'],
                                activities: {
                                    create: {
                                        title: "Employee Wellness Program",
                                        description: "Develop and roll out a new employee wellness program.",
                                        leadOwner: "Chief Human Capital Officer",
                                        responsibleId: emma.id,
                                        startDate: new Date("2024-08-01"),
                                        endDate: new Date("2024-10-31"),
                                        status: "Not Started",
                                        weight: 29,
                                        progress: 0,
                                        approvalStatus: ApprovalStatus.PENDING,
                                        strategicPlanId: strategicPlan.id,
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
                                ownerId: admin.id,
                                collaborators: ['Yonas Alemu'],
                                activities: {
                                    create: {
                                        title: "Customer Support Training",
                                        description: "Advanced training for all customer support staff on new product features.",
                                        leadOwner: "Chief Operations Officer",
                                        responsibleId: oliver.id,
                                        startDate: new Date("2024-07-10"),
                                        endDate: new Date("2024-07-20"),
                                        status: "Delayed",
                                        weight: 29,
                                        progress: 50,
                                        approvalStatus: ApprovalStatus.DECLINED,
                                        declineReason: "The delay reason is not sufficient. Please provide a more detailed recovery plan.",
                                        strategicPlanId: strategicPlan.id,
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
