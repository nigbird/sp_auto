"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User } from "lucide-react";
import {
  AuthError,
  AuthHeading,
  AuthNotice,
  AuthShell,
  AuthSubmitButton,
  PasswordField,
  fieldClass,
  iconClass,
  linkClass,
} from "@/components/login/auth-shell";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthShell>
        <AuthHeading
          title="Hello!"
          subtitle="Welcome back!"
          description="Sign in to your Nib International Bank Strategic Plan workspace."
        />
        <LoginForm />
      </AuthShell>
    </Suspense>
  );
}

/**
 * Where to go after signing in: the `next` parameter, but only if it is a path
 * on this site. Anything else ("https://evil.example", "//evil.example",
 * "/\evil.example") would turn the sign-in page into an open redirect.
 */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname.startsWith("/login")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const router = useRouter();
  const passwordSet = searchParams.get("password");
  const nextParam = searchParams.get("next");

  // The session cookies are SameSite=Strict, so following a link from an email
  // or chat arrives without them and is sent here. This same-site request does
  // carry them: if the session is still good, carry on to the page that was asked for.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((response) => {
        if (response.ok && !cancelled) router.replace(safeNextPath(nextParam));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router, nextParam]);

  const fail = (message: string) => {
    setError(message);
    setErrorKey((k) => k + 1);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        fail(
          response.status === 429
            ? data.error || "Too many attempts. Try again later."
            : data.error || "Invalid email or password."
        );
        return;
      }

      router.push(safeNextPath(nextParam));
      router.refresh();
    } catch {
      fail("Could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-6 space-y-4" onSubmit={handleLogin}>
      {(passwordSet === "set" || passwordSet === "reset" || passwordSet === "changed") && (
        <AuthNotice>
          {passwordSet === "set" ? "Your password is set." : passwordSet === "changed" ? "Your password was changed." : "Your password has been reset."} Sign in with your new password.
        </AuthNotice>
      )}

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
          <User className={iconClass} />
        </div>
      </div>

      <div className="a-enter space-y-2" style={{ animationDelay: "0.4s" }}>
        <PasswordField
          id="password"
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link
            href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"}
            className={linkClass}
          >
            Forgot password?
          </Link>
        </div>
      </div>

      {error && <AuthError message={error} errorKey={errorKey} />}

      <div className="a-enter pt-2" style={{ animationDelay: "0.48s" }}>
        <AuthSubmitButton busy={isSubmitting} busyLabel="Signing in…">
          Login
        </AuthSubmitButton>
      </div>
    </form>
  );
}
