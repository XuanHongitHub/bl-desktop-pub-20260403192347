import type { BillingCycle } from "@/lib/billing-plans";
import { buildControlApiUrl } from "@/lib/control-api-routes";
import type {
  CommerceAuditEvent,
  CommerceCampaign,
  CommerceCoupon,
  CommerceLicenseKey,
  CommercePlan,
  CommercePricePreviewResult,
  ControlAdminAutomationRunListItem,
  ControlAdminInvoiceListItem,
  ControlAdminListResult,
  ControlAdminMembershipItem,
  ControlAdminOverview,
  ControlAdminRevenueSummary,
  ControlAdminUserDetail,
  ControlAdminUserListItem,
  ControlAdminWorkspaceDetail,
  ControlAdminWorkspaceHealthRow,
  ControlAuditLog,
  ControlCoupon,
  ControlMembership,
  ControlStripeCheckoutConfirmResponse,
  ControlStripeCheckoutCreateResponse,
  ControlWorkspaceBillingState,
  SyncServerConfigStatus,
} from "@/types";

export interface WebBillingConnection {
  controlBaseUrl: string;
  controlToken: string;
  userId: string;
  userEmail: string;
  platformRole?: string | null;
}

export interface WebBillingWorkspaceListItem {
  id: string;
  name: string;
  mode: "personal" | "team";
  createdAt: string;
  createdBy: string;
  planLabel: string;
  profileLimit: number;
  memberLimit: number;
  billingCycle: BillingCycle | null;
  subscriptionStatus: "active" | "past_due" | "canceled";
  subscriptionSource: "internal" | "license" | "stripe";
  expiresAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
}

export interface CreateCheckoutInput {
  planId: "starter" | "team" | "scale" | "enterprise";
  billingCycle: BillingCycle;
  couponCode?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateAdminUserInput {
  email: string;
  password: string;
  platformRole?: "platform_admin" | null;
}

export interface CreateWorkspaceInput {
  name: string;
  mode?: "personal" | "team";
}

export interface OverrideWorkspaceSubscriptionInput {
  planId: "starter" | "team" | "scale" | "enterprise";
  billingCycle: BillingCycle;
  profileLimit?: number;
  memberLimit?: number;
  expiresAt?: string | null;
  planLabel?: string | null;
}

export interface RedeemCouponInput {
  code: string;
}

export interface RedeemLicenseInput {
  key: string;
}

export interface CommercePricePreviewInput {
  workspaceId: string;
  planCode: string;
  interval: BillingCycle;
  campaignId?: string | null;
  couponCode?: string | null;
}

export interface CreateCommercePlanInput {
  code: string;
  name: string;
  profiles: number;
  members: number;
  storageGb: number;
  proxyGb: number;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  supportTier: "email" | "priority" | "dedicated";
}

export interface CreateCommerceCampaignInput {
  name: string;
  priority: number;
  exclusive: boolean;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  targetPlans?: string[];
  targetWorkspaceIds?: string[];
}

export interface CreateCommerceCouponInput {
  code: string;
  discountPercent: number;
  maxRedemptions: number;
  maxPerUser: number;
  maxPerWorkspace: number;
  expiresAt: string;
}

export interface PlatformAdminListQuery {
  q?: string;
  page?: number;
  pageSize?: number;
  status?: "active" | "past_due" | "canceled";
  planIdFilter?: "starter" | "team" | "scale" | "enterprise" | "free";
}

function mapControlCouponToCommerceCoupon(
  input: ControlCoupon,
): CommerceCoupon {
  const expiresAtTime = Date.parse(input.expiresAt);
  const isExpired =
    Number.isFinite(expiresAtTime) && expiresAtTime < Date.now();
  return {
    id: input.id,
    code: input.code,
    status: input.revokedAt ? "disabled" : isExpired ? "expired" : "active",
    discountPercent: input.discountPercent,
    maxRedemptions: input.maxRedemptions,
    redeemedCount: input.redeemedCount,
    maxPerUser: input.maxPerUser,
    maxPerWorkspace: input.maxPerWorkspace,
    expiresAt: input.expiresAt,
    createdAt: input.createdAt,
    updatedAt: input.revokedAt ?? input.createdAt,
  };
}

function mapControlAuditToCommerceAudit(
  input: ControlAuditLog,
): CommerceAuditEvent {
  const target = input.targetId ?? "unknown";
  return {
    id: input.id,
    entityType: "coupon",
    entityId: target,
    action: input.action,
    actorUserId: input.actor,
    before: null,
    after: null,
    createdAt: input.createdAt,
  };
}

export interface CreateCommerceLicenseInput {
  planCode: string;
  seats: number;
  profileQuota: number;
  expiresAt?: string | null;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Ignore JSON parsing failures.
  }
  return response.statusText || `${response.status}`;
}

function buildHeaders(
  connection: WebBillingConnection,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${connection.controlToken}`,
    "x-user-id": connection.userId,
    "x-user-email": connection.userEmail,
  };
  if (connection.platformRole?.trim()) {
    headers["x-platform-role"] = connection.platformRole.trim();
  }
  return headers;
}

async function requestControl<T>(
  connection: WebBillingConnection,
  routeKey:
    | "authMe"
    | "workspaces"
    | "adminOverview"
    | "adminWorkspaceHealth"
    | "workspaceBillingState"
    | "workspaceMembers"
    | "workspaceMemberInvite"
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
  routeInput: {
    workspaceId?: string;
    userId?: string;
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
    status?: "active" | "past_due" | "canceled";
    planIdFilter?: "starter" | "team" | "scale" | "enterprise" | "free";
  },
  init: RequestInit,
): Promise<T> {
  const response = await fetch(
    buildControlApiUrl(connection.controlBaseUrl, routeKey, routeInput),
    {
      ...init,
      headers: {
        ...buildHeaders(connection),
        ...(init.headers || {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function listWorkspaces(
  connection: WebBillingConnection,
): Promise<WebBillingWorkspaceListItem[]> {
  return requestControl<WebBillingWorkspaceListItem[]>(
    connection,
    "workspaces",
    {},
    {
      method: "GET",
    },
  );
}

export async function getAuthMeProfile(
  connection: WebBillingConnection,
): Promise<{
  id: string;
  email: string;
  platformRole: "platform_admin" | null;
}> {
  return requestControl<{
    id: string;
    email: string;
    platformRole: "platform_admin" | null;
  }>(connection, "authMe", {}, { method: "GET" });
}

export async function createWorkspace(
  connection: WebBillingConnection,
  input: CreateWorkspaceInput,
): Promise<{
  id: string;
  name: string;
  mode: "personal" | "team";
  createdAt: string;
  createdBy: string;
}> {
  return requestControl<{
    id: string;
    name: string;
    mode: "personal" | "team";
    createdAt: string;
    createdBy: string;
  }>(
    connection,
    "workspaces",
    {},
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function listAdminWorkspaceHealth(
  connection: WebBillingConnection,
): Promise<ControlAdminWorkspaceHealthRow[]> {
  return requestControl<ControlAdminWorkspaceHealthRow[]>(
    connection,
    "adminWorkspaceHealth",
    {},
    {
      method: "GET",
    },
  );
}

export async function getAdminOverview(
  connection: WebBillingConnection,
): Promise<ControlAdminOverview> {
  return requestControl<ControlAdminOverview>(
    connection,
    "adminOverview",
    {},
    {
      method: "GET",
    },
  );
}

export async function getWorkspaceBillingState(
  connection: WebBillingConnection,
  workspaceId: string,
): Promise<ControlWorkspaceBillingState> {
  return requestControl<ControlWorkspaceBillingState>(
    connection,
    "workspaceBillingState",
    { workspaceId },
    {
      method: "GET",
    },
  );
}

export async function listWorkspaceMembers(
  connection: WebBillingConnection,
  workspaceId: string,
): Promise<ControlMembership[]> {
  return requestControl<ControlMembership[]>(
    connection,
    "workspaceMembers",
    { workspaceId },
    {
      method: "GET",
    },
  );
}

export async function updateWorkspaceMemberRole(
  connection: WebBillingConnection,
  workspaceId: string,
  userId: string,
  role: "owner" | "admin" | "member" | "viewer",
): Promise<ControlMembership> {
  return requestControl<ControlMembership>(
    connection,
    "workspaceMemberRole",
    { workspaceId, userId },
    {
      method: "PATCH",
      body: JSON.stringify({ role, reason: "updated_from_super_admin_users" }),
    },
  );
}

export async function inviteWorkspaceMember(
  connection: WebBillingConnection,
  workspaceId: string,
  input: { email: string; role: "owner" | "admin" | "member" | "viewer" },
): Promise<{
  id: string;
  workspaceId: string;
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
}> {
  return requestControl<{
    id: string;
    workspaceId: string;
    email: string;
    role: "owner" | "admin" | "member" | "viewer";
  }>(
    connection,
    "workspaceMemberInvite",
    { workspaceId },
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function createWorkspaceStripeCheckout(
  connection: WebBillingConnection,
  workspaceId: string,
  input: CreateCheckoutInput,
): Promise<ControlStripeCheckoutCreateResponse> {
  return requestControl<ControlStripeCheckoutCreateResponse>(
    connection,
    "workspaceStripeCheckout",
    { workspaceId },
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function confirmWorkspaceStripeCheckout(
  connection: WebBillingConnection,
  workspaceId: string,
  checkoutSessionId: string,
): Promise<ControlStripeCheckoutConfirmResponse> {
  return requestControl<ControlStripeCheckoutConfirmResponse>(
    connection,
    "workspaceStripeCheckoutConfirm",
    { workspaceId, checkoutSessionId },
    {
      method: "POST",
    },
  );
}

export async function cancelWorkspaceSubscription(
  connection: WebBillingConnection,
  workspaceId: string,
  mode: "period_end" | "immediate",
): Promise<ControlWorkspaceBillingState> {
  return requestControl<ControlWorkspaceBillingState>(
    connection,
    "workspaceCancelSubscription",
    { workspaceId },
    {
      method: "POST",
      body: JSON.stringify({ mode }),
    },
  );
}

export async function reactivateWorkspaceSubscription(
  connection: WebBillingConnection,
  workspaceId: string,
): Promise<ControlWorkspaceBillingState> {
  return requestControl<ControlWorkspaceBillingState>(
    connection,
    "workspaceReactivateSubscription",
    { workspaceId },
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function overrideWorkspaceSubscriptionAsAdmin(
  connection: WebBillingConnection,
  workspaceId: string,
  input: OverrideWorkspaceSubscriptionInput,
): Promise<ControlWorkspaceBillingState> {
  return requestControl<ControlWorkspaceBillingState>(
    connection,
    "workspaceAdminSubscriptionOverride",
    { workspaceId },
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function createAdminUser(
  connection: WebBillingConnection,
  input: CreateAdminUserInput,
): Promise<{
  user: {
    id: string;
    email: string;
    platformRole: "platform_admin" | null;
  };
}> {
  return requestControl<{
    user: {
      id: string;
      email: string;
      platformRole: "platform_admin" | null;
    };
  }>(
    connection,
    "adminUsersCreate",
    {},
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function listAdminUsers(
  connection: WebBillingConnection,
  query: PlatformAdminListQuery = {},
): Promise<ControlAdminListResult<ControlAdminUserListItem>> {
  return requestControl<ControlAdminListResult<ControlAdminUserListItem>>(
    connection,
    "adminUsersList",
    query,
    {
      method: "GET",
    },
  );
}

export async function getAdminUserDetail(
  connection: WebBillingConnection,
  userId: string,
): Promise<ControlAdminUserDetail> {
  return requestControl<ControlAdminUserDetail>(
    connection,
    "adminUserDetail",
    { userId },
    {
      method: "GET",
    },
  );
}

export async function updateAdminUserPlatformRole(
  connection: WebBillingConnection,
  userId: string,
  platformRole: "platform_admin" | null,
): Promise<ControlAdminUserListItem> {
  return requestControl<ControlAdminUserListItem>(
    connection,
    "adminUserPlatformRoleUpdate",
    { userId },
    {
      method: "PATCH",
      body: JSON.stringify({
        platformRole,
        reason: "updated_from_super_admin_permissions",
      }),
    },
  );
}

export async function resetAdminUserPassword(
  connection: WebBillingConnection,
  userId: string,
  password: string,
): Promise<{
  user: {
    id: string;
    email: string;
  };
}> {
  return requestControl<{
    user: {
      id: string;
      email: string;
    };
  }>(
    connection,
    "adminUserPasswordReset",
    { userId },
    {
      method: "PATCH",
      body: JSON.stringify({
        password,
        reason: "updated_from_super_admin_user_edit",
      }),
    },
  );
}

export async function deleteAdminUser(
  connection: WebBillingConnection,
  userId: string,
): Promise<{ deleted: true; userId: string }> {
  return requestControl<{ deleted: true; userId: string }>(
    connection,
    "adminUserDelete",
    { userId },
    {
      method: "DELETE",
      body: JSON.stringify({
        reason: "deleted_from_super_admin_user_edit",
      }),
    },
  );
}

export async function listAdminWorkspaces(
  connection: WebBillingConnection,
  query: PlatformAdminListQuery = {},
): Promise<ControlAdminListResult<ControlAdminWorkspaceDetail>> {
  return requestControl<ControlAdminListResult<ControlAdminWorkspaceDetail>>(
    connection,
    "adminWorkspacesList",
    query,
    {
      method: "GET",
    },
  );
}

export async function listAdminMemberships(
  connection: WebBillingConnection,
  query: PlatformAdminListQuery = {},
): Promise<ControlAdminListResult<ControlAdminMembershipItem>> {
  return requestControl<ControlAdminListResult<ControlAdminMembershipItem>>(
    connection,
    "adminMembershipsList",
    query,
    {
      method: "GET",
    },
  );
}

export async function listAdminInvoices(
  connection: WebBillingConnection,
  query: PlatformAdminListQuery = {},
): Promise<ControlAdminListResult<ControlAdminInvoiceListItem>> {
  return requestControl<ControlAdminListResult<ControlAdminInvoiceListItem>>(
    connection,
    "adminInvoicesList",
    query,
    {
      method: "GET",
    },
  );
}

export async function getAdminRevenue(
  connection: WebBillingConnection,
): Promise<ControlAdminRevenueSummary> {
  return requestControl<ControlAdminRevenueSummary>(
    connection,
    "adminRevenue",
    {},
    {
      method: "GET",
    },
  );
}

export async function listAdminAutomationRuns(
  connection: WebBillingConnection,
  query: PlatformAdminListQuery = {},
): Promise<ControlAdminListResult<ControlAdminAutomationRunListItem>> {
  return requestControl<
    ControlAdminListResult<ControlAdminAutomationRunListItem>
  >(connection, "adminAutomationRuns", query, {
    method: "GET",
  });
}

export async function getControlConfigStatus(
  connection: WebBillingConnection,
): Promise<SyncServerConfigStatus> {
  const response = await fetch(
    `${connection.controlBaseUrl.replace(/\/$/, "")}/config-status`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${connection.controlToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as SyncServerConfigStatus;
}

export async function getAdminWorkspaceDetail(
  connection: WebBillingConnection,
  workspaceId: string,
): Promise<ControlAdminWorkspaceDetail> {
  return requestControl<ControlAdminWorkspaceDetail>(
    connection,
    "adminWorkspaceDetail",
    { workspaceId },
    {
      method: "GET",
    },
  );
}

export async function transferAdminWorkspaceOwner(
  connection: WebBillingConnection,
  workspaceId: string,
  userId: string,
  reason: string,
): Promise<ControlAdminWorkspaceDetail> {
  return requestControl<ControlAdminWorkspaceDetail>(
    connection,
    "adminWorkspaceOwnerTransfer",
    { workspaceId },
    {
      method: "PATCH",
      body: JSON.stringify({ userId, reason }),
    },
  );
}

export async function redeemWorkspaceCoupon(
  connection: WebBillingConnection,
  workspaceId: string,
  input: RedeemCouponInput,
): Promise<ControlWorkspaceBillingState> {
  return requestControl<ControlWorkspaceBillingState>(
    connection,
    "workspaceRedeemCoupon",
    { workspaceId },
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function redeemWorkspaceLicense(
  connection: WebBillingConnection,
  workspaceId: string,
  input: RedeemLicenseInput,
): Promise<ControlWorkspaceBillingState> {
  return requestControl<ControlWorkspaceBillingState>(
    connection,
    "workspaceRedeemLicense",
    { workspaceId },
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function listCommercePlans(
  connection: WebBillingConnection,
): Promise<CommercePlan[]> {
  return requestControl<CommercePlan[]>(
    connection,
    "adminCommercePlans",
    {},
    {
      method: "GET",
    },
  );
}

export async function createCommercePlan(
  connection: WebBillingConnection,
  input: CreateCommercePlanInput,
): Promise<CommercePlan> {
  return requestControl<CommercePlan>(
    connection,
    "adminCommercePlans",
    {},
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function publishCommercePlanVersion(
  connection: WebBillingConnection,
  planId: string,
): Promise<CommercePlan> {
  return requestControl<CommercePlan>(
    connection,
    "adminCommercePlanPublishVersion",
    { planId },
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function listCommerceCampaigns(
  connection: WebBillingConnection,
): Promise<CommerceCampaign[]> {
  return requestControl<CommerceCampaign[]>(
    connection,
    "adminCommerceCampaigns",
    {},
    {
      method: "GET",
    },
  );
}

export async function createCommerceCampaign(
  connection: WebBillingConnection,
  input: CreateCommerceCampaignInput,
): Promise<CommerceCampaign> {
  return requestControl<CommerceCampaign>(
    connection,
    "adminCommerceCampaigns",
    {},
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function activateCommerceCampaign(
  connection: WebBillingConnection,
  campaignId: string,
): Promise<CommerceCampaign> {
  return requestControl<CommerceCampaign>(
    connection,
    "adminCommerceCampaignActivate",
    { campaignId },
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function deactivateCommerceCampaign(
  connection: WebBillingConnection,
  campaignId: string,
): Promise<CommerceCampaign> {
  return requestControl<CommerceCampaign>(
    connection,
    "adminCommerceCampaignDeactivate",
    { campaignId },
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function listCommerceCoupons(
  connection: WebBillingConnection,
): Promise<CommerceCoupon[]> {
  const payload = await requestControl<ControlCoupon[]>(
    connection,
    "adminCommerceCoupons",
    {},
    {
      method: "GET",
    },
  );
  return Array.isArray(payload)
    ? payload.map(mapControlCouponToCommerceCoupon)
    : [];
}

export async function createCommerceCoupon(
  connection: WebBillingConnection,
  input: CreateCommerceCouponInput,
): Promise<CommerceCoupon> {
  const payload = await requestControl<ControlCoupon>(
    connection,
    "adminCommerceCoupons",
    {},
    {
      method: "POST",
      body: JSON.stringify({
        code: input.code,
        source: "internal",
        discountPercent: input.discountPercent,
        maxRedemptions: input.maxRedemptions,
        maxPerUser: input.maxPerUser,
        maxPerWorkspace: input.maxPerWorkspace,
        expiresAt: input.expiresAt,
        workspaceAllowlist: [],
        workspaceDenylist: [],
      }),
    },
  );
  return mapControlCouponToCommerceCoupon(payload);
}

export async function disableCommerceCoupon(
  connection: WebBillingConnection,
  couponId: string,
): Promise<CommerceCoupon> {
  const payload = await requestControl<ControlCoupon>(
    connection,
    "adminCommerceCouponDisable",
    { couponId },
    {
      method: "POST",
      body: JSON.stringify({ reason: "disabled_from_web_commerce" }),
    },
  );
  return mapControlCouponToCommerceCoupon(payload);
}

export async function listCommerceLicenses(
  connection: WebBillingConnection,
): Promise<CommerceLicenseKey[]> {
  return requestControl<CommerceLicenseKey[]>(
    connection,
    "adminCommerceLicenses",
    {},
    {
      method: "GET",
    },
  );
}

export async function createCommerceLicense(
  connection: WebBillingConnection,
  input: CreateCommerceLicenseInput,
): Promise<CommerceLicenseKey> {
  return requestControl<CommerceLicenseKey>(
    connection,
    "adminCommerceLicenses",
    {},
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function revokeCommerceLicense(
  connection: WebBillingConnection,
  licenseId: string,
): Promise<CommerceLicenseKey> {
  return requestControl<CommerceLicenseKey>(
    connection,
    "adminCommerceLicenseRevoke",
    { licenseId },
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function rotateCommerceLicense(
  connection: WebBillingConnection,
  licenseId: string,
): Promise<CommerceLicenseKey> {
  return requestControl<CommerceLicenseKey>(
    connection,
    "adminCommerceLicenseRotate",
    { licenseId },
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export async function previewCommercePrice(
  connection: WebBillingConnection,
  input: CommercePricePreviewInput,
): Promise<CommercePricePreviewResult> {
  return requestControl<CommercePricePreviewResult>(
    connection,
    "adminCommercePricePreview",
    {},
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function listCommerceAudit(
  connection: WebBillingConnection,
  limit = 50,
): Promise<CommerceAuditEvent[]> {
  const payload = await requestControl<ControlAuditLog[]>(
    connection,
    "adminCommerceAudit",
    { auditLimit: limit },
    {
      method: "GET",
    },
  );
  return Array.isArray(payload)
    ? payload.map(mapControlAuditToCommerceAudit)
    : [];
}

export async function listAdminAuditLogs(
  connection: WebBillingConnection,
  limit = 200,
): Promise<ControlAuditLog[]> {
  const payload = await requestControl<ControlAuditLog[]>(
    connection,
    "adminCommerceAudit",
    { auditLimit: limit },
    {
      method: "GET",
    },
  );
  return Array.isArray(payload) ? payload : [];
}
