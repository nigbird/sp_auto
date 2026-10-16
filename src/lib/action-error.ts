/**
 * Turns anything a failed server action or fetch can throw into a sentence a
 * person can act on. Production builds of Next.js replace thrown server-action
 * messages with a generic digest, so those get a plain fallback instead.
 */
export function describeError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!message) return fallback;
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (/Server Components render|omitted in production/i.test(message)) return fallback;
  if (/Unique constraint failed/i.test(message)) {
    const field = message.match(/fields?: \(`?([\w,` ]+)`?\)/)?.[1]?.replace(/`/g, "");
    return field ? `A record with this ${field} already exists.` : "A record with these details already exists.";
  }
  return message;
}
