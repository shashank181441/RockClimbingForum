'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getCategory, listDiscussions } from '@/lib/api/forum';
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
  const { user, roles } = useAuth();
  const canCreateTopic = roles.includes('admin') || roles.includes('moderator');
  const [category, setCategory] = useState<Category | null>(null);
  const [topics, setTopics] = useState<TopicWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const cat = await getCategory(slug);
        setCategory(cat);

        const list = (cat.topics ?? []).map((t) => ({ ...t, discussion_count: 0 }));
        setTopics(list);
        setLoading(false);

        if (list.length === 0) return;

        const counts = await Promise.all(
          list.map(async (top) => {
            try {
              const { total } = await listDiscussions({ topic_id: top.id, per_page: 1 });
              return { id: top.id, discussion_count: total };
            } catch {
              return { id: top.id, discussion_count: 0 };
            }
          })
        );

        setTopics((prev) =>
          prev.map((t) => {
            const match = counts.find((c) => c.id === t.id);
            return match ? { ...t, discussion_count: match.discussion_count } : t;
          })
        );
      } catch {
        setError('Category not found.');
        setCategory(null);
        setTopics([]);
        setLoading(false);
      }
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
        {canCreateTopic && category && (
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
            canCreateTopic
              ? 'Create the first topic to start discussions here.'
              : 'Topics will appear here once created.'
          }
          action={
            canCreateTopic && category ? (
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
