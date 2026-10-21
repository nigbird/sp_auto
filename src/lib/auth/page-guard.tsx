import { forbidden } from "next/navigation";
import { requireUser, type SessionUser } from "./session";
import { userCan } from "./permissions-server";
import type { Permission } from "./permissions";
import { recordDenied } from "./audit";

/**
 * Use at the top of a server page or layout:
 *   const { user, denied } = await guardPage("reports:view");
 *   if (denied) return denied;
 * Nothing on the page is loaded or rendered for someone without access: they
 * get an HTTP 403 with the "no access" screen (src/app/forbidden.tsx), and the
 * attempt is written to the audit log. `denied` is kept for the callers above;
 * it is always null now because a refusal never returns.
 */
export async function guardPage(...anyOf: Permission[]): Promise<{ user: SessionUser; denied: React.ReactElement | null }> {
  const user = await requireUser();
  if (userCan(user, ...anyOf)) return { user, denied: null };
  await recordDenied(anyOf, "page");
  forbidden();
}
