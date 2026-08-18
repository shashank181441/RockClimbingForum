'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { DiscussionWithRelations, CommentWithProfile, Attachment } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { LikeButton } from '@/components/like-button';
import { CommentNode } from '@/components/comment-node';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { timeAgo, getInitials } from '@/lib/helpers';
import { ChevronRight, Lock, Pin, Eye, MessageCircle, Bookmark, BookmarkCheck, Flag, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function DiscussionPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user, profile } = useAuth();
  const [discussion, setDiscussion] = useState<DiscussionWithRelations | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());

  const loadComments = useCallback(async (discId: string) => {
    const { data: comms } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:profiles!comments_user_id_fkey(id, username, display_name, avatar_url)
      `)
      .eq('discussion_id', discId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: true });
    setComments((comms ?? []) as CommentWithProfile[]);
  }, []);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const { data: disc, error: discError } = await supabase
      .from('discussions')
      .select(`
        *,
        profiles:profiles!discussions_user_id_fkey(id, username, display_name, avatar_url),
        topics:topics!discussions_topic_id_fkey(id, name, slug, categories:categories!topics_category_id_fkey(name, slug)),
        tags:discussion_tags(tag:tags(id, name, slug))
      `)
      .eq('slug', slug)
      .neq('status', 'deleted')
      .maybeSingle();

    if (discError || !disc) {
      setError('Discussion not found.');
      setLoading(false);
      return;
    }

    const formatted = {
      ...disc,
      tags: disc.tags?.map((dt: { tag: unknown[] }) => dt.tag).flat() ?? [],
    } as DiscussionWithRelations;
    setDiscussion(formatted);
    setLikeCount(formatted.like_count);

    // Increment view count only on full (non-silent) loads
    if (!opts?.silent) {
      await supabase.rpc('increment_view_count', { disc_id: formatted.id }).then(({ error }: { error: unknown }) => {
        if (error) console.warn('Failed to increment view count');
      });
    }

    // Load attachments
    const { data: atts } = await supabase
      .from('attachments')
      .select('*')
      .eq('attachable_type', 'discussion')
      .eq('attachable_id', formatted.id)
      .order('created_at');
    setAttachments(atts ?? []);

    // Load comments
    await loadComments(formatted.id);

    setLoading(false);
  }, [slug, loadComments]);

  // Load discussion once per slug (not on every auth token refresh)
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only slug
  }, [slug]);

  // When user becomes available, refresh personal like/bookmark state without full reload UI
  useEffect(() => {
    if (!user || !discussion) return;
    let cancelled = false;
    (async () => {
      const { data: likeData } = await supabase
        .from('likes')
        .select('id')
        .eq('likeable_type', 'discussion')
        .eq('likeable_id', discussion.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setIsLiked(!!likeData);

      const { data: bookmarkData } = await supabase
        .from('bookmarks')
        .select('discussion_id')
        .eq('discussion_id', discussion.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setIsBookmarked(!!bookmarkData);

      const { data: commentLikes } = await supabase
        .from('likes')
        .select('likeable_id')
        .eq('likeable_type', 'comment')
        .eq('user_id', user.id);
      if (cancelled) return;
      setLikedCommentIds(new Set((commentLikes ?? []).map((l) => l.likeable_id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, discussion?.id]);

  async function submitComment() {
    if (!user) {
      toast.error('Please sign in to comment.');
      router.push('/login');
      return;
    }
    if (!newComment.trim() || !discussion) return;
    setSubmittingComment(true);

    const { error } = await supabase.from('comments').insert({
      discussion_id: discussion.id,
      user_id: user.id,
      body: newComment.trim(),
      depth: 0,
      path: '',
    });

    if (error) {
      toast.error('Failed to post comment.');
    } else {
      // Update discussion last_activity_at and comment_count
      const { count } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('discussion_id', discussion.id)
        .neq('status', 'deleted');
      await supabase
        .from('discussions')
        .update({ last_activity_at: new Date().toISOString(), comment_count: count ?? 0 })
        .eq('id', discussion.id);
      setNewComment('');
      await loadComments(discussion.id);
      toast.success('Comment posted!');
    }
    setSubmittingComment(false);
  }

  async function toggleBookmark() {
    if (!user || !discussion) {
      toast.error('Please sign in to bookmark.');
      return;
    }
    if (isBookmarked) {
      await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('discussion_id', discussion.id);
      setIsBookmarked(false);
      toast.success('Removed from bookmarks.');
    } else {
      await supabase.from('bookmarks').insert({ user_id: user.id, discussion_id: discussion.id });
      setIsBookmarked(true);
      toast.success('Added to bookmarks.');
    }
  }

  async function reportDiscussion() {
    if (!user || !discussion) return;
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reportable_type: 'discussion',
      reportable_id: discussion.id,
      reason: 'Reported by user',
    });
    if (error) toast.error('Failed to report.');
    else toast.success('Discussion reported.');
  }

  // Build comment tree
  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  if (loading) return <LoadingState text="Loading discussion..." />;
  if (error) return <div className="container mx-auto px-4 py-12"><ErrorState message={error} /></div>;
  if (!discussion) return <div className="container mx-auto px-4 py-12"><ErrorState message="Discussion not found." /></div>;

  const isLocked = discussion.is_locked;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {discussion.topics?.categories && (
          <>
            <Link href={`/categories/${discussion.topics.categories.slug}`} className="hover:text-foreground">
              {discussion.topics.categories.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        {discussion.topics && (
          <>
            <Link href={`/topics/${discussion.topics.slug}`} className="hover:text-foreground">
              {discussion.topics.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="truncate text-foreground">{discussion.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Main content */}
        <div className="lg:col-span-3">
          {/* Discussion header */}
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              {discussion.is_pinned && (
                <Badge variant="secondary" className="gap-1 bg-accent/15 text-accent">
                  <Pin className="h-3 w-3" /> Pinned
                </Badge>
              )}
              {isLocked && (
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" /> Locked
                </Badge>
              )}
              {discussion.tags?.map((tag) => (
                <Link key={tag.id} href={`/tags/${tag.slug}`}>
                  <Badge variant="outline" className="hover:bg-muted">#{tag.name}</Badge>
                </Link>
              ))}
            </div>

            <h1 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl">
              {discussion.title}
            </h1>

            <div className="mt-4 flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={discussion.profiles?.avatar_url ?? undefined} alt={discussion.profiles?.display_name ?? ''} />
                <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                  {getInitials(discussion.profiles?.display_name || discussion.profiles?.username)}
                </AvatarFallback>
              </Avatar>
              <div>
                <Link href={`/u/${discussion.profiles?.username}`} className="text-sm font-medium hover:text-primary">
                  {discussion.profiles?.display_name || discussion.profiles?.username}
                </Link>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{timeAgo(discussion.created_at)}</span>
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {discussion.view_count}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {discussion.comment_count}</span>
                </div>
              </div>
            </div>

            {/* Body */}
            {discussion.body && (
              <div className="prose-climbing mt-4 text-sm leading-relaxed sm:text-base">
                {discussion.body.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}

            {/* Image gallery */}
            {attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.thumbnail_url || att.file_url}
                      alt="Attachment"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </a>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
              <LikeButton
                likeableType="discussion"
                likeableId={discussion.id}
                likeCount={likeCount}
                isLiked={isLiked}
                onToggle={(liked, count) => {
                  setIsLiked(liked);
                  setLikeCount(count);
                }}
                size="md"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleBookmark}
                className={cn('gap-1.5', isBookmarked && 'text-primary')}
              >
                {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                {isBookmarked ? 'Saved' : 'Save'}
              </Button>
              {user && discussion.user_id !== user.id && (
                <Button variant="ghost" size="sm" onClick={reportDiscussion} className="gap-1.5 text-muted-foreground">
                  <Flag className="h-4 w-4" /> Report
                </Button>
              )}
            </div>
          </Card>

          {/* Comments section */}
          <div className="mt-6">
            <h2 className="mb-4 font-display text-lg font-bold">
              {discussion.comment_count} {discussion.comment_count === 1 ? 'Comment' : 'Comments'}
            </h2>

            {/* Comment box */}
            {!isLocked ? (
              <Card className="mb-6 p-4">
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.display_name ?? ''} />
                    <AvatarFallback className="text-xs font-bold">
                      {getInitials(profile?.display_name || profile?.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your thoughts..."
                      rows={3}
                      className="resize-none"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" onClick={submitComment} disabled={submittingComment || !newComment.trim()}>
                        {submittingComment ? 'Posting...' : 'Post Comment'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="mb-6 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" /> This discussion is locked. New comments are disabled.
                </div>
              </Card>
            )}

            {/* Comment tree */}
            {rootComments.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No comments yet"
                description={isLocked ? undefined : "Be the first to share your thoughts."}
              />
            ) : (
              <Card className="p-4 sm:p-5">
                <div className="space-y-1">
                  {rootComments.map((comment) => (
                    <CommentNode
                      key={comment.id}
                      comment={comment}
                      replies={getReplies(comment.id)}
                      allComments={comments}
                      discussionId={discussion.id}
                      isLocked={isLocked}
                      depth={0}
                      currentUserId={user?.id ?? null}
                      likedCommentIds={likedCommentIds}
                      onLikeToggle={(commentId, isLiked, newCount) => {
                        setComments((prev) =>
                          prev.map((c) =>
                            c.id === commentId ? { ...c, like_count: newCount } : c
                          )
                        );
                        setLikedCommentIds((prev) => {
                          const next = new Set(prev);
                          if (isLiked) next.add(commentId);
                          else next.delete(commentId);
                          return next;
                        });
                      }}
                      onCommentAdded={() => loadComments(discussion.id)}
                    />
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20 p-5">
            <h3 className="mb-3 font-display text-sm font-semibold">Discussion Info</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Posted</dt>
                <dd>{timeAgo(discussion.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Views</dt>
                <dd>{discussion.view_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Comments</dt>
                <dd>{discussion.comment_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Likes</dt>
                <dd>{likeCount}</dd>
              </div>
            </dl>
            {discussion.topics && (
              <div className="mt-4 border-t border-border pt-3">
                <Link
                  href={`/topics/${discussion.topics.slug}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View topic: {discussion.topics.name}
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
