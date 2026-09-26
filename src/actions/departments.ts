'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions-server';

export type DepartmentResult = { success: true } | { success: false; message: string };

function revalidate() {
  revalidatePath('/settings/organization/departments');
  revalidatePath('/settings/organization/lead-owners');
  revalidatePath('/users');
}

export async function getDepartments() {
  await requireUser();

  return prisma.department.findMany({ orderBy: { name: 'asc' } });
}

/** Departments with the offices that default to them and how much uses them, for the settings page. */
export async function getDepartmentOverview() {
  await requireUser();
  const [departments, leadOwners, userCounts, activityCounts] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.leadOwner.findMany({ select: { name: true, department: true }, orderBy: { name: 'asc' } }),
    prisma.user.groupBy({ by: ['department'], _count: { _all: true } }),
    prisma.activity.groupBy({ by: ['department'], _count: { _all: true } }),
  ]);
  return departments.map(d => ({
    id: d.id,
    name: d.name,
    leadOwners: leadOwners.filter(l => l.department === d.name).map(l => l.name),
    people: userCounts.find(c => c.department === d.name)?._count._all ?? 0,
    activities: activityCounts.find(c => c.department === d.name)?._count._all ?? 0,
  }));
}

const clean = (name: string) => (name ?? '').replace(/\s+/g, ' ').trim();

export async function createDepartment(name: string): Promise<DepartmentResult> {
  await requirePermission('settings:view');

  const trimmed = clean(name);
  if (!trimmed) return { success: false, message: 'Department name is required.' };
  const clash = await prisma.department.findFirst({ where: { name: { equals: trimmed, mode: 'insensitive' } } });
  if (clash) return { success: false, message: `"${clash.name}" already exists.` };

  await prisma.department.create({ data: { name: trimmed } });
  revalidate();
  return { success: true };
}

/**
 * Renames a department everywhere it's used — activities, people and
 * lead-owner defaults all store the name — so nothing is left pointing at
 * the old one (a plan with the old name would otherwise fail to save).
 */
export async function updateDepartment(id: string, name: string): Promise<DepartmentResult> {
  await requirePermission('settings:view');

  const trimmed = clean(name);
  if (!trimmed) return { success: false, message: 'Department name is required.' };
  const current = await prisma.department.findUnique({ where: { id } });
  if (!current) return { success: false, message: 'This department no longer exists.' };
  const clash = await prisma.department.findFirst({ where: { id: { not: id }, name: { equals: trimmed, mode: 'insensitive' } } });
  if (clash) return { success: false, message: `"${clash.name}" already exists.` };
  if (current.name === trimmed) return { success: true };

  await prisma.$transaction([
    prisma.department.update({ where: { id }, data: { name: trimmed } }),
    prisma.activity.updateMany({ where: { department: current.name }, data: { department: trimmed } }),
    prisma.user.updateMany({ where: { department: current.name }, data: { department: trimmed } }),
    prisma.leadOwner.updateMany({ where: { department: current.name }, data: { department: trimmed } }),
  ]);
  revalidate();
  revalidatePath('/strategic-plan', 'layout');
  return { success: true };
}

/** Refused while activities still use the department; people and lead owners just lose it. */
export async function deleteDepartment(id: string): Promise<DepartmentResult> {
  await requirePermission('settings:view');

  const current = await prisma.department.findUnique({ where: { id } });
  if (!current) return { success: true };
  const activities = await prisma.activity.count({ where: { department: current.name } });
  if (activities > 0) {
    return { success: false, message: `${activities} activit${activities === 1 ? 'y uses' : 'ies use'} "${current.name}". Move them to another department in the plan (or rename this one) before deleting it.` };
  }

  await prisma.$transaction([
    prisma.user.updateMany({ where: { department: current.name }, data: { department: null } }),
    prisma.leadOwner.updateMany({ where: { department: current.name }, data: { department: null } }),
    prisma.department.delete({ where: { id } }),
  ]);
  revalidate();
  return { success: true };
}
