import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api/client';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: { slug: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const data = await apiFetch<{
      name: string;
      description: string | null;
      slug: string;
      banner_image_url?: string | null;
      category?: { name?: string } | null;
    }>(`/topics/${params.slug}`, { token: null });

    if (!data) {
      return buildPageMetadata({
        title: 'Topic not found',
        description: 'This topic does not exist.',
        path: `/topics/${params.slug}`,
        noIndex: true,
      });
    }

    const categoryName = data.category?.name;
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
