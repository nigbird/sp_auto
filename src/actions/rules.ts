'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod';
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

const ruleFields = z.object({
    status: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500),
    min: z.coerce.number().finite(),
    max: z.coerce.number().finite(),
});

/** Only the rule's own editable fields, validated — never whatever else the request carries. */
function ruleData<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new Error('Check the rule: it needs a status name and numeric minimum and maximum.');
    return parsed.data;
}

export async function updateRule(id: string, data: Partial<Omit<Rule, 'id' | 'isSystem'>>) {
    await requirePermission('settings:manage');
    const fields = ruleData(ruleFields.partial(), data);

    const before = await prisma.rule.findUnique({ where: { id: String(id) } });
    const updatedRule = await prisma.rule.update({
        where: { id: String(id) },
        data: fields,
    });
    const changes = before ? changedFields(before, fields) : {};
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
    const fields = ruleData(ruleFields, data);

    const newRule = await prisma.rule.create({
        data: {
            ...fields,
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
