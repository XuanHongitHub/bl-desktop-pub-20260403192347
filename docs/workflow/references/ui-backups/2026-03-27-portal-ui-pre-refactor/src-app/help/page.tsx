import { PortalShell } from '@/components/portal/portal-shell';

export default function HelpPage() {
  return (
    <PortalShell>
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Support</h1>
        <p className="text-muted-foreground">
          Documentation, incident notices, and support contact for BugLogin.
        </p>
      </section>
    </PortalShell>
  );
}
