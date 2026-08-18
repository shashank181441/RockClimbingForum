import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/site-url';

const SITE_NAME = 'Nepal Climbs';
const DEFAULT_DESCRIPTION =
  "Nepal's community for bouldering and rock climbing. Share beta, trip reports, crag guides, and stoke.";

export function absoluteUrl(path = '/'): string {
  const base = getSiteUrl();
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildPageMetadata({
  title,
  description,
  path,
  image,
  type = 'website',
  noIndex = false,
}: {
  title: string;
  description?: string | null;
  path: string;
  image?: string | null;
  type?: 'website' | 'article';
  noIndex?: boolean;
}): Metadata {
  const desc = (description || DEFAULT_DESCRIPTION).slice(0, 160);
  const url = absoluteUrl(path);
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  return {
    title: fullTitle,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description: desc,
      url,
      siteName: SITE_NAME,
      type,
      locale: 'en_US',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: fullTitle,
      description: desc,
      ...(image ? { images: [image] } : {}),
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export { SITE_NAME, DEFAULT_DESCRIPTION };
