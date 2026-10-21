import type {NextConfig} from 'next';

/**
 * Security headers sent on every response. The Content-Security-Policy is not
 * here: it carries a per-request nonce, so src/middleware.ts sets it.
 */
const securityHeaders = [
  // Browsers ignore HSTS on plain-HTTP responses, so this is harmless in local development.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // "same-origin" (not "no-referrer"): POSTs must keep their Origin header for the CSRF checks.
  { key: 'Referrer-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()', 'autoplay=()', 'camera=()', 'display-capture=()', 'encrypted-media=()',
      'geolocation=()', 'gyroscope=()', 'magnetometer=()', 'microphone=()', 'midi=()', 'payment=()',
      'picture-in-picture=()', 'publickey-credentials-get=()', 'screen-wake-lock=()', 'serial=()',
      'usb=()', 'xr-spatial-tracking=()', 'browsing-topics=()',
    ].join(', '),
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Every script, style, font and image is served from this origin, so require-corp blocks nothing we use.
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Origin-Agent-Cluster', value: '?1' },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework (X-Powered-By: Next.js).
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Old URLs from before the menu was regrouped into Planning / Reporting / Administration.
  async redirects() {
    return [
      { source: '/my-activity', destination: '/plan', permanent: false },
      { source: '/approvals', destination: '/plan/approvals', permanent: false },
      { source: '/activities', destination: '/plan/approvals', permanent: false },
      { source: '/settings/user-management', destination: '/users', permanent: false },
      { source: '/settings/user-registration', destination: '/users', permanent: false },
      { source: '/settings/role-management/:path*', destination: '/users/roles', permanent: false },
    ];
  },
  experimental: {
    // Enables forbidden(), so a refused page is answered with HTTP 403 (src/lib/auth/page-guard.tsx).
    authInterrupts: true,
    serverActions: {
      // Strategic-plan workbooks are uploaded through a server action; the 1 MB default is too small for larger plans.
      bodySizeLimit: '10mb',
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // The only images are small local files (the logo). Serving them as-is switches off the
    // image optimizer, and with it the remote-image fetching that has been a source of DoS bugs.
    unoptimized: true,
  },
};

export default nextConfig;
