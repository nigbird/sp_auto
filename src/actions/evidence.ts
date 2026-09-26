'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { hasPermission, requirePermission } from '@/lib/auth/permissions-server';
import { requireUser } from '@/lib/auth/session';
import { isPeriodClosedForSubmissions } from '@/lib/reporting-period';
import { EVIDENCE_MAX_BYTES, EVIDENCE_MAX_FILES, detectEvidenceType, sanitizeFileName } from '@/lib/evidence-files';

export interface EvidenceMeta {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: Date | string;
}

export type EvidenceActionResult =
  | { success: true; evidence?: EvidenceMeta }
  | { success: false; message: string };

const evidenceMetaSelect = { id: true, fileName: true, mimeType: true, fileSize: true, uploadedAt: true } as const;

const fail = (message: string): EvidenceActionResult => ({ success: false, message });

/**
 * Loads a period report and checks that `userId` may change its evidence:
 * only the activity's responsible person, and only while the report can
 * still be edited (requested or returned, in an open period).
 */
async function loadEditableEntry(entryId: string, userId: string) {
  const entry = await prisma.activityPeriodEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      activityId: true,
      reportStatus: true,
      reportingPeriod: { select: { status: true, cutOffDate: true } },
      activity: { select: { responsibleId: true } },
      _count: { select: { evidence: true } },
    },
  });
  if (!entry) return { error: 'This report no longer exists.' } as const;
  if (entry.activity.responsibleId !== userId) return { error: 'Only the person responsible for this activity can change its evidence.' } as const;
  if (entry.reportStatus !== 'REQUESTED' && entry.reportStatus !== 'RETURNED') return { error: 'Evidence can only be changed while the report is being filled in or after it was returned.' } as const;
  if (isPeriodClosedForSubmissions(entry.reportingPeriod)) return { error: 'This reporting period is closed, so its evidence can no longer be changed.' } as const;
  return { entry } as const;
}

export async function uploadReportEvidence(entryId: string, formData: FormData): Promise<EvidenceActionResult> {
  const user = await requirePermission('my-activity:update');

  const loaded = await loadEditableEntry(entryId, user.id);
  if ('error' in loaded) return fail(loaded.error!);
  const { entry } = loaded;
  if (entry._count.evidence >= EVIDENCE_MAX_FILES) return fail(`A report can have at most ${EVIDENCE_MAX_FILES} files. Remove one first.`);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('No file was selected.');
  if (file.size > EVIDENCE_MAX_BYTES) return fail('The file is too large — the limit is 5 MB.');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = sanitizeFileName(file.name);
  const detected = detectEvidenceType(bytes, fileName);
  if (!detected) return fail("This type of file isn't allowed. Use an image, PDF, Office document, CSV or text file.");

  const evidence = await prisma.evidence.create({
    data: {
      activityId: entry.activityId,
      periodEntryId: entry.id,
      fileName,
      mimeType: detected.mimeType,
      fileSize: bytes.length,
      data: Buffer.from(bytes),
      uploadedById: user.id,
    },
    select: evidenceMetaSelect,
  });

  revalidatePath('/reports/submit');
  return { success: true, evidence };
}

export async function deleteReportEvidence(evidenceId: string): Promise<EvidenceActionResult> {
  const user = await requirePermission('my-activity:update');

  const evidence = await prisma.evidence.findUnique({ where: { id: evidenceId }, select: { id: true, periodEntryId: true } });
  if (!evidence?.periodEntryId) return fail('This file no longer exists.');

  const loaded = await loadEditableEntry(evidence.periodEntryId, user.id);
  if ('error' in loaded) return fail(loaded.error!);

  await prisma.evidence.delete({ where: { id: evidence.id } });
  revalidatePath('/reports/submit');
  return { success: true };
}

/**
 * Every file attached to an activity's reports, for the activity details
 * dialog. Same audience as the download route: the responsible person or a
 * report approver; anyone else gets an empty list.
 */
export async function getActivityEvidence(activityId: string): Promise<EvidenceMeta[]> {
  const user = await requireUser();
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { responsibleId: true } });
  if (!activity) return [];
  if (activity.responsibleId !== user.id && !(await hasPermission(user.roleId, 'activities:edit'))) return [];

  return prisma.evidence.findMany({
    where: { activityId },
    select: evidenceMetaSelect,
    orderBy: { uploadedAt: 'asc' },
  });
}
