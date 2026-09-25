import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
