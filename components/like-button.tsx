'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Heart } from 'lucide-react';
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

  const handleToggle = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to like posts.');
      return;
    }

    // Optimistic update
    const newIsLiked = !isLiked;
    const newCount = isLiked ? likeCount - 1 : likeCount + 1;
    onToggle(newIsLiked, newCount);

    if (newIsLiked) {
      const { error } = await supabase
        .from('likes')
        .insert({ user_id: user.id, likeable_type: likeableType, likeable_id: likeableId });
      if (error) {
        if (error.code !== '23505') {
          toast.error('Failed to like.');
          onToggle(isLiked, likeCount);
        }
      }
    } else {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('likeable_type', likeableType)
        .eq('likeable_id', likeableId);
      if (error) {
        toast.error('Failed to unlike.');
        onToggle(isLiked, likeCount);
      }
    }
  }, [user, isLiked, likeCount, likeableType, likeableId, onToggle]);

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-all',
        isLiked
          ? 'bg-accent/15 text-accent hover:bg-accent/25'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        size === 'sm' ? 'text-xs' : 'text-sm'
      )}
    >
      <Heart className={cn('transition-all', isLiked ? 'fill-accent text-accent' : '', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      <span>{likeCount}</span>
    </button>
  );
}
