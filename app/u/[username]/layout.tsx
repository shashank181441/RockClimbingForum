import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api/client';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: { username: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const data = await apiFetch<{
      username?: string;
      profile?: {
        username?: string;
        display_name?: string | null;
        bio?: string | null;
        avatar_url?: string | null;
        location?: string | null;
        climbing_grade_max?: string | null;
      } | null;
    }>(`/profiles/${params.username}`, { token: null });

    const profile = data.profile;
    const username = profile?.username || data.username || params.username;

    if (!profile && !data.username) {
      return buildPageMetadata({
        title: 'Climber not found',
        path: `/u/${params.username}`,
        noIndex: true,
      });
    }

    const name = profile?.display_name || username;
    const bits = [
      profile?.bio,
      profile?.climbing_grade_max ? `Max grade ${profile.climbing_grade_max}` : null,
      profile?.location,
    ].filter(Boolean);
    const description =
      bits.join(' · ') || `${name}'s climbing profile on Nepal Climbs.`;

    return buildPageMetadata({
      title: name,
      description,
      path: `/u/${username}`,
      image: profile?.avatar_url,
    });
  } catch {
    return buildPageMetadata({
      title: params.username,
      path: `/u/${params.username}`,
    });
  }
}

export default function ProfileLayout({ children }: Props) {
  return children;
}
