import { readEmailChangeToken } from "@/lib/auth/email-change";
import { ConfirmEmailScreen } from "./confirm-email-screen";

export const dynamic = "force-dynamic";

/**
 * Landing page for the "confirm your new email" link. The link is checked up
 * front, but the change only happens on the button press: mail scanners open
 * links automatically, and that mustn't change anyone's sign-in email.
 */
export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const found = await readEmailChangeToken(token);
  return (
    <ConfirmEmailScreen
      token={token}
      link={found.ok ? { ok: true, from: found.from, to: found.to } : { ok: false, reason: found.reason }}
    />
  );
}
