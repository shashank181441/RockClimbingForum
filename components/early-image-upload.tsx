'use client';

import { useCallback, useState } from 'react';
import { uploadImage } from '@/lib/api/forum';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import {
  addPendingUpload,
  clearPendingUploads,
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

export function EarlyImageUpload({
  value,
  onChange,
  maxImages = 8,
  label = 'Images (optional)',
}: EarlyImageUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

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
        try {
          const result = await uploadImage(file);
          const pending: PendingUpload = {
            storage_path: result.path,
            file_url: result.url,
            file_type: file.type || null,
          };
          addPendingUpload(pending);
          uploaded.push({
            ...pending,
            localId: result.path,
            previewUrl: URL.createObjectURL(file),
          });
        } catch (err) {
          toast.error(
            err instanceof ApiError ? err.message : `Failed to upload ${file.name}`
          );
        }
      }

      if (uploaded.length > 0) {
        onChange([...value, ...uploaded]);
      }
      setUploading(false);
    },
    [user, value, maxImages, onChange]
  );

  const removeImage = (image: UploadedImage) => {
    onChange(value.filter((img) => img.localId !== image.localId));
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    removePendingUpload(image.storage_path);
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
        Images upload as soon as you pick them. Submitting the post embeds their URLs in the body.
      </p>
    </div>
  );
}

/** Images are already uploaded; clear local pending tracking after create. */
export async function attachUploadedImages(images: UploadedImage[]) {
  if (images.length === 0) return;
  clearPendingUploads(images.map((img) => img.storage_path));
}

export async function discardUploadedImages(images: UploadedImage[]) {
  clearPendingUploads(images.map((img) => img.storage_path));
}
