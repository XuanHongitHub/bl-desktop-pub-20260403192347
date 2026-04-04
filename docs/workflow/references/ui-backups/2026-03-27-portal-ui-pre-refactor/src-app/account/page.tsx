import { PortalShell } from '@/components/portal/portal-shell';

export default function AccountPage() {
  return (
    <PortalShell>
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Manage your profile, billing identity, and authentication settings.
        </p>
      </section>
    </PortalShell>
  );
}
