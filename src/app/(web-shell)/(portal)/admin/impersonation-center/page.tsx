"use client";

import { SuperAdminRequiredPage } from "@/components/portal/admin/super-admin-required-page";

export default function AdminImpersonationCenterPage() {
  return (
    <SuperAdminRequiredPage
      titleKey="portalSite.admin.nav.impersonationCenter"
      menuGroupKey="portalSite.admin.menu.identityWorkspace"
    />
  );
}
