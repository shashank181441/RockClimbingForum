import type { MetadataRoute } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { absoluteUrl } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/categories'), changeFrequency: 'weekly', priority: 0.8 },
    { url: absoluteUrl('/faq'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/privacy'), changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const supabase = createServerSupabase();

    const [{ data: categories }, { data: topics }, { data: discussions }] = await Promise.all([
      supabase.from('categories').select('slug').order('sort_order'),
      supabase.from('topics').select('slug').eq('is_private', false),
      supabase
        .from('discussions')
        .select('slug, updated_at, last_activity_at')
        .neq('status', 'deleted')
        .order('last_activity_at', { ascending: false })
        .limit(2000),
    ]);

    const categoryRoutes: MetadataRoute.Sitemap = (categories ?? []).map((c) => ({
      url: absoluteUrl(`/categories/${c.slug}`),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    const topicRoutes: MetadataRoute.Sitemap = (topics ?? []).map((t) => ({
      url: absoluteUrl(`/topics/${t.slug}`),
      changeFrequency: 'daily',
      priority: 0.75,
    }));

    const discussionRoutes: MetadataRoute.Sitemap = (discussions ?? []).map((d) => ({
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
