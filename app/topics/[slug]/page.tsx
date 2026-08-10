'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { TopicWithCategory, TopicRule, DiscussionWithRelations } from '@/lib/types';
import { DiscussionCard } from '@/components/discussion-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollText, Plus, ChevronRight, Lock, Pin } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function TopicPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const [topic, setTopic] = useState<TopicWithCategory | null>(null);
  const [rules, setRules] = useState<TopicRule[]>([]);
  const [pinnedDiscussions, setPinnedDiscussions] = useState<DiscussionWithRelations[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: top, error: topError } = await supabase
        .from('topics')
        .select('*, categories:categories!topics_category_id_fkey(name, slug)')
        .eq('slug', slug)
        .maybeSingle();

      if (topError || !top) {
        setError('Topic not found.');
        setLoading(false);
        return;
      }

      setTopic(top);

      // Load rules (topic-specific + site-wide)
      const { data: r1 } = await supabase
        .from('topic_rules')
        .select('*')
        .eq('topic_id', top.id)
        .order('sort_order');
      const { data: r2 } = await supabase
        .from('topic_rules')
        .select('*')
        .is('topic_id', null)
        .order('sort_order');
      setRules([...(r1 ?? []), ...(r2 ?? [])]);

      // Load discussions
      const { data: discs } = await supabase
        .from('discussions')
        .select(`
          *,
          profiles:profiles!discussions_user_id_fkey(id, username, display_name, avatar_url),
          topics:topics!discussions_topic_id_fkey(id, name, slug),
          tags:discussion_tags(tag:tags(id, name, slug))
        `)
        .eq('topic_id', top.id)
        .neq('status', 'deleted')
        .order('is_pinned', { ascending: false })
        .order('last_activity_at', { ascending: false });

      const formatted = (discs ?? []).map((d) => ({
        ...d,
        tags: d.tags?.map((dt: { tag: unknown[] }) => dt.tag).flat() ?? [],
      })) as DiscussionWithRelations[];

      setPinnedDiscussions(formatted.filter((d) => d.is_pinned));
      setDiscussions(formatted.filter((d) => !d.is_pinned));
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) return <LoadingState text="Loading topic..." />;
  if (error) return <div className="container mx-auto px-4 py-12"><ErrorState message={error} /></div>;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {topic?.categories && (
          <>
            <Link href={`/categories/${topic.categories.slug}`} className="hover:text-foreground">
              {topic.categories.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="text-foreground">{topic?.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{topic?.name}</h1>
            {topic?.is_locked && (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <p className="mt-1 max-w-2xl text-muted-foreground">{topic?.description}</p>
        </div>
        {user && !topic?.is_locked && (
          <Button asChild>
            <Link href={`/new-discussion?topic=${topic?.slug}`}>
              <Plus className="mr-1 h-4 w-4" /> New Discussion
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Discussions */}
        <div className="lg:col-span-2">
          {pinnedDiscussions.length === 0 && discussions.length === 0 ? (
            <EmptyState
              icon={Pin}
              title="No discussions yet"
              description="Be the first to start a discussion in this topic."
              action={
                user && !topic?.is_locked ? (
                  <Button asChild size="sm">
                    <Link href={`/new-discussion?topic=${topic?.slug}`}>Start a Discussion</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {pinnedDiscussions.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Pin className="h-4 w-4 text-accent" /> Pinned
                  </div>
                  {pinnedDiscussions.map((d) => (
                    <DiscussionCard key={d.id} discussion={d} />
                  ))}
                  {discussions.length > 0 && <div className="my-4 border-t border-border" />}
                </>
              )}
              {discussions.map((d) => (
                <DiscussionCard key={d.id} discussion={d} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              <h2 className="font-display text-base font-semibold">Rules</h2>
            </div>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No specific rules for this topic.</p>
            ) : (
              <ol className="space-y-3">
                {rules.map((rule, i) => (
                  <li key={rule.id} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{rule.title}</p>
                      {rule.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{rule.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
