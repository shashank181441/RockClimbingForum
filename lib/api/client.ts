/**
 * Laravel API client for Nepal Climbs (Sanctum Bearer tokens).
 * Base: NEXT_PUBLIC_API_URL (e.g. https://rockapi.vendingao.com/api)
 */

const TOKEN_KEY = 'nepal-climbs:api-token';

export function getLaravelApiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'https://rockapi.vendingao.com/api').replace(/\/$/, '');
}

/** Origin without /api — used for /storage media URLs */
export function getApiOrigin(): string {
  return getLaravelApiUrl().replace(/\/api$/, '');
}

export function mediaUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin = getApiOrigin();
  return `${origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  errors?: Record<string, string[]>;
};

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string | null; raw?: boolean } = {}
): Promise<T> {
  const base = getLaravelApiUrl();
  const { token = getToken(), headers, raw, body, ...rest } = options;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...rest,
    body,
    headers: {
      Accept: 'application/json',
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const envelope = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!res.ok) {
    throw new ApiError(
      envelope.message || `API error ${res.status}`,
      res.status,
      envelope.errors
    );
  }

  if (raw) return envelope as T;
  return (envelope.data !== undefined ? envelope.data : envelope) as T;
}

export async function apiFetchPaginated<T>(
  path: string,
  options?: RequestInit & { token?: string | null }
): Promise<{ data: T[]; meta: NonNullable<ApiEnvelope<T>['meta']> }> {
  const envelope = await apiFetch<ApiEnvelope<T[]>>(path, { ...options, raw: true });
  return {
    data: (envelope.data as T[]) || [],
    meta: envelope.meta || { current_page: 1, last_page: 1, per_page: 20, total: 0 },
  };
}
