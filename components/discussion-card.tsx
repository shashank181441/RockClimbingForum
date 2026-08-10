'use client';

import Link from 'next/link';
import { MessageCircle, Eye, Heart, Pin, Lock, Bookmark } from 'lucide-react';
import type { DiscussionWithRelations } from '@/lib/types';
import { timeAgo } from '@/lib/helpers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getInitials } from '@/lib/helpers';
import { cn } from '@/lib/utils';

interface DiscussionCardProps {
  discussion: DiscussionWithRelations;
  showTopic?: boolean;
}

export function DiscussionCard({ discussion, showTopic = false }: DiscussionCardProps) {
  return (
    <Card
      className={cn(
        'group relative overflow-hidden p-4 transition-all hover:shadow-md sm:p-5',
        discussion.is_pinned && 'border-l-4 border-l-accent'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={discussion.profiles?.avatar_url ?? undefined} alt={discussion.profiles?.display_name ?? ''} />
          <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
            {getInitials(discussion.profiles?.display_name || discussion.profiles?.username)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {discussion.is_pinned && (
              <Badge variant="secondary" className="gap-1 bg-accent/15 text-accent">
                <Pin className="h-3 w-3" /> Pinned
              </Badge>
            )}
            {discussion.is_locked && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> Locked
              </Badge>
            )}
            {showTopic && discussion.topics && (
              <Link href={`/topics/${discussion.topics.slug}`}>
                <Badge variant="outline" className="hover:bg-muted">
                  {discussion.topics.name}
                </Badge>
              </Link>
            )}
          </div>

          <Link href={`/d/${discussion.slug}`} className="block">
            <h3 className="mt-1.5 font-display text-base font-semibold leading-snug transition-colors group-hover:text-primary sm:text-lg">
              {discussion.title}
            </h3>
          </Link>

          {discussion.body && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {discussion.body.replace(/[#*`>]/g, '').slice(0, 200)}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium">
              <Link href={`/u/${discussion.profiles?.username}`} className="hover:text-foreground">
                @{discussion.profiles?.username}
              </Link>
            </span>
            <span>{timeAgo(discussion.created_at)}</span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" /> {discussion.comment_count}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {discussion.view_count}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> {discussion.like_count}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function DiscussionCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </Card>
  );
}
