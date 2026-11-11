"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { confirmEmailChange } from "@/actions/profile";
import { AuthError, AuthHeading, AuthNotice, AuthShell, AuthSubmitButton, linkClass } from "@/components/login/auth-shell";

type LinkState =
  | { ok: true; from: string; to: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

const DEAD_LINK: Record<"invalid" | "expired" | "used", { title: string; body: string }> = {
  invalid: { title: "Link not valid", body: "This link isn't recognised. Check that you copied the whole link from the email." },
  expired: { title: "Link expired", body: "This link has expired. Sign in with your current email and request the change again from your profile." },
  used: { title: "Link already used", body: "This link has already been used, or the account's email was changed since it was sent." },
};

function BackToSignIn() {
  return (
    <div className="flex justify-center pt-2">
      <Link href="/login" className={`${linkClass} inline-flex items-center gap-1`}>
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </div>
  );
}

export function ConfirmEmailScreen({ token, link }: { token: string; link: LinkState }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!link.ok) {
    const { title, body } = DEAD_LINK[link.reason];
    return (
      <AuthShell>
        <AuthHeading title={title} description={body} />
        <div className="mt-6"><BackToSignIn /></div>
      </AuthShell>
    );
  }

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await confirmEmailChange(token);
      if (result.success) setDone(result.email);
      else setError(result.message);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      {done ? (
        <>
          <AuthHeading title="Email changed" description="You've been signed out on every device." />
          <div className="mt-6 space-y-4">
            <AuthNotice>Sign in with <strong>{done}</strong> from now on. Your password hasn't changed.</AuthNotice>
            <BackToSignIn />
          </div>
        </>
      ) : (
        <>
          <AuthHeading
            title="Confirm your new email"
            description={<>Your sign-in email will change from <strong>{link.from}</strong> to <strong>{link.to}</strong>. You'll be signed out on every device.</>}
          />
          <form onSubmit={confirm} className="mt-6 space-y-4">
            {error && <AuthError message={error} />}
            <AuthSubmitButton busy={busy} busyLabel="Changing…">Confirm new email</AuthSubmitButton>
            <BackToSignIn />
          </form>
        </>
      )}
    </AuthShell>
  );
}
