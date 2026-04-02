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
    case "nest":
    default:
      return "/v1/control";
  }
}

type RouteBuilderInput = {
  workspaceId?: string;
  userId?: string;
  route?: "register" | "login" | "google";
  scope?: "member";
  checkoutSessionId?: string;
  planId?: string;
  campaignId?: string;
  couponId?: string;
  licenseId?: string;
  auditLimit?: number;
  q?: string;
  page?: number;
  pageSize?: number;
};

export function buildControlApiPath(
  routeKey:
    | "authMe"
    | "workspaces"
    | "publicAuth"
    | "adminWorkspaceHealth"
    | "workspaceBillingState"
    | "workspaceMembers"
    | "workspaceMemberRole"
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
    | "adminWorkspacesList"
    | "adminWorkspaceDetail"
    | "adminWorkspaceOwnerTransfer"
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
    case "workspaces":
      return input.scope === "member"
        ? `${prefix}/workspaces?scope=member`
        : `${prefix}/workspaces`;
    case "publicAuth":
      return `${prefix}/public/auth/${input.route ?? "login"}`;
    case "adminWorkspaceHealth":
      return `${prefix}/admin/workspace-health`;
    case "workspaceBillingState":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/state`;
    case "workspaceMembers":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/members`;
    case "workspaceMemberRole":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/members/${encodeURIComponent(input.userId ?? "")}/role`;
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
    case "adminWorkspacesList": {
      const params = new URLSearchParams();
      if (input.q?.trim()) {
        params.set("q", input.q.trim());
      }
      params.set("page", String(Math.max(1, input.page ?? 1)));
      params.set("pageSize", String(Math.max(1, input.pageSize ?? 25)));
      return `${prefix}/admin/workspaces?${params.toString()}`;
    }
    case "adminWorkspaceDetail":
      return `${prefix}/admin/workspaces/${encodeURIComponent(input.workspaceId ?? "")}`;
    case "adminWorkspaceOwnerTransfer":
      return `${prefix}/admin/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/owner`;
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
    | "workspaces"
    | "publicAuth"
    | "adminWorkspaceHealth"
    | "workspaceBillingState"
    | "workspaceMembers"
    | "workspaceMemberRole"
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
    | "adminWorkspacesList"
    | "adminWorkspaceDetail"
    | "adminWorkspaceOwnerTransfer"
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
