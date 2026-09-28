"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkPasswordStrength, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import {
  AuthError,
  AuthHeading,
  AuthShell,
  AuthSubmitButton,
  PasswordField,
  linkClass,
} from "@/components/login/auth-shell";

type LinkState =
  | { ok: true; purpose: "INVITE" | "RESET"; email: string; name: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

const DEAD_LINK: Record<"invalid" | "expired" | "used", { title: string; body: string }> = {
  invalid: { title: "Link not valid", body: "This link isn't recognised. Check that you copied the whole link from the email." },
  expired: { title: "Link expired", body: "This link has expired, or a newer email has replaced it. Use the link in the most recent email." },
  used: { title: "Link already used", body: "This link has already been used to set a password." },
};

export function SetPasswordScreen({ token, link }: { token: string; link: LinkState }) {
  return <AuthShell>{link.ok ? <SetPasswordForm token={token} {...link} /> : <DeadLink reason={link.reason} />}</AuthShell>;
}

function DeadLink({ reason }: { reason: "invalid" | "expired" | "used" }) {
  const { title, body } = DEAD_LINK[reason];
  return (
    <>
      <AuthHeading title={title} description={body} />
      <div className="mt-6 space-y-3 text-sm leading-relaxed text-[#6B5443]">
        <p>
          <strong>Setting up a new account?</strong> Ask your system administrator to resend your invitation.
        </p>
        <p>
          <strong>Already have a password?</strong>{" "}
          <Link href="/forgot-password" className={linkClass}>
            Request a new reset link
          </Link>
          .
        </p>
        <div className="flex justify-center pt-2">
          <Link href="/login" className={`${linkClass} inline-flex items-center gap-1`}>
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </>
  );
}

function SetPasswordForm({ token, purpose, email, name }: { token: string; purpose: "INVITE" | "RESET"; email: string; name: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);

  const fail = (message: string) => {
    setError(message);
    setErrorKey((k) => k + 1);
  };

  const rules = [
    { label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: password.length >= MIN_PASSWORD_LENGTH },
    { label: "A letter and a number", met: /[A-Za-z]/.test(password) && /\d/.test(password) },
    { label: "Both entries match", met: password.length > 0 && password === confirm },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const weakness = checkPasswordStrength(password);
    if (weakness) return fail(weakness);
    if (password !== confirm) return fail("The two passwords don't match.");

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // The link died while the page was open (expired or used elsewhere): reload to show why.
        if (response.status === 410) {
          router.refresh();
          return;
        }
        return fail(data.error || "Could not save your password. Please try again.");
      }
      router.push(`/login?password=${purpose === "INVITE" ? "set" : "reset"}&email=${encodeURIComponent(email)}`);
    } catch {
      fail("Could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeading
        title={purpose === "INVITE" ? `Welcome, ${name.split(" ")[0]}!` : "Reset password"}
        description={
          purpose === "INVITE" ? (
            <>Choose a password to activate your account <strong>{email}</strong>.</>
          ) : (
            <>Choose a new password for <strong>{email}</strong>. You'll be signed out of any other devices.</>
          )
        }
      />
      <form className="mt-6 space-y-4" onSubmit={submit}>
        {/* Lets password managers save the new password against the right account. */}
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        <div className="a-enter" style={{ animationDelay: "0.32s" }}>
          <PasswordField
            id="new-password"
            label="New password"
            placeholder="Enter a new password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            describedBy="password-rules"
          />
        </div>
        <div className="a-enter" style={{ animationDelay: "0.4s" }}>
          <PasswordField
            id="confirm-password"
            label="Confirm password"
            placeholder="Enter it again"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
        </div>

        <ul id="password-rules" className="space-y-1 text-xs">
          {rules.map((rule) => (
            <li key={rule.label} className={cn("flex items-center gap-1.5", rule.met ? "text-[#3F5E33]" : "text-[#8A7361]")}>
              {rule.met ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {rule.label}
            </li>
          ))}
        </ul>

        {error && <AuthError message={error} errorKey={errorKey} />}

        <div className="a-enter pt-2" style={{ animationDelay: "0.48s" }}>
          <AuthSubmitButton busy={isSubmitting} busyLabel="Saving…">
            {purpose === "INVITE" ? "Set password" : "Reset password"}
          </AuthSubmitButton>
        </div>
      </form>
    </>
  );
}
