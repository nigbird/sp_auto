'use server'

import { getCurrentUser, type SessionUser } from '@/lib/auth/session';

export async function getCurrentUserAction(): Promise<SessionUser | null> {
  return getCurrentUser();
}
