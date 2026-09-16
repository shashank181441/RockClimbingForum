'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTopic, listCategories } from '@/lib/api/forum';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { slugify } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Category, Topic } from '@/lib/types';

interface CreateTopicDialogProps {
  categoryId?: string;
  categories?: Category[];
  onCreated?: (topic: Topic) => void;
  trigger?: React.ReactNode;
  navigateOnCreate?: boolean;
}

export function CreateTopicDialog({
  categoryId,
  categories: categoriesProp,
  onCreated,
  trigger,
  navigateOnCreate = false,
}: CreateTopicDialogProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId ?? '');
  const [categories, setCategories] = useState<Category[]>(categoriesProp ?? []);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (categoryId) setSelectedCategoryId(categoryId);
  }, [categoryId]);

  useEffect(() => {
    if (categoriesProp) {
      setCategories(categoriesProp);
      return;
    }
    if (!open) return;
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [open, categoriesProp]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error('Sign in to create a topic.');
      return;
    }
    if (!name.trim() || !selectedCategoryId) {
      toast.error('Please provide a name and category.');
      return;
    }

    setSubmitting(true);
    const slugBase = slugify(name);
    const slug = `${slugBase || 'topic'}-${Date.now().toString(36)}`;

    try {
      const data = await createTopic({
        category_id: selectedCategoryId,
        name: name.trim(),
        slug,
        description: description.trim() || undefined,
      });
      toast.success('Topic created.');
      setName('');
      setDescription('');
      setOpen(false);
      onCreated?.(data);
      if (navigateOnCreate) {
        router.push(`/topics/${data.slug}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create topic.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> New Topic
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Topic</DialogTitle>
          <DialogDescription>
            Topics hold discussions within a category (e.g. a specific crag or technique).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!categoryId && (
            <div className="space-y-2">
              <Label htmlFor="topic-category">Category *</Label>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No categories yet. An admin needs to create one first.
                </p>
              ) : (
                <select
                  id="topic-category"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select a category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="topic-name">Name *</Label>
            <Input
              id="topic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hattiban Boulder"
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-description">Description</Label>
            <Textarea
              id="topic-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should people post here?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || (!categoryId && categories.length === 0)}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                'Create Topic'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
