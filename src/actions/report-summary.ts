'use server'

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission, userCan } from '@/lib/auth/permissions-server';
import { recordAudit } from '@/lib/auth/audit';
import { generateSummary, MAX_CORRECTIONS, parseCorrections, type SummaryCorrection } from '@/lib/report-summary';
import { loadSummaryCorrections, loadSummarySource, loadSummaryTables, loadTableContext } from '@/lib/report-summary-data';
import { defaultTables, sanitizeTableKeys } from '@/lib/summary-tables';

/** Returned rather than thrown so the message survives Next.js' production error masking. */
export type SummaryActionResult =
    | { success: true; kept?: number; updatedAt?: string }
    | { success: false; message: string; conflict?: boolean };

const fail = (message: string, conflict?: boolean): SummaryActionResult => ({ success: false, message, ...(conflict ? { conflict } : {}) });

const MAX_BODY = 20000;

const MAX_HEADING = 300;

const revalidateSummary = () => revalidatePath('/reports/summary');

/** Sections people add themselves; regenerating never touches them. */
const CUSTOM_PREFIX = 'custom:';
const isCustomKey = (key: string) => key.startsWith(CUSTOM_PREFIX);

const cleanHeading = (heading: unknown) => (typeof heading === 'string' ? heading.replace(/\s+/g, ' ').trim() : '');

/** Everything the summary page shows for one plan and period (the latest period with a report request by default). */
export async function getReportSummaryPage(strategicPlanId: string, periodId?: string) {
    const user = await requirePermission('reports:view');
    const periods = await prisma.reportingPeriod.findMany({
        where: { strategicPlanId },
        orderBy: { startDate: 'asc' },
        select: { id: true, name: true, startDate: true, endDate: true, reportRequestSentAt: true },
    });
    const withRequests = periods.filter(p => p.reportRequestSentAt);
    const selected = (periodId && periods.find(p => p.id === periodId)) || withRequests[withRequests.length - 1] || null;
    const source = selected ? await loadSummarySource(selected.id) : null;
    const canEdit = userCan(user, 'reports:summary');
    const tables = source ? await loadSummaryTables(source) : { tables: {}, catalog: [] };
    return JSON.parse(JSON.stringify({
        periods,
        selected,
        hasReports: (source?.entries.length ?? 0) > 0,
        summary: source?.summary
            ? {
                id: source.summary.id,
                generatedAt: source.summary.generatedAt,
                sections: source.summary.sections.filter(s => !s.hidden).map(s => ({
                    id: s.id, key: s.key, level: s.level, heading: s.heading, body: s.body, tables: s.tables,
                    custom: isCustomKey(s.key), headingEdited: s.headingEdited,
                    edited: !isCustomKey(s.key) && s.body !== s.generatedBody, editedAt: s.editedAt, updatedAt: s.updatedAt,
                })),
                removed: source.summary.sections.filter(s => s.hidden).map(s => ({ id: s.id, heading: s.heading })),
            }
            : null,
        tables: tables.tables,
        tableCatalog: tables.catalog,
        corrections: canEdit ? await loadSummaryCorrections() : [],
        canEdit,
        canExport: userCan(user, 'reports:export'),
    }));
}

/**
 * Writes the summary for a period from its approved reports. Sections someone
 * edited keep their text unless `overwriteEdited` is set; their generated
 * text is still refreshed, so "Reset to generated" gives the new draft.
 */
export async function generateReportSummary(periodId: string, options: { overwriteEdited?: boolean } = {}): Promise<SummaryActionResult> {
    const user = await requirePermission('reports:summary');
    const source = await loadSummarySource(periodId);
    if (!source) return fail('That reporting period no longer exists.');
    if (source.entries.length === 0) return fail(`No reports have been requested for ${source.period.name} yet, so there is nothing to summarise.`);

    const corrections = await loadSummaryCorrections();
    const tableContext = await loadTableContext(source, corrections);
    const generated = generateSummary(source.plan, source.entries, source.period, corrections, tableContext.metrics?.activityDelayRows);
    let kept = 0;
    await prisma.$transaction(async tx => {
        const summary = await tx.reportSummary.upsert({
            where: { reportingPeriodId: periodId },
            update: { generatedAt: new Date(), generatedById: user.id },
            create: { reportingPeriodId: periodId, generatedById: user.id },
            include: { sections: true },
        });
        const replace = !!options.overwriteEdited;
        const before = [...summary.sections].sort((x, y) => x.position - y.position);
        const existing = new Map(before.filter(s => !isCustomKey(s.key)).map(s => [s.key, s]));

        // Sections people added stay where they were: after the generated section they followed.
        const customsAfter = new Map<string | null, typeof before>();
        let anchor: string | null = null;
        for (const s of before) {
            if (!isCustomKey(s.key)) { anchor = s.key; continue; }
            customsAfter.set(anchor, [...(customsAfter.get(anchor) ?? []), s]);
        }
        const generatedKeys = new Set(generated.map(g => g.key));
        const orphanCustoms = Array.from(customsAfter).filter(([k]) => k !== null && !generatedKeys.has(k)).flatMap(([, list]) => list);
        let position = 0;
        const placeCustoms = async (list: typeof before | undefined) => {
            for (const c of list ?? []) await tx.reportSummarySection.update({ where: { id: c.id }, data: { position: position++ } });
        };

        await placeCustoms(customsAfter.get(null));
        for (const g of generated) {
            const old = existing.get(g.key);
            existing.delete(g.key);
            const keep = !!old && !replace && old.body !== old.generatedBody;
            if (keep) kept++;
            const keepHeading = !!old && !replace && old.headingEdited;
            const pos = position++;
            await tx.reportSummarySection.upsert({
                where: { summaryId_key: { summaryId: summary.id, key: g.key } },
                // Chosen tables, renamed headings and removed sections stay as people left them, unless everything is being replaced.
                update: {
                    position: pos, generatedBody: g.body,
                    ...(keepHeading ? {} : { heading: g.heading, level: g.level, headingEdited: false }),
                    ...(keep ? {} : { body: g.body, editedAt: null, editedById: null }),
                    ...(replace ? { tables: defaultTables(g.key), hidden: false } : {}),
                },
                create: { summaryId: summary.id, key: g.key, position: pos, level: g.level, heading: g.heading, body: g.body, generatedBody: g.body, tables: defaultTables(g.key) },
            });
            await placeCustoms(customsAfter.get(g.key));
        }
        await placeCustoms(orphanCustoms);
        // Objectives or pillars with no reports this period drop out of the summary.
        if (existing.size > 0) await tx.reportSummarySection.deleteMany({ where: { id: { in: Array.from(existing.values(), s => s.id) } } });
    });

    await recordAudit({
        action: 'REPORT_SUMMARY_GENERATED', entityType: 'ReportingPeriod', entityId: periodId,
        summary: `Generated the report summary for ${source.period.name}${kept ? ` (kept ${kept} edited section${kept === 1 ? '' : 's'})` : ''}${options.overwriteEdited ? ', replacing edited sections' : ''}`,
        metadata: { sections: generated.length, kept, overwriteEdited: !!options.overwriteEdited },
    });
    revalidateSummary();
    return { success: true, kept };
}

async function sectionWithPeriod(sectionId: string) {
    return prisma.reportSummarySection.findUnique({
        where: { id: sectionId },
        include: { summary: { select: { reportingPeriodId: true, reportingPeriod: { select: { name: true } } } } },
    });
}

/**
 * Saves a section's text. `seenUpdatedAt` is the version the editor started
 * from; if someone saved in between, nothing is overwritten.
 */
export async function saveSummarySection(sectionId: string, body: string, seenUpdatedAt?: string): Promise<SummaryActionResult> {
    const user = await requirePermission('reports:summary');
    if (typeof body !== 'string') return fail('The section text is missing.');
    const text = body.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
    if (text.length > MAX_BODY) return fail(`A section can hold at most ${MAX_BODY.toLocaleString('en-US')} characters.`);

    const section = await sectionWithPeriod(sectionId);
    if (!section) return fail('This section no longer exists; the summary may have been regenerated. Reload the page.');
    if (seenUpdatedAt && section.updatedAt.toISOString() !== new Date(seenUpdatedAt).toISOString()) {
        return fail('Someone else saved this section after you opened it. Reload the page to see their changes before editing.', true);
    }
    if (text === section.body) return { success: true, updatedAt: section.updatedAt.toISOString() };

    // updateMany with the version guard makes the check-and-write atomic.
    const result = await prisma.reportSummarySection.updateMany({
        where: { id: sectionId, updatedAt: section.updatedAt },
        data: { body: text, editedAt: new Date(), editedById: user.id },
    });
    if (result.count === 0) return fail('Someone else saved this section at the same time. Reload the page to see their changes.', true);
    const saved = await prisma.reportSummarySection.findUnique({ where: { id: sectionId }, select: { updatedAt: true } });

    await recordAudit({
        action: 'REPORT_SUMMARY_EDITED', entityType: 'ReportingPeriod', entityId: section.summary.reportingPeriodId,
        summary: `Edited “${section.heading}” in the ${section.summary.reportingPeriod.name} report summary`,
        metadata: { sectionKey: section.key },
    });
    revalidateSummary();
    return { success: true, updatedAt: saved?.updatedAt.toISOString() };
}

/** Sets which tables a section shows under its text, in order. */
export async function setSectionTables(sectionId: string, tables: string[], seenUpdatedAt?: string): Promise<SummaryActionResult> {
    await requirePermission('reports:summary');
    const keys = sanitizeTableKeys(tables);
    if (!keys) return fail('That table list is not valid. Reload the page and try again.');
    const section = await sectionWithPeriod(sectionId);
    if (!section) return fail('This section no longer exists; the summary may have been regenerated. Reload the page.');
    if (seenUpdatedAt && section.updatedAt.toISOString() !== new Date(seenUpdatedAt).toISOString()) {
        return fail('Someone else changed this section after you opened it. Reload the page to see their changes.', true);
    }
    const result = await prisma.reportSummarySection.updateMany({ where: { id: sectionId, updatedAt: section.updatedAt }, data: { tables: keys } });
    if (result.count === 0) return fail('Someone else changed this section at the same time. Reload the page to see their changes.', true);
    const added = keys.filter(k => !section.tables.includes(k));
    const removed = section.tables.filter(k => !keys.includes(k));
    await recordAudit({
        action: 'REPORT_SUMMARY_EDITED', entityType: 'ReportingPeriod', entityId: section.summary.reportingPeriodId,
        summary: `Changed the tables under “${section.heading}” in the ${section.summary.reportingPeriod.name} report summary`,
        metadata: { sectionKey: section.key, added, removed },
    });
    revalidateSummary();
    return { success: true };
}

/** Puts a section back to its generated text. */
export async function resetSummarySection(sectionId: string): Promise<SummaryActionResult> {
    await requirePermission('reports:summary');
    const section = await sectionWithPeriod(sectionId);
    if (!section) return fail('This section no longer exists; the summary may have been regenerated. Reload the page.');
    if (section.body === section.generatedBody) return { success: true, updatedAt: section.updatedAt.toISOString() };
    const saved = await prisma.reportSummarySection.update({
        where: { id: sectionId },
        data: { body: section.generatedBody, editedAt: null, editedById: null },
        select: { updatedAt: true },
    });
    await recordAudit({
        action: 'REPORT_SUMMARY_EDITED', entityType: 'ReportingPeriod', entityId: section.summary.reportingPeriodId,
        summary: `Reset “${section.heading}” in the ${section.summary.reportingPeriod.name} report summary to the generated text`,
        metadata: { sectionKey: section.key, reset: true },
    });
    revalidateSummary();
    return { success: true, updatedAt: saved.updatedAt.toISOString() };
}

/** Renames a section and sets whether it is a main heading (1) or a sub-heading (2). Regenerating keeps the new name. */
export async function renameSummarySection(sectionId: string, heading: string, level: number, seenUpdatedAt?: string): Promise<SummaryActionResult> {
    await requirePermission('reports:summary');
    const title = cleanHeading(heading);
    if (!title) return fail('Give the section a title.');
    if (title.length > MAX_HEADING) return fail(`Keep the title to ${MAX_HEADING} characters or fewer.`);
    if (level !== 1 && level !== 2) return fail('Choose a heading or a sub-heading.');
    const section = await sectionWithPeriod(sectionId);
    if (!section) return fail('This section no longer exists; the summary may have been regenerated. Reload the page.');
    if (title === section.heading && level === section.level) return { success: true };
    const result = await prisma.reportSummarySection.updateMany({
        where: { id: sectionId, ...(seenUpdatedAt ? { updatedAt: new Date(seenUpdatedAt) } : {}) },
        data: { heading: title, level, headingEdited: true },
    });
    if (result.count === 0) return fail('Someone else changed this section after you opened it. Reload the page to see their changes.', true);
    await recordAudit({
        action: 'REPORT_SUMMARY_EDITED', entityType: 'ReportingPeriod', entityId: section.summary.reportingPeriodId,
        summary: `Renamed “${section.heading}” to “${title}” in the ${section.summary.reportingPeriod.name} report summary`,
        metadata: { sectionKey: section.key, from: section.heading, to: title, level },
    });
    revalidateSummary();
    return { success: true };
}

/**
 * Adds a section of your own, after `afterSectionId` (or at the end). It starts
 * with the given text and no tables; regenerating never changes or removes it.
 */
export async function addSummarySection(periodId: string, input: { heading: string; level: number; body?: string; afterSectionId?: string | null }): Promise<SummaryActionResult> {
    const user = await requirePermission('reports:summary');
    const title = cleanHeading(input.heading);
    if (!title) return fail('Give the section a title.');
    if (title.length > MAX_HEADING) return fail(`Keep the title to ${MAX_HEADING} characters or fewer.`);
    if (input.level !== 1 && input.level !== 2) return fail('Choose a heading or a sub-heading.');
    const body = typeof input.body === 'string' ? input.body.replace(/\r\n?/g, '\n').trim() : '';
    if (body.length > MAX_BODY) return fail(`A section can hold at most ${MAX_BODY.toLocaleString('en-US')} characters.`);

    const summary = await prisma.reportSummary.findUnique({
        where: { reportingPeriodId: periodId },
        select: { id: true, reportingPeriod: { select: { name: true } }, sections: { select: { id: true, position: true }, orderBy: { position: 'asc' } } },
    });
    if (!summary) return fail('Generate the summary first; then you can add your own sections to it.');
    const after = input.afterSectionId ? summary.sections.find(s => s.id === input.afterSectionId) : null;
    if (input.afterSectionId && !after) return fail('That section no longer exists. Reload the page and try again.');
    const position = after ? after.position + 1 : (summary.sections[summary.sections.length - 1]?.position ?? -1) + 1;

    await prisma.$transaction([
        prisma.reportSummarySection.updateMany({ where: { summaryId: summary.id, position: { gte: position } }, data: { position: { increment: 1 } } }),
        prisma.reportSummarySection.create({
            data: {
                summaryId: summary.id, key: `${CUSTOM_PREFIX}${crypto.randomUUID()}`, position, level: input.level, heading: title,
                body, generatedBody: '', headingEdited: true, editedAt: new Date(), editedById: user.id,
            },
        }),
    ]);
    await recordAudit({
        action: 'REPORT_SUMMARY_EDITED', entityType: 'ReportingPeriod', entityId: periodId,
        summary: `Added the section “${title}” to the ${summary.reportingPeriod.name} report summary`,
        metadata: { added: title },
    });
    revalidateSummary();
    return { success: true };
}

/**
 * Removes a section. A section someone added is deleted; a generated one is
 * hidden, so regenerating doesn't bring it back — it can be restored.
 */
export async function deleteSummarySection(sectionId: string): Promise<SummaryActionResult> {
    await requirePermission('reports:summary');
    const section = await sectionWithPeriod(sectionId);
    if (!section) return { success: true };
    const custom = isCustomKey(section.key);
    if (custom) await prisma.reportSummarySection.delete({ where: { id: sectionId } });
    else await prisma.reportSummarySection.update({ where: { id: sectionId }, data: { hidden: true } });
    await recordAudit({
        action: 'REPORT_SUMMARY_EDITED', entityType: 'ReportingPeriod', entityId: section.summary.reportingPeriodId,
        summary: `${custom ? 'Deleted' : 'Removed'} the section “${section.heading}” from the ${section.summary.reportingPeriod.name} report summary`,
        metadata: { sectionKey: section.key, removed: true },
    });
    revalidateSummary();
    return { success: true };
}

/** Brings back a removed generated section, in its original place. */
export async function restoreSummarySection(sectionId: string): Promise<SummaryActionResult> {
    await requirePermission('reports:summary');
    const section = await sectionWithPeriod(sectionId);
    if (!section) return fail('This section no longer exists; the summary may have been regenerated. Reload the page.');
    if (!section.hidden) return { success: true };
    await prisma.reportSummarySection.update({ where: { id: sectionId }, data: { hidden: false } });
    await recordAudit({
        action: 'REPORT_SUMMARY_EDITED', entityType: 'ReportingPeriod', entityId: section.summary.reportingPeriodId,
        summary: `Restored the section “${section.heading}” in the ${section.summary.reportingPeriod.name} report summary`,
        metadata: { sectionKey: section.key, restored: true },
    });
    revalidateSummary();
    return { success: true };
}

/** Deletes a period's summary with all its sections, edits and chosen tables. */
export async function deleteReportSummary(periodId: string): Promise<SummaryActionResult> {
    await requirePermission('reports:summary');
    const summary = await prisma.reportSummary.findUnique({
        where: { reportingPeriodId: periodId },
        select: { id: true, reportingPeriod: { select: { name: true } }, _count: { select: { sections: true } } },
    });
    if (!summary) return { success: true };
    await prisma.reportSummary.delete({ where: { id: summary.id } });
    await recordAudit({
        action: 'REPORT_SUMMARY_DELETED', entityType: 'ReportingPeriod', entityId: periodId,
        summary: `Deleted the ${summary.reportingPeriod.name} report summary (${summary._count.sections} sections)`,
        metadata: { sections: summary._count.sections },
    });
    revalidateSummary();
    return { success: true };
}

/** Replaces the wording corrections applied when summaries are generated. */
export async function updateSummaryCorrections(input: SummaryCorrection[]): Promise<SummaryActionResult> {
    await requirePermission('reports:summary');
    if (!Array.isArray(input)) return fail('The corrections list is missing.');
    if (input.length > MAX_CORRECTIONS) return fail(`Keep the list to at most ${MAX_CORRECTIONS} corrections.`);
    const corrections = parseCorrections(input);
    if (corrections.some(c => c.find.length > 100 || c.replace.length > 200)) return fail('Keep each correction short: up to 100 characters to find and 200 to replace with.');
    const finds = corrections.map(c => c.find.toLowerCase());
    const duplicate = finds.find((f, n) => finds.indexOf(f) !== n);
    if (duplicate) return fail(`“${duplicate}” is listed more than once.`);

    await prisma.appConfig.upsert({
        where: { id: 'singleton' },
        update: { summaryCorrections: corrections as unknown as object },
        create: { id: 'singleton', summaryCorrections: corrections as unknown as object },
    });
    await recordAudit({
        action: 'REPORT_SUMMARY_CORRECTIONS_UPDATED', entityType: 'AppConfig', entityId: 'singleton',
        summary: `Saved ${corrections.length} summary wording correction${corrections.length === 1 ? '' : 's'}`,
        metadata: { count: corrections.length },
    });
    revalidateSummary();
    return { success: true };
}
