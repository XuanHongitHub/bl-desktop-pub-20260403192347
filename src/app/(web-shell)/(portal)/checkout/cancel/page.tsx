"use client";

import { CheckoutStatusPage } from "@/components/portal/checkout-status-page";
import { PortalShell } from "@/components/portal/portal-shell";

export default function CheckoutCancelPage() {
  return (
    <PortalShell>
      <CheckoutStatusPage status="cancel" />
    </PortalShell>
  );
}
