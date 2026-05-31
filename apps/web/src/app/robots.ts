import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
    sitemap: 'https://test-vesta.velirasolutions.com/sitemap.xml',
  };
}
