import Link from 'next/link';

export function LinearHero() {
  return (
    <section className="bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-20 md:py-28">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-muted-foreground">BugLogin Portal</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Quản trị profile và automation ở tốc độ production
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
            Nền tảng dành cho team vận hành số lượng lớn profile, proxy và workflow tự động,
            với trải nghiệm ổn định cho desktop và self-host.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/desktop"
            className="inline-flex h-11 items-center justify-center rounded-md bg-foreground px-5 text-sm font-medium text-background transition-colors hover:opacity-90"
          >
            Mở ứng dụng
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Xem pricing
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Workspace</p>
            <p className="mt-1 text-lg font-semibold">Multi-tenant</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Sync</p>
            <p className="mt-1 text-lg font-semibold">Self-host ready</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Automation</p>
            <p className="mt-1 text-lg font-semibold">Scale-first</p>
          </div>
        </div>
      </div>
    </section>
  );
}
