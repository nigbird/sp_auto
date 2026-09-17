import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();

  const { id } = await params;
  const evidence = await prisma.evidence.findUnique({ where: { id } });
  if (!evidence) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(evidence.data), {
    headers: {
      'Content-Type': evidence.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(evidence.fileName)}"`,
      'Content-Length': String(evidence.fileSize),
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
}
