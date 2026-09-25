"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type NibLogoProps = {
  /** "dark" = brown wordmark for light backgrounds, "light" = white wordmark for dark backgrounds. */
  tone?: "dark" | "light";
  showWordmark?: boolean;
  className?: string;
};

/**
 * Nib Bank brand mark (brown sphere with a gold wave) plus wordmark.
 * Swap the <svg> for the official logo asset if one is available.
 */
export function NibLogo({ tone = "dark", showWordmark = true, className }: NibLogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clip = `nib-clip-${uid}`;
  const sphere = `nib-sphere-${uid}`;
  const wave = `nib-wave-${uid}`;

  return (
    <div className={cn("group inline-flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 48 48"
        className="h-11 w-11 shrink-0 drop-shadow-[0_4px_10px_rgba(74,48,33,0.16)] transition-transform duration-500 ease-out group-hover:rotate-[-8deg] group-hover:scale-105"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clip}>
            <circle cx="24" cy="24" r="22" />
          </clipPath>
          <radialGradient id={sphere} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#7A5A45" />
            <stop offset="60%" stopColor="#5E4231" />
            <stop offset="100%" stopColor="#4A3021" />
          </radialGradient>
          <linearGradient id={wave} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DDB462" />
            <stop offset="100%" stopColor="#C99532" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect width="48" height="48" fill={`url(#${sphere})`} />
          <path d="M0 30 C 9 18, 15 18, 22 29 S 36 38, 48 20 V48 H0 Z" fill={`url(#${wave})`} />
          <ellipse cx="17" cy="13" rx="9" ry="4.5" fill="#F8F6F1" opacity="0.12" />
        </g>
      </svg>
      {showWordmark && (
        <div className="leading-none">
          <div
            className={cn(
              "text-2xl font-extrabold tracking-tight",
              tone === "light" ? "text-[#F8F6F1]" : "text-[#4A3021]"
            )}
          >
            nib
          </div>
          <div
            className={cn(
              "mt-1 text-[10px] font-semibold uppercase tracking-[0.28em]",
              tone === "light" ? "text-[#D8A94E]" : "text-[#C99532]"
            )}
          >
            Bank
          </div>
        </div>
      )}
    </div>
  );
}
