export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type EntitlementState = "active" | "grace_active" | "read_only";
export type WorkspaceMode = "personal" | "team";

export interface WorkspaceRecord {
  id: string;
  name: string;
  mode: WorkspaceMode;
  createdAt: string;
  createdBy: string;
}

export interface MembershipRecord {
  workspaceId: string;
  userId: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
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
