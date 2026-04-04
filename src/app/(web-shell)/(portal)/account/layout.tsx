import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { PortalAccountSidebarShell } from "@/components/portal/portal-sidebar-shell";

export const metadata: Metadata = {
  title: "Account",
  description:
    "Manage workspace billing, invoices, usage, and account controls in BugLogin portal.",
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PortalAccountSidebarShell>{children}</PortalAccountSidebarShell>
    </Suspense>
  );
}
