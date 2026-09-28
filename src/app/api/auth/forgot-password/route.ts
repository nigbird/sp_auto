import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { originIsTrusted } from '@/lib/auth/origin';
import { getRequestIp } from '@/lib/auth/rate-limit';
import { writeAuditLog } from '@/lib/auth/audit';
import { sendPasswordLink } from '@/lib/auth/password-tokens';

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 10;

// The reply is identical whether or not the address belongs to anyone, so the
// form can't be used to discover which emails have accounts.
const GENERIC_REPLY = { ok: true };

export async function POST(request: NextRequest) {
  if (!originIsTrusted(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  const email = parsed.data.email;
  const ip = getRequestIp(request);
  const userAgent = request.headers.get('user-agent');

  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    prisma.auditLog.count({ where: { action: 'PASSWORD_RESET_REQUEST', identifier: email, createdAt: { gte: since } } }),
    ip === 'unknown'
      ? Promise.resolve(0)
      : prisma.auditLog.count({ where: { action: 'PASSWORD_RESET_REQUEST', ip, createdAt: { gte: since } } }),
  ]);
  if (byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP) {
    return NextResponse.json({ error: 'Too many reset requests. Please wait a few minutes and try again.' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, status: true } });
  const eligible = !!user && user.status === 'ACTIVE';
  const emailed = eligible ? (await sendPasswordLink(user, 'RESET')).emailed : false;

  await writeAuditLog({
    action: 'PASSWORD_RESET_REQUEST',
    success: emailed,
    identifier: email,
    userId: user?.id,
    ip,
    userAgent,
    metadata: { eligible },
  });

  return NextResponse.json(GENERIC_REPLY);
}
