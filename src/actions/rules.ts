'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import type { Rule } from '@/lib/types';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions-server';
import { changedFields, recordAudit } from '@/lib/auth/audit';

export async function getRules(): Promise<Rule[]> {
    await requireUser();

    const rules = await prisma.rule.findMany();
    // Prisma returns Float fields as numbers, so no conversion is needed.
    return rules.map(rule => ({
        ...rule,
        min: rule.min,
        max: rule.max,
    }));
}

export async function updateRule(id: string, data: Partial<Omit<Rule, 'id' | 'isSystem'>>) {
    await requirePermission('settings:manage');

    const before = await prisma.rule.findUnique({ where: { id } });
    const updatedRule = await prisma.rule.update({
        where: { id },
        data,
    });
    const changes = before ? changedFields(before, data) : {};
    if (Object.keys(changes).length > 0) {
        await recordAudit({
            action: 'RULE_UPDATED', entityType: 'Rule', entityId: id,
            summary: `Edited status rule "${updatedRule.status}" (${updatedRule.min}–${updatedRule.max}%)`,
            metadata: { changes },
        });
    }
    revalidatePath('/settings/rules');
    return updatedRule;
}

export async function createRule(data: Omit<Rule, 'id' | 'isSystem'>) {
    await requirePermission('settings:manage');

    const newRule = await prisma.rule.create({
        data: {
            ...data,
            isSystem: false,
        }
    });
    await recordAudit({
        action: 'RULE_CREATED', entityType: 'Rule', entityId: newRule.id,
        summary: `Created status rule "${newRule.status}" (${newRule.min}–${newRule.max}%)`,
    });
    revalidatePath('/settings/rules');
    return newRule;
}

export async function deleteRule(id: string) {
    await requirePermission('settings:manage');

    const rule = await prisma.rule.delete({ where: { id } });
    await recordAudit({ action: 'RULE_DELETED', entityType: 'Rule', entityId: id, summary: `Deleted status rule "${rule.status}"` });
    revalidatePath('/settings/rules');
}
