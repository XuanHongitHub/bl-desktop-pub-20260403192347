import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import type { EntitlementState, WorkspaceMode, WorkspaceRole } from "./control.types.js";
import { ControlService } from "./control.service.js";

type ActorHeaders = {
  "x-user-id"?: string;
  "x-user-email"?: string;
  "x-platform-role"?: string;
};

@Controller("v1/control")
export class ControlController {
  constructor(private readonly controlService: ControlService) {}

  @Post("workspaces")
  createWorkspace(
    @Headers() headers: ActorHeaders,
    @Body() body: { name: string; mode?: WorkspaceMode },
  ) {
    return this.controlService.createWorkspace(
      this.actorFromHeaders(headers),
      (body.name || "Workspace").trim(),
      body.mode ?? "team",
    );
  }

  @Get("workspaces")
  listWorkspaces(@Headers() headers: ActorHeaders) {
    return this.controlService.listWorkspaces(this.actorFromHeaders(headers));
  }

  @Get("workspaces/:workspaceId/entitlement")
  getEntitlement(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.controlService.getEntitlement(workspaceId, this.actorFromHeaders(headers));
  }

  @Patch("workspaces/:workspaceId/entitlement")
  setEntitlement(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body() body: { state: EntitlementState; reason: string },
  ) {
    return this.controlService.setEntitlement(
      workspaceId,
      body.state,
      this.actorFromHeaders(headers),
      body.reason,
    );
  }

  @Get("workspaces/:workspaceId/overview")
  getWorkspaceOverview(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.controlService.getWorkspaceOverview(
      workspaceId,
      this.actorFromHeaders(headers),
    );
  }

  @Get("workspaces/:workspaceId/members")
  listMemberships(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.controlService.listMemberships(workspaceId, this.actorFromHeaders(headers));
  }

  @Post("workspaces/:workspaceId/members/invite")
  inviteMember(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body() body: { email: string; role: WorkspaceRole },
  ) {
    return this.controlService.createInvite(
      workspaceId,
      body.email,
      body.role,
      this.actorFromHeaders(headers),
    );
  }

  @Patch("workspaces/:workspaceId/members/:targetUserId/role")
  updateMembershipRole(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("targetUserId") targetUserId: string,
    @Body() body: { role: WorkspaceRole; reason: string },
  ) {
    return this.controlService.updateMembershipRole(
      workspaceId,
      targetUserId,
      body.role,
      this.actorFromHeaders(headers),
      body.reason,
    );
  }

  @Post("workspaces/:workspaceId/members/:targetUserId/remove")
  removeMembership(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("targetUserId") targetUserId: string,
    @Body() body: { reason: string },
  ) {
    return this.controlService.removeMembership(
      workspaceId,
      targetUserId,
      this.actorFromHeaders(headers),
      body.reason,
    );
  }

  @Post("auth/invite/accept")
  acceptInvite(@Headers() headers: ActorHeaders, @Body() body: { token: string }) {
    return this.controlService.acceptInvite(body.token, this.actorFromHeaders(headers));
  }

  @Get("workspaces/:workspaceId/invites")
  listInvites(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.controlService.listInvites(workspaceId, this.actorFromHeaders(headers));
  }

  @Post("workspaces/:workspaceId/invites/:inviteId/revoke")
  revokeInvite(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("inviteId") inviteId: string,
    @Body() body: { reason: string },
  ) {
    return this.controlService.revokeInvite(
      workspaceId,
      inviteId,
      this.actorFromHeaders(headers),
      body.reason,
    );
  }

  @Post("workspaces/:workspaceId/share-grants")
  createShareGrant(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body()
    body: {
      resourceType: "profile" | "group";
      resourceId: string;
      recipientEmail: string;
      reason: string;
    },
  ) {
    return this.controlService.createShareGrant(
      workspaceId,
      body.resourceType,
      body.resourceId,
      body.recipientEmail,
      this.actorFromHeaders(headers),
      body.reason,
    );
  }

  @Post("workspaces/:workspaceId/share-grants/:shareGrantId/revoke")
  revokeShareGrant(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("shareGrantId") shareGrantId: string,
    @Body() body: { reason: string },
  ) {
    return this.controlService.revokeShareGrant(
      workspaceId,
      shareGrantId,
      this.actorFromHeaders(headers),
      body.reason,
    );
  }

  @Get("workspaces/:workspaceId/share-grants")
  listShareGrants(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.controlService.listShareGrants(workspaceId, this.actorFromHeaders(headers));
  }

  @Get("admin/overview")
  getAdminOverview(@Headers() headers: ActorHeaders) {
    return this.controlService.getPlatformAdminOverview(
      this.actorFromHeaders(headers),
    );
  }

  @Get("admin/audit-logs")
  getAuditLogs(@Headers() headers: ActorHeaders, @Query("limit") limit?: string) {
    const parsedLimit = Number(limit || 200);
    return this.controlService.getAuditLogs(
      this.actorFromHeaders(headers),
      Number.isFinite(parsedLimit) ? parsedLimit : 200,
    );
  }

  @Post("admin/coupons")
  createCoupon(
    @Headers() headers: ActorHeaders,
    @Body()
    body: {
      code: string;
      source: "internal" | "stripe";
      discountPercent: number;
      workspaceAllowlist?: string[];
      workspaceDenylist?: string[];
      maxRedemptions: number;
      expiresAt: string;
    },
  ) {
    return this.controlService.createCoupon(this.actorFromHeaders(headers), body);
  }

  @Post("admin/coupons/:couponId/revoke")
  revokeCoupon(
    @Headers() headers: ActorHeaders,
    @Param("couponId") couponId: string,
    @Body() body: { reason: string },
  ) {
    return this.controlService.revokeCoupon(
      couponId,
      this.actorFromHeaders(headers),
      body.reason,
    );
  }

  @Get("admin/coupons")
  listCoupons(@Headers() headers: ActorHeaders) {
    return this.controlService.listCoupons(this.actorFromHeaders(headers));
  }

  @Post("workspaces/:workspaceId/coupons/select-best")
  selectBestCoupon(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body() body: { codes: string[] },
  ) {
    return this.controlService.selectBestCoupon(
      this.actorFromHeaders(headers),
      workspaceId,
      body.codes || [],
    );
  }

  private actorFromHeaders(headers: ActorHeaders) {
    return {
      userId: headers["x-user-id"]?.trim() || "anonymous",
      email: headers["x-user-email"]?.trim().toLowerCase() || "anonymous@local",
      platformRole: headers["x-platform-role"]?.trim() || null,
    };
  }
}
