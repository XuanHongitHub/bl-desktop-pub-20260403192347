export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type EntitlementState = "active" | "grace_active" | "read_only";
export type WorkspaceMode = "personal" | "team";
export type ControlPlatformRole = "platform_admin";
export type BillingPlanId = "starter" | "growth" | "scale" | "custom";
export type BillingCycle = "monthly" | "yearly";
export type WorkspaceSubscriptionStatus = "active" | "past_due" | "canceled";
export type BillingSource = "internal" | "license" | "stripe";
export type BillingPaymentMethod =
  | "self_host_checkout"
  | "coupon"
  | "license"
  | "stripe";

export interface WorkspaceRecord {
  id: string;
  name: string;
  mode: WorkspaceMode;
  createdAt: string;
  createdBy: string;
}

export interface WorkspaceListItem extends WorkspaceRecord {
  planLabel: string;
  profileLimit: number;
  billingCycle: BillingCycle | null;
  subscriptionStatus: WorkspaceSubscriptionStatus;
  subscriptionSource: BillingSource;
  expiresAt: string | null;
}

export interface MembershipRecord {
  workspaceId: string;
  userId: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface AuthUserRecord {
  userId: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  platformRole: ControlPlatformRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntitlementRecord {
  workspaceId: string;
  state: EntitlementState;
  graceEndsAt: string | null;
  updatedAt: string;
}

export interface InviteRecord {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
  consumedAt: string | null;
}

export interface ShareGrantRecord {
  id: string;
  workspaceId: string;
  resourceType: "profile" | "group";
  resourceId: string;
  recipientEmail: string;
  accessMode: "full" | "run_sync_limited";
  createdAt: string;
  createdBy: string;
  revokedAt: string | null;
}

export interface CouponRecord {
  id: string;
  code: string;
  source: "internal" | "stripe";
  discountPercent: number;
  workspaceAllowlist: string[];
  workspaceDenylist: string[];
  maxRedemptions: number;
  redeemedCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface CouponSelectionResult {
  bestCoupon: CouponRecord | null;
  reason: string;
}

export interface LicenseClaimResult {
  code: string;
  planId: BillingPlanId;
  planLabel: string;
  profileLimit: number;
  billingCycle: BillingCycle;
}

export interface LicenseRedemptionRecord extends LicenseClaimResult {
  workspaceId: string;
  redeemedAt: string;
  redeemedBy: string;
}

export interface WorkspaceSubscriptionRecord {
  workspaceId: string;
  planId: BillingPlanId | null;
  planLabel: string;
  profileLimit: number;
  billingCycle: BillingCycle | null;
  status: WorkspaceSubscriptionStatus;
  source: BillingSource;
  startedAt: string;
  expiresAt: string | null;
  updatedAt: string;
}

export interface BillingInvoiceRecord {
  id: string;
  workspaceId: string;
  planId: BillingPlanId;
  planLabel: string;
  billingCycle: BillingCycle;
  baseAmountUsd: number;
  amountUsd: number;
  discountPercent: number;
  method: BillingPaymentMethod;
  source: BillingSource;
  couponCode: string | null;
  status: "paid";
  createdAt: string;
  paidAt: string;
  actorUserId: string;
  stripeSessionId: string | null;
}

export interface StripeCheckoutRecord {
  id: string;
  workspaceId: string;
  planId: BillingPlanId;
  planLabel: string;
  billingCycle: BillingCycle;
  profileLimit: number;
  baseAmountUsd: number;
  amountUsd: number;
  discountPercent: number;
  couponCode: string | null;
  stripeSessionId: string;
  checkoutUrl: string;
  createdAt: string;
  completedAt: string | null;
  actorUserId: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  actor: string;
  workspaceId?: string;
  targetId?: string;
  reason?: string;
  createdAt: string;
}

export interface WorkspaceOverview {
  workspaceId: string;
  members: number;
  activeInvites: number;
  activeShareGrants: number;
  entitlementState: EntitlementState;
}

export interface WorkspaceBillingState {
  workspaceId: string;
  subscription: WorkspaceSubscriptionRecord;
  recentInvoices: BillingInvoiceRecord[];
}

export interface StripeCheckoutCreateResult {
  checkoutSessionId: string;
  checkoutUrl: string;
  amountUsd: number;
  discountPercent: number;
  couponCode: string | null;
  immediateActivated?: boolean;
  prorationCreditUsd?: number;
  prorationRemainingDays?: number;
}

export interface StripeCheckoutConfirmResult {
  status: "pending" | "paid";
  subscription: WorkspaceSubscriptionRecord | null;
  invoice: BillingInvoiceRecord | null;
}

export interface PlatformAdminOverview {
  workspaces: number;
  members: number;
  activeInvites: number;
  activeShareGrants: number;
  activeCoupons: number;
  entitlementActive: number;
  entitlementGrace: number;
  entitlementReadOnly: number;
  auditsLast24h: number;
}
