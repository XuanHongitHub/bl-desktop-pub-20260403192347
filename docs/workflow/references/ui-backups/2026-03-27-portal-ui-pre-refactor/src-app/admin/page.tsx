import { PortalShell } from '@/components/portal/portal-shell';

export default function AdminPage() {
  return (
    <PortalShell>
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">
          Platform-level controls, workspace governance, and audit operations.
        </p>
      </section>
    </PortalShell>
  );
}
