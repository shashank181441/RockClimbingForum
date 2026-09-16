'use client';

import { useState } from 'react';
import {
  createComment,
  createReport,
  deleteComment as apiDeleteComment,
  updateComment,
} from '@/lib/api/forum';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import type { CommentWithProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LikeButton } from '@/components/like-button';
import { timeAgo, getInitials } from '@/lib/helpers';
import { Reply, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CommentNodeProps {
  comment: CommentWithProfile;
  replies: CommentWithProfile[];
  allComments: CommentWithProfile[];
  discussionId: string;
  isLocked: boolean;
  depth: number;
  currentUserId: string | null;
  likedCommentIds: Set<string>;
  onLikeToggle: (commentId: string, isLiked: boolean, newCount: number) => void;
  onCommentAdded: () => void;
}

const MAX_INDENT_DEPTH = 6;

export function CommentNode({
  comment,
  replies,
  allComments,
  discussionId,
  isLocked,
  depth,
  currentUserId,
  likedCommentIds,
  onLikeToggle,
  onCommentAdded,
}: CommentNodeProps) {
  const { user } = useAuth();
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body);
  const [collapsed, setCollapsed] = useState(false);

  const isOwner = currentUserId === comment.user_id;
  const isHidden = comment.status === 'hidden';

  async function submitReply() {
    if (!replyText.trim()) return;
    if (!user) {
      toast.error('Please sign in to reply.');
      return;
    }
    setSubmitting(true);

    try {
      await createComment(discussionId, replyText.trim(), comment.id);
      setReplyText('');
      setShowReplyBox(false);
      onCommentAdded();
      toast.success('Reply posted!');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to post reply.');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (!editText.trim()) return;
    try {
      await updateComment(comment.id, editText.trim());
      setEditing(false);
      onCommentAdded();
      toast.success('Comment edited.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to edit comment.');
    }
  }

  async function deleteComment() {
    try {
      await apiDeleteComment(comment.id);
      onCommentAdded();
      toast.success('Comment deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete comment.');
    }
  }

  async function reportComment() {
    if (!currentUserId) return;
    try {
      await createReport({
        reportable_type: 'comment',
        reportable_id: comment.id,
        reason: 'Reported by user',
      });
      toast.success('Comment reported.');
    } catch {
      toast.error('Failed to report.');
    }
  }

  if (comment.status === 'deleted') {
    return (
      <div className={cn('py-2', depth > 0 && 'ml-4 border-l border-border pl-4')}>
        <p className="text-xs italic text-muted-foreground">[comment deleted]</p>
        {replies.length > 0 && !collapsed && (
          <div className="mt-2">
            {replies.map((reply) => {
              const replyReplies = allComments.filter((c) => c.parent_id === reply.id && c.status !== 'deleted');
              return (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  replies={replyReplies}
                  allComments={allComments}
                  discussionId={discussionId}
                  isLocked={isLocked}
                  depth={depth + 1}
                  currentUserId={currentUserId}
                  likedCommentIds={likedCommentIds}
                  onLikeToggle={onLikeToggle}
                  onCommentAdded={onCommentAdded}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const shouldFlatten = depth >= MAX_INDENT_DEPTH;

  return (
    <div className={cn('animate-fade-in', depth > 0 && !shouldFlatten && 'ml-4 border-l border-border pl-4')}>
      <div className="py-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={comment.profiles?.avatar_url ?? undefined} alt={comment.profiles?.display_name ?? ''} />
            <AvatarFallback className="text-[10px] font-bold">
              {getInitials(comment.profiles?.display_name || comment.profiles?.username)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium">
            {comment.profiles?.display_name || comment.profiles?.username || 'Unknown'}
          </span>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
          {comment.edited_at && <span className="text-xs text-muted-foreground">(edited)</span>}
          {isHidden && <span className="text-xs text-muted-foreground">· hidden</span>}

          {replies.length > 0 && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {collapsed ? `[+] ${replies.length} replies` : '[−]'}
            </button>
          )}

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner && !isLocked && (
                  <>
                    <DropdownMenuItem onClick={() => setEditing(true)}>
                      <Edit2 className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={deleteComment} className="text-destructive">
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
                {!isOwner && (
                  <DropdownMenuItem onClick={reportComment} className="text-destructive">
                    Report
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditText(comment.body); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 whitespace-pre-wrap text-sm">{comment.body}</div>
        )}

        <div className="mt-2 flex items-center gap-2">
          <LikeButton
            likeableType="comment"
            likeableId={comment.id}
            likeCount={comment.like_count}
            isLiked={likedCommentIds.has(comment.id)}
            onToggle={(isLiked, newCount) => onLikeToggle(comment.id, isLiked, newCount)}
            size="sm"
          />
          {!isLocked && (
            <button
              onClick={() => setShowReplyBox(!showReplyBox)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Reply className="h-3.5 w-3.5" /> Reply
            </button>
          )}
        </div>

        {showReplyBox && (
          <div className="mt-3 space-y-2 animate-slide-in">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              rows={3}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={submitReply} disabled={submitting || !replyText.trim()}>
                {submitting ? 'Posting...' : 'Reply'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowReplyBox(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {replies.length > 0 && !collapsed && (
          <div className="mt-1">
            {replies.map((reply) => {
              const replyReplies = allComments.filter((c) => c.parent_id === reply.id && c.status !== 'deleted');
              return (
                <CommentNode
                  key={reply.id}
                  comment={reply}
                  replies={replyReplies}
                  allComments={allComments}
                  discussionId={discussionId}
                  isLocked={isLocked}
                  depth={depth + 1}
                  currentUserId={currentUserId}
                  likedCommentIds={likedCommentIds}
                  onLikeToggle={onLikeToggle}
                  onCommentAdded={onCommentAdded}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
