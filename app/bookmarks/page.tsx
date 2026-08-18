'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { DiscussionWithRelations } from '@/lib/types';
import { DiscussionCard, DiscussionCardSkeleton } from '@/components/discussion-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function BookmarksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [discussions, setDiscussions] = useState<DiscussionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBookmarks = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setDiscussions([]);
      return;
    }
    setLoading(true);

    // Get bookmarked discussion IDs
    const { data: bookmarks, error: bmError } = await supabase
      .from('bookmarks')
      .select('discussion_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (bmError) {
      setError('Failed to load bookmarks.');
      setLoading(false);
      return;
    }

    if (!bookmarks || bookmarks.length === 0) {
      setDiscussions([]);
      setLoading(false);
      return;
    }

    const discIds = bookmarks.map((b) => b.discussion_id);

    const { data: discs, error: discError } = await supabase
      .from('discussions')
      .select(`
        *,
        profiles:profiles!discussions_user_id_fkey(id, username, display_name, avatar_url),
        topics:topics!discussions_topic_id_fkey(id, name, slug),
        tags:discussion_tags(tag:tags(id, name, slug))
      `)
      .in('id', discIds)
      .neq('status', 'deleted')
      .order('last_activity_at', { ascending: false });

    if (discError) {
      setError('Failed to load bookmarked discussions.');
    } else {
      const formatted = (discs ?? []).map((d) => ({
        ...d,
        tags: d.tags?.map((dt: { tag: unknown[] }) => dt.tag).flat() ?? [],
      })) as DiscussionWithRelations[];
      setDiscussions(formatted);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  if (authLoading) return <LoadingState />;
  if (!user) return null;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold sm:text-3xl">Bookmarks</h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <DiscussionCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : discussions.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No bookmarks yet"
          description="Save discussions to read them later."
          action={
            <Button asChild size="sm">
              <Link href="/">Browse Discussions</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {discussions.map((d) => (
            <DiscussionCard key={d.id} discussion={d} showTopic />
          ))}
        </div>
      )}
    </div>
  );
}
