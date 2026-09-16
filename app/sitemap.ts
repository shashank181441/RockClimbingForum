import type { MetadataRoute } from 'next';
import { apiFetch, apiFetchPaginated } from '@/lib/api/client';
import { absoluteUrl } from '@/lib/seo';

type SlugRow = { slug: string; is_private?: boolean };
type DiscussionRow = { slug: string; updated_at?: string; last_activity_at?: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/categories'), changeFrequency: 'weekly', priority: 0.8 },
    { url: absoluteUrl('/faq'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const [categories, topics, discussionsResult] = await Promise.all([
      apiFetch<SlugRow[]>('/categories', { token: null }),
      apiFetch<SlugRow[]>('/topics', { token: null }),
      apiFetchPaginated<DiscussionRow>('/discussions?per_page=100', { token: null }),
    ]);

    const categoryRoutes: MetadataRoute.Sitemap = (categories ?? []).map((c) => ({
      url: absoluteUrl(`/categories/${c.slug}`),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    const topicRoutes: MetadataRoute.Sitemap = (topics ?? [])
      .filter((t) => !t.is_private)
      .map((t) => ({
        url: absoluteUrl(`/topics/${t.slug}`),
        changeFrequency: 'daily',
        priority: 0.75,
      }));

    const discussionRoutes: MetadataRoute.Sitemap = (discussionsResult.data ?? []).map((d) => ({
      url: absoluteUrl(`/d/${d.slug}`),
      lastModified: d.last_activity_at || d.updated_at || undefined,
      changeFrequency: 'daily',
      priority: 0.6,
    }));

    return [...staticRoutes, ...categoryRoutes, ...topicRoutes, ...discussionRoutes];
  } catch {
    return staticRoutes;
  }
}
