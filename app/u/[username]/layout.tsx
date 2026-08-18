import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: { username: string }; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name, bio, avatar_url, location, climbing_grade_max')
      .eq('username', params.username)
      .maybeSingle();

    if (!data) {
      return buildPageMetadata({
        title: 'Climber not found',
        path: `/u/${params.username}`,
        noIndex: true,
      });
    }

    const name = data.display_name || data.username;
    const bits = [
      data.bio,
      data.climbing_grade_max ? `Max grade ${data.climbing_grade_max}` : null,
      data.location,
    ].filter(Boolean);
    const description =
      bits.join(' · ') || `${name}'s climbing profile on Nepal Climbs.`;

    return buildPageMetadata({
      title: name,
      description,
      path: `/u/${data.username}`,
      image: data.avatar_url,
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
