import { apiFetch, apiFetchPaginated, getLaravelApiUrl, getToken, setToken } from './client';
import {
  adaptCategory,
  adaptComment,
  adaptDiscussion,
  adaptProfile,
  adaptRoles,
  adaptTag,
  adaptTopic,
  adaptTopicRules,
} from './adapters';
import type {
  Category,
  CommentWithProfile,
  DiscussionWithRelations,
  Notification,
  Profile,
  Tag,
  TopicRule,
  TopicWithCategory,
  UserRole,
} from '@/lib/types';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
};

export type AuthPayload = {
  user: AuthUser;
  profile: Profile | null;
  roles: UserRole[];
  token: string;
};

type LaravelUser = Record<string, unknown> & {
  id: number | string;
  email: string;
  username?: string;
  profile?: Record<string, unknown>;
  role_assignments?: { role: UserRole }[];
};

function toAuthUser(u: LaravelUser): AuthUser {
  return {
    id: String(u.id),
    email: String(u.email),
    username: String(u.username || u.profile?.username || ''),
  };
}

function toAuthPayload(data: { user: LaravelUser; token: string }): AuthPayload {
  return {
    user: toAuthUser(data.user),
    profile: adaptProfile(data.user),
    roles: adaptRoles(data.user),
    token: data.token,
  };
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const data = await apiFetch<{ user: LaravelUser; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, device_name: 'web' }),
    token: null,
  });
  setToken(data.token);
  return toAuthPayload(data);
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<AuthPayload> {
  const data = await apiFetch<{ user: LaravelUser; token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username,
      email,
      password,
      password_confirmation: password,
    }),
    token: null,
  });
  setToken(data.token);
  return toAuthPayload(data);
}

export async function logout(): Promise<void> {
  try {
    if (getToken()) await apiFetch('/auth/logout', { method: 'POST' });
  } finally {
    setToken(null);
  }
}

export async function fetchMe(): Promise<Omit<AuthPayload, 'token'> | null> {
  if (!getToken()) return null;
  try {
    const user = await apiFetch<LaravelUser>('/auth/me');
    return {
      user: toAuthUser(user),
      profile: adaptProfile(user),
      roles: adaptRoles(user),
    };
  } catch {
    setToken(null);
    return null;
  }
}

export async function listCategories(): Promise<Category[]> {
  const rows = await apiFetch<Record<string, unknown>[]>('/categories');
  return (rows || []).map(adaptCategory);
}

export async function getCategory(slug: string): Promise<Category & { topics?: TopicWithCategory[] }> {
  const raw = await apiFetch<Record<string, unknown>>(`/categories/${slug}`);
  const topics = ((raw.topics as Record<string, unknown>[]) || []).map(adaptTopic);
  return { ...adaptCategory(raw), topics };
}

export async function createCategory(input: {
  name: string;
  slug?: string;
  description?: string;
}): Promise<Category> {
  const raw = await apiFetch<Record<string, unknown>>('/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return adaptCategory(raw);
}

export async function listTopics(categoryId?: string): Promise<TopicWithCategory[]> {
  const q = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : '';
  const rows = await apiFetch<Record<string, unknown>[]>(`/topics${q}`);
  return (rows || []).map(adaptTopic);
}

export async function getTopic(
  slug: string
): Promise<TopicWithCategory & { rules: TopicRule[] }> {
  const raw = await apiFetch<Record<string, unknown>>(`/topics/${slug}`);
  return {
    ...adaptTopic(raw),
    rules: adaptTopicRules((raw.rules as Record<string, unknown>[]) || []),
  };
}

export async function createTopic(input: {
  category_id: string;
  name: string;
  slug?: string;
  description?: string;
}): Promise<TopicWithCategory> {
  const raw = await apiFetch<Record<string, unknown>>('/topics', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return adaptTopic(raw);
}

export async function listDiscussions(params: {
  topic_id?: string;
  user_id?: string;
  search?: string;
  sort?: 'recent' | 'popular';
  per_page?: number;
  page?: number;
} = {}): Promise<{ data: DiscussionWithRelations[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.topic_id) sp.set('topic_id', params.topic_id);
  if (params.user_id) sp.set('user_id', params.user_id);
  if (params.search) sp.set('search', params.search);
  if (params.sort === 'popular') sp.set('sort', 'popular');
  if (params.per_page) sp.set('per_page', String(params.per_page));
  if (params.page) sp.set('page', String(params.page));
  const q = sp.toString() ? `?${sp}` : '';
  const { data, meta } = await apiFetchPaginated<Record<string, unknown>>(`/discussions${q}`);
  return { data: data.map(adaptDiscussion), total: meta.total };
}

export async function getDiscussion(slug: string): Promise<DiscussionWithRelations> {
  const raw = await apiFetch<Record<string, unknown>>(`/discussions/${slug}`);
  return adaptDiscussion(raw);
}

export async function createDiscussion(input: {
  topic_id: string;
  title: string;
  body: string;
  tags?: string[];
}): Promise<DiscussionWithRelations> {
  const raw = await apiFetch<Record<string, unknown>>('/discussions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return adaptDiscussion(raw);
}

export async function listComments(
  discussionId: string
): Promise<CommentWithProfile[]> {
  const { data } = await apiFetchPaginated<Record<string, unknown>>(
    `/discussions/${discussionId}/comments?per_page=100`
  );
  return data.map(adaptComment);
}

export async function createComment(
  discussionId: string,
  body: string,
  parentId?: string | null
): Promise<CommentWithProfile> {
  const raw = await apiFetch<Record<string, unknown>>(
    `/discussions/${discussionId}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ body, parent_id: parentId || undefined }),
    }
  );
  return adaptComment(raw);
}

export async function updateComment(
  commentId: string,
  body: string
): Promise<CommentWithProfile> {
  const raw = await apiFetch<Record<string, unknown>>(`/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  });
  return adaptComment(raw);
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiFetch(`/comments/${commentId}`, { method: 'DELETE' });
}

export async function toggleLike(
  likeableType: 'discussion' | 'comment',
  likeableId: string
): Promise<{ liked: boolean; like_count: number }> {
  return apiFetch('/likes/toggle', {
    method: 'POST',
    body: JSON.stringify({ likeable_type: likeableType, likeable_id: likeableId }),
  });
}

export async function listBookmarks(): Promise<DiscussionWithRelations[]> {
  const { data } = await apiFetchPaginated<Record<string, unknown>>('/bookmarks');
  return data.map(adaptDiscussion);
}

export async function toggleBookmark(
  discussionId: string
): Promise<{ bookmarked: boolean }> {
  return apiFetch(`/bookmarks/${discussionId}/toggle`, { method: 'POST' });
}

export async function getProfile(username: string): Promise<{
  user: AuthUser;
  profile: Profile | null;
  badges: unknown[];
}> {
  const raw = await apiFetch<LaravelUser>(`/profiles/${username}`);
  return {
    user: toAuthUser(raw),
    profile: adaptProfile(raw),
    badges: (raw.badges as unknown[]) || [],
  };
}

export async function updateProfile(
  input: Partial<Profile> & { username?: string }
): Promise<Profile | null> {
  const raw = await apiFetch<LaravelUser>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return adaptProfile(raw);
}

export async function uploadImage(file: File): Promise<{ path: string; url: string }> {
  const form = new FormData();
  form.append('image', file);
  const data = await apiFetch<{ path: string; url: string }>('/uploads/images', {
    method: 'POST',
    body: form,
  });
  return {
    path: data.path,
    url: data.url.startsWith('http') ? data.url : `${getLaravelApiUrl().replace(/\/api$/, '')}${data.url}`,
  };
}

function adaptNotification(raw: Record<string, unknown>): Notification {
  return {
    id: String(raw.id),
    user_id: String(raw.user_id),
    type: raw.type as Notification['type'],
    title: String(raw.title ?? ''),
    body: (raw.message as string | null) ?? null,
    url: (raw.data as { url?: string } | null)?.url ?? null,
    actor_id: null,
    is_read: Boolean(raw.read_at),
    created_at: String(raw.created_at ?? ''),
  };
}

export async function listNotifications(): Promise<Notification[]> {
  const { data } = await apiFetchPaginated<Record<string, unknown>>('/notifications');
  return data.map(adaptNotification);
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch('/notifications/read-all', { method: 'PATCH' });
}

export async function deleteNotification(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
}

export async function listTags(): Promise<Tag[]> {
  try {
    const rows = await apiFetch<Record<string, unknown>[]>('/tags');
    return (rows || []).map(adaptTag);
  } catch {
    return [];
  }
}

export async function createReport(input: {
  reportable_type: string;
  reportable_id: string;
  reason: string;
  details?: string;
}): Promise<void> {
  await apiFetch('/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function toggleFollow(userId: string): Promise<{ following: boolean }> {
  return apiFetch(`/follows/${userId}/toggle`, { method: 'POST' });
}

export async function listModerationReports(): Promise<unknown[]> {
  const rows = await apiFetch<unknown[]>('/moderation/reports');
  return rows || [];
}

export async function resolveReport(
  id: string,
  status: 'resolved' | 'dismissed'
): Promise<void> {
  await apiFetch(`/moderation/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function hideDiscussion(id: string): Promise<void> {
  await apiFetch(`/moderation/discussions/${id}/hide`, { method: 'PATCH' });
}

export async function hideComment(id: string): Promise<void> {
  await apiFetch(`/moderation/comments/${id}/hide`, { method: 'PATCH' });
}

export async function banUser(
  userId: string,
  reason: string,
  endsAt?: string | null
): Promise<void> {
  await apiFetch(`/moderation/users/${userId}/ban`, {
    method: 'POST',
    body: JSON.stringify({ reason, ends_at: endsAt || undefined }),
  });
}
