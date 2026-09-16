'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  deleteNotification as apiDeleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/forum';
import { useAuth } from '@/lib/auth-context';
import type { Notification } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Bell, Heart, MessageCircle, UserPlus, Award, Shield, AtSign, Check, CheckCheck, Trash2 } from 'lucide-react';
import { timeAgo, getInitials } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  reply: MessageCircle,
  like: Heart,
  follow: UserPlus,
  badge: Award,
  moderation: Shield,
  mention: AtSign,
  system: Bell,
};

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) {
      setLoading(false);
      setNotifications([]);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const data = await listNotifications();
      setNotifications(data);
      setError(null);
    } catch {
      setError('Failed to load notifications.');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      void loadNotifications({ silent: true });
    }, 60_000);
    return () => clearInterval(interval);
  }, [user?.id, loadNotifications]);

  async function markAsRead(id: string) {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  async function markAllAsRead() {
    if (!user) return;
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read.');
  }

  async function deleteNotification(id: string) {
    await apiDeleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  if (authLoading) return <LoadingState />;
  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1.5">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="You'll see replies, likes, and other activity here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = iconMap[notif.type] ?? Bell;
            return (
              <Card
                key={notif.id}
                className={cn(
                  'flex items-start gap-3 p-4 transition-colors',
                  !notif.is_read && 'border-l-4 border-l-primary bg-primary/5'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-xs font-bold">
                      {getInitials(notif.title || notif.type)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {notif.title || `New ${notif.type}`}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(notif.created_at)}</span>
                    {!notif.is_read && (
                      <span className="ml-1 h-2 w-2 rounded-full bg-accent" />
                    )}
                  </div>
                  {notif.body && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{notif.body}</p>
                  )}
                  {notif.url && (
                    <Link href={notif.url} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                      View
                    </Link>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!notif.is_read && (
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notif.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
