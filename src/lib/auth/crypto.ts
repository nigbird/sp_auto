// Web-Crypto based helpers (crypto.subtle) — deliberately not Node's `crypto` module,
// so this file runs unchanged in both the Node route handlers and Edge middleware.
import { getAuthSecret } from './config';

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let cachedKeyPromise: Promise<CryptoKey> | null = null;

async function getAesKey(): Promise<CryptoKey> {
  if (!cachedKeyPromise) {
    cachedKeyPromise = (async () => {
      const secretBytes = new TextEncoder().encode(getAuthSecret());
      const digest = await crypto.subtle.digest('SHA-256', secretBytes);
      return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    })();
  }
  return cachedKeyPromise;
}

/** Encrypts a string (the signed JWT) for storage in the httpOnly access-token cookie. */
export async function encryptForCookie(plaintext: string): Promise<string> {
  const key = await getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return base64UrlEncode(combined);
}

/** Reverses encryptForCookie. Returns null on any decryption/format failure. */
export async function decryptFromCookie(cookieValue: string): Promise<string | null> {
  try {
    const combined = base64UrlDecode(cookieValue);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const key = await getAesKey();
    const plaintextBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plaintextBytes);
  } catch {
    return null;
  }
}

/** Generates a random opaque token for the refresh-token cookie. */
export function generateOpaqueToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

/** SHA-256 hex digest — used to store only a hash of the refresh token server-side. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateId(): string {
  return crypto.randomUUID();
}
