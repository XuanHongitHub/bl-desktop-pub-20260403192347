"use client";

import { SuperAdminRequiredPage } from "@/components/portal/admin/super-admin-required-page";

export default function AdminFeatureFlagsPage() {
  return (
    <SuperAdminRequiredPage
      titleKey="portalSite.admin.nav.featureFlags"
      menuGroupKey="portalSite.admin.menu.governanceSecurity"
    />
  );
}
