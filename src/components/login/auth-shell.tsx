"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoginIllustration } from "@/components/login/login-illustration";
import Image from "next/image";
import "@/components/login/login.css";

/**
 * The shared frame for the sign-in screens (login, forgot password, set
 * password): illustration on the left, frosted card on the right.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="nib-login relative min-h-screen w-full overflow-hidden bg-[#FAF8F4] lg:grid lg:grid-cols-[1.25fr_1fr]">
      <Backdrop />
      <IllustrationPanel />
      <section className="relative z-20 flex min-h-screen items-center justify-center px-5 py-12 sm:px-12 lg:justify-start lg:pl-0 lg:pr-12">
        {/* Shift the card back over the partition by ~7% of its own width. */}
        <div className="relative w-full max-w-[400px] lg:-translate-x-[7%]">
          {/* soft blurred glow around the card's outer edge */}
          <div className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[radial-gradient(ellipse_at_center,rgba(255,250,240,0.55),rgba(230,194,122,0.10)_55%,transparent_75%)] blur-2xl" />

          <div className="relative rounded-3xl border border-[#C9A36A]/40 bg-[#F4EEE5]/[0.5] px-7 py-8 shadow-[0_22px_50px_-24px_rgba(121,86,63,0.38),0_2px_6px_-2px_rgba(121,86,63,0.08)] ring-1 ring-inset ring-[#FFFDF8]/60 backdrop-blur-lg sm:px-9">
            {/* On small screens the illustration panel (and its logo) is hidden, so brand the card itself. */}
            <div className="a-enter mb-6 flex items-center gap-2.5 lg:hidden">
              <Image src="/niblogo.png" alt="" width={32} height={32} priority className="h-8 w-8 shrink-0" />
              <div className="leading-tight">
                <p className="text-sm font-bold tracking-tight text-[#5B4030]">Nib International Bank</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8A7361]">Strategic Plan</p>
              </div>
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}

/**
 * One continuous background behind both columns: warm white on the left, feathering
 * across the partition into translucent beige, then caramel and muted brown toward the
 * far right corner. It sits behind the card, so the card's glass picks it up.
 */
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {/* soft cream-to-gold radial light on the left */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_30%_50%,rgba(230,194,122,0.10),rgba(250,248,244,0)_70%)]" />

      {/* right-hand warm wash, feathered so it flows across the partition */}
      <div className="absolute inset-y-0 right-0 left-0 lg:left-[46%] lg:[mask-image:linear-gradient(to_right,transparent,black_22%)]">
        <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(244,238,229,0.9)_0%,rgba(240,229,213,0.88)_38%,rgba(217,189,154,0.7)_68%,rgba(185,138,90,0.6)_88%,rgba(121,86,63,0.55)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_12%,rgba(217,164,65,0.14),transparent_45%)]" />
      </div>

      {/* blurred light pools */}
      <div className="a-drift absolute left-[52%] top-[18%] h-80 w-80 rounded-full bg-[#FFF8EC]/70 blur-3xl" />
      <div className="a-drift absolute bottom-[8%] right-[6%] h-96 w-96 rounded-full bg-[#D9A441]/[0.10] blur-3xl" style={{ animationDelay: "-6s" }} />

      {/* low-opacity curved lines, top right */}
      <svg className="a-drift absolute -right-12 -top-10 h-72 w-96" viewBox="0 0 380 280" style={{ animationDelay: "-3s" }}>
        <path d="M150 0 C 200 80, 280 120, 380 128 L380 0 Z" fill="#E6C27A" fillOpacity="0.16" />
        <path d="M80 0 C 140 110, 250 180, 380 190" fill="none" stroke="#D9A441" strokeOpacity="0.22" strokeWidth="1" />
        <path d="M40 0 C 110 140, 240 220, 380 236" fill="none" stroke="#D9A441" strokeOpacity="0.12" strokeWidth="1" />
      </svg>

      {/* low-opacity curve, bottom right */}
      <svg className="a-drift absolute -bottom-12 right-0 h-64 w-[34rem]" viewBox="0 0 540 250" style={{ animationDelay: "-10s" }}>
        <path d="M0 250 C 150 150, 330 120, 540 150 L540 250 Z" fill="#FAF8F4" fillOpacity="0.14" />
        <path d="M40 250 C 180 170, 350 150, 540 178" fill="none" stroke="#F4EEE5" strokeOpacity="0.35" strokeWidth="1" />
      </svg>

      {/* bottom-left soft wave */}
      <svg className="a-drift absolute -bottom-8 -left-8 hidden h-32 w-60 lg:block" viewBox="0 0 320 180">
        <path d="M0 60 C 80 70, 150 130, 320 180 L0 180 Z" fill="#E6C27A" fillOpacity="0.28" />
        <path d="M0 110 C 70 115, 120 150, 220 180 L0 180 Z" fill="#B98A5A" fillOpacity="0.22" />
      </svg>
    </div>
  );
}

function IllustrationPanel() {
  return (
    <section className="relative hidden min-h-screen flex-col px-10 py-10 lg:flex xl:px-14">
      <div className="a-enter relative z-10 flex items-center gap-3">
        <Image src="/niblogo.png" alt="Nib International Bank" width={44} height={44} priority className="h-11 w-11 shrink-0 drop-shadow-[0_4px_10px_rgba(121,86,63,0.18)]" />
        <div className="leading-tight">
          <p className="text-lg font-bold tracking-tight text-[#5B4030]">Nib International Bank</p>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8A7361]">Strategic Plan</p>
        </div>
      </div>

      {/* illustration and tagline as one centred group */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-6">
        <LoginIllustration className="a-enter-scene h-auto w-full max-w-[740px]" />
        <p
          className="a-enter mt-2 max-w-md text-center text-sm leading-relaxed text-[#8A7361]"
          style={{ animationDelay: "0.3s" }}
        >
          Plan, track and report on strategic initiatives across every streams and department, all in one place.
        </p>
      </div>
    </section>
  );
}

/**
 * Deep antique gold for gold text on the cream card: #765618 keeps ≥4.5:1 (WCAG AA,
 * normal text) even against the darker beige the frosted card can pick up. The
 * brighter #D9A441 stays for the button, borders and decoration.
 */
export const DEEP_GOLD_TEXT = "text-[#765618]";

export const fieldClass =
  "peer h-12 w-full rounded-xl border border-[#E4D6C3]/80 bg-[#FDFBF7]/70 pl-12 pr-4 text-[15px] text-[#5B4030] shadow-[0_4px_14px_-10px_rgba(121,86,63,0.25)] outline-none transition-all duration-300 placeholder:text-[#A8927E] hover:border-[#D9A441]/45 focus:border-[#D9A441]/70 focus:bg-[#FDFBF7]/90 focus:ring-4 focus:ring-[#D9A441]/[0.12] [&:-webkit-autofill]:[-webkit-text-fill-color:#5B4030] [&:-webkit-autofill]:[transition:background-color_9999s_ease-out] [&:-webkit-autofill]:shadow-[inset_0_0_0_40px_#FBF7F0]";

export const iconClass =
  "pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A8927E] transition-colors duration-300 peer-focus:text-[#D9A441]";

export const linkClass = cn(
  "rounded text-sm font-medium underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]/50",
  DEEP_GOLD_TEXT
);

export function AuthHeading({ title, subtitle, description }: { title: string; subtitle?: string; description: ReactNode }) {
  return (
    <>
      <h1 className="a-enter text-4xl font-bold tracking-tight text-[#5B4030]" style={{ animationDelay: "0.08s" }}>
        {title}
      </h1>
      {subtitle && (
        <p className={cn("a-enter pb-1 text-3xl font-bold tracking-tight", DEEP_GOLD_TEXT)} style={{ animationDelay: "0.16s" }}>
          {subtitle}
        </p>
      )}
      <p className="a-enter mt-1 text-sm leading-relaxed text-[#8A7361]" style={{ animationDelay: "0.24s" }}>
        {description}
      </p>
    </>
  );
}

export function AuthError({ message, errorKey }: { message: string; errorKey?: number }) {
  return (
    <div
      key={errorKey}
      role="alert"
      className="a-shake flex items-start gap-2 rounded-xl border border-[#C98B7A]/30 bg-[#B5705C]/[0.08] px-4 py-3 text-sm text-[#8E4E3D]"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B5705C]" />
      <span>{message}</span>
    </div>
  );
}

export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="a-enter flex items-start gap-2 rounded-xl border border-[#8BA87A]/35 bg-[#6E9A5C]/[0.08] px-4 py-3 text-sm text-[#3F5E33]">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5E8A4C]" />
      <div>{children}</div>
    </div>
  );
}

export function AuthSubmitButton({ busy, busyLabel, children }: { busy: boolean; busyLabel: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-b from-[#E2B55C] to-[#D9A441] text-base font-semibold tracking-wide text-[#4E3726] shadow-[0_12px_26px_-16px_rgba(185,138,90,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-16px_rgba(185,138,90,0.8)] hover:brightness-[1.03] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D9A441]/25 disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:translate-y-0"
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-[#FAF8F4]/30 opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100" />
      {busy ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
  describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[#6B5443]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          className={cn(fieldClass, "pr-12")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          required
        />
        <Lock className={iconClass} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#A8927E] transition-colors duration-200 hover:bg-[#D9A441]/10 hover:text-[#79563F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]/50"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
