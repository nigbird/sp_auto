/**
 * Test data for the VA-001 retest (horizontal access control on My Plan).
 *
 *   node scripts/va-test-data.mjs create   # two same-role test users + a published mock plan
 *   node scripts/va-test-data.mjs remove   # delete the mock plan, deactivate the test users
 *
 * Run on the server from the project folder (reads DATABASE_URL from .env).
 * VA_TEST_ROLE picks the role (default "User"); it must be a normal staff role,
 * not an administrator/manager role that may see everyone's activities.
 *
 * `create` prints the two sign-ins once. Each tester is responsible for their
 * own activities only, so signed in as tester 1, My Plan must never contain
 * "VA-TEST tester 2" activities, and the reverse. Running `create` again
 * re-issues fresh passwords and rebuilds the plan.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLAN_NAME = 'VA-TEST Mock Plan (VA-001 retest)';
const PLAN_VERSION = 'VA-TEST';
const TESTERS = [
  { key: 1, name: 'VA Tester One', email: 'va-tester1@example.com' },
  { key: 2, name: 'VA Tester Two', email: 'va-tester2@example.com' },
];
// Permissions that legitimately show every person's activities somewhere in the app.
const PLAN_WIDE = ['strategic-plan:view', 'strategic-plan:edit', 'plan-approvals:view', 'reports:view', 'dashboard:view'];

/** Random, always meets the password policy (length, upper, lower, digit, symbol). */
const newPassword = () => `${randomBytes(9).toString('base64url')}-Va7`;

async function create() {
  const roleName = process.env.VA_TEST_ROLE || 'User';
  const role = await prisma.role.findUnique({ where: { name: roleName }, include: { permissions: true } });
  if (!role) {
    const names = (await prisma.role.findMany({ select: { name: true } })).map((r) => r.name);
    throw new Error(`Role "${roleName}" not found. Set VA_TEST_ROLE to one of: ${names.join(', ')}`);
  }
  const perms = role.permissions.map((p) => p.permission);
  if (!perms.includes('my-plan:view')) throw new Error(`Role "${roleName}" has no "my-plan:view", so it cannot open My Plan.`);
  const wide = perms.filter((p) => PLAN_WIDE.includes(p));

  const users = [];
  const passwords = {};
  for (const t of TESTERS) {
    const password = newPassword();
    passwords[t.key] = password;
    const data = { name: t.name, avatar: '', roleId: role.id, status: 'ACTIVE', passwordHash: await bcrypt.hash(password, 12) };
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: { ...data, sessionVersion: { increment: 1 } }, // also ends any old test sessions
      create: { email: t.email, ...data },
    });
    users.push(user);
  }

  // Rebuild the plan from scratch so reruns are clean.
  await removePlan();
  const year = new Date().getFullYear();
  const plan = await prisma.strategicPlan.create({
    data: { name: PLAN_NAME, version: PLAN_VERSION, startYear: year, endYear: year + 1, status: 'PUBLISHED', isActive: true },
  });
  const pillar = await prisma.pillar.create({ data: { title: 'VA-TEST Pillar', strategicPlanId: plan.id } });
  const objective = await prisma.objective.create({ data: { statement: 'VA-TEST Objective', pillarId: pillar.id } });

  for (const [i, user] of users.entries()) {
    const n = TESTERS[i].key;
    const initiative = await prisma.initiative.create({
      data: { title: `VA-TEST Initiative ${n}`, ownerId: user.id, objectiveId: objective.id },
    });
    for (const letter of ['A', 'B']) {
      await prisma.activity.create({
        data: {
          title: `VA-TEST tester ${n} activity ${letter}`,
          description: `Belongs to ${TESTERS[i].name} only. Must not be visible to the other tester.`,
          responsibleId: user.id,
          initiativeId: initiative.id,
          strategicPlanId: plan.id,
          startDate: new Date(`${year}-01-01`),
          endDate: new Date(`${year}-12-31`),
          status: 'Not Started',
          weight: 25,
          progress: 0,
          approvalStatus: 'APPROVED',
        },
      });
    }
  }

  console.log(`\nCreated published plan "${PLAN_NAME}" with 2 activities per tester.`);
  console.log(`Role used: "${roleName}"`);
  if (wide.length) {
    console.log(`  Note: this role also has ${wide.join(', ')}, so it may legitimately see the whole plan on`);
    console.log('  the Strategic Plan / Dashboard / Reports pages. My Plan (/plan) must still show only own activities.');
  }
  console.log('\nSign-ins (shown once; run "create" again to issue new ones):');
  for (const t of TESTERS) console.log(`  ${t.email}   ${passwords[t.key]}`);
  console.log('\nRemove after the retest:  node scripts/va-test-data.mjs remove\n');
}

/** Deletes the mock plan (pillars, objectives, initiatives and activities cascade). */
async function removePlan() {
  const plans = await prisma.strategicPlan.findMany({ where: { name: PLAN_NAME, version: PLAN_VERSION }, select: { id: true } });
  for (const { id } of plans) {
    try {
      await prisma.strategicPlan.delete({ where: { id } });
    } catch (error) {
      // Something the testers created (e.g. reports) still points at it: hide it instead.
      await prisma.strategicPlan.update({ where: { id }, data: { status: 'DRAFT', isActive: false } });
      console.log(`Could not delete plan ${id} (${error.code ?? error.message}); deactivated it instead. Delete it from Strategic Plans if needed.`);
    }
  }
  return plans.length;
}

async function remove() {
  const removed = await removePlan();
  // Deactivated (not deleted): audit-log entries keep pointing at them.
  const { count } = await prisma.user.updateMany({
    where: { email: { in: TESTERS.map((t) => t.email) } },
    data: { status: 'INACTIVE', passwordHash: '', sessionVersion: { increment: 1 } },
  });
  console.log(`Removed ${removed} mock plan(s); deactivated ${count} test user(s).`);
}

const command = process.argv[2];
const run = command === 'create' ? create : command === 'remove' ? remove : null;
if (!run) {
  console.error('Usage: node scripts/va-test-data.mjs create|remove');
  process.exit(1);
}
run()
  .catch((error) => { console.error(error.message ?? error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
