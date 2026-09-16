/**
 * Laravel API client stub for the feature/laravel-api migration.
 * Frontend still uses Supabase by default; set NEXT_PUBLIC_API_URL when switching.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

export function getLaravelApiUrl(): string {
  return API_URL;
}

export function isLaravelApiEnabled(): boolean {
  return Boolean(API_URL);
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }

  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'message' in body && String((body as { message: string }).message)) ||
      `API error ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}
