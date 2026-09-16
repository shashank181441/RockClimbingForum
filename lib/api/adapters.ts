import { mediaUrl } from './client';
import type {
  Category,
  Comment,
  CommentWithProfile,
  Discussion,
  DiscussionWithRelations,
  Profile,
  Tag,
  Topic,
  TopicRule,
  TopicWithCategory,
  UserRole,
} from '@/lib/types';

/** Laravel user + nested profile → frontend Profile (id = user id string) */
export function adaptProfile(
  userOrProfile: Record<string, unknown> | null | undefined
): Profile | null {
  if (!userOrProfile) return null;

  const nested = userOrProfile.profile as Record<string, unknown> | undefined;
  const src = nested || userOrProfile;
  const id =
    String(
      userOrProfile.id ??
        src.user_id ??
        src.id ??
        ''
    ) || '';

  if (!id && !src.username) return null;

  return {
    id,
    username: String(src.username ?? userOrProfile.username ?? ''),
    display_name: (src.display_name as string | null) ?? null,
    bio: (src.bio as string | null) ?? null,
    avatar_url: mediaUrl((src.avatar_url as string | null) ?? null),
    cover_image_url: mediaUrl((src.cover_image_url as string | null) ?? null),
    location: (src.location as string | null) ?? null,
    climbing_grade_max: (src.climbing_grade_max as string | null) ?? null,
    climbing_style: (src.climbing_style as string | null) ?? null,
    years_climbing: (src.years_climbing as number | null) ?? null,
    website_url: (src.website_url as string | null) ?? null,
    instagram_handle: (src.instagram_handle as string | null) ?? null,
    signature: (src.signature as string | null) ?? null,
    theme: (src.theme as string | null) ?? null,
    status: (src.status as string | null) ?? null,
    created_at: String(src.created_at ?? userOrProfile.created_at ?? ''),
    updated_at: String(src.updated_at ?? userOrProfile.updated_at ?? ''),
  };
}

export function adaptRoles(user: Record<string, unknown> | null | undefined): UserRole[] {
  const assignments = (user?.role_assignments as { role: UserRole }[]) || [];
  return assignments.map((r) => r.role);
}

export function adaptCategory(raw: Record<string, unknown>): Category {
  return {
    id: String(raw.id),
    name: String(raw.name),
    slug: String(raw.slug),
    description: (raw.description as string | null) ?? null,
    icon_url: mediaUrl((raw.icon_url as string | null) ?? null),
    parent_id: raw.parent_id ? String(raw.parent_id) : null,
    sort_order: Number(raw.sort_order ?? 0),
  };
}

export function adaptTopic(raw: Record<string, unknown>): TopicWithCategory {
  const category = raw.category as Record<string, unknown> | undefined;
  return {
    id: String(raw.id),
    category_id: String(raw.category_id),
    name: String(raw.name),
    slug: String(raw.slug),
    description: (raw.description as string | null) ?? null,
    banner_image_url: mediaUrl((raw.banner_image_url as string | null) ?? null),
    is_locked: Boolean(raw.is_locked),
    is_private: Boolean(raw.is_private),
    created_by: raw.created_by != null ? String(raw.created_by) : null,
    sort_order: Number(raw.sort_order ?? 0),
    categories: category ? adaptCategory(category) : null,
  };
}

export function adaptTopicRules(raw: Record<string, unknown>[]): TopicRule[] {
  return (raw || []).map((r) => ({
    id: String(r.id),
    topic_id: r.topic_id ? String(r.topic_id) : null,
    title: String(r.title),
    description: (r.description as string | null) ?? null,
    sort_order: Number(r.sort_order ?? 0),
  }));
}

export function adaptTag(raw: Record<string, unknown>): Tag {
  return {
    id: String(raw.id),
    name: String(raw.name),
    slug: String(raw.slug),
  };
}

export function adaptDiscussion(raw: Record<string, unknown>): DiscussionWithRelations {
  const user = raw.user as Record<string, unknown> | undefined;
  const topic = raw.topic as Record<string, unknown> | undefined;
  const tagsRaw = (raw.tags as Record<string, unknown>[]) || [];

  const base: Discussion = {
    id: String(raw.id),
    topic_id: String(raw.topic_id),
    user_id: String(raw.user_id),
    title: String(raw.title),
    slug: String(raw.slug),
    body: (raw.body as string | null) ?? null,
    status: raw.status as Discussion['status'],
    is_pinned: Boolean(raw.is_pinned),
    is_locked: Boolean(raw.is_locked),
    view_count: Number(raw.view_count ?? 0),
    comment_count: Number(raw.comment_count ?? 0),
    like_count: Number(raw.like_count ?? 0),
    last_activity_at: String(raw.last_activity_at ?? raw.created_at ?? ''),
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };

  return {
    ...base,
    profiles: adaptProfile(user || null),
    topics: topic
      ? {
          id: String(topic.id),
          category_id: String(topic.category_id ?? ''),
          name: String(topic.name),
          slug: String(topic.slug),
          description: (topic.description as string | null) ?? null,
          banner_image_url: null,
          is_locked: Boolean(topic.is_locked),
          is_private: Boolean(topic.is_private),
          created_by: null,
          sort_order: Number(topic.sort_order ?? 0),
          categories: topic.category
            ? adaptCategory(topic.category as Record<string, unknown>)
            : null,
        }
      : null,
    tags: tagsRaw.map(adaptTag),
  };
}

export function adaptComment(raw: Record<string, unknown>): CommentWithProfile {
  const user = raw.user as Record<string, unknown> | undefined;
  const comment: Comment = {
    id: String(raw.id),
    discussion_id: String(raw.discussion_id),
    parent_id: raw.parent_id ? String(raw.parent_id) : null,
    user_id: String(raw.user_id),
    body: String(raw.body ?? ''),
    depth: Number(raw.depth ?? 0),
    path: String(raw.path ?? ''),
    like_count: Number(raw.like_count ?? 0),
    reply_count: Number(raw.reply_count ?? 0),
    status: raw.status as Comment['status'],
    edited_at: (raw.edited_at as string | null) ?? null,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  };
  return { ...comment, profiles: adaptProfile(user || null) };
}
