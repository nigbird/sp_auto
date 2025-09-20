
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import type { Rule } from '@/lib/types';

export async function getRules(): Promise<Rule[]> {
    const rules = await prisma.rule.findMany();
    // Prisma returns Decimal for float types, need to convert to number
    return rules.map(rule => ({
        ...rule,
        min: rule.min.toNumber(),
        max: rule.max.toNumber(),
    }));
}

export async function updateRule(id: string, data: Partial<Omit<Rule, 'id' | 'isSystem'>>) {
    const updatedRule = await prisma.rule.update({
        where: { id },
        data,
    });
    revalidatePath('/settings/rules');
    return updatedRule;
}

export async function createRule(data: Omit<Rule, 'id' | 'isSystem'>) {
    const newRule = await prisma.rule.create({
        data: {
            ...data,
            isSystem: false,
        }
    });
    revalidatePath('/settings/rules');
    return newRule;
}

export async function deleteRule(id: string) {
    await prisma.rule.delete({ where: { id } });
    revalidatePath('/settings/rules');
}
