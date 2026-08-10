export type UserRole = 'admin' | 'moderator' | 'verified_guide' | 'member';

export type DiscussionStatus = 'open' | 'closed' | 'hidden' | 'deleted';
export type CommentStatus = 'visible' | 'hidden' | 'deleted';
export type LikeableType = 'discussion' | 'comment';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';
export type NotificationType = 'reply' | 'like' | 'follow' | 'badge' | 'moderation' | 'mention' | 'system';
export type AttachableType = 'discussion' | 'comment';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  location: string | null;
  climbing_grade_max: string | null;
  climbing_style: string | null;
  years_climbing: number | null;
  website_url: string | null;
  instagram_handle: string | null;
  signature: string | null;
  theme: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  notify_on_reply: boolean;
  notify_on_like: boolean;
  notify_on_follow: boolean;
  notify_on_mention: boolean;
  notify_on_moderation: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  parent_id: string | null;
  sort_order: number;
}

export interface Topic {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_image_url: string | null;
  is_locked: boolean;
  is_private: boolean;
  created_by: string | null;
  sort_order: number;
}

export interface TopicRule {
  id: string;
  topic_id: string | null;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Discussion {
  id: string;
  topic_id: string;
  user_id: string;
  title: string;
  slug: string;
  body: string | null;
  status: DiscussionStatus;
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  comment_count: number;
  like_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface TopicWithCategory extends Topic {
  categories: Category | null;
}

export interface DiscussionWithRelations extends Discussion {
  profiles: Profile | null;
  topics: TopicWithCategory | null;
  tags: Tag[] | null;
}

export interface Comment {
  id: string;
  discussion_id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  depth: number;
  path: string;
  like_count: number;
  reply_count: number;
  status: CommentStatus;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommentWithProfile extends Comment {
  profiles: Profile | null;
}

export interface Attachment {
  id: string;
  uploader_id: string;
  storage_path: string;
  file_url: string;
  thumbnail_url: string | null;
  file_type: string | null;
  attachable_type: AttachableType | null;
  attachable_id: string | null;
  created_at: string;
}

export interface Like {
  id: string;
  user_id: string;
  reaction_type_id: string;
  likeable_type: LikeableType;
  likeable_id: string;
  created_at: string;
}

export interface Bookmark {
  user_id: string;
  discussion_id: string;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reportable_type: string;
  reportable_id: string;
  reason: string;
  status: ReportStatus;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ModerationLog {
  id: string;
  moderator_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  note: string | null;
  created_at: string;
}

export interface Ban {
  id: string;
  user_id: string;
  banned_by: string | null;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string | null;
  body: string | null;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  color: string | null;
}

export interface UserBadge {
  user_id: string;
  badge_id: string;
  awarded_at: string;
  badges: Badge | null;
}
