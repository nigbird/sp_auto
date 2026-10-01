import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { originIsTrusted } from '@/lib/auth/origin';
import { getRequestIp } from '@/lib/auth/rate-limit';
import { writeAuditLog } from '@/lib/auth/audit';
import { consumePasswordToken, lookupPasswordToken } from '@/lib/auth/password-tokens';
import { checkPasswordStrength } from '@/lib/auth/password-policy';

const schema = z.object({ token: z.string().min(1), password: z.string() });

const LINK_ERRORS = {
  invalid: 'This link is not valid. Request a new one.',
  expired: 'This link has expired or was replaced by a newer email.',
  used: 'This link has already been used. Request a new one if you still need to set your password.',
} as const;

export async function POST(request: NextRequest) {
  if (!originIsTrusted(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const weakness = checkPasswordStrength(password);
  if (weakness) return NextResponse.json({ error: weakness }, { status: 400 });

  const found = await lookupPasswordToken(token);
  if (!found.ok) {
    return NextResponse.json({ error: LINK_ERRORS[found.reason], code: found.reason }, { status: 410 });
  }

  const saved = await consumePasswordToken(found.tokenId, found.userId, password);
  if (!saved) {
    return NextResponse.json({ error: LINK_ERRORS.used, code: 'used' }, { status: 410 });
  }

  await writeAuditLog({
    action: 'PASSWORD_SET',
    success: true,
    identifier: found.email,
    userId: found.userId,
    actorId: found.userId,
    summary: found.purpose === 'INVITE' ? 'Accepted invitation and set password' : 'Reset password from emailed link',
    ip: getRequestIp(request),
    userAgent: request.headers.get('user-agent'),
    metadata: { purpose: found.purpose },
  });

  return NextResponse.json({ ok: true, purpose: found.purpose });
}
