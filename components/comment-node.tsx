'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
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
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error('Please sign in to reply.');
      setSubmitting(false);
      return;
    }

    const parentPath = comment.path || '';
    const newPath = parentPath ? `${parentPath}.${comment.id}` : comment.id;
    const newDepth = (comment.depth || 0) + 1;

    const { error } = await supabase.from('comments').insert({
      discussion_id: discussionId,
      parent_id: comment.id,
      user_id: userData.user.id,
      body: replyText.trim(),
      depth: newDepth,
      path: newPath,
    });

    if (error) {
      toast.error('Failed to post reply.');
    } else {
      // Update parent reply_count
      await supabase.rpc('increment_reply_count', { comment_id: comment.id }).catch(() => {});
      // Update discussion last_activity_at
      await supabase
        .from('discussions')
        .update({ last_activity_at: new Date().toISOString(), comment_count: (await getCommentCount(discussionId)) })
        .eq('id', discussionId);
      setReplyText('');
      setShowReplyBox(false);
      onCommentAdded();
      toast.success('Reply posted!');
    }
    setSubmitting(false);
  }

  async function getCommentCount(discId: string): Promise<number> {
    const { count } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('discussion_id', discId)
      .neq('status', 'deleted');
    return count ?? 0;
  }

  async function saveEdit() {
    if (!editText.trim()) return;
    const { error } = await supabase
      .from('comments')
      .update({ body: editText.trim(), edited_at: new Date().toISOString() })
      .eq('id', comment.id);
    if (error) {
      toast.error('Failed to edit comment.');
    } else {
      setEditing(false);
      onCommentAdded();
      toast.success('Comment edited.');
    }
  }

  async function deleteComment() {
    const { error } = await supabase
      .from('comments')
      .update({ status: 'deleted' })
      .eq('id', comment.id);
    if (error) {
      toast.error('Failed to delete comment.');
    } else {
      onCommentAdded();
      toast.success('Comment deleted.');
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

  const indentDepth = Math.min(depth, MAX_INDENT_DEPTH);
  const shouldFlatten = depth >= MAX_INDENT_DEPTH;

  return (
    <div className={cn('animate-fade-in', depth > 0 && !shouldFlatten && 'ml-4 border-l border-border pl-4')}>
      <div className="py-3">
        {/* Header */}
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
                  <DropdownMenuItem
                    onClick={() => {
                      supabase.from('reports').insert({
                        reporter_id: currentUserId,
                        reportable_type: 'comment',
                        reportable_id: comment.id,
                        reason: 'Reported by user',
                      }).then(({ error }) => {
                        if (error) toast.error('Failed to report.');
                        else toast.success('Comment reported.');
                      });
                    }}
                    className="text-destructive"
                  >
                    Report
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Body */}
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

        {/* Actions */}
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

        {/* Reply box */}
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

        {/* Replies */}
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
