import { lookupPasswordToken } from "@/lib/auth/password-tokens";
import { SetPasswordScreen } from "./set-password-screen";

export const dynamic = "force-dynamic";

/** Landing page for the invite and forgot-password emails. The link is checked up front so a dead one says so straight away. */
export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const found = await lookupPasswordToken(token);
  return (
    <SetPasswordScreen
      token={token}
      link={found.ok ? { ok: true, purpose: found.purpose, email: found.email, name: found.name } : { ok: false, reason: found.reason }}
    />
  );
}
