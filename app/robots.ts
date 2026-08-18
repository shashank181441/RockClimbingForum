import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/settings', '/notifications', '/bookmarks', '/moderation', '/new-discussion', '/login', '/signup', '/auth/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
