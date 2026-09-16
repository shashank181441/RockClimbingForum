'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  banUser as apiBanUser,
  hideComment as apiHideComment,
  hideDiscussion as apiHideDiscussion,
  listModerationReports,
  resolveReport,
} from '@/lib/api/forum';
import { ApiError } from '@/lib/api/client';
import { adaptProfile } from '@/lib/api/adapters';
import { useAuth } from '@/lib/auth-context';
import type { Report, Profile } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, LoadingState } from '@/components/states';
import { Shield, Flag, EyeOff, Trash2, Ban, Check, X, ScrollText, AlertTriangle } from 'lucide-react';
import { timeAgo } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

interface ReportWithRelations extends Report {
  reporter: Profile | null;
}

function adaptReport(raw: unknown): ReportWithRelations {
  const r = (raw || {}) as Record<string, unknown>;
  const reporterRaw = r.reporter as Record<string, unknown> | undefined;
  return {
    id: String(r.id ?? ''),
    reporter_id: String(r.reporter_id ?? ''),
    reportable_type: String(r.reportable_type ?? ''),
    reportable_id: String(r.reportable_id ?? ''),
    reason: String(r.reason ?? ''),
    status: (r.status as Report['status']) || 'pending',
    resolved_by: r.resolved_by != null ? String(r.resolved_by) : null,
    resolution_note: (r.resolution_note as string | null) ?? null,
    created_at: String(r.created_at ?? ''),
    resolved_at: (r.resolved_at as string | null) ?? null,
    reporter: reporterRaw ? adaptProfile(reporterRaw) : null,
  };
}

export default function ModerationPage() {
  const router = useRouter();
  const { user, roles, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<ReportWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'resolved' | 'logs'>('pending');

  const isMod = roles.includes('admin') || roles.includes('moderator');

  const loadData = useCallback(async () => {
    if (!user || !isMod) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const rows = await listModerationReports();
      const all = (rows || []).map(adaptReport);
      if (tab === 'pending') {
        setReports(all.filter((r) => r.status === 'pending'));
      } else if (tab === 'resolved') {
        setReports(all.filter((r) => r.status === 'resolved' || r.status === 'dismissed'));
      } else {
        setReports([]);
      }
    } catch {
      toast.error('Failed to load reports.');
      setReports([]);
    } finally {
      setLoading(false);
    }
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

  async function handleResolve(reportId: string, action: 'resolved' | 'dismissed') {
    try {
      await resolveReport(reportId, action);
      toast.success(`Report ${action}.`);
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to resolve report.');
    }
  }

  async function handleHideDiscussion(discussionId: string, reportId: string) {
    try {
      await apiHideDiscussion(discussionId);
      await resolveReport(reportId, 'resolved');
      toast.success('Discussion hidden.');
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to hide discussion.');
    }
  }

  async function handleHideComment(commentId: string, reportId: string) {
    try {
      await apiHideComment(commentId);
      await resolveReport(reportId, 'resolved');
      toast.success('Comment hidden.');
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to hide comment.');
    }
  }

  async function handleBanUser(userId: string, reportId: string) {
    try {
      await apiBanUser(userId, 'Banned via moderation dashboard');
      await resolveReport(reportId, 'resolved');
      toast.success('User banned.');
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to ban user.');
    }
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
        <EmptyState
          icon={ScrollText}
          title="No action log endpoint"
          description="Moderation actions are applied via the API; a dedicated log feed is not available yet."
        />
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
              onHideDiscussion={(id) => handleHideDiscussion(id, report.id)}
              onDeleteDiscussion={(id) => handleHideDiscussion(id, report.id)}
              onHideComment={(id) => handleHideComment(id, report.id)}
              onBanUser={(id) => handleBanUser(id, report.id)}
              onResolve={() => handleResolve(report.id, 'resolved')}
              onDismiss={() => handleResolve(report.id, 'dismissed')}
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
            {report.reporter?.username ? (
              <Link href={`/u/${report.reporter.username}`} className="font-medium hover:text-primary">
                @{report.reporter.username}
              </Link>
            ) : (
              <span className="font-medium">unknown</span>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Reason: {report.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Target ID: {report.reportable_id}
          </p>

          {report.status === 'pending' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {report.reportable_type === 'discussion' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => onHideDiscussion(report.reportable_id)} className="gap-1.5">
                    <EyeOff className="h-3.5 w-3.5" /> Hide
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDeleteDiscussion(report.reportable_id)} className="gap-1.5 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </>
              )}
              {report.reportable_type === 'comment' && (
                <Button size="sm" variant="outline" onClick={() => onHideComment(report.reportable_id)} className="gap-1.5">
                  <EyeOff className="h-3.5 w-3.5" /> Hide Comment
                </Button>
              )}
              {report.reportable_type === 'user' && (
                <Button size="sm" variant="outline" onClick={() => onBanUser(report.reportable_id)} className="gap-1.5 text-destructive">
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
