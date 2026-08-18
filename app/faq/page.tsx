import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'FAQ',
  description: 'Frequently asked questions about Nepal Climbs — accounts, posting, climbing grades, and community rules.',
  path: '/faq',
});

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'What is Nepal Climbs?',
    a: (
      <>
        Nepal Climbs is a community forum for bouldering and rock climbing in Nepal. Share beta, crag info, trip reports,
        gear talk, and connect with other climbers.
      </>
    ),
  },
  {
    q: 'How do I create an account?',
    a: (
      <>
        Go to{' '}
        <Link href="/signup" className="text-primary hover:underline">
          Sign up
        </Link>
        , choose a username, and confirm your email if prompted. After that you can post discussions and comments.
      </>
    ),
  },
  {
    q: 'How do I start a discussion?',
    a: (
      <>
        Open a topic (or create one if you have permission), then use <strong>New Discussion</strong>. Add a clear title,
        optional body text, tags, and images. Images upload as soon as you select them.
      </>
    ),
  },
  {
    q: 'What are categories and topics?',
    a: (
      <>
        <strong>Categories</strong> group broad areas (e.g. Crags, Training). <strong>Topics</strong> sit inside a category
        and hold related discussions (e.g. a specific crag). Browse them from{' '}
        <Link href="/categories" className="text-primary hover:underline">
          Categories
        </Link>
        .
      </>
    ),
  },
  {
    q: 'Can I upload photos?',
    a: (
      <>
        Yes. On the new discussion form, add images at the top. They upload immediately to our storage and attach when you
        publish the post.
      </>
    ),
  },
  {
    q: 'How do likes and bookmarks work?',
    a: (
      <>
        Sign in to like discussions or comments, and bookmark discussions to find them later under{' '}
        <Link href="/bookmarks" className="text-primary hover:underline">
          Bookmarks
        </Link>
        .
      </>
    ),
  },
  {
    q: 'Is outdoor climbing advice a substitute for experience?',
    a: (
      <>
        No. Information on this site is shared by community members and may be incomplete or outdated. Always climb within
        your ability, check local conditions, and use your own judgment. Climbing involves inherent risk.
      </>
    ),
  },
  {
    q: 'How do I report a post or user?',
    a: (
      <>
        Use the report action on a discussion when signed in. Moderators review pending reports from the moderation
        dashboard.
      </>
    ),
  },
  {
    q: 'How is my data used?',
    a: (
      <>
        See our{' '}
        <Link href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>{' '}
        for details on accounts, content, and cookies.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Frequently Asked Questions</h1>
      <p className="mt-2 text-muted-foreground">
        Quick answers about using Nepal Climbs. Still stuck? Start a discussion in the community.
      </p>

      <div className="mt-8 space-y-4">
        {FAQS.map((item) => (
          <details
            key={item.q}
            className="group rounded-lg border border-border bg-card px-4 py-3 open:shadow-sm"
          >
            <summary className="cursor-pointer list-none font-display text-base font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                {item.q}
                <span className="text-muted-foreground transition group-open:rotate-45">+</span>
              </span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
