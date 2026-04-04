import { PortalShell } from '@/components/portal/portal-shell';

export default function CheckoutPage() {
  return (
    <PortalShell>
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-muted-foreground">
          Secure checkout flow is connected here for web-first billing.
        </p>
      </section>
    </PortalShell>
  );
}
