'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getProfile, listDiscussions, toggleFollow } from '@/lib/api/forum';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import type { Profile, DiscussionWithRelations, Badge, UserRole } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge as UIBadge } from '@/components/ui/badge';
import { DiscussionCard } from '@/components/discussion-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { MapPin, Award, Link as LinkIcon, Instagram, Mountain, Calendar, UserPlus, UserCheck } from 'lucide-react';
import { formatDate, getInitials } from '@/lib/helpers';
import { toast } from 'sonner';

function adaptBadges(raw: unknown[]): Badge[] {
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const b = item as Record<string, unknown>;
      return {
        id: String(b.id ?? ''),
        name: String(b.name ?? ''),
        description: (b.description as string | null) ?? null,
        icon_url: (b.icon_url as string | null) ?? null,
        color: (b.color as string | null) ?? null,
      } satisfies Badge;
    })
    .filter((b): b is Badge => !!b && !!b.id);
}

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
      try {
        const data = await getProfile(username);
        if (!data.profile) {
          setError('User not found.');
          setLoading(false);
          return;
        }
        setProfile(data.profile);
        setBadges(adaptBadges(data.badges));
        setRoles([]);

        const { data: discs } = await listDiscussions({
          user_id: data.profile.id,
          per_page: 10,
        });
        setDiscussions(discs);
        setFollowerCount(0);
        setFollowingCount(0);
        setIsFollowing(false);
      } catch {
        setError('User not found.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username, currentUser]);

  async function handleToggleFollow() {
    if (!currentUser || !profile) {
      toast.error('Please sign in to follow.');
      return;
    }
    try {
      const result = await toggleFollow(profile.id);
      setIsFollowing(result.following);
      setFollowerCount((c) => Math.max(0, result.following ? c + 1 : c - 1));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update follow.');
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <div className="container mx-auto px-4 py-12"><ErrorState message={error} /></div>;
  if (!profile) return <div className="container mx-auto px-4 py-12"><ErrorState message="User not found." /></div>;

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
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
            <Button size="sm" variant={isFollowing ? 'secondary' : 'default'} onClick={handleToggleFollow} className="gap-1.5">
              {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>
        )}
      </div>

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
