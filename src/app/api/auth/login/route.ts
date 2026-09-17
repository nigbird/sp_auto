import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ACCESS_TOKEN_TTL_SECONDS } from '@/lib/auth/config';
import { originIsTrusted } from '@/lib/auth/origin';
import { getRequestIp, isIdentifierLocked, isIpLocked } from '@/lib/auth/rate-limit';
import { createSessionWithTokens } from '@/lib/auth/issue';
import { setAuthCookies } from '@/lib/auth/cookies';
import { writeAuditLog } from '@/lib/auth/audit';

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

// Precomputed so the "no such user" path still spends bcrypt-compare-comparable
// time, rather than returning near-instantly and leaking which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function POST(request: NextRequest) {
  if (!originIsTrusted(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const ip = getRequestIp(request);
  const userAgent = request.headers.get('user-agent') ?? undefined;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const identifier = parsed.data.identifier.trim().toLowerCase();
  const { password } = parsed.data;

  if ((await isIpLocked(ip)) || (await isIdentifierLocked(identifier))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.', code: 'LOCKED' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email: identifier }, include: { role: true } });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  const isValid = !!user && user.status === 'ACTIVE' && passwordMatches;

  if (!isValid) {
    await writeAuditLog({ action: 'LOGIN_FAILURE', success: false, identifier, userId: user?.id, ip, userAgent });
    const lockedNow = (await isIdentifierLocked(identifier)) || (await isIpLocked(ip));
    return NextResponse.json(
      { error: 'Invalid email or password.', ...(lockedNow ? { code: 'LOCKED' } : {}) },
      { status: lockedNow ? 429 : 401 }
    );
  }

  const { accessJwt, refreshOpaqueToken } = await createSessionWithTokens({
    userId: user.id,
    role: user.role.name,
    roleId: user.roleId,
    sessionVersion: user.sessionVersion,
    ip,
    userAgent: userAgent ?? '',
  });

  await writeAuditLog({ action: 'LOGIN_SUCCESS', success: true, identifier, userId: user.id, ip, userAgent });

  const response = NextResponse.json({
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role.name },
  });
  await setAuthCookies(response, { accessJwt, refreshOpaqueToken });
  return response;
}
