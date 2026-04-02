"use client";

import { SuperAdminRequiredPage } from "@/components/portal/admin/super-admin-required-page";

export default function AdminSupportConsolePage() {
  return (
    <SuperAdminRequiredPage
      titleKey="portalSite.admin.nav.supportConsole"
      menuGroupKey="portalSite.admin.menu.commandCenter"
    />
  );
}
