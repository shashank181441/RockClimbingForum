import Link from 'next/link';
import { Mountain } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background/50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 font-display text-sm font-bold">
            <Mountain className="h-5 w-5 text-primary" />
            Nepal Climbs
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <Link href="/categories" className="hover:text-foreground">Categories</Link>
            <Link href="/faq" className="hover:text-foreground">FAQ</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <span className="opacity-50">Climb safe. Namaste.</span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
