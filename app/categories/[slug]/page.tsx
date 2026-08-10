'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Category, Topic } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { CreateTopicDialog } from '@/components/create-topic-dialog';
import { ArrowRight, FolderOpen, ChevronRight } from 'lucide-react';

interface TopicWithCounts extends Topic {
  discussion_count: number;
}

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [topics, setTopics] = useState<TopicWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: cat, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (catError || !cat) {
        setError('Category not found.');
        setCategory(null);
        setTopics([]);
        setLoading(false);
        return;
      }

      setCategory(cat);

      const { data: tops } = await supabase
        .from('topics')
        .select('*')
        .eq('category_id', cat.id)
        .order('sort_order');

      const list = tops ?? [];
      // End loading as soon as topics arrive — don't wait on counts
      setTopics(list.map((t) => ({ ...t, discussion_count: 0 })));
      setLoading(false);

      if (list.length === 0) return;

      const counts = await Promise.all(
        list.map(async (top) => {
          const { count } = await supabase
            .from('discussions')
            .select('*', { count: 'exact', head: true })
            .eq('topic_id', top.id)
            .neq('status', 'deleted');
          return { id: top.id, discussion_count: count ?? 0 };
        })
      );

      setTopics((prev) =>
        prev.map((t) => {
          const match = counts.find((c) => c.id === t.id);
          return match ? { ...t, discussion_count: match.discussion_count } : t;
        })
      );
    }
    load();
  }, [slug]);

  if (loading) return <LoadingState text="Loading category..." />;
  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/categories" className="hover:text-foreground">Categories</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{category?.name}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{category?.name}</h1>
          <p className="mt-1 text-muted-foreground">{category?.description}</p>
        </div>
        {user && category && (
          <CreateTopicDialog
            categoryId={category.id}
            categories={category ? [category] : []}
            onCreated={(topic) =>
              setTopics((prev) => [...prev, { ...topic, discussion_count: 0 }])
            }
            navigateOnCreate
          />
        )}
      </div>

      {topics.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No topics in this category"
          description={
            user
              ? 'Create the first topic to start discussions here.'
              : 'Topics will appear here once created. Sign in to add one.'
          }
          action={
            user && category ? (
              <CreateTopicDialog
                categoryId={category.id}
                categories={[category]}
                onCreated={(topic) =>
                  setTopics((prev) => [...prev, { ...topic, discussion_count: 0 }])
                }
                navigateOnCreate
              />
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/topics/${topic.slug}`}>
              <Card className="group h-full p-5 transition-all hover:border-primary hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-semibold group-hover:text-primary">{topic.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{topic.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {topic.discussion_count} {topic.discussion_count === 1 ? 'discussion' : 'discussions'}
                  {topic.is_locked && ' · Locked'}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
