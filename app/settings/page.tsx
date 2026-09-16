'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile, uploadImage as apiUploadImage } from '@/lib/api/forum';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ImagePlus, X, Save, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { getInitials } from '@/lib/helpers';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [climbingGradeMax, setClimbingGradeMax] = useState('');
  const [climbingStyle, setClimbingStyle] = useState('');
  const [yearsClimbing, setYearsClimbing] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [signature, setSignature] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    email_notifications: true,
    push_notifications: true,
    notify_on_reply: true,
    notify_on_like: true,
    notify_on_follow: true,
    notify_on_mention: true,
    notify_on_moderation: true,
  });

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
      setLocation(profile.location ?? '');
      setClimbingGradeMax(profile.climbing_grade_max ?? '');
      setClimbingStyle(profile.climbing_style ?? '');
      setYearsClimbing(profile.years_climbing?.toString() ?? '');
      setWebsiteUrl(profile.website_url ?? '');
      setInstagramHandle(profile.instagram_handle ?? '');
      setSignature(profile.signature ?? '');
      setAvatarPreview(profile.avatar_url);
      setCoverPreview(profile.cover_image_url);
    }
  }, [profile]);

  async function handleSave() {
    if (!user || !profile) return;
    setSaving(true);

    let avatarUrl = profile.avatar_url;
    let coverUrl = profile.cover_image_url;

    try {
      if (avatarFile) {
        const uploaded = await apiUploadImage(avatarFile);
        avatarUrl = uploaded.url;
      }
      if (coverFile) {
        const uploaded = await apiUploadImage(coverFile);
        coverUrl = uploaded.url;
      }

      await updateProfile({
        display_name: displayName || null,
        bio: bio || null,
        location: location || null,
        climbing_grade_max: climbingGradeMax || null,
        climbing_style: climbingStyle || null,
        years_climbing: yearsClimbing ? parseInt(yearsClimbing, 10) : null,
        website_url: websiteUrl || null,
        instagram_handle: instagramHandle || null,
        signature: signature || null,
        avatar_url: avatarUrl,
        cover_image_url: coverUrl,
        theme: theme ?? null,
      });

      await refreshProfile();
      toast.success('Profile saved!');
      // Notification prefs UI kept; no backend endpoint yet
      void settings;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold sm:text-3xl">Settings</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-display text-lg">Profile</CardTitle>
          <CardDescription>Update your public profile information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-4">
            <div>
              <Label>Avatar</Label>
              <div className="mt-2 flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarPreview ?? undefined} alt="Avatar" />
                  <AvatarFallback className="text-lg font-bold">
                    {getInitials(displayName || profile?.username)}
                  </AvatarFallback>
                </Avatar>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:border-primary hover:bg-muted">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setAvatarFile(f);
                        setAvatarPreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                  <ImagePlus className="h-4 w-4" /> Choose image
                </label>
                {avatarFile && (
                  <button onClick={() => { setAvatarFile(null); setAvatarPreview(profile?.avatar_url ?? null); }}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <Label>Cover Image</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="h-16 w-28 overflow-hidden rounded-lg border border-border bg-muted">
                  {coverPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreview} alt="Cover" className="h-full w-full object-cover" />
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:border-primary hover:bg-muted">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setCoverFile(f);
                        setCoverPreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                  <ImagePlus className="h-4 w-4" /> Choose image
                </label>
                {coverFile && (
                  <button onClick={() => { setCoverFile(null); setCoverPreview(profile?.cover_image_url ?? null); }}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Boulder, CO" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell the community about yourself..." maxLength={500} />
            <p className="text-xs text-muted-foreground">{bio.length}/500 characters</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="grade">Max Grade</Label>
              <Input id="grade" value={climbingGradeMax} onChange={(e) => setClimbingGradeMax(e.target.value)} placeholder="V8 / 5.12c" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="style">Climbing Style</Label>
              <Input id="style" value={climbingStyle} onChange={(e) => setClimbingStyle(e.target.value)} placeholder="Bouldering, Trad..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="years">Years Climbing</Label>
              <Input id="years" type="number" value={yearsClimbing} onChange={(e) => setYearsClimbing(e.target.value)} placeholder="5" min="0" max="80" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram Handle</Label>
              <Input id="instagram" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="climber123" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signature">Signature</Label>
            <Input id="signature" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Appears at the bottom of your posts" maxLength={200} />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-display text-lg">Appearance</CardTitle>
          <CardDescription>Choose your preferred theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                  theme === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                )}
              >
                <opt.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-display text-lg">Notifications</CardTitle>
          <CardDescription>
            Preference toggles are kept for the UI; saving currently updates your profile only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'notify_on_reply', label: 'Replies to your posts' },
            { key: 'notify_on_like', label: 'Likes on your content' },
            { key: 'notify_on_follow', label: 'New followers' },
            { key: 'notify_on_mention', label: 'Mentions' },
            { key: 'notify_on_moderation', label: 'Moderation actions' },
            { key: 'email_notifications', label: 'Email notifications' },
            { key: 'push_notifications', label: 'Push notifications' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <Label htmlFor={item.key} className="text-sm">{item.label}</Label>
              <Switch
                id={item.key}
                checked={settings[item.key as keyof typeof settings]}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, [item.key]: checked }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
