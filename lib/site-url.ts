/** Canonical public site URL for auth redirects (email confirm, OAuth, etc.) */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://rock.vendingao.com';
}

export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}
