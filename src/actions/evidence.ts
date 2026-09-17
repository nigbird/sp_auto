'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';

const MAX_EVIDENCE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface EvidenceMeta {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: Date;
  uploadedBy: { name: string };
}

export async function uploadEvidence(activityId: string, formData: FormData): Promise<EvidenceMeta> {
  const user = await requireUser();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('No file provided.');
  }
  if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    throw new Error('File is too large (max 10MB).');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const evidence = await prisma.evidence.create({
    data: {
      activityId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      data: buffer,
      uploadedById: user.id,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      uploadedAt: true,
      uploadedBy: { select: { name: true } },
    },
  });

  revalidatePath('/my-activity');
  revalidatePath('/activities');
  return evidence;
}

export async function getEvidenceList(activityId: string): Promise<EvidenceMeta[]> {
  await requireUser();

  return prisma.evidence.findMany({
    where: { activityId },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      uploadedAt: true,
      uploadedBy: { select: { name: true } },
    },
    orderBy: { uploadedAt: 'desc' },
  });
}

export async function deleteEvidence(id: string): Promise<void> {
  await requireUser();

  await prisma.evidence.delete({ where: { id } });
  revalidatePath('/my-activity');
  revalidatePath('/activities');
}
