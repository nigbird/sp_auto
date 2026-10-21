import { headers } from "next/headers";
import { NoAccess } from "@/components/no-access";
import { recordDenied } from "@/lib/auth/audit";

/**
 * Middleware rewrites a request for a page the user's role can't open to here,
 * with HTTP 403 (src/middleware.ts). It sets x-denied-permissions only on that
 * rewrite and strips it from every other request, so a direct visit logs nothing.
 */
export default async function AccessDeniedPage() {
  const denied = (await headers()).get("x-denied-permissions");
  if (denied) await recordDenied(denied.split(","), "page");
  return <NoAccess />;
}
