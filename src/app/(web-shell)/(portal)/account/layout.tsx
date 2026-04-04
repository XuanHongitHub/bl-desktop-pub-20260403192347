import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalAccountSidebarShell } from "@/components/portal/portal-sidebar-shell";

export const metadata: Metadata = {
  title: "Account",
  description:
    "Manage workspace billing, invoices, usage, and account controls in BugLogin portal.",
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <PortalAccountSidebarShell>{children}</PortalAccountSidebarShell>;
}
