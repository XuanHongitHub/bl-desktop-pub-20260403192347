"use client";

import { SuperAdminRequiredPage } from "@/components/portal/admin/super-admin-required-page";

export default function AdminInvoicesPage() {
  return (
    <SuperAdminRequiredPage
      titleKey="portalSite.admin.nav.invoices"
      menuGroupKey="portalSite.admin.menu.revenueCommerce"
    />
  );
}
