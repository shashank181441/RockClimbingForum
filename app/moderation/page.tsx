'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Report, Profile, Discussion, Comment, ModerationLog } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Shield, Flag, EyeOff, Trash2, Ban, Check, X, ScrollText, AlertTriangle } from 'lucide-react';
import { timeAgo, getInitials } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

interface ReportWithRelations extends Report {
  reporter: Profile | null;
}

export default function ModerationPage() {
  const router = useRouter();
  const { user, roles, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<ReportWithRelations[]>([]);
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'resolved' | 'logs'>('pending');

  const isMod = roles.includes('admin') || roles.includes('moderator');

  const loadData = useCallback(async () => {
    if (!user || !isMod) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const statusFilter = tab === 'pending' ? 'pending' : tab === 'resolved' ? 'resolved' : 'pending';
    const { data: reportsData, error: reportsError } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:profiles!reports_reporter_id_fkey(id, username, display_name, avatar_url)
      `)
      .eq('status', statusFilter)
      .order('created_at', { ascending: false })
      .limit(50);

    if (reportsError) {
      setError('Failed to load reports.');
    } else {
      setReports((reportsData ?? []) as ReportWithRelations[]);
    }

    if (tab === 'logs') {
      const { data: logsData } = await supabase
        .from('moderation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setLogs(logsData ?? []);
    }

    setLoading(false);
  }, [user, isMod, tab]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!authLoading && user && !isMod) {
      router.push('/');
    }
  }, [user, isMod, authLoading, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function resolveReport(reportId: string, action: 'resolved' | 'dismissed', note?: string) {
    if (!user) return;
    const { error } = await supabase
      .from('reports')
      .update({
        status: action,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: note ?? `Action: ${action}`,
      })
      .eq('id', reportId);

    if (error) {
      toast.error('Failed to resolve report.');
      return;
    }

    await supabase.from('moderation_logs').insert({
      moderator_id: user.id,
      action,
      target_type: 'report',
      target_id: reportId,
      note: note ?? `Report ${action}`,
    });

    toast.success(`Report ${action}.`);
    loadData();
  }

  async function hideDiscussion(discussionId: string, reportId: string) {
    if (!user) return;
    await supabase.from('discussions').update({ status: 'hidden' }).eq('id', discussionId);
    await supabase.from('moderation_logs').insert({
      moderator_id: user.id,
      action: 'hide',
      target_type: 'discussion',
      target_id: discussionId,
    });
    await resolveReport(reportId, 'resolved', 'Discussion hidden');
    toast.success('Discussion hidden.');
  }

  async function deleteDiscussion(discussionId: string, reportId: string) {
    if (!user) return;
    await supabase.from('discussions').update({ status: 'deleted' }).eq('id', discussionId);
    await supabase.from('moderation_logs').insert({
      moderator_id: user.id,
      action: 'delete',
      target_type: 'discussion',
      target_id: discussionId,
    });
    await resolveReport(reportId, 'resolved', 'Discussion deleted');
    toast.success('Discussion deleted.');
  }

  async function hideComment(commentId: string, reportId: string) {
    if (!user) return;
    await supabase.from('comments').update({ status: 'hidden' }).eq('id', commentId);
    await supabase.from('moderation_logs').insert({
      moderator_id: user.id,
      action: 'hide',
      target_type: 'comment',
      target_id: commentId,
    });
    await resolveReport(reportId, 'resolved', 'Comment hidden');
    toast.success('Comment hidden.');
  }

  async function banUser(userId: string, reportId: string) {
    if (!user) return;
    await supabase.from('bans').insert({
      user_id: userId,
      banned_by: user.id,
      reason: 'Banned via moderation dashboard',
    });
    await supabase.from('moderation_logs').insert({
      moderator_id: user.id,
      action: 'ban',
      target_type: 'user',
      target_id: userId,
    });
    await resolveReport(reportId, 'resolved', 'User banned');
    toast.success('User banned.');
  }

  if (authLoading) return <LoadingState />;
  if (!user || !isMod) return null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Moderation Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage reports and moderation actions.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border p-1">
        {[
          { key: 'pending', label: 'Pending' },
          { key: 'resolved', label: 'Resolved' },
          { key: 'logs', label: 'Action Log' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'pending' | 'resolved' | 'logs')}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : tab === 'logs' ? (
        logs.length === 0 ? (
          <EmptyState icon={ScrollText} title="No actions logged" />
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <Card key={log.id} className="flex items-center gap-3 p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">{log.action} {log.target_type}</p>
                  {log.note && <p className="text-xs text-muted-foreground">{log.note}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{timeAgo(log.created_at)}</span>
              </Card>
            ))}
          </div>
        )
      ) : reports.length === 0 ? (
        <EmptyState
          icon={tab === 'pending' ? Check : Flag}
          title={tab === 'pending' ? 'No pending reports' : 'No resolved reports'}
          description={tab === 'pending' ? 'All clear! No reports need attention.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onHideDiscussion={(id) => hideDiscussion(id, report.id)}
              onDeleteDiscussion={(id) => deleteDiscussion(id, report.id)}
              onHideComment={(id) => hideComment(id, report.id)}
              onBanUser={(id) => banUser(id, report.id)}
              onResolve={() => resolveReport(report.id, 'resolved')}
              onDismiss={() => resolveReport(report.id, 'dismissed')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  report,
  onHideDiscussion,
  onDeleteDiscussion,
  onHideComment,
  onBanUser,
  onResolve,
  onDismiss,
}: {
  report: ReportWithRelations;
  onHideDiscussion: (id: string) => void;
  onDeleteDiscussion: (id: string) => void;
  onHideComment: (id: string) => void;
  onBanUser: (userId: string) => void;
  onResolve: () => void;
  onDismiss: () => void;
}) {
  const [targetInfo, setTargetInfo] = useState<{ title?: string; body?: string; username?: string; userId?: string } | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(true);

  useEffect(() => {
    async function loadTarget() {
      if (report.reportable_type === 'discussion') {
        const { data } = await supabase
          .from('discussions')
          .select('title, body, user_id, profiles:profiles!discussions_user_id_fkey(username)')
          .eq('id', report.reportable_id)
          .maybeSingle();
        if (data) {
          const d = data as unknown as { title: string; body: string | null; user_id: string; profiles: Profile | null };
          setTargetInfo({
            title: d.title,
            body: d.body ?? undefined,
            username: d.profiles?.username ?? undefined,
            userId: d.user_id,
          });
        }
      } else if (report.reportable_type === 'comment') {
        const { data } = await supabase
          .from('comments')
          .select('body, user_id, profiles:profiles!comments_user_id_fkey(username)')
          .eq('id', report.reportable_id)
          .maybeSingle();
        if (data) {
          const d = data as unknown as { body: string; user_id: string; profiles: Profile | null };
          setTargetInfo({
            body: d.body,
            username: d.profiles?.username ?? undefined,
            userId: d.user_id,
          });
        }
      }
      setLoadingTarget(false);
    }
    loadTarget();
  }, [report]);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">{report.reportable_type}</Badge>
            <Badge variant={report.status === 'pending' ? 'default' : 'outline'} className="capitalize">
              {report.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{timeAgo(report.created_at)}</span>
          </div>

          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Reported by </span>
            <Link href={`/u/${report.reporter?.username}`} className="font-medium hover:text-primary">
              @{report.reporter?.username}
            </Link>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Reason: {report.reason}</p>

          {loadingTarget ? (
            <div className="mt-2 h-12 animate-pulse rounded bg-muted" />
          ) : targetInfo ? (
            <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
              {targetInfo.title && <p className="text-sm font-medium">{targetInfo.title}</p>}
              {targetInfo.body && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{targetInfo.body}</p>}
              {targetInfo.username && (
                <p className="mt-1 text-xs text-muted-foreground">by @{targetInfo.username}</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs italic text-muted-foreground">Target content not found (may be deleted).</p>
          )}

          {/* Actions */}
          {report.status === 'pending' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {report.reportable_type === 'discussion' && targetInfo && (
                <>
                  <Button size="sm" variant="outline" onClick={() => onHideDiscussion(report.reportable_id)} className="gap-1.5">
                    <EyeOff className="h-3.5 w-3.5" /> Hide
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDeleteDiscussion(report.reportable_id)} className="gap-1.5 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </>
              )}
              {report.reportable_type === 'comment' && targetInfo && (
                <Button size="sm" variant="outline" onClick={() => onHideComment(report.reportable_id)} className="gap-1.5">
                  <EyeOff className="h-3.5 w-3.5" /> Hide Comment
                </Button>
              )}
              {targetInfo?.userId && (
                <Button size="sm" variant="outline" onClick={() => onBanUser(targetInfo.userId!)} className="gap-1.5 text-destructive">
                  <Ban className="h-3.5 w-3.5" /> Ban User
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onResolve} className="gap-1.5">
                <Check className="h-3.5 w-3.5" /> Resolve
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> Dismiss
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
