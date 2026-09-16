import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api/client';
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
    const discussion = await apiFetch<{
      title: string;
      slug: string;
      body: string | null;
      topic?: { name?: string } | null;
      user?: { username?: string; profile?: { display_name?: string; username?: string } } | null;
    }>(`/discussions/${params.slug}`, { token: null });

    if (!discussion) {
      return buildPageMetadata({
        title: 'Discussion not found',
        description: 'This discussion does not exist or was removed.',
        path: `/d/${params.slug}`,
        noIndex: true,
      });
    }

    const topicName = discussion.topic?.name;
    const author =
      discussion.user?.profile?.display_name ||
      discussion.user?.profile?.username ||
      discussion.user?.username;
    const desc =
      excerpt(discussion.body) ||
      `${discussion.title}${topicName ? ` — ${topicName}` : ''}${author ? ` by ${author}` : ''} on Nepal Climbs.`;

    return buildPageMetadata({
      title: discussion.title,
      description: desc,
      path: `/d/${discussion.slug}`,
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
