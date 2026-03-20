import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  AuditLogRecord,
  CouponRecord,
  CouponSelectionResult,
  EntitlementRecord,
  EntitlementState,
  InviteRecord,
  MembershipRecord,
  PlatformAdminOverview,
  ShareGrantRecord,
  WorkspaceMode,
  WorkspaceOverview,
  WorkspaceRecord,
  WorkspaceRole,
} from "./control.types.js";

type RequestActor = {
  userId: string;
  email: string;
  platformRole: string | null;
};

@Injectable()
export class ControlService {
  private readonly workspaces = new Map<string, WorkspaceRecord>();
  private readonly memberships = new Map<string, MembershipRecord[]>();
  private readonly entitlements = new Map<string, EntitlementRecord>();
  private readonly invites = new Map<string, InviteRecord>();
  private readonly shareGrants = new Map<string, ShareGrantRecord>();
  private readonly coupons = new Map<string, CouponRecord>();
  private readonly auditLogs: AuditLogRecord[] = [];

  createWorkspace(actor: RequestActor, name: string, mode: WorkspaceMode) {
    const normalizedName = this.normalizeWorkspaceName(name);
    const workspaceId = randomUUID();
    const now = new Date().toISOString();
    const workspace: WorkspaceRecord = {
      id: workspaceId,
      name: normalizedName,
      mode,
      createdAt: now,
      createdBy: actor.userId,
    };
    this.workspaces.set(workspace.id, workspace);

    const ownerMembership: MembershipRecord = {
      workspaceId,
      userId: actor.userId,
      email: actor.email,
      role: "owner",
      createdAt: now,
    };
    this.memberships.set(workspaceId, [ownerMembership]);
    this.entitlements.set(workspaceId, {
      workspaceId,
      state: "active",
      graceEndsAt: null,
      updatedAt: now,
    });

    this.audit("workspace.created", actor.email, workspaceId, workspaceId);

    return workspace;
  }

  listWorkspaces(actor: RequestActor): WorkspaceRecord[] {
    const ownedMemberships = Array.from(this.memberships.values()).flat();
    const workspaceIds = new Set(
      ownedMemberships
        .filter((membership) => membership.userId === actor.userId)
        .map((membership) => membership.workspaceId),
    );

    return Array.from(this.workspaces.values()).filter((workspace) =>
      workspaceIds.has(workspace.id),
    );
  }

  getWorkspaceMembership(workspaceId: string, actor: RequestActor): MembershipRecord {
    const members = this.memberships.get(workspaceId) || [];
    const membership = members.find((item) => item.userId === actor.userId);
    if (!membership) {
      throw new UnauthorizedException("permission_denied");
    }
    return membership;
  }

  getEntitlement(workspaceId: string, actor: RequestActor): EntitlementRecord {
    this.assertWorkspaceAccess(workspaceId, actor);
    const entitlement = this.entitlements.get(workspaceId);
    if (!entitlement) {
      throw new NotFoundException("entitlement_not_found");
    }
    return entitlement;
  }

  setEntitlement(
    workspaceId: string,
    state: EntitlementState,
    actor: RequestActor,
    reason: string,
  ): EntitlementRecord {
    this.assertPlatformAdmin(actor);
    this.assertWorkspaceExists(workspaceId);
    const normalizedReason = this.requireReason(reason);
    const now = new Date().toISOString();
    const current = this.entitlements.get(workspaceId);
    if (!current) {
      throw new NotFoundException("entitlement_not_found");
    }

    const graceEndsAt =
      state === "grace_active"
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;
    const next: EntitlementRecord = {
      ...current,
      state,
      graceEndsAt,
      updatedAt: now,
    };
    this.entitlements.set(workspaceId, next);

    this.audit(
      "entitlement.updated",
      actor.email,
      workspaceId,
      workspaceId,
      normalizedReason,
    );
    return next;
  }

  createInvite(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    actor: RequestActor,
  ): InviteRecord {
    const membership = this.getWorkspaceMembership(workspaceId, actor);
    const canManageMembers = membership.role === "owner" || membership.role === "admin";
    if (!canManageMembers) {
      throw new UnauthorizedException("permission_denied");
    }
    if (role === "owner" && membership.role !== "owner") {
      throw new UnauthorizedException("permission_denied");
    }
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      throw new BadRequestException("invalid_email");
    }
    const members = this.memberships.get(workspaceId) || [];
    if (members.some((item) => item.email === normalizedEmail)) {
      throw new BadRequestException("member_already_exists");
    }

    const hasActiveInvite = Array.from(this.invites.values()).some(
      (invite) =>
        invite.workspaceId === workspaceId &&
        invite.email === normalizedEmail &&
        invite.consumedAt === null,
    );
    if (hasActiveInvite) {
      throw new BadRequestException("invite_already_exists");
    }

    const now = new Date().toISOString();
    const invite: InviteRecord = {
      id: randomUUID(),
      workspaceId,
      email: normalizedEmail,
      role,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      createdBy: actor.userId,
      consumedAt: null,
    };

    this.invites.set(invite.token, invite);
    this.audit("invite.created", actor.email, workspaceId, invite.id);
    return invite;
  }

  listInvites(workspaceId: string, actor: RequestActor): InviteRecord[] {
    const membership = this.getWorkspaceMembership(workspaceId, actor);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new UnauthorizedException("permission_denied");
    }

    return Array.from(this.invites.values())
      .filter((invite) => invite.workspaceId === workspaceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  revokeInvite(
    workspaceId: string,
    inviteId: string,
    actor: RequestActor,
    reason: string,
  ): InviteRecord {
    const membership = this.getWorkspaceMembership(workspaceId, actor);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new UnauthorizedException("permission_denied");
    }
    const normalizedReason = this.requireReason(reason);
    const invite = Array.from(this.invites.values()).find(
      (item) => item.id === inviteId && item.workspaceId === workspaceId,
    );
    if (!invite) {
      throw new NotFoundException("invite_not_found");
    }
    if (invite.consumedAt) {
      throw new BadRequestException("invite_already_used");
    }

    invite.consumedAt = new Date().toISOString();
    this.invites.set(invite.token, invite);
    this.audit("invite.revoked", actor.email, workspaceId, invite.id, normalizedReason);
    return invite;
  }

  updateMembershipRole(
    workspaceId: string,
    targetUserId: string,
    nextRole: WorkspaceRole,
    actor: RequestActor,
    reason: string,
  ): MembershipRecord {
    const actorMembership = this.getWorkspaceMembership(workspaceId, actor);
    const canManageMembers =
      actorMembership.role === "owner" || actorMembership.role === "admin";
    if (!canManageMembers) {
      throw new UnauthorizedException("permission_denied");
    }
    const normalizedReason = this.requireReason(reason);

    const members = this.memberships.get(workspaceId) || [];
    const targetMembership = members.find((member) => member.userId === targetUserId);
    if (!targetMembership) {
      throw new NotFoundException("membership_not_found");
    }

    if (targetMembership.role === "owner" && actorMembership.role !== "owner") {
      throw new UnauthorizedException("permission_denied");
    }
    if (nextRole === "owner" && actorMembership.role !== "owner") {
      throw new UnauthorizedException("permission_denied");
    }

    if (targetMembership.role === "owner" && nextRole !== "owner") {
      const ownerCount = this.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new UnauthorizedException("last_owner_cannot_be_removed");
      }
    }

    targetMembership.role = nextRole;
    this.memberships.set(workspaceId, members);
    this.audit(
      "membership.role_updated",
      actor.email,
      workspaceId,
      targetUserId,
      normalizedReason,
    );
    return targetMembership;
  }

  listMemberships(workspaceId: string, actor: RequestActor): MembershipRecord[] {
    this.assertWorkspaceAccess(workspaceId, actor);
    return [...(this.memberships.get(workspaceId) || [])];
  }

  removeMembership(
    workspaceId: string,
    targetUserId: string,
    actor: RequestActor,
    reason: string,
  ): MembershipRecord {
    const actorMembership = this.getWorkspaceMembership(workspaceId, actor);
    const canManageMembers =
      actorMembership.role === "owner" || actorMembership.role === "admin";
    if (!canManageMembers) {
      throw new UnauthorizedException("permission_denied");
    }
    const normalizedReason = this.requireReason(reason);
    const members = [...(this.memberships.get(workspaceId) || [])];
    const targetIndex = members.findIndex((member) => member.userId === targetUserId);
    if (targetIndex < 0) {
      throw new NotFoundException("membership_not_found");
    }
    const targetMembership = members[targetIndex];

    if (targetMembership.role === "owner" && actorMembership.role !== "owner") {
      throw new UnauthorizedException("permission_denied");
    }
    if (targetMembership.role === "owner" && this.countOwners(workspaceId) <= 1) {
      throw new UnauthorizedException("last_owner_cannot_be_removed");
    }

    members.splice(targetIndex, 1);
    this.memberships.set(workspaceId, members);
    this.audit(
      "membership.removed",
      actor.email,
      workspaceId,
      targetUserId,
      normalizedReason,
    );
    return targetMembership;
  }

  acceptInvite(token: string, actor: RequestActor): MembershipRecord {
    const invite = this.invites.get(token);
    if (!invite) {
      throw new NotFoundException("invite_not_found");
    }
    if (invite.consumedAt) {
      throw new UnauthorizedException("invite_already_used");
    }
    const normalizedActorEmail = this.normalizeEmail(actor.email);
    if (!normalizedActorEmail || invite.email !== normalizedActorEmail) {
      throw new UnauthorizedException("permission_denied");
    }
    const expired = new Date(invite.expiresAt).getTime() < Date.now();

    const now = new Date().toISOString();
    const members = this.memberships.get(invite.workspaceId) || [];
    const existing = members.find((member) => member.userId === actor.userId);

    if (existing) {
      existing.role = invite.role;
    } else {
      members.push({
        workspaceId: invite.workspaceId,
        userId: actor.userId,
        email: normalizedActorEmail,
        role: invite.role,
        createdAt: now,
      });
    }
    this.memberships.set(invite.workspaceId, members);
    invite.consumedAt = now;
    this.invites.set(token, invite);
    this.audit(
      expired ? "invite.accepted_after_expiry" : "invite.accepted",
      normalizedActorEmail,
      invite.workspaceId,
      invite.id,
      expired ? "expired_link_auto_accepted_for_exact_email" : undefined,
    );

    return (
      members.find((member) => member.userId === actor.userId) || {
        workspaceId: invite.workspaceId,
        userId: actor.userId,
        email: normalizedActorEmail,
        role: invite.role,
        createdAt: now,
      }
    );
  }

  createShareGrant(
    workspaceId: string,
    resourceType: "profile" | "group",
    resourceId: string,
    recipientEmail: string,
    actor: RequestActor,
    reason: string,
  ): ShareGrantRecord {
    const membership = this.getWorkspaceMembership(workspaceId, actor);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new UnauthorizedException("permission_denied");
    }
    const normalizedReason = this.requireReason(reason);
    const normalizedRecipientEmail = this.normalizeEmail(recipientEmail);
    if (!normalizedRecipientEmail) {
      throw new BadRequestException("invalid_email");
    }

    const accessMode =
      this.findMembershipByEmail(normalizedRecipientEmail) !== null
        ? "full"
        : "run_sync_limited";

    const existingGrant = Array.from(this.shareGrants.values()).find(
      (grant) =>
        grant.workspaceId === workspaceId &&
        grant.resourceType === resourceType &&
        grant.resourceId === resourceId &&
        grant.recipientEmail === normalizedRecipientEmail &&
        grant.revokedAt === null,
    );
    if (existingGrant) {
      return existingGrant;
    }

    const grant: ShareGrantRecord = {
      id: randomUUID(),
      workspaceId,
      resourceType,
      resourceId,
      recipientEmail: normalizedRecipientEmail,
      accessMode,
      createdAt: new Date().toISOString(),
      createdBy: actor.userId,
      revokedAt: null,
    };

    this.shareGrants.set(grant.id, grant);
    this.audit("share.created", actor.email, workspaceId, grant.id, normalizedReason);
    return grant;
  }

  revokeShareGrant(
    workspaceId: string,
    shareGrantId: string,
    actor: RequestActor,
    reason: string,
  ): ShareGrantRecord {
    const membership = this.getWorkspaceMembership(workspaceId, actor);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new UnauthorizedException("permission_denied");
    }
    const normalizedReason = this.requireReason(reason);

    const grant = this.shareGrants.get(shareGrantId);
    if (!grant || grant.workspaceId !== workspaceId) {
      throw new NotFoundException("share_not_found");
    }
    if (!grant.revokedAt) {
      grant.revokedAt = new Date().toISOString();
    }
    this.shareGrants.set(grant.id, grant);
    this.audit("share.revoked", actor.email, workspaceId, grant.id, normalizedReason);
    return grant;
  }

  listShareGrants(workspaceId: string, actor: RequestActor): ShareGrantRecord[] {
    this.assertWorkspaceAccess(workspaceId, actor);
    return Array.from(this.shareGrants.values())
      .filter((grant) => grant.workspaceId === workspaceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  getWorkspaceOverview(workspaceId: string, actor: RequestActor): WorkspaceOverview {
    this.assertWorkspaceAccess(workspaceId, actor);
    const entitlement = this.entitlements.get(workspaceId);
    if (!entitlement) {
      throw new NotFoundException("entitlement_not_found");
    }

    const members = this.memberships.get(workspaceId) || [];
    const activeInvites = Array.from(this.invites.values()).filter(
      (invite) => invite.workspaceId === workspaceId && invite.consumedAt === null,
    );
    const activeShareGrants = Array.from(this.shareGrants.values()).filter(
      (grant) => grant.workspaceId === workspaceId && grant.revokedAt === null,
    );

    return {
      workspaceId,
      members: members.length,
      activeInvites: activeInvites.length,
      activeShareGrants: activeShareGrants.length,
      entitlementState: entitlement.state,
    };
  }

  getPlatformAdminOverview(actor: RequestActor): PlatformAdminOverview {
    this.assertPlatformAdmin(actor);

    const entitlementStates = Array.from(this.entitlements.values());
    const activeCoupons = Array.from(this.coupons.values()).filter(
      (coupon) => !coupon.revokedAt && new Date(coupon.expiresAt).getTime() > Date.now(),
    );
    const auditsLast24h = this.auditLogs.filter((log) => {
      const at = new Date(log.createdAt).getTime();
      return Number.isFinite(at) && Date.now() - at <= 24 * 60 * 60 * 1000;
    });

    return {
      workspaces: this.workspaces.size,
      members: Array.from(this.memberships.values()).reduce(
        (sum, members) => sum + members.length,
        0,
      ),
      activeInvites: Array.from(this.invites.values()).filter(
        (invite) => invite.consumedAt === null,
      ).length,
      activeShareGrants: Array.from(this.shareGrants.values()).filter(
        (grant) => grant.revokedAt === null,
      ).length,
      activeCoupons: activeCoupons.length,
      entitlementActive: entitlementStates.filter((item) => item.state === "active")
        .length,
      entitlementGrace: entitlementStates.filter((item) => item.state === "grace_active")
        .length,
      entitlementReadOnly: entitlementStates.filter((item) => item.state === "read_only")
        .length,
      auditsLast24h: auditsLast24h.length,
    };
  }

  getAuditLogs(actor: RequestActor, limit = 200): AuditLogRecord[] {
    this.assertPlatformAdmin(actor);
    const normalizedLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(1000, Math.trunc(limit)))
      : 200;
    return this.auditLogs.slice(-normalizedLimit).reverse();
  }

  createCoupon(
    actor: RequestActor,
    input: {
      code: string;
      source: "internal" | "stripe";
      discountPercent: number;
      workspaceAllowlist?: string[];
      workspaceDenylist?: string[];
      maxRedemptions: number;
      expiresAt: string;
    },
  ): CouponRecord {
    this.assertPlatformAdmin(actor);
    const normalizedCode = input.code.trim().toUpperCase();
    if (!normalizedCode || !/^[A-Z0-9_-]{3,40}$/.test(normalizedCode)) {
      throw new BadRequestException("invalid_coupon_code");
    }
    if (!Number.isFinite(input.discountPercent) || input.discountPercent <= 0) {
      throw new BadRequestException("invalid_discount_percent");
    }
    if (input.discountPercent > 95) {
      throw new BadRequestException("discount_too_high");
    }
    if (!Number.isFinite(input.maxRedemptions) || input.maxRedemptions < 0) {
      throw new BadRequestException("invalid_max_redemptions");
    }
    const expiresAtMs = new Date(input.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      throw new BadRequestException("invalid_expiry");
    }
    const codeConflict = Array.from(this.coupons.values()).some(
      (coupon) => coupon.code === normalizedCode && coupon.revokedAt === null,
    );
    if (codeConflict) {
      throw new BadRequestException("coupon_code_conflict");
    }

    const coupon: CouponRecord = {
      id: randomUUID(),
      code: normalizedCode,
      source: input.source,
      discountPercent: input.discountPercent,
      workspaceAllowlist: input.workspaceAllowlist?.filter(Boolean) ?? [],
      workspaceDenylist: input.workspaceDenylist?.filter(Boolean) ?? [],
      maxRedemptions: input.maxRedemptions,
      redeemedCount: 0,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: new Date().toISOString(),
      createdBy: actor.userId,
    };

    this.coupons.set(coupon.id, coupon);
    this.audit("coupon.created", actor.email, undefined, coupon.id);
    return coupon;
  }

  revokeCoupon(couponId: string, actor: RequestActor, reason: string): CouponRecord {
    this.assertPlatformAdmin(actor);
    const normalizedReason = this.requireReason(reason);
    const coupon = this.coupons.get(couponId);
    if (!coupon) {
      throw new NotFoundException("coupon_not_found");
    }

    if (!coupon.revokedAt) {
      coupon.revokedAt = new Date().toISOString();
    }
    this.coupons.set(coupon.id, coupon);
    this.audit("coupon.revoked", actor.email, undefined, coupon.id, normalizedReason);
    return coupon;
  }

  listCoupons(actor: RequestActor): CouponRecord[] {
    this.assertPlatformAdmin(actor);
    return Array.from(this.coupons.values());
  }

  selectBestCoupon(
    actor: RequestActor,
    workspaceId: string,
    codes: string[],
  ): CouponSelectionResult {
    this.assertWorkspaceAccess(workspaceId, actor);
    const normalizedCodes = new Set(codes.map((code) => code.trim().toUpperCase()));
    if (normalizedCodes.size === 0) {
      return {
        bestCoupon: null,
        reason: "no_coupon_provided",
      };
    }
    const now = Date.now();

    const candidates = Array.from(this.coupons.values()).filter((coupon) => {
      if (!normalizedCodes.has(coupon.code)) return false;
      if (coupon.revokedAt) return false;
      if (new Date(coupon.expiresAt).getTime() < now) return false;
      if (coupon.maxRedemptions > 0 && coupon.redeemedCount >= coupon.maxRedemptions) return false;
      if (coupon.workspaceAllowlist.length > 0 && !coupon.workspaceAllowlist.includes(workspaceId)) {
        return false;
      }
      if (coupon.workspaceDenylist.includes(workspaceId)) return false;
      return true;
    });

    if (candidates.length === 0) {
      return {
        bestCoupon: null,
        reason: "no_eligible_coupon",
      };
    }

    const bestCoupon = candidates.sort(
      (left, right) => right.discountPercent - left.discountPercent,
    )[0];
    bestCoupon.redeemedCount += 1;
    this.coupons.set(bestCoupon.id, bestCoupon);
    this.audit("coupon.applied", actor.email, workspaceId, bestCoupon.id);

    return {
      bestCoupon,
      reason: "best_discount_selected",
    };
  }

  private assertWorkspaceAccess(workspaceId: string, actor: RequestActor) {
    this.assertWorkspaceExists(workspaceId);
    this.getWorkspaceMembership(workspaceId, actor);
  }

  private assertWorkspaceExists(workspaceId: string) {
    if (!this.workspaces.has(workspaceId)) {
      throw new NotFoundException("workspace_not_found");
    }
  }

  private assertPlatformAdmin(actor: RequestActor) {
    if (actor.platformRole !== "platform_admin") {
      throw new UnauthorizedException("permission_denied");
    }
  }

  private audit(
    action: string,
    actor: string,
    workspaceId?: string,
    targetId?: string,
    reason?: string,
  ) {
    this.auditLogs.push({
      id: randomUUID(),
      action,
      actor,
      workspaceId,
      targetId,
      reason,
      createdAt: new Date().toISOString(),
    });
  }

  private findMembershipByEmail(email: string): MembershipRecord | null {
    for (const memberships of this.memberships.values()) {
      const membership = memberships.find((item) => item.email === email);
      if (membership) {
        return membership;
      }
    }
    return null;
  }

  private countOwners(workspaceId: string): number {
    const members = this.memberships.get(workspaceId) || [];
    return members.filter((member) => member.role === "owner").length;
  }

  private normalizeEmail(email: string): string | null {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return null;
    }
    return normalized;
  }

  private normalizeWorkspaceName(name: string): string {
    const normalized = name.trim();
    if (!normalized) {
      return "Workspace";
    }
    return normalized.slice(0, 120);
  }

  private requireReason(reason: string): string {
    const normalized = reason.trim();
    if (!normalized) {
      throw new BadRequestException("reason_required");
    }
    return normalized;
  }
}
