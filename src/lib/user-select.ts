/**
 * The user fields that are safe to send to the browser. Use this instead of
 * `include: { user: true }` so password hashes and session counters never leave the server.
 */
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
