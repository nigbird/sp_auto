import type { SVGProps } from 'react';

export function LoginLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 60"
      {...props}
    >
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: '#c9a140', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#f2d675', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <text
        x="10"
        y="45"
        fontFamily="Arial, sans-serif"
        fontSize="40"
        fontWeight="bold"
        fill="#6b4a24"
      >
        Nib
      </text>
      <text
        x="75"
        y="45"
        fontFamily="Arial, sans-serif"
        fontSize="40"
        fontWeight="bold"
        fill="url(#grad1)"
        style={{ fontStyle: 'italic' }}
      >
        tera
      </text>
      <text
        x="115"
        y="58"
        fontFamily="Arial, sans-serif"
        fontSize="18"
        fontWeight="normal"
        fill="url(#grad1)"
        style={{ fontStyle: 'italic' }}
      >
        tickets
      </text>
      {/* Simple decorative elements */}
      <circle cx="85" cy="15" r="2" fill="#f2d675" />
      <circle cx="90" cy="12" r="1.5" fill="#f2d675" />
      <circle cx="94" cy="15" r="1" fill="#f2d675" />
    </svg>
  );
}
