'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import {
  addPendingUpload,
  clearPendingUploads,
  getPendingUploads,
  removePendingUpload,
  type PendingUpload,
} from '@/lib/pending-uploads';
import { Label } from '@/components/ui/label';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export interface UploadedImage extends PendingUpload {
  localId: string;
  previewUrl?: string;
}

interface EarlyImageUploadProps {
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  label?: string;
}

async function deleteStorageFile(storagePath: string) {
  await supabase.storage.from('forum-images').remove([storagePath]);
  removePendingUpload(storagePath);
}

export function EarlyImageUpload({
  value,
  onChange,
  maxImages = 8,
  label = 'Images (optional)',
}: EarlyImageUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  // Clean abandoned uploads from previous sessions (not in current form state)
  useEffect(() => {
    if (!user) return;
    const pending = getPendingUploads();
    const activePaths = new Set(value.map((img) => img.storage_path));
    const orphans = pending.filter((u) => !activePaths.has(u.storage_path));
    if (orphans.length === 0) return;

    (async () => {
      await Promise.all(orphans.map((u) => deleteStorageFile(u.storage_path)));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!user) {
        toast.error('Sign in to upload images.');
        return;
      }

      const files = Array.from(e.target.files ?? []);
      e.target.value = '';
      if (files.length === 0) return;

      if (files.length + value.length > maxImages) {
        toast.error(`Maximum ${maxImages} images.`);
        return;
      }

      setUploading(true);

      const uploaded: UploadedImage[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'jpg';
        const filePath = `${user.id}/pending/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('forum-images')
          .upload(filePath, file);

        if (uploadError) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage.from('forum-images').getPublicUrl(filePath);
        const pending: PendingUpload = {
          storage_path: filePath,
          file_url: urlData.publicUrl,
          file_type: file.type || null,
        };
        addPendingUpload(pending);
        uploaded.push({
          ...pending,
          localId: filePath,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (uploaded.length > 0) {
        onChange([...value, ...uploaded]);
      }
      setUploading(false);
    },
    [user, value, maxImages, onChange]
  );

  const removeImage = async (image: UploadedImage) => {
    onChange(value.filter((img) => img.localId !== image.localId));
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    await deleteStorageFile(image.storage_path);
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {uploading && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
          </span>
        )}
      </Label>
      <div className="flex flex-wrap gap-3">
        {value.map((img) => (
          <div key={img.localId} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.previewUrl || img.file_url}
              alt="Upload preview"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeImage(img)}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 hover:bg-background"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.length < maxImages && (
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-muted">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleSelect}
              className="hidden"
              disabled={uploading || !user}
            />
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
            )}
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Images upload as soon as you pick them. Submitting the post only links them — no long wait at the end.
      </p>
    </div>
  );
}

/** After discussion insert: create attachment rows from already-uploaded files */
export async function attachUploadedImages(
  images: UploadedImage[],
  discussionId: string,
  uploaderId: string
) {
  if (images.length === 0) return;

  const rows = images.map((img) => ({
    uploader_id: uploaderId,
    storage_path: img.storage_path,
    file_url: img.file_url,
    thumbnail_url: img.file_url,
    file_type: img.file_type,
    attachable_type: 'discussion' as const,
    attachable_id: discussionId,
  }));

  const { error } = await supabase.from('attachments').insert(rows);
  if (error) throw error;

  clearPendingUploads(images.map((img) => img.storage_path));
}

export async function discardUploadedImages(images: UploadedImage[]) {
  await Promise.all(images.map((img) => deleteStorageFile(img.storage_path)));
  clearPendingUploads(images.map((img) => img.storage_path));
}
