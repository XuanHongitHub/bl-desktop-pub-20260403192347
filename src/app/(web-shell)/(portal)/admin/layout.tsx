import type { ReactNode } from "react";
import type { Metadata } from "next";
import { PortalAdminSidebarShell } from "@/components/portal/portal-sidebar-shell";

export const metadata: Metadata = {
  title: "Admin",
  description:
    "Super admin control plane for workspace health, revenue, audit, and system status.",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalAdminSidebarShell>{children}</PortalAdminSidebarShell>;
}
