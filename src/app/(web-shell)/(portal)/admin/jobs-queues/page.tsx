"use client";

import { SuperAdminRequiredPage } from "@/components/portal/admin/super-admin-required-page";

export default function AdminJobsQueuesPage() {
  return (
    <SuperAdminRequiredPage
      titleKey="portalSite.admin.nav.jobsQueues"
      menuGroupKey="portalSite.admin.menu.commandCenter"
    />
  );
}
