"use client";

import { SuperAdminRequiredPage } from "@/components/portal/admin/super-admin-required-page";

export default function AdminPolicyCenterPage() {
  return (
    <SuperAdminRequiredPage
      titleKey="portalSite.admin.nav.policyCenter"
      menuGroupKey="portalSite.admin.menu.governanceSecurity"
    />
  );
}
