import Link from 'next/link';
import { PortalShell } from '@/components/portal/portal-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AuthPage() {
  return (
    <PortalShell>
      <section className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to BugLogin</h1>
          <p className="text-sm text-muted-foreground">Use your workspace account to continue.</p>
        </div>

        <form className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input id="email" type="email" placeholder="you@company.com" autoComplete="email" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Link href="/help" className="text-xs text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" placeholder="••••••••" autoComplete="current-password" />
          </div>

          <Button type="button" className="w-full">
            Continue
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          No account yet?{' '}
          <Link href="/pricing" className="font-medium text-foreground hover:underline">
            Start with a plan
          </Link>
        </p>
      </section>
    </PortalShell>
  );
}
