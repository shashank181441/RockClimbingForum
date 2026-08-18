import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: { slug: string }; children: React.ReactNode };

function excerpt(text: string | null | undefined, max = 160): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const supabase = createServerSupabase();
    const { data: discussion } = await supabase
      .from('discussions')
      .select(
        `
        id, title, slug, body,
        topics:topics!discussions_topic_id_fkey(name),
        profiles:profiles!discussions_user_id_fkey(display_name, username)
      `
      )
      .eq('slug', params.slug)
      .neq('status', 'deleted')
      .maybeSingle();

    if (!discussion) {
      return buildPageMetadata({
        title: 'Discussion not found',
        description: 'This discussion does not exist or was removed.',
        path: `/d/${params.slug}`,
        noIndex: true,
      });
    }

    const topicName = (discussion.topics as { name?: string } | null)?.name;
    const author =
      (discussion.profiles as { display_name?: string; username?: string } | null)?.display_name ||
      (discussion.profiles as { username?: string } | null)?.username;
    const desc =
      excerpt(discussion.body) ||
      `${discussion.title}${topicName ? ` — ${topicName}` : ''}${author ? ` by ${author}` : ''} on Nepal Climbs.`;

    const { data: imgs } = await supabase
      .from('attachments')
      .select('file_url, thumbnail_url')
      .eq('attachable_type', 'discussion')
      .eq('attachable_id', discussion.id)
      .order('created_at', { ascending: true })
      .limit(1);

    const image = imgs?.[0]?.thumbnail_url || imgs?.[0]?.file_url || null;

    return buildPageMetadata({
      title: discussion.title,
      description: desc,
      path: `/d/${discussion.slug}`,
      image,
      type: 'article',
    });
  } catch {
    return buildPageMetadata({
      title: 'Discussion',
      path: `/d/${params.slug}`,
    });
  }
}

export default function DiscussionLayout({ children }: Props) {
  return children;
}
