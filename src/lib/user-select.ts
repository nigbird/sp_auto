/**
 * The user fields that are safe to send to the browser. Use this instead of
 * `include: { user: true }` so password hashes and session counters never leave the server.
 */
/**
 * Only same-origin avatar paths are shown. Older accounts point at an external
 * placeholder service, which the Content-Security-Policy blocks anyway; the
 * avatar then falls back to the person's initials.
 */
export function safeAvatar(avatar: string | null | undefined): string {
  return avatar && avatar.startsWith('/') && !avatar.startsWith('//') ? avatar : '';
}

export const publicUserSelect = {
    id: true,
    name: true,
    email: true,
    avatar: true,
    status: true,
    roleId: true,
    createdAt: true,
    updatedAt: true,
} as const;
