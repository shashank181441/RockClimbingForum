import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: { slug: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from('topics')
      .select('name, description, slug, banner_image_url, categories:categories!topics_category_id_fkey(name)')
      .eq('slug', params.slug)
      .maybeSingle();

    if (!data) {
      return buildPageMetadata({
        title: 'Topic not found',
        description: 'This topic does not exist.',
        path: `/topics/${params.slug}`,
        noIndex: true,
      });
    }

    const categoryName = (data.categories as { name?: string } | null)?.name;
    const desc =
      data.description ||
      (categoryName
        ? `Discussions in ${data.name} (${categoryName}) on Nepal Climbs.`
        : `Discussions in ${data.name} on Nepal Climbs.`);

    return buildPageMetadata({
      title: data.name,
      description: desc,
      path: `/topics/${data.slug}`,
      image: data.banner_image_url,
    });
  } catch {
    return buildPageMetadata({
      title: 'Topic',
      path: `/topics/${params.slug}`,
    });
  }
}

export default function TopicLayout({ children }: Props) {
  return children;
}
