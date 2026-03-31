import type { ReactNode } from "react";
import type { Metadata } from "next";
import { PortalAccountSidebarShell } from "@/components/portal/portal-sidebar-shell";

export const metadata: Metadata = {
  title: "Account",
  description:
    "Manage workspace billing, invoices, usage, and account controls in BugLogin portal.",
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <PortalAccountSidebarShell>{children}</PortalAccountSidebarShell>;
}
