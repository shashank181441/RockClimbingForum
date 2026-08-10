'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Notification, Profile } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Bell, Heart, MessageCircle, UserPlus, Award, Shield, AtSign, Check, CheckCheck, Trash2 } from 'lucide-react';
import { timeAgo, getInitials } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NotificationWithActor extends Notification {
  actor: Profile | null;
}

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
  const [notifications, setNotifications] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setNotifications([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      setError('Failed to load notifications.');
    } else {
      setNotifications((data ?? []) as NotificationWithActor[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => loadNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotifications]);

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  async function markAllAsRead() {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read.');
  }

  async function deleteNotification(id: string) {
    await supabase.from('notifications').delete().eq('id', id);
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
                    <AvatarImage src={notif.actor?.avatar_url ?? undefined} alt={notif.actor?.display_name ?? ''} />
                    <AvatarFallback className="text-xs font-bold">
                      {getInitials(notif.actor?.display_name || notif.actor?.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {notif.actor && (
                      <span className="text-sm font-medium">
                        {notif.actor.display_name || notif.actor.username}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{timeAgo(notif.created_at)}</span>
                    {!notif.is_read && (
                      <span className="ml-1 h-2 w-2 rounded-full bg-accent" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {notif.title || `New ${notif.type}`}
                    {notif.body && <span className="block text-xs">{notif.body}</span>}
                  </p>
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

