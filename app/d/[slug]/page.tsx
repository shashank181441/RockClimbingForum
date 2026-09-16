'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createComment,
  createReport,
  getDiscussion,
  listBookmarks,
  listComments,
  toggleBookmark as apiToggleBookmark,
} from '@/lib/api/forum';
import { ApiError, mediaUrl } from '@/lib/api/client';
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
import { ChevronRight, Lock, Pin, Eye, MessageCircle, Bookmark, BookmarkCheck, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const IMAGE_URL_RE = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif)(?:\?\S*)?$/i;

function extractBodyAndImages(body: string | null): { text: string; images: string[] } {
  if (!body) return { text: '', images: [] };
  const lines = body.split('\n');
  const images: string[] = [];
  const textLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (IMAGE_URL_RE.test(trimmed)) {
      images.push(trimmed);
    } else {
      textLines.push(line);
    }
  }
  return { text: textLines.join('\n').trimEnd(), images };
}

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
  const [bodyText, setBodyText] = useState('');

  const loadComments = useCallback(async (discId: string) => {
    const comms = await listComments(discId);
    setComments(comms);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const disc = await getDiscussion(slug);
      setDiscussion(disc);
      setLikeCount(disc.like_count);

      const { text, images } = extractBodyAndImages(disc.body);
      setBodyText(text);
      setAttachments(
        images.map((url, i) => ({
          id: `embed-${i}`,
          uploader_id: disc.user_id,
          storage_path: url,
          file_url: mediaUrl(url) || url,
          thumbnail_url: mediaUrl(url) || url,
          file_type: 'image',
          attachable_type: 'discussion' as const,
          attachable_id: disc.id,
          created_at: disc.created_at,
        }))
      );

      try {
        await loadComments(disc.id);
      } catch {
        setComments([]);
      }
    } catch {
      setError('Discussion not found.');
    } finally {
      setLoading(false);
    }
  }, [slug, loadComments]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only slug
  }, [slug]);

  useEffect(() => {
    if (!user || !discussion) return;
    let cancelled = false;
    (async () => {
      try {
        const bookmarks = await listBookmarks();
        if (!cancelled) {
          setIsBookmarked(bookmarks.some((d) => d.id === discussion.id));
        }
      } catch {
        /* ignore */
      }
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

    try {
      await createComment(discussion.id, newComment.trim());
      setNewComment('');
      await loadComments(discussion.id);
      setDiscussion((prev) =>
        prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev
      );
      toast.success('Comment posted!');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to post comment.');
    } finally {
      setSubmittingComment(false);
    }
  }

  async function toggleBookmark() {
    if (!user || !discussion) {
      toast.error('Please sign in to bookmark.');
      return;
    }
    try {
      const result = await apiToggleBookmark(discussion.id);
      setIsBookmarked(result.bookmarked);
      toast.success(result.bookmarked ? 'Added to bookmarks.' : 'Removed from bookmarks.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update bookmark.');
    }
  }

  async function reportDiscussion() {
    if (!user || !discussion) return;
    try {
      await createReport({
        reportable_type: 'discussion',
        reportable_id: discussion.id,
        reason: 'Reported by user',
      });
      toast.success('Discussion reported.');
    } catch {
      toast.error('Failed to report.');
    }
  }

  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  if (loading) return <LoadingState text="Loading discussion..." />;
  if (error) return <div className="container mx-auto px-4 py-12"><ErrorState message={error} /></div>;
  if (!discussion) return <div className="container mx-auto px-4 py-12"><ErrorState message="Discussion not found." /></div>;

  const isLocked = discussion.is_locked;

  return (
    <div className="container mx-auto px-4 py-8">
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
        <div className="lg:col-span-3">
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

            {bodyText && (
              <div className="prose-climbing mt-4 text-sm leading-relaxed sm:text-base">
                {bodyText.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}

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

          <div className="mt-6">
            <h2 className="mb-4 font-display text-lg font-bold">
              {discussion.comment_count} {discussion.comment_count === 1 ? 'Comment' : 'Comments'}
            </h2>

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
