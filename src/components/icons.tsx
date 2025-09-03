import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 7v10" />
      <path d="M6 7v10" />
      <path d="M12 7v10" />
      <path d="M18 7v10" />
      <path d="M22 7v10" />
      <path d="M2 12h20" />
    </svg>
  );
}
