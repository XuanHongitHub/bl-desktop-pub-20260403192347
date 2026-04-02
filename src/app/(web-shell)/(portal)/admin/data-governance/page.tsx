"use client";

import { SuperAdminRequiredPage } from "@/components/portal/admin/super-admin-required-page";

export default function AdminDataGovernancePage() {
  return (
    <SuperAdminRequiredPage
      titleKey="portalSite.admin.nav.dataGovernance"
      menuGroupKey="portalSite.admin.menu.governanceSecurity"
    />
  );
}
