"use client";

import { SuperAdminRequiredPage } from "@/components/portal/admin/super-admin-required-page";

export default function AdminAbuseTrustPage() {
  return (
    <SuperAdminRequiredPage
      titleKey="portalSite.admin.nav.abuseTrust"
      menuGroupKey="portalSite.admin.menu.identityWorkspace"
    />
  );
}
