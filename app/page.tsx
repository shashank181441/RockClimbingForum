'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Category, DiscussionWithRelations } from '@/lib/types';
import { DiscussionCard, DiscussionCardSkeleton } from '@/components/discussion-card';
import { EmptyState, ErrorState } from '@/components/states';
import { CreateCategoryDialog } from '@/components/create-category-dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mountain, MessageCircle, TrendingUp, Clock, ArrowRight, Plus, FolderOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface CategoryWithCounts extends Category {
  topic_count: number;
  discussion_count: number;
}

export default function HomePage() {
  const { user } = useAuth();
  const canCreateCategory = !!user;
  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionWithRelations[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingDisc, setLoadingDisc] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'recent' | 'trending'>('recent');

  useEffect(() => {
    async function loadCategories() {
      setLoadingCats(true);
      const { data: cats, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

      if (catError) {
        setError('Failed to load categories.');
        setLoadingCats(false);
        return;
      }

      const list = cats ?? [];
      setCategories(list.map((cat) => ({ ...cat, topic_count: 0, discussion_count: 0 })));
      setLoadingCats(false);

      if (list.length === 0) return;

      const enriched = await Promise.all(
        list.map(async (cat) => {
          const [{ count: topicCount }, { data: topics }] = await Promise.all([
            supabase
              .from('topics')
              .select('*', { count: 'exact', head: true })
              .eq('category_id', cat.id),
            supabase.from('topics').select('id').eq('category_id', cat.id),
          ]);

          const topicIds = (topics ?? []).map((t) => t.id);
          let discussionCount = 0;
          if (topicIds.length > 0) {
            const { count } = await supabase
              .from('discussions')
              .select('*', { count: 'exact', head: true })
              .in('topic_id', topicIds)
              .neq('status', 'deleted');
            discussionCount = count ?? 0;
          }

          return {
            ...cat,
            topic_count: topicCount ?? 0,
            discussion_count: discussionCount,
          };
        })
      );

      setCategories(enriched);
    }

    loadCategories();
  }, []);

  useEffect(() => {
    async function loadDiscussions() {
      setLoadingDisc(true);
      const orderCol = tab === 'trending' ? 'like_count' : 'last_activity_at';
      const { data: disc, error: discError } = await supabase
        .from('discussions')
        .select(`
          *,
          profiles:profiles!discussions_user_id_fkey(id, username, display_name, avatar_url),
          topics:topics!discussions_topic_id_fkey(id, name, slug),
          tags:discussion_tags(tag:tags(id, name, slug))
        `)
        .neq('status', 'deleted')
        .order(orderCol, { ascending: false })
        .limit(10);

      if (discError) {
        setError('Failed to load discussions.');
        setDiscussions([]);
      } else {
        const formatted = (disc ?? []).map((d) => ({
          ...d,
          tags: d.tags?.map((dt: { tag: unknown[] }) => dt.tag).flat() ?? [],
        })) as DiscussionWithRelations[];
        setDiscussions(formatted);
      }
      setLoadingDisc(false);
    }

    loadDiscussions();
  }, [tab]);

  return (
    <div className="bg-topo-pattern">
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/10 via-accent/5 to-background">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 flex justify-center">
              <Mountain className="h-12 w-12 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Nepal Climbs
            </h1>
            <p className="mt-2 text-sm font-medium text-accent">
              नेपालको बोल्डरिङ र रक क्लाइम्बिङ समुदाय
            </p>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
              Nepal&apos;s bouldering & rock climbing community. Share beta, crag guides, trip reports, and stoke.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {user ? (
                <Button asChild size="lg">
                  <Link href="/new-discussion">
                    <Plus className="mr-2 h-5 w-5" /> Start a Discussion
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/signup">Join the Community</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/login">Sign In</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">Categories</h2>
              {canCreateCategory && (
                <CreateCategoryDialog
                  onCreated={(cat) =>
                    setCategories((prev) => [...prev, { ...cat, topic_count: 0, discussion_count: 0 }])
                  }
                />
              )}
            </div>
            {loadingCats ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="h-28 animate-pulse bg-muted/50" />
                ))}
              </div>
            ) : error && categories.length === 0 ? (
              <ErrorState message={error} />
            ) : categories.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No categories yet"
                description={
                  canCreateCategory
                    ? 'Create a category so climbers can find topics.'
                    : 'Sign in to create the first category.'
                }
                action={
                  canCreateCategory ? (
                    <CreateCategoryDialog
                      onCreated={(cat) =>
                        setCategories((prev) => [
                          ...prev,
                          { ...cat, topic_count: 0, discussion_count: 0 },
                        ])
                      }
                    />
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {categories.map((cat) => (
                  <Link key={cat.id} href={`/categories/${cat.slug}`}>
                    <Card className="group h-full p-4 transition-all hover:border-primary hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-base font-semibold group-hover:text-primary">
                            {cat.name}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {cat.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{cat.topic_count} topics</span>
                        <span>{cat.discussion_count} discussions</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                {tab === 'trending' ? 'Trending' : 'Recent'}
              </h2>
              <div className="flex gap-1 rounded-lg border border-border p-1">
                <button
                  onClick={() => setTab('recent')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    tab === 'recent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" /> Recent
                </button>
                <button
                  onClick={() => setTab('trending')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    tab === 'trending' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Trending
                </button>
              </div>
            </div>

            {loadingDisc ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <DiscussionCardSkeleton key={i} />
                ))}
              </div>
            ) : discussions.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No discussions yet"
                description="Be the first to start a conversation."
                action={
                  user ? (
                    <Button asChild size="sm">
                      <Link href="/new-discussion">Start a Discussion</Link>
                    </Button>
                  ) : undefined
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
        </div>
      </div>
    </div>
  );
}
