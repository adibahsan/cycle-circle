import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The floating dev-tools button sits on the phone bottom nav's "More" tab and
  // swallows taps (and e2e clicks) at 375px. Error overlays still show.
  devIndicators: false,
  transpilePackages: ['@vesta/shared'],
  experimental: {
    // Tree-shake heavy barrel imports into per-symbol imports. Next already
    // optimizes lucide-react/date-fns/recharts by default; motion is not on
    // that list, so list it (and the rest, harmlessly explicit) here.
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts', 'motion'],
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
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
