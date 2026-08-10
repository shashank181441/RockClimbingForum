'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Topic, Tag, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { slugify } from '@/lib/helpers';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CreateTopicDialog } from '@/components/create-topic-dialog';
import { CreateCategoryDialog } from '@/components/create-category-dialog';
import {
  EarlyImageUpload,
  attachUploadedImages,
  discardUploadedImages,
  type UploadedImage,
} from '@/components/early-image-upload';
import { EmptyState } from '@/components/states';
import { FolderOpen } from 'lucide-react';

export default function NewDiscussionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      const [topsRes, tagsRes, catsRes] = await Promise.all([
        supabase.from('topics').select('*').order('name'),
        supabase.from('tags').select('*').order('name'),
        supabase.from('categories').select('*').order('sort_order'),
      ]);

      const tops = topsRes.data ?? [];
      setTopics(tops);
      setAllTags(tagsRes.data ?? []);
      setCategories(catsRes.data ?? []);

      const topicSlug = searchParams.get('topic');
      if (topicSlug) {
        const matched = tops.find((t) => t.slug === topicSlug);
        if (matched) setSelectedTopicId(matched.id);
      }
      setLoadingData(false);
    }
    loadData();
  }, [searchParams]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  async function handleCancel() {
    if (images.length > 0) {
      await discardUploadedImages(images);
      setImages([]);
    }
    router.back();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !selectedTopicId) {
      toast.error('Please provide a title and select a topic.');
      return;
    }

    setSubmitting(true);

    const slugBase = slugify(title);
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const { data: disc, error: discError } = await supabase
      .from('discussions')
      .insert({
        topic_id: selectedTopicId,
        user_id: user.id,
        title: title.trim(),
        slug,
        body: body.trim(),
      })
      .select('*')
      .single();

    if (discError || !disc) {
      toast.error('Failed to create discussion.');
      setSubmitting(false);
      return;
    }

    if (selectedTags.length > 0) {
      const tagRows = selectedTags.map((tag_id) => ({
        discussion_id: disc.id,
        tag_id,
      }));
      await supabase.from('discussion_tags').insert(tagRows);
    }

    // Images already in storage — just insert attachment rows
    try {
      await attachUploadedImages(images, disc.id, user.id);
    } catch {
      toast.error('Discussion created, but linking images failed.');
    }

    toast.success('Discussion created!');
    router.push(`/d/${slug}`);
  }

  if (authLoading || loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="relative mb-6 flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="absolute left-0 gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">New Discussion</h1>
      </div>

      <Card>
        <CardContent className="p-6">
          {topics.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No topics yet"
              description={
                categories.length === 0
                  ? 'Create a category first, then a topic, before starting a discussion.'
                  : 'Create a topic to start posting discussions.'
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {categories.length > 0 ? (
                    <CreateTopicDialog
                      categories={categories}
                      onCreated={(topic) => {
                        setTopics((prev) => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)));
                        setSelectedTopicId(topic.id);
                      }}
                    />
                  ) : (
                    <CreateCategoryDialog
                      onCreated={(cat) => setCategories((prev) => [...prev, cat])}
                    />
                  )}
                </div>
              }
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Images at top — upload immediately on select */}
              <EarlyImageUpload value={images} onChange={setImages} maxImages={8} />

              {/* Topic selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="topic">Topic *</Label>
                  <CreateTopicDialog
                    categories={categories}
                    onCreated={(topic) => {
                      setTopics((prev) => [...prev, topic].sort((a, b) => a.name.localeCompare(b.name)));
                      setSelectedTopicId(topic.id);
                    }}
                    trigger={
                      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs">
                        + Create topic
                      </Button>
                    }
                  />
                </div>
                <select
                  id="topic"
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select a topic...</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your discussion a clear title..."
                  required
                  maxLength={200}
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label htmlFor="body">Body</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your post... You can use plain text with line breaks."
                  rows={10}
                  className="resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  Supports plain text. Line breaks are preserved.
                </p>
              </div>

              {/* Tags */}
              {allTags.length > 0 && (
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          selectedTags.includes(tag.id)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:bg-muted'
                        )}
                      >
                        #{tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                    </>
                  ) : (
                    'Create Discussion'
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
