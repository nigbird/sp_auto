import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { ACCESS_TOKEN_TTL_SECONDS, getAuthSecret } from './config';

export interface AccessTokenClaims extends JWTPayload {
  sub: string; // user id
  sid: string; // session id
  role: string;
  permissions: string[];
  sessionVersion: number;
}

let cachedSecretKey: Uint8Array | null = null;

function getSecretKey(): Uint8Array {
  if (!cachedSecretKey) {
    cachedSecretKey = new TextEncoder().encode(getAuthSecret());
  }
  return cachedSecretKey;
}

export async function signAccessToken(params: {
  userId: string;
  sessionId: string;
  role: string;
  permissions: string[];
  sessionVersion: number;
}): Promise<string> {
  return new SignJWT({
    sid: params.sessionId,
    role: params.role,
    permissions: params.permissions,
    sessionVersion: params.sessionVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(params.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/** Verifies signature + expiry only. Does not check the live session — callers needing
 * the DB-backed guarantee should use requireUser()/getCurrentUser() from session.ts. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}
