import Link from 'next/link';

export function LinearFooter() {
  return (
    <footer className="border-t border-border/50 bg-background/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} BugLogin. All rights reserved.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/auth" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link href="/help" className="transition-colors hover:text-foreground">
            Support
          </Link>
        </div>
      </div>
    </footer>
  );
}
