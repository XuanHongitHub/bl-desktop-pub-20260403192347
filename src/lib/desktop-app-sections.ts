import type { WebBillingPortalRoute } from "@/lib/web-billing-portal";
import type { AppSection } from "@/types";

export const APP_SECTION_VALUES: AppSection[] = [
  "profiles",
  "profiles-create",
  "groups",
  "bugidea-automation",
  "proxies",
  "pricing",
  "billing",
  "workspace-owner-overview",
  "workspace-owner-directory",
  "workspace-owner-permissions",
  "super-admin-overview",
  "super-admin-incident-board",
  "super-admin-workspace",
  "super-admin-permissions",
  "super-admin-memberships",
  "super-admin-abuse-trust",
  "super-admin-users",
  "super-admin-billing",
  "super-admin-subscriptions",
  "super-admin-invoices",
  "super-admin-cookies",
  "super-admin-policy-center",
  "super-admin-data-governance",
  "super-admin-jobs-queues",
  "super-admin-feature-flags",
  "super-admin-support-console",
  "super-admin-impersonation-center",
  "super-admin-browser-update",
  "super-admin-audit",
  "super-admin-system",
  "super-admin-commerce-plans",
  "super-admin-commerce-campaigns",
  "super-admin-commerce-coupons",
  "super-admin-commerce-licenses",
  "super-admin-commerce-preview",
  "super-admin-commerce-audit",
  "super-admin-analytics",
  "workspace-admin-overview",
  "workspace-admin-directory",
  "workspace-admin-permissions",
  "workspace-admin-members",
  "workspace-admin-access",
  "workspace-admin-workspace",
  "workspace-admin-audit",
  "workspace-admin-system",
  "workspace-admin-analytics",
  "workspace-governance",
  "settings",
  "admin-overview",
  "admin-workspace",
  "admin-billing",
  "admin-cookies",
  "admin-audit",
  "admin-system",
  "admin-analytics",
];
export const APP_SECTION_SET = new Set<AppSection>(APP_SECTION_VALUES);

export const WORKSPACE_OWNER_SECTIONS: AppSection[] = [
  "workspace-owner-overview",
  "workspace-owner-directory",
  "workspace-owner-permissions",
  "workspace-admin-overview",
  "workspace-admin-directory",
  "workspace-admin-permissions",
  "workspace-admin-members",
  "workspace-admin-access",
  "workspace-admin-workspace",
  "workspace-admin-audit",
  "workspace-admin-system",
  "workspace-admin-analytics",
  "workspace-governance",
];

export const WORKSPACE_OWNER_LEGACY_SECTION_MAP: Partial<
  Record<AppSection, AppSection>
> = {
  "workspace-governance": "workspace-owner-overview",
  "workspace-admin-overview": "workspace-owner-overview",
  "workspace-owner-directory": "workspace-admin-members",
  "workspace-admin-directory": "workspace-admin-members",
  "workspace-owner-permissions": "workspace-admin-access",
  "workspace-admin-permissions": "workspace-admin-access",
  "workspace-admin-system": "workspace-owner-overview",
  "workspace-admin-analytics": "workspace-owner-overview",
};

export const SUPER_ADMIN_LEGACY_SECTION_MAP: Partial<
  Record<AppSection, AppSection>
> = {
  "admin-overview": "super-admin-overview",
  "admin-workspace": "super-admin-workspace",
  "admin-billing": "super-admin-billing",
  "admin-cookies": "super-admin-cookies",
  "admin-audit": "super-admin-audit",
  "admin-system": "super-admin-overview",
  "admin-analytics": "super-admin-overview",
  "super-admin-system": "super-admin-overview",
  "super-admin-analytics": "super-admin-overview",
};

export const BILLING_LEGACY_SECTION_MAP: Record<string, AppSection> = {
  "billing-checkout": "billing",
  "billing-coupon": "billing",
  "billing-license": "billing",
};

export function normalizeLegacyAppSection(section: string): AppSection {
  const fromBillingLegacy = BILLING_LEGACY_SECTION_MAP[section];
  if (fromBillingLegacy) {
    return fromBillingLegacy;
  }
  const typedSection = section as AppSection;
  return (
    WORKSPACE_OWNER_LEGACY_SECTION_MAP[typedSection] ??
    SUPER_ADMIN_LEGACY_SECTION_MAP[typedSection] ??
    typedSection
  );
}

export function isWorkspaceOwnerSection(section: AppSection): boolean {
  const normalizedSection = normalizeLegacyAppSection(section);
  return WORKSPACE_OWNER_SECTIONS.includes(normalizedSection);
}

export function isSuperAdminSection(section: AppSection): boolean {
  return section.startsWith("super-admin-") || section.startsWith("admin-");
}

export function resolveEmbeddedPortalRouteForSection(
  section: AppSection,
): WebBillingPortalRoute | null {
  if (
    section === "workspace-owner-overview" ||
    section === "workspace-owner-directory" ||
    section === "workspace-owner-permissions" ||
    section === "workspace-governance" ||
    section === "workspace-admin-overview" ||
    section === "workspace-admin-directory" ||
    section === "workspace-admin-permissions" ||
    section === "workspace-admin-members" ||
    section === "workspace-admin-access" ||
    section === "workspace-admin-workspace" ||
    section === "workspace-admin-audit" ||
    section === "workspace-admin-system" ||
    section === "workspace-admin-analytics"
  ) {
    return "management";
  }

  if (
    section === "super-admin-overview" ||
    section === "admin-overview" ||
    section === "super-admin-cookies" ||
    section === "admin-cookies"
  ) {
    return "adminCommandCenter";
  }
  if (section === "super-admin-incident-board") {
    return "adminIncidentBoard";
  }
  if (section === "super-admin-permissions") {
    return "adminPermissions";
  }
  if (section === "super-admin-memberships") {
    return "adminMemberships";
  }
  if (section === "super-admin-abuse-trust") {
    return "adminAbuseTrust";
  }
  if (section === "super-admin-users") {
    return "adminUsers";
  }
  if (section === "super-admin-workspace" || section === "admin-workspace") {
    return "adminWorkspaces";
  }
  if (section === "super-admin-subscriptions") {
    return "adminSubscriptions";
  }
  if (section === "super-admin-invoices") {
    return "adminInvoices";
  }
  if (section === "super-admin-billing" || section === "admin-billing") {
    return "adminRevenue";
  }
  if (section === "super-admin-policy-center") {
    return "adminPolicyCenter";
  }
  if (section === "super-admin-data-governance") {
    return "adminDataGovernance";
  }
  if (section === "super-admin-jobs-queues") {
    return "adminJobsQueues";
  }
  if (section === "super-admin-feature-flags") {
    return "adminFeatureFlags";
  }
  if (section === "super-admin-support-console") {
    return "adminSupportConsole";
  }
  if (section === "super-admin-impersonation-center") {
    return "adminImpersonationCenter";
  }
  if (section === "super-admin-browser-update") {
    return "adminBrowserUpdate";
  }
  if (section === "super-admin-audit" || section === "admin-audit") {
    return "adminAudit";
  }
  if (section === "super-admin-commerce-plans") {
    return "adminCommercePlans";
  }
  if (section === "super-admin-commerce-campaigns") {
    return "adminCommerceCampaigns";
  }
  if (section === "super-admin-commerce-coupons") {
    return "adminCommerceCoupons";
  }
  if (section === "super-admin-commerce-licenses") {
    return "adminCommerceLicenses";
  }
  if (section === "super-admin-commerce-preview") {
    return "adminCommercePreview";
  }
  if (section === "super-admin-commerce-audit") {
    return "adminCommerceAudit";
  }
  if (
    section === "super-admin-system" ||
    section === "admin-system" ||
    section === "super-admin-analytics" ||
    section === "admin-analytics"
  ) {
    return "adminSystem";
  }
  return null;
}

export function parsePersistedAppSection(
  value: string | null | undefined,
): AppSection | null {
  if (!value) {
    return null;
  }
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }
  const normalizedSection = normalizeLegacyAppSection(normalizedValue);
  if (!APP_SECTION_SET.has(normalizedSection)) {
    return null;
  }
  return normalizedSection;
}
