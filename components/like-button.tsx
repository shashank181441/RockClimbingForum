'use client';

import { useCallback, useRef, useState } from 'react';
import { toggleLike } from '@/lib/api/forum';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { Heart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LikeButtonProps {
  likeableType: 'discussion' | 'comment';
  likeableId: string;
  likeCount: number;
  isLiked: boolean;
  onToggle: (isLiked: boolean, newCount: number) => void;
  size?: 'sm' | 'md';
}

export function LikeButton({
  likeableType,
  likeableId,
  likeCount,
  isLiked,
  onToggle,
  size = 'sm',
}: LikeButtonProps) {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!user) {
        toast.error('Please sign in to like posts.');
        return;
      }
      if (inFlight.current || pending) return;

      inFlight.current = true;
      setPending(true);

      const previousLiked = isLiked;
      const previousCount = likeCount;
      const optimisticLiked = !isLiked;
      const optimisticCount = Math.max(0, isLiked ? likeCount - 1 : likeCount + 1);
      onToggle(optimisticLiked, optimisticCount);

      try {
        const result = await toggleLike(likeableType, likeableId);
        onToggle(!!result.liked, typeof result.like_count === 'number' ? result.like_count : optimisticCount);
      } catch (err: unknown) {
        onToggle(previousLiked, previousCount);
        const message =
          err instanceof ApiError
            ? err.message
            : err && typeof err === 'object' && 'message' in err
              ? String((err as { message: string }).message)
              : 'Failed to update like.';
        toast.error(message);
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [user, pending, isLiked, likeCount, likeableType, likeableId, onToggle]
  );

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      aria-pressed={isLiked}
      aria-label={isLiked ? 'Unlike' : 'Like'}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-all disabled:opacity-60',
        isLiked
          ? 'bg-accent/15 text-accent hover:bg-accent/25'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        size === 'sm' ? 'text-xs' : 'text-sm'
      )}
    >
      {pending ? (
        <Loader2 className={cn('animate-spin', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      ) : (
        <Heart
          className={cn(
            'transition-all',
            isLiked ? 'fill-accent text-accent' : '',
            size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
          )}
        />
      )}
      <span>{likeCount}</span>
    </button>
  );
}
