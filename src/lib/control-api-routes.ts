type ControlApiBackend = "nest" | "laravel";

const DEFAULT_BACKEND: ControlApiBackend = "nest";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export function resolveControlApiBackend(): ControlApiBackend {
  const raw = process.env.NEXT_PUBLIC_CONTROL_API_BACKEND?.trim().toLowerCase();
  if (raw === "laravel") {
    return "laravel";
  }
  return DEFAULT_BACKEND;
}

function resolveControlApiPrefix(backend: ControlApiBackend): string {
  switch (backend) {
    case "laravel":
      // Keep current contract by default; update this prefix when Laravel routes differ.
      return "/v1/control";
    default:
      return "/v1/control";
  }
}

type RouteBuilderInput = {
  workspaceId?: string;
  userId?: string;
  inviteId?: string;
  route?: "register" | "login" | "google";
  scope?: "member";
  checkoutSessionId?: string;
  planId?: string;
  campaignId?: string;
  couponId?: string;
  licenseId?: string;
  shareGrantId?: string;
  auditLimit?: number;
  q?: string;
  page?: number;
  pageSize?: number;
  status?: "active" | "past_due" | "canceled";
  planIdFilter?: "starter" | "team" | "scale" | "enterprise" | "free";
};

export function buildControlApiPath(
  routeKey:
    | "authMe"
    | "authInvites"
    | "authInviteAccept"
    | "authInviteDecline"
    | "workspaces"
    | "publicAuth"
    | "adminOverview"
    | "adminWorkspaceHealth"
    | "workspaceBillingState"
    | "workspaceMembers"
    | "workspaceMemberInvite"
    | "workspaceMemberRole"
    | "workspaceInvites"
    | "workspaceInviteRevoke"
    | "workspaceShareGrants"
    | "workspaceShareGrantRevoke"
    | "workspaceStripeCheckout"
    | "workspaceStripeCheckoutConfirm"
    | "workspaceCancelSubscription"
    | "workspaceReactivateSubscription"
    | "workspaceAdminSubscriptionOverride"
    | "workspaceRedeemCoupon"
    | "workspaceRedeemLicense"
    | "workspaceEntitlementHistory"
    | "adminUsersCreate"
    | "adminUsersList"
    | "adminUserDetail"
    | "adminUserPlatformRoleUpdate"
    | "adminUserPasswordReset"
    | "adminUserDelete"
    | "adminMembershipsList"
    | "adminWorkspacesList"
    | "adminWorkspaceDetail"
    | "adminWorkspaceOwnerTransfer"
    | "adminInvoicesList"
    | "adminRevenue"
    | "adminAutomationRuns"
    | "adminCommercePlans"
    | "adminCommercePlanPublishVersion"
    | "adminCommerceCampaigns"
    | "adminCommerceCampaignActivate"
    | "adminCommerceCampaignDeactivate"
    | "adminCommerceCoupons"
    | "adminCommerceCouponDisable"
    | "adminCommerceLicenses"
    | "adminCommerceLicenseRevoke"
    | "adminCommerceLicenseRotate"
    | "adminCommercePricePreview"
    | "adminCommerceAudit",
  input: RouteBuilderInput = {},
): string {
  const prefix = resolveControlApiPrefix(resolveControlApiBackend());

  switch (routeKey) {
    case "authMe":
      return `${prefix}/auth/me`;
    case "authInvites":
      return `${prefix}/auth/invites`;
    case "authInviteAccept":
      return `${prefix}/auth/invites/${encodeURIComponent(input.inviteId ?? "")}/accept`;
    case "authInviteDecline":
      return `${prefix}/auth/invites/${encodeURIComponent(input.inviteId ?? "")}/decline`;
    case "workspaces":
      return input.scope === "member"
        ? `${prefix}/workspaces?scope=member`
        : `${prefix}/workspaces`;
    case "publicAuth":
      return `${prefix}/public/auth/${input.route ?? "login"}`;
    case "adminOverview":
      return `${prefix}/admin/overview`;
    case "adminWorkspaceHealth":
      return `${prefix}/admin/workspace-health`;
    case "workspaceBillingState":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/state`;
    case "workspaceMembers":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/members`;
    case "workspaceMemberInvite":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/members/invite`;
    case "workspaceMemberRole":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/members/${encodeURIComponent(input.userId ?? "")}/role`;
    case "workspaceInvites":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/invites`;
    case "workspaceInviteRevoke":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/invites/${encodeURIComponent(input.inviteId ?? "")}/revoke`;
    case "workspaceShareGrants":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/share-grants`;
    case "workspaceShareGrantRevoke":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/share-grants/${encodeURIComponent(input.shareGrantId ?? "")}/revoke`;
    case "workspaceStripeCheckout":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/stripe-checkout`;
    case "workspaceStripeCheckoutConfirm":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/stripe-checkout/${encodeURIComponent(input.checkoutSessionId ?? "")}/confirm`;
    case "workspaceCancelSubscription":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/subscription/cancel`;
    case "workspaceReactivateSubscription":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/subscription/reactivate`;
    case "workspaceAdminSubscriptionOverride":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/subscription/admin-override`;
    case "workspaceRedeemCoupon":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/coupon/redeem`;
    case "workspaceRedeemLicense":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/license/redeem`;
    case "workspaceEntitlementHistory":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/entitlements/history`;
    case "adminUsersCreate":
      return `${prefix}/admin/users`;
    case "adminUsersList": {
      const params = new URLSearchParams();
      if (input.q?.trim()) {
        params.set("q", input.q.trim());
      }
      params.set("page", String(Math.max(1, input.page ?? 1)));
      params.set("pageSize", String(Math.max(1, input.pageSize ?? 25)));
      return `${prefix}/admin/users?${params.toString()}`;
    }
    case "adminUserDetail":
      return `${prefix}/admin/users/${encodeURIComponent(input.userId ?? "")}`;
    case "adminUserPlatformRoleUpdate":
      return `${prefix}/admin/users/${encodeURIComponent(input.userId ?? "")}/platform-role`;
    case "adminUserPasswordReset":
      return `${prefix}/admin/users/${encodeURIComponent(input.userId ?? "")}/password`;
    case "adminUserDelete":
      return `${prefix}/admin/users/${encodeURIComponent(input.userId ?? "")}`;
    case "adminMembershipsList": {
      const params = new URLSearchParams();
      if (input.q?.trim()) params.set("q", input.q.trim());
      params.set("page", String(Math.max(1, input.page ?? 1)));
      params.set("pageSize", String(Math.max(1, input.pageSize ?? 25)));
      return `${prefix}/admin/memberships?${params.toString()}`;
    }
    case "adminWorkspacesList": {
      const params = new URLSearchParams();
      if (input.q?.trim()) {
        params.set("q", input.q.trim());
      }
      if (input.status) {
        params.set("status", input.status);
      }
      if (input.planIdFilter) {
        params.set("planId", input.planIdFilter);
      }
      params.set("page", String(Math.max(1, input.page ?? 1)));
      params.set("pageSize", String(Math.max(1, input.pageSize ?? 25)));
      return `${prefix}/admin/workspaces?${params.toString()}`;
    }
    case "adminWorkspaceDetail":
      return `${prefix}/admin/workspaces/${encodeURIComponent(input.workspaceId ?? "")}`;
    case "adminWorkspaceOwnerTransfer":
      return `${prefix}/admin/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/owner`;
    case "adminInvoicesList": {
      const params = new URLSearchParams();
      if (input.q?.trim()) params.set("q", input.q.trim());
      params.set("page", String(Math.max(1, input.page ?? 1)));
      params.set("pageSize", String(Math.max(1, input.pageSize ?? 25)));
      return `${prefix}/admin/invoices?${params.toString()}`;
    }
    case "adminRevenue":
      return `${prefix}/admin/revenue`;
    case "adminAutomationRuns": {
      const params = new URLSearchParams();
      if (input.q?.trim()) params.set("q", input.q.trim());
      params.set("page", String(Math.max(1, input.page ?? 1)));
      params.set("pageSize", String(Math.max(1, input.pageSize ?? 25)));
      return `${prefix}/admin/automation-runs?${params.toString()}`;
    }
    case "adminCommercePlans":
      return `${prefix}/admin/commerce/plans`;
    case "adminCommercePlanPublishVersion":
      return `${prefix}/admin/commerce/plans/${encodeURIComponent(input.planId ?? "")}/publish-version`;
    case "adminCommerceCampaigns":
      return `${prefix}/admin/commerce/campaigns`;
    case "adminCommerceCampaignActivate":
      return `${prefix}/admin/commerce/campaigns/${encodeURIComponent(input.campaignId ?? "")}/activate`;
    case "adminCommerceCampaignDeactivate":
      return `${prefix}/admin/commerce/campaigns/${encodeURIComponent(input.campaignId ?? "")}/deactivate`;
    case "adminCommerceCoupons":
      return `${prefix}/admin/coupons`;
    case "adminCommerceCouponDisable":
      return `${prefix}/admin/coupons/${encodeURIComponent(input.couponId ?? "")}/revoke`;
    case "adminCommerceLicenses":
      return `${prefix}/admin/commerce/licenses`;
    case "adminCommerceLicenseRevoke":
      return `${prefix}/admin/commerce/licenses/${encodeURIComponent(input.licenseId ?? "")}/revoke`;
    case "adminCommerceLicenseRotate":
      return `${prefix}/admin/commerce/licenses/${encodeURIComponent(input.licenseId ?? "")}/rotate`;
    case "adminCommercePricePreview":
      return `${prefix}/admin/commerce/price-preview`;
    case "adminCommerceAudit":
      return `${prefix}/admin/audit-logs?limit=${Math.max(1, input.auditLimit ?? 50)}`;
    default:
      return `${prefix}/workspaces`;
  }
}

export function buildControlApiUrl(
  baseUrl: string,
  routeKey:
    | "authMe"
    | "authInvites"
    | "authInviteAccept"
    | "authInviteDecline"
    | "workspaces"
    | "publicAuth"
    | "adminOverview"
    | "adminWorkspaceHealth"
    | "workspaceBillingState"
    | "workspaceMembers"
    | "workspaceMemberInvite"
    | "workspaceMemberRole"
    | "workspaceInvites"
    | "workspaceInviteRevoke"
    | "workspaceShareGrants"
    | "workspaceShareGrantRevoke"
    | "workspaceStripeCheckout"
    | "workspaceStripeCheckoutConfirm"
    | "workspaceCancelSubscription"
    | "workspaceReactivateSubscription"
    | "workspaceAdminSubscriptionOverride"
    | "workspaceRedeemCoupon"
    | "workspaceRedeemLicense"
    | "workspaceEntitlementHistory"
    | "adminUsersCreate"
    | "adminUsersList"
    | "adminUserDetail"
    | "adminUserPlatformRoleUpdate"
    | "adminUserPasswordReset"
    | "adminUserDelete"
    | "adminMembershipsList"
    | "adminWorkspacesList"
    | "adminWorkspaceDetail"
    | "adminWorkspaceOwnerTransfer"
    | "adminInvoicesList"
    | "adminRevenue"
    | "adminAutomationRuns"
    | "adminCommercePlans"
    | "adminCommercePlanPublishVersion"
    | "adminCommerceCampaigns"
    | "adminCommerceCampaignActivate"
    | "adminCommerceCampaignDeactivate"
    | "adminCommerceCoupons"
    | "adminCommerceCouponDisable"
    | "adminCommerceLicenses"
    | "adminCommerceLicenseRevoke"
    | "adminCommerceLicenseRotate"
    | "adminCommercePricePreview"
    | "adminCommerceAudit",
  input: RouteBuilderInput = {},
): string {
  return `${normalizeBaseUrl(baseUrl)}${buildControlApiPath(routeKey, input)}`;
}
