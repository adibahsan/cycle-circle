import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://test-vesta.velirasolutions.com';

  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/login`, lastModified: new Date() },
    { url: `${base}/privacy`, lastModified: new Date() },
    { url: `${base}/terms`, lastModified: new Date() },
    { url: `${base}/guide`, lastModified: new Date() },
  ];
}
