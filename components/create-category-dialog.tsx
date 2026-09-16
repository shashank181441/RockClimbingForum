'use client';

import { useState } from 'react';
import { createCategory } from '@/lib/api/forum';
import { ApiError } from '@/lib/api/client';
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
import type { Category } from '@/lib/types';

interface CreateCategoryDialogProps {
  onCreated?: (category: Category) => void;
  trigger?: React.ReactNode;
}

export function CreateCategoryDialog({ onCreated, trigger }: CreateCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Category name is required.');
      return;
    }

    setSubmitting(true);
    const slugBase = slugify(name);
    const slug = slugBase || `category-${Date.now().toString(36)}`;

    try {
      const data = await createCategory({
        name: name.trim(),
        slug,
        description: description.trim() || undefined,
      });
      toast.success('Category created.');
      setName('');
      setDescription('');
      setOpen(false);
      onCreated?.(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create category.';
      toast.error(
        message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')
          ? 'A category with that name already exists.'
          : message
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> New Category
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Category</DialogTitle>
          <DialogDescription>
            Categories group related climbing topics (e.g. Crags, Training, Gear).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name *</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Crag Guides"
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What belongs in this category?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                'Create Category'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
