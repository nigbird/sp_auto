'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';

export async function getDepartments() {
  await requireUser();

  return prisma.department.findMany({ orderBy: { name: 'asc' } });
}

export async function createDepartment(name: string) {
  await requireUser();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Department name is required.");

  const newDepartment = await prisma.department.create({ data: { name: trimmed } });
  revalidatePath('/settings/departments');
  return newDepartment;
}

export async function updateDepartment(id: string, name: string) {
  await requireUser();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Department name is required.");

  const updatedDepartment = await prisma.department.update({ where: { id }, data: { name: trimmed } });
  revalidatePath('/settings/departments');
  return updatedDepartment;
}

export async function deleteDepartment(id: string) {
  await requireUser();

  await prisma.department.delete({ where: { id } });
  revalidatePath('/settings/departments');
}
