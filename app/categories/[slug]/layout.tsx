import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api/client';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: { slug: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const data = await apiFetch<{ name: string; description: string | null; slug: string }>(
      `/categories/${params.slug}`,
      { token: null }
    );

    if (!data) {
      return buildPageMetadata({
        title: 'Category not found',
        description: 'This category does not exist.',
        path: `/categories/${params.slug}`,
        noIndex: true,
      });
    }

    return buildPageMetadata({
      title: data.name,
      description: data.description || `Browse climbing topics in ${data.name} on Nepal Climbs.`,
      path: `/categories/${data.slug}`,
    });
  } catch {
    return buildPageMetadata({
      title: 'Category',
      path: `/categories/${params.slug}`,
    });
  }
}

export default function CategoryLayout({ children }: Props) {
  return children;
}
