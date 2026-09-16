'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listCategories, listTopics } from '@/lib/api/forum';
import { useAuth } from '@/lib/auth-context';
import type { Category } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/states';
import { CreateCategoryDialog } from '@/components/create-category-dialog';
import { ArrowRight, FolderOpen } from 'lucide-react';

interface CategoryWithCounts extends Category {
  topic_count: number;
}

export default function CategoriesPage() {
  const { user, roles } = useAuth();
  const canCreateCategory = roles.includes('admin') || roles.includes('moderator');
  const [categories, setCategories] = useState<CategoryWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const list = await listCategories();
        setCategories(list.map((cat) => ({ ...cat, topic_count: 0 })));
        setLoading(false);

        if (list.length === 0) return;

        const topics = await listTopics();
        const counts = new Map<string, number>();
        for (const t of topics) {
          counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1);
        }

        setCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            topic_count: counts.get(cat.id) ?? 0,
          }))
        );
      } catch {
        setError('Failed to load categories.');
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">All Categories</h1>
          <p className="mt-1 text-muted-foreground">Browse all discussion areas of the forum.</p>
        </div>
        {canCreateCategory && (
          <CreateCategoryDialog
            onCreated={(cat) =>
              setCategories((prev) => [...prev, { ...cat, topic_count: 0 }])
            }
          />
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No categories yet"
          description={
            canCreateCategory
              ? 'Create the first category to organize climbing discussions.'
              : 'Sign in to create categories, or wait for someone to add them.'
          }
          action={
            canCreateCategory ? (
              <CreateCategoryDialog
                onCreated={(cat) =>
                  setCategories((prev) => [...prev, { ...cat, topic_count: 0 }])
                }
              />
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/categories/${cat.slug}`}>
              <Card className="group h-full p-5 transition-all hover:border-primary hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold group-hover:text-primary">{cat.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{cat.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{cat.topic_count} topics</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
