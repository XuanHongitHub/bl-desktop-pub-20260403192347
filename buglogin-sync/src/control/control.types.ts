export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type AuthProvider = "password" | "google" | "password_google";
export type EntitlementState = "active" | "grace_active" | "read_only";
export type WorkspaceMode = "personal" | "team";
export type ControlPlatformRole = "platform_admin";
export type BillingPlanId = "starter" | "growth" | "scale" | "custom";
export type BillingCycle = "monthly" | "yearly";
export type WorkspaceSubscriptionStatus = "active" | "past_due" | "canceled";
export type BillingSource = "internal" | "license" | "stripe";
export type BillingCancellationMode = "period_end" | "immediate";
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
  actorRole: WorkspaceRole;
  planLabel: string;
  profileLimit: number;
  memberLimit: number;
  billingCycle: BillingCycle | null;
  subscriptionStatus: WorkspaceSubscriptionStatus;
  subscriptionSource: BillingSource;
  expiresAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
}

export interface MembershipRecord {
  workspaceId: string;
  userId: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface PlatformAdminListResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type PlatformAdminUserAccountState = "active" | "locked";

export interface PlatformAdminUserListItem {
  userId: string;
  email: string;
  platformRole: ControlPlatformRole | null;
  authProvider: AuthProvider;
  hasPasswordAuth: boolean;
  hasGoogleAuth: boolean;
  workspaceCount: number;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
  accountState: PlatformAdminUserAccountState;
}

export interface PlatformAdminUserWorkspaceMembership {
  userId: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface PlatformAdminUserDetail extends PlatformAdminUserListItem {
  memberships: PlatformAdminUserWorkspaceMembership[];
  recentAuditLogs: AuditLogRecord[];
}

export interface PlatformAdminMembershipItem {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
  platformRole: ControlPlatformRole | null;
  authProvider: AuthProvider;
}

export interface AuthUserRecord {
  userId: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  authProvider: AuthProvider;
  googleSub: string | null;
  platformRole: ControlPlatformRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAdminEmailRecord {
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceAdminTiktokStateRecord {
  workspaceId: string;
  bearerKey: string;
  workflowRows: unknown[];
  rotationCursor: number;
  autoWorkflowRun?: unknown | null;
  operationProgress?: unknown | null;
  updatedAt: string;
}

export interface WorkspaceTiktokCookieSourceRecord {
  id: string;
  workspaceId: string;
  phone: string;
  apiPhone: string;
  cookie: string;
  source: "excel_import";
  createdAt: string;
  updatedAt: string;
}

export type TiktokAutomationFlowType =
  | "signup"
  | "signup_seller"
  | "update_cookie";
export type TiktokAutomationRunMode = "auto" | "semi";
export type TiktokAutomationRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "stopped"
  | "completed"
  | "failed";
export type TiktokAutomationItemStatus =
  | "queued"
  | "running"
  | "manual_pending"
  | "step_failed"
  | "blocked"
  | "done"
  | "skipped"
  | "cancelled";

export interface TiktokAutomationAccountRecord {
  id: string;
  workspaceId: string;
  flowType: TiktokAutomationFlowType;
  phone: string;
  apiPhone: string;
  cookie: string;
  username: string;
  password: string;
  profileId: string | null;
  profileName: string | null;
  status: TiktokAutomationItemStatus;
  lastStep: string | null;
  lastError: string | null;
  source: "excel_import" | "manual" | "bugidea_pull";
  createdAt: string;
  updatedAt: string;
}

export interface TiktokAutomationRunRecord {
  id: string;
  workspaceId: string;
  flowType: TiktokAutomationFlowType;
  mode: TiktokAutomationRunMode;
  status: TiktokAutomationRunStatus;
  accountIds: string[];
  currentIndex: number;
  activeItemId: string | null;
  totalCount: number;
  doneCount: number;
  failedCount: number;
  blockedCount: number;
  createdBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TiktokAutomationRunItemRecord {
  id: string;
  runId: string;
  workspaceId: string;
  accountId: string;
  phone: string;
  apiPhone: string;
  profileId: string | null;
  profileName: string | null;
  status: TiktokAutomationItemStatus;
  step: string;
  attempt: number;
  username: string;
  password: string;
  cookiePreview: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface TiktokCookieRecord {
  id: string;
  label: string;
  cookie: string;
  status: string;
  notes: string | null;
  testedAt: string | null;
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
  maxPerUser: number;
  maxPerWorkspace: number;
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
  memberLimit: number;
  billingCycle: BillingCycle;
}

export interface LicenseRedemptionRecord extends LicenseClaimResult {
  workspaceId: string;
  redeemedAt: string;
  redeemedBy: string;
  memberLimit: number;
}

export interface WorkspaceSubscriptionRecord {
  workspaceId: string;
  planId: BillingPlanId | null;
  planLabel: string;
  profileLimit: number;
  memberLimit: number;
  billingCycle: BillingCycle | null;
  status: WorkspaceSubscriptionStatus;
  source: BillingSource;
  startedAt: string;
  expiresAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
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
  usage: WorkspaceBillingUsage;
}

export interface WorkspaceBillingUsage {
  storageUsedBytes: number;
  storageLimitMb: number;
  proxyBandwidthUsedMb: number;
  proxyBandwidthLimitMb: number;
  updatedAt: string | null;
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

export interface PlatformAdminWorkspaceHealthRow {
  workspaceId: string;
  workspaceName: string;
  mode: WorkspaceMode;
  planId: BillingPlanId | null;
  planLabel: string;
  subscriptionStatus: WorkspaceSubscriptionStatus;
  entitlementState: EntitlementState;
  profileLimit: number;
  memberLimit: number;
  members: number;
  activeInvites: number;
  activeShareGrants: number;
  storageUsedBytes: number;
  storageLimitMb: number;
  storagePercent: number;
  proxyBandwidthUsedMb: number;
  proxyBandwidthLimitMb: number;
  proxyBandwidthPercent: number;
  latestInvoiceAt: string | null;
  usageUpdatedAt: string | null;
  riskLevel: "low" | "medium" | "high";
}

export interface PlatformAdminWorkspaceOwnerSummary {
  userId: string;
  email: string;
}

export interface PlatformAdminWorkspaceDetail
  extends PlatformAdminWorkspaceHealthRow {
  createdAt: string;
  createdBy: string;
  owner: PlatformAdminWorkspaceOwnerSummary | null;
  memberships: PlatformAdminUserWorkspaceMembership[];
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  recentAuditLogs: AuditLogRecord[];
}

export interface PlatformAdminInvoiceListItem extends BillingInvoiceRecord {
  workspaceName: string;
  actorEmail: string | null;
}

export interface PlatformAdminRevenueSummary {
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  canceledSubscriptions: number;
  grossRevenueUsd: number;
  invoiceCount: number;
  payingWorkspaces: number;
}

export interface PlatformAdminAutomationRunListItem {
  runId: string;
  workspaceId: string;
  workspaceName: string;
  flowType: TiktokAutomationFlowType;
  mode: TiktokAutomationRunMode;
  status: TiktokAutomationRunStatus;
  totalCount: number;
  doneCount: number;
  failedCount: number;
  blockedCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
