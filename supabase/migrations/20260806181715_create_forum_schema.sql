/*
# Create Rock Climbing Forum Schema

1. Overview
Complete schema for a rock climbing discussion forum: profiles, user settings/roles/badges,
categories, topics, discussions, comments, attachments, likes, bookmarks, follows, reports,
moderation logs, bans, and notifications.

2. New Tables
- profiles, user_settings, user_roles, badges, user_badges
- categories, topics, topic_rules
- discussions, tags, discussion_tags
- comments (nested via parent_id, depth, path)
- attachments (images in storage bucket 'forum-images')
- likes, bookmarks, follows, reports, moderation_logs, bans, notifications

3. Security
- RLS enabled on ALL tables.
- Public read on content tables; owner-scoped writes; admin/moderator for moderation.
- Storage bucket 'forum-images' public read, authed insert, owner delete.
- Profile auto-creates on signup via trigger handle_new_user.
*/

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'verified_guide', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discussion_status AS ENUM ('open', 'closed', 'hidden', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE comment_status AS ENUM ('visible', 'hidden', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE likeable_type AS ENUM ('discussion', 'comment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('pending', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('reply', 'like', 'follow', 'badge', 'moderation', 'mention', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attachable_type AS ENUM ('discussion', 'comment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  bio text,
  avatar_url text,
  cover_image_url text,
  location text,
  climbing_grade_max text,
  climbing_style text,
  years_climbing integer,
  website_url text,
  instagram_handle text,
  signature text,
  theme text DEFAULT 'system',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- USER SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  notify_on_reply boolean DEFAULT true,
  notify_on_like boolean DEFAULT true,
  notify_on_follow boolean DEFAULT true,
  notify_on_mention boolean DEFAULT true,
  notify_on_moderation boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_owner_read" ON user_settings;
CREATE POLICY "settings_owner_read" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_owner_update" ON user_settings;
CREATE POLICY "settings_owner_update" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "settings_owner_insert" ON user_settings;
CREATE POLICY "settings_owner_insert" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- USER ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_public_read" ON user_roles;
CREATE POLICY "roles_public_read" ON user_roles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "roles_admin_write" ON user_roles;
CREATE POLICY "roles_admin_write" ON user_roles FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- ============================================================
-- BADGES
-- ============================================================
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon_url text,
  color text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "badges_public_read" ON badges;
CREATE POLICY "badges_public_read" ON badges FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "badges_admin_write" ON badges;
CREATE POLICY "badges_admin_write" ON badges FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- ============================================================
-- USER BADGES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_badges (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_badges_public_read" ON user_badges;
CREATE POLICY "user_badges_public_read" ON user_badges FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "user_badges_self_insert" ON user_badges;
CREATE POLICY "user_badges_self_insert" ON user_badges FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_badges_admin_delete" ON user_badges;
CREATE POLICY "user_badges_admin_delete" ON user_badges FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon_url text,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_admin_write" ON categories;
CREATE POLICY "categories_admin_write" ON categories FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- ============================================================
-- TOPICS
-- ============================================================
CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  banner_image_url text,
  is_locked boolean DEFAULT false,
  is_private boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topics_public_read" ON topics;
CREATE POLICY "topics_public_read" ON topics FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "topics_admin_write" ON topics;
CREATE POLICY "topics_admin_write" ON topics FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- ============================================================
-- TOPIC RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS topic_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE topic_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rules_public_read" ON topic_rules;
CREATE POLICY "rules_public_read" ON topic_rules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "rules_admin_write" ON topic_rules;
CREATE POLICY "rules_admin_write" ON topic_rules FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- ============================================================
-- DISCUSSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  body text,
  status discussion_status DEFAULT 'open',
  is_pinned boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  view_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  like_count integer DEFAULT 0,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discussions_public_read" ON discussions;
CREATE POLICY "discussions_public_read" ON discussions FOR SELECT
  TO anon, authenticated USING (status <> 'deleted');

DROP POLICY IF EXISTS "discussions_authed_insert" ON discussions;
CREATE POLICY "discussions_authed_insert" ON discussions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "discussions_owner_mod_update" ON discussions;
CREATE POLICY "discussions_owner_mod_update" ON discussions FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  ) WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

DROP POLICY IF EXISTS "discussions_owner_mod_delete" ON discussions;
CREATE POLICY "discussions_owner_mod_delete" ON discussions FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- ============================================================
-- TAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_public_read" ON tags;
CREATE POLICY "tags_public_read" ON tags FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "tags_authed_insert" ON tags;
CREATE POLICY "tags_authed_insert" ON tags FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- DISCUSSION TAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS discussion_tags (
  discussion_id uuid REFERENCES discussions(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (discussion_id, tag_id)
);
ALTER TABLE discussion_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dt_public_read" ON discussion_tags;
CREATE POLICY "dt_public_read" ON discussion_tags FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "dt_authed_insert" ON discussion_tags;
CREATE POLICY "dt_authed_insert" ON discussion_tags FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM discussions d WHERE d.id = discussion_id AND d.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "dt_owner_delete" ON discussion_tags;
CREATE POLICY "dt_owner_delete" ON discussion_tags FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM discussions d WHERE d.id = discussion_id AND d.user_id = auth.uid())
  );

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid REFERENCES discussions(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  depth integer DEFAULT 0,
  path text DEFAULT '',
  like_count integer DEFAULT 0,
  reply_count integer DEFAULT 0,
  status comment_status DEFAULT 'visible',
  edited_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_public_read" ON comments;
CREATE POLICY "comments_public_read" ON comments FOR SELECT
  TO anon, authenticated USING (status <> 'deleted');

DROP POLICY IF EXISTS "comments_authed_insert" ON comments;
CREATE POLICY "comments_authed_insert" ON comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_owner_mod_update" ON comments;
CREATE POLICY "comments_owner_mod_update" ON comments FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  ) WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

DROP POLICY IF EXISTS "comments_owner_mod_delete" ON comments;
CREATE POLICY "comments_owner_delete" ON comments FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- ============================================================
-- ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_url text NOT NULL,
  thumbnail_url text,
  file_type text,
  attachable_type attachable_type,
  attachable_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_public_read" ON attachments;
CREATE POLICY "attachments_public_read" ON attachments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "attachments_authed_insert" ON attachments;
CREATE POLICY "attachments_authed_insert" ON attachments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = uploader_id);

DROP POLICY IF EXISTS "attachments_owner_mod_delete" ON attachments;
CREATE POLICY "attachments_owner_mod_delete" ON attachments FOR DELETE
  TO authenticated USING (
    auth.uid() = uploader_id OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- ============================================================
-- LIKES
-- ============================================================
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type_id text DEFAULT 'like',
  likeable_type likeable_type NOT NULL,
  likeable_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, likeable_type, likeable_id)
);
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_public_read" ON likes;
CREATE POLICY "likes_public_read" ON likes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "likes_authed_insert" ON likes;
CREATE POLICY "likes_authed_insert" ON likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "likes_owner_delete" ON likes;
CREATE POLICY "likes_owner_delete" ON likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- BOOKMARKS
-- ============================================================
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  discussion_id uuid REFERENCES discussions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, discussion_id)
);
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookmarks_owner_read" ON bookmarks;
CREATE POLICY "bookmarks_owner_read" ON bookmarks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookmarks_owner_insert" ON bookmarks;
CREATE POLICY "bookmarks_owner_insert" ON bookmarks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookmarks_owner_delete" ON bookmarks;
CREATE POLICY "bookmarks_owner_delete" ON bookmarks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- FOLLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_public_read" ON follows;
CREATE POLICY "follows_public_read" ON follows FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "follows_authed_insert" ON follows;
CREATE POLICY "follows_authed_insert" ON follows FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_owner_delete" ON follows;
CREATE POLICY "follows_owner_delete" ON follows FOR DELETE
  TO authenticated USING (auth.uid() = follower_id);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reportable_type text NOT NULL,
  reportable_id uuid NOT NULL,
  reason text NOT NULL,
  status report_status DEFAULT 'pending',
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_authed_insert" ON reports;
CREATE POLICY "reports_authed_insert" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_mod_read" ON reports;
CREATE POLICY "reports_mod_read" ON reports FOR SELECT
  TO authenticated USING (
    auth.uid() = reporter_id OR
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

DROP POLICY IF EXISTS "reports_mod_update" ON reports;
CREATE POLICY "reports_mod_update" ON reports FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- ============================================================
-- MODERATION LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "modlogs_mod_read" ON moderation_logs;
CREATE POLICY "modlogs_mod_read" ON moderation_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

DROP POLICY IF EXISTS "modlogs_mod_insert" ON moderation_logs;
CREATE POLICY "modlogs_mod_insert" ON moderation_logs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- ============================================================
-- BANS
-- ============================================================
CREATE TABLE IF NOT EXISTS bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bans_mod_read" ON bans;
CREATE POLICY "bans_mod_read" ON bans FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

DROP POLICY IF EXISTS "bans_admin_insert" ON bans;
CREATE POLICY "bans_admin_insert" ON bans FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

DROP POLICY IF EXISTS "bans_admin_delete" ON bans;
CREATE POLICY "bans_admin_delete" ON bans FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type notification_type NOT NULL,
  title text,
  body text,
  url text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifs_owner_read" ON notifications;
CREATE POLICY "notifs_owner_read" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifs_owner_update" ON notifications;
CREATE POLICY "notifs_owner_update" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifs_owner_delete" ON notifications;
CREATE POLICY "notifs_owner_delete" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifs_authed_insert" ON notifications;
CREATE POLICY "notifs_authed_insert" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username text;
  new_username text;
  counter integer := 0;
BEGIN
  base_username := COALESCE(split_part(NEW.email, '@', 1), 'climber');
  new_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = new_username) LOOP
    counter := counter + 1;
    new_username := base_username || '_' || counter;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, new_username, split_part(NEW.email, '@', 1));
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('forum-images', 'forum-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "forum_images_public_read" ON storage.objects;
CREATE POLICY "forum_images_public_read" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'forum-images');

DROP POLICY IF EXISTS "forum_images_authed_insert" ON storage.objects;
CREATE POLICY "forum_images_authed_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'forum-images');

DROP POLICY IF EXISTS "forum_images_owner_delete" ON storage.objects;
CREATE POLICY "forum_images_owner_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'forum-images' AND owner = auth.uid());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_discussions_topic ON discussions(topic_id);
CREATE INDEX IF NOT EXISTS idx_discussions_last_activity ON discussions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_slug ON discussions(slug);
CREATE INDEX IF NOT EXISTS idx_comments_discussion ON comments(discussion_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_path ON comments(path);
CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(likeable_type, likeable_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category_id);
CREATE INDEX IF NOT EXISTS idx_attachments_target ON attachments(attachable_type, attachable_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
