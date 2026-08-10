'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Profile, DiscussionWithRelations, Badge, UserRole } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge as UIBadge } from '@/components/ui/badge';
import { DiscussionCard } from '@/components/discussion-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { MapPin, Award, Link as LinkIcon, Instagram, Mountain, Calendar, UserPlus, UserCheck } from 'lucide-react';
import { formatDate, getInitials, timeAgo } from '@/lib/helpers';
import { toast } from 'sonner';

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (profError || !prof) {
        setError('User not found.');
        setLoading(false);
        return;
      }
      setProfile(prof);

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', prof.id);
      setRoles((roleData ?? []).map((r: { role: UserRole }) => r.role));

      const { data: badgeData } = await supabase
        .from('user_badges')
        .select('badges:badges(id, name, description, icon_url, color)')
        .eq('user_id', prof.id);
      setBadges(
        (badgeData ?? [])
          .map((ub) => {
            const raw = (ub as { badges: Badge | Badge[] | null }).badges;
            return Array.isArray(raw) ? raw[0] : raw;
          })
          .filter((b): b is Badge => !!b)
      );

      const { data: discs } = await supabase
        .from('discussions')
        .select(`
          *,
          profiles:profiles!discussions_user_id_fkey(id, username, display_name, avatar_url),
          topics:topics!discussions_topic_id_fkey(id, name, slug),
          tags:discussion_tags(tag:tags(id, name, slug))
        `)
        .eq('user_id', prof.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(10);

      const formatted = (discs ?? []).map((d) => ({
        ...d,
        tags: d.tags?.map((dt: { tag: unknown[] }) => dt.tag).flat() ?? [],
      })) as DiscussionWithRelations[];
      setDiscussions(formatted);

      // Follower counts
      const { count: fc } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', prof.id);
      setFollowerCount(fc ?? 0);

      const { count: fg } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', prof.id);
      setFollowingCount(fg ?? 0);

      // Check if current user follows
      if (currentUser && currentUser.id !== prof.id) {
        const { data: followData } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', prof.id)
          .maybeSingle();
        setIsFollowing(!!followData);
      }

      setLoading(false);
    }
    load();
  }, [username, currentUser]);

  async function toggleFollow() {
    if (!currentUser || !profile) {
      toast.error('Please sign in to follow.');
      return;
    }
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', profile.id);
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: profile.id });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <div className="container mx-auto px-4 py-12"><ErrorState message={error} /></div>;
  if (!profile) return <div className="container mx-auto px-4 py-12"><ErrorState message="User not found." /></div>;

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Cover + avatar */}
      <div className="relative mb-16">
        <div className="h-40 overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-muted to-accent/10 sm:h-48">
          {profile.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.cover_image_url} alt="Cover" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="absolute -bottom-12 left-4 sm:left-6">
          <Avatar className="h-24 w-24 border-4 border-background sm:h-28 sm:w-28">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name ?? ''} />
            <AvatarFallback className="bg-primary text-2xl font-bold text-primary-foreground">
              {getInitials(profile.display_name || profile.username)}
            </AvatarFallback>
          </Avatar>
        </div>
        {isOwnProfile && (
          <div className="absolute right-4 top-4">
            <Button asChild size="sm" variant="secondary">
              <Link href="/settings">Edit Profile</Link>
            </Button>
          </div>
        )}
        {!isOwnProfile && currentUser && (
          <div className="absolute right-4 top-4">
            <Button size="sm" variant={isFollowing ? 'secondary' : 'default'} onClick={toggleFollow} className="gap-1.5">
              {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>
        )}
      </div>

      {/* Profile info */}
      <div className="mb-6 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold">{profile.display_name || profile.username}</h1>
          {roles.map((role) => (
            role !== 'member' && (
              <UIBadge key={role} variant="secondary" className="capitalize">
                {role.replace('_', ' ')}
              </UIBadge>
            )
          ))}
        </div>
        <p className="text-sm text-muted-foreground">@{profile.username}</p>

        {profile.bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed">{profile.bio}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {profile.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {profile.location}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> Joined {formatDate(profile.created_at)}
          </span>
          {profile.website_url && (
            <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground">
              <LinkIcon className="h-4 w-4" /> Website
            </a>
          )}
          {profile.instagram_handle && (
            <a href={`https://instagram.com/${profile.instagram_handle}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground">
              <Instagram className="h-4 w-4" /> {profile.instagram_handle}
            </a>
          )}
        </div>

        <div className="mt-3 flex gap-4 text-sm">
          <span><strong>{followerCount}</strong> <span className="text-muted-foreground">followers</span></span>
          <span><strong>{followingCount}</strong> <span className="text-muted-foreground">following</span></span>
        </div>
      </div>

      {/* Climbing stats */}
      {(profile.climbing_grade_max || profile.climbing_style || profile.years_climbing) && (
        <Card className="mb-6 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Mountain className="h-5 w-5 text-primary" />
            <h2 className="font-display text-base font-semibold">Climbing Stats</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {profile.climbing_grade_max && (
              <div>
                <p className="text-xs text-muted-foreground">Max Grade</p>
                <p className="mt-0.5 font-display text-lg font-bold text-primary">{profile.climbing_grade_max}</p>
              </div>
            )}
            {profile.climbing_style && (
              <div>
                <p className="text-xs text-muted-foreground">Style</p>
                <p className="mt-0.5 font-medium">{profile.climbing_style}</p>
              </div>
            )}
            {profile.years_climbing !== null && (
              <div>
                <p className="text-xs text-muted-foreground">Years Climbing</p>
                <p className="mt-0.5 font-medium">{profile.years_climbing}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <Card className="mb-6 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-accent" />
            <h2 className="font-display text-base font-semibold">Badges</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {badges.map((badge) => (
              <div key={badge.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
                  <Award className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium">{badge.name}</p>
                  {badge.description && <p className="text-xs text-muted-foreground">{badge.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent discussions */}
      <div>
        <h2 className="mb-4 font-display text-lg font-bold">Recent Discussions</h2>
        {discussions.length === 0 ? (
          <EmptyState icon={Mountain} title="No discussions yet" description="This user hasn't posted any discussions." />
        ) : (
          <div className="space-y-3">
            {discussions.map((d) => (
              <DiscussionCard key={d.id} discussion={d} showTopic />
            ))}
          </div>
        )}
      </div>

      {profile.signature && (
        <div className="mt-8 border-t border-border pt-4">
          <p className="text-xs italic text-muted-foreground">{profile.signature}</p>
        </div>
      )}
    </div>
  );
}
