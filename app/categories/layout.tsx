import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Categories',
  description: 'Browse all climbing discussion categories on Nepal Climbs.',
  path: '/categories',
});

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
