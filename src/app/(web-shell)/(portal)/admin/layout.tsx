import type { ReactNode } from "react";
import {
  ADMIN_SETTINGS_NAV,
  PortalSettingsShell,
} from "@/components/portal/portal-settings-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PortalSettingsShell
      nav={ADMIN_SETTINGS_NAV}
      eyebrowKey="portalSite.admin.eyebrow"
      title="admin"
    >
      {children}
    </PortalSettingsShell>
  );
}
