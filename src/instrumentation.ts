// Runs once when the Next.js server process starts. This app is a persistent
// `next start` process (not serverless), so an in-process timer is a real,
// working scheduler without adding external infrastructure (no cron, no queue,
// no separate worker process) — see src/actions/notifications.ts for what it runs.
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { syncTimeBasedNotifications } = await import('@/lib/notification-sync');

  setInterval(() => {
    syncTimeBasedNotifications().catch((error) => {
      console.error('[notifications] background sync failed:', error);
    });
  }, SYNC_INTERVAL_MS);
}
