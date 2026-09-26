import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions-server';
import { detectEvidenceType, sanitizeFileName } from '@/lib/evidence-files';

/**
 * Serves one evidence file. Images are shown inline (for the preview);
 * everything else is always a download. Only the activity's responsible
 * person, the uploader, and report approvers may fetch a file.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await params;
  // Check access before loading the file contents.
  const meta = await prisma.evidence.findUnique({
    where: { id },
    select: { uploadedById: true, activity: { select: { responsibleId: true } } },
  });
  // Same response for "missing" and "not yours", so ids can't be probed.
  const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!meta) return notFound();
  const allowed = meta.activity.responsibleId === user.id
    || meta.uploadedById === user.id
    || await hasPermission(user.roleId, 'activities:edit');
  if (!allowed) return notFound();

  const evidence = await prisma.evidence.findUnique({ where: { id }, select: { fileName: true, data: true } });
  if (!evidence) return notFound();

  const bytes = new Uint8Array(evidence.data);
  const fileName = sanitizeFileName(evidence.fileName);
  // Re-detect from the bytes rather than trusting the stored type (older uploads stored whatever the browser sent).
  const detected = detectEvidenceType(bytes, fileName);
  const inline = !!detected?.isImage && request.nextUrl.searchParams.get('download') !== '1';
  const asciiName = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': detected?.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Content-Length': String(bytes.length),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'private, no-store',
    },
  });
}
