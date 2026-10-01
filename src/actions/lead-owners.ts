'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions-server';
import { changedFields, recordAudit } from '@/lib/auth/audit';

export type LeadOwnerResult<T = undefined> = { success: true; data?: T } | { success: false; message: string };

function revalidate() {
  revalidatePath('/settings/organization/lead-owners');
  revalidatePath('/users');
}

/** Lead-owner offices with how many people hold each. */
export async function getLeadOwners() {
  await requireUser();
  const leadOwners = await prisma.leadOwner.findMany({
    orderBy: { name: 'asc' },
    include: { users: { select: { id: true, name: true } } },
  });
  return JSON.parse(JSON.stringify(leadOwners)) as { id: string; name: string; department: string | null; users: { id: string; name: string }[] }[];
}

function clean(name: string) {
  return (name ?? '').replace(/\s+/g, ' ').trim();
}

export async function createLeadOwner(name: string, department?: string | null): Promise<LeadOwnerResult<{ id: string }>> {
  await requirePermission('settings:manage');
  const trimmed = clean(name);
  if (!trimmed) return { success: false, message: 'Lead owner name is required.' };
  const existing = await prisma.leadOwner.findFirst({ where: { name: { equals: trimmed, mode: 'insensitive' } } });
  if (existing) return { success: false, message: `"${existing.name}" already exists.` };
  const created = await prisma.leadOwner.create({ data: { name: trimmed, department: clean(department ?? '') || null } });
  await recordAudit({
    action: 'LEAD_OWNER_CREATED', entityType: 'LeadOwner', entityId: created.id,
    summary: `Created lead owner "${trimmed}"${created.department ? ` in ${created.department}` : ''}`,
  });
  revalidate();
  return { success: true, data: { id: created.id } };
}

export async function updateLeadOwner(id: string, name: string, department?: string | null): Promise<LeadOwnerResult> {
  await requirePermission('settings:manage');
  const trimmed = clean(name);
  if (!trimmed) return { success: false, message: 'Lead owner name is required.' };
  const clash = await prisma.leadOwner.findFirst({ where: { id: { not: id }, name: { equals: trimmed, mode: 'insensitive' } } });
  if (clash) return { success: false, message: `"${clash.name}" already exists.` };
  const before = await prisma.leadOwner.findUnique({ where: { id }, select: { name: true, department: true } });
  const next = { name: trimmed, department: clean(department ?? '') || null };
  await prisma.leadOwner.update({ where: { id }, data: next });
  const changes = before ? changedFields(before, next) : {};
  if (Object.keys(changes).length > 0) {
    await recordAudit({
      action: 'LEAD_OWNER_UPDATED', entityType: 'LeadOwner', entityId: id,
      summary: changes.name ? `Renamed lead owner "${before!.name}" to "${trimmed}"` : `Edited lead owner "${trimmed}"`,
      metadata: { changes },
    });
  }
  revalidate();
  return { success: true };
}

/** People who held this office keep their account; they just no longer have a lead-owner title. */
export async function deleteLeadOwner(id: string): Promise<LeadOwnerResult> {
  await requirePermission('settings:manage');
  const deleted = await prisma.leadOwner.delete({ where: { id } });
  await recordAudit({ action: 'LEAD_OWNER_DELETED', entityType: 'LeadOwner', entityId: id, summary: `Deleted lead owner "${deleted.name}"` });
  revalidate();
  return { success: true };
}
