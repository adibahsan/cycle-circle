import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@vesta/shared'],
  experimental: {
    // Article image uploads go through a server action (5 MB image cap + multipart overhead).
    serverActions: { bodySizeLimit: '6mb' },
    // Tree-shake heavy barrel imports. @tiptap/* and motion are not on Next's
    // default optimized list, so list them explicitly alongside the rest.
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      'motion',
      '@tiptap/react',
      '@tiptap/starter-kit',
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
