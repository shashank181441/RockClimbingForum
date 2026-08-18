import type { Metadata } from 'next';
import Link from 'next/link';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Privacy Policy',
  description: 'How Nepal Climbs collects, uses, and protects your information.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 19, 2026</p>

      <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none space-y-6 text-sm leading-relaxed text-foreground">
        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">1. Who we are</h2>
          <p>
            Nepal Climbs (&quot;we&quot;, &quot;us&quot;) is a community forum for bouldering and rock climbing in Nepal,
            available at{' '}
            <Link href="/" className="text-primary hover:underline">
              rock.vendingao.com
            </Link>
            . This policy explains what data we collect and how we use it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">2. Information we collect</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground">Account data</span> — email, username, password (hashed by our auth provider), and profile details you choose to add (bio, location, climbing grade, avatar, etc.).
            </li>
            <li>
              <span className="text-foreground">Content you post</span> — discussions, comments, images, likes, bookmarks, and reports.
            </li>
            <li>
              <span className="text-foreground">Technical data</span> — IP address, browser type, and basic usage logs processed by our hosting and database providers for security and reliability.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">3. How we use your information</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>To operate the forum (accounts, posts, notifications, moderation).</li>
            <li>To keep the community safe (spam, abuse, and ban enforcement).</li>
            <li>To improve the site and fix bugs.</li>
            <li>We do not sell your personal information.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">4. Service providers</h2>
          <p className="text-muted-foreground">
            We use third-party services to run Nepal Climbs, including authentication, database, file storage (e.g. Supabase),
            and hosting. Those providers process data under their own privacy policies and only as needed to provide the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">5. Cookies and local storage</h2>
          <p className="text-muted-foreground">
            We use cookies / local storage to keep you signed in, remember theme preferences, and support basic site features
            (for example temporary upload state). You can clear these in your browser; some features may stop working if you do.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">6. Public content</h2>
          <p className="text-muted-foreground">
            Profile information you make public, discussions, and comments are visible to other visitors and may appear in search engines.
            Do not post personal contact details or sensitive information you want to keep private.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">7. Your choices</h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Update or delete profile fields in Settings.</li>
            <li>Request account deletion by contacting the site admins.</li>
            <li>You may stop using the service at any time.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">8. Children</h2>
          <p className="text-muted-foreground">
            Nepal Climbs is not directed at children under 13. If you believe a child has created an account, contact us so we can remove it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">9. Changes</h2>
          <p className="text-muted-foreground">
            We may update this policy from time to time. The &quot;Last updated&quot; date at the top will change when we do.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">10. Contact</h2>
          <p className="text-muted-foreground">
            Questions about privacy? Reach out via the forum or your site administrator.
            See also our{' '}
            <Link href="/faq" className="text-primary hover:underline">
              FAQ
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
