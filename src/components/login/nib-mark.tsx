import { useId } from "react";

/**
 * The Nib International Bank mark, traced from the app favicon (src/app/favicon.ico)
 * as a vector so it stays crisp at any size: a brown upper half and a gold lower
 * half split by a white zig-zag.
 */
export function NibMark({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clip = `nib-mark-clip-${uid}`;
  const brown = `nib-mark-brown-${uid}`;
  const gold = `nib-mark-gold-${uid}`;

  // The zig-zag divider: in from the left, up to a peak, down to a trough, up to the right.
  const divider = "M -2 29 L 15 13.5 L 31 30.5 L 50 15";

  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Nib International Bank logo">
      <defs>
        <clipPath id={clip}>
          <circle cx="24" cy="24" r="23" />
        </clipPath>
        <linearGradient id={brown} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7A4318" />
          <stop offset="50%" stopColor="#A9672E" />
          <stop offset="100%" stopColor="#6E3A13" />
        </linearGradient>
        <radialGradient id={gold} cx="42%" cy="72%" r="65%">
          <stop offset="0%" stopColor="#FFD85A" />
          <stop offset="70%" stopColor="#F2B81E" />
          <stop offset="100%" stopColor="#E3A10E" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="48" height="48" fill={`url(#${brown})`} />
        <path d={`${divider} L 50 50 L -2 50 Z`} fill={`url(#${gold})`} />
        <path d={divider} fill="none" stroke="#FFFDF8" strokeWidth="3.2" strokeLinejoin="miter" />
      </g>
    </svg>
  );
}
