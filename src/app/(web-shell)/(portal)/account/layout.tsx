import type { ReactNode } from "react";
import {
  ACCOUNT_SETTINGS_NAV,
  PortalSettingsShell,
} from "@/components/portal/portal-settings-shell";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <PortalSettingsShell
      nav={ACCOUNT_SETTINGS_NAV}
      eyebrowKey="portalSite.account.eyebrow"
      title="account"
    >
      {children}
    </PortalSettingsShell>
  );
}
