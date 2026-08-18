import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: { slug: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from('categories')
      .select('name, description, slug')
      .eq('slug', params.slug)
      .maybeSingle();

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
