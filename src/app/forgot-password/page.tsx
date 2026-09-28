"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import {
  AuthError,
  AuthHeading,
  AuthNotice,
  AuthShell,
  AuthSubmitButton,
  fieldClass,
  iconClass,
  linkClass,
} from "@/components/login/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <AuthShell>
        <AuthHeading
          title="Forgot password?"
          description="Enter the email address you sign in with and we'll send you a link to choose a new password."
        />
        <ForgotPasswordForm />
      </AuthShell>
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        setErrorKey((k) => k + 1);
        return;
      }
      setSentTo(email.trim());
    } catch {
      setError("Could not reach the server. Please try again.");
      setErrorKey((k) => k + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const backToLogin = (
    <div className="flex justify-center pt-1">
      <Link href="/login" className={`${linkClass} inline-flex items-center gap-1`}>
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </div>
  );

  if (sentTo) {
    return (
      <div className="mt-6 space-y-4">
        <AuthNotice>
          If <strong>{sentTo}</strong> belongs to an active account, a reset link is on its way. It expires in 1 hour.
        </AuthNotice>
        <p className="text-sm leading-relaxed text-[#6B5443]">
          Didn't get it? Check your spam folder, or{" "}
          <button type="button" onClick={() => submit()} disabled={isSubmitting} className={linkClass}>
            {isSubmitting ? "sending…" : "send it again"}
          </button>
          . If it still doesn't arrive, contact your system administrator.
        </p>
        {error && <AuthError message={error} errorKey={errorKey} />}
        {backToLogin}
      </div>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <div className="a-enter space-y-2" style={{ animationDelay: "0.32s" }}>
        <label htmlFor="email" className="block text-sm font-medium text-[#6B5443]">
          Email address
        </label>
        <div className="relative">
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            className={fieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
          <Mail className={iconClass} />
        </div>
      </div>

      {error && <AuthError message={error} errorKey={errorKey} />}

      <div className="a-enter space-y-3 pt-2" style={{ animationDelay: "0.4s" }}>
        <AuthSubmitButton busy={isSubmitting} busyLabel="Sending…">
          Send reset link
        </AuthSubmitButton>
        {backToLogin}
      </div>
    </form>
  );
}
