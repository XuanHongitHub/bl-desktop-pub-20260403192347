import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ControlAuthGuard } from "./control-auth.guard.js";
import type { EntitlementState, WorkspaceMode, WorkspaceRole } from "./control.types.js";
import { ControlService } from "./control.service.js";

type ActorHeaders = {
  "x-user-id"?: string;
  "x-user-email"?: string;
  "x-platform-role"?: string;
};

@Controller("v1/control")
@UseGuards(ControlAuthGuard)
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
  listWorkspaces(
    @Headers() headers: ActorHeaders,
    @Query("scope") scope?: string,
  ) {
    const effectiveScope = scope === "all" ? "all" : "member";
    return this.controlService.listWorkspaces(
      this.actorFromHeaders(headers),
      effectiveScope,
    );
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

  @Get("workspaces/:workspaceId/billing/state")
  getWorkspaceBillingState(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.controlService.getWorkspaceBillingState(
      workspaceId,
      this.actorFromHeaders(headers),
    );
  }

  @Patch("workspaces/:workspaceId/billing/subscription/admin-override")
  overrideWorkspaceSubscriptionAsAdmin(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body()
    body: {
      planId: "starter" | "growth" | "scale" | "custom";
      billingCycle: "monthly" | "yearly";
      profileLimit?: number;
      memberLimit?: number;
      expiresAt?: string | null;
      planLabel?: string | null;
    },
  ) {
    return this.controlService.overrideWorkspaceSubscriptionAsAdmin(
      this.actorFromHeaders(headers),
      workspaceId,
      body,
    );
  }

  @Post("workspaces/:workspaceId/billing/internal-activate")
  activateWorkspacePlanInternal(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body()
    body: {
      planId: "starter" | "growth" | "scale" | "custom";
      billingCycle: "monthly" | "yearly";
      method: "self_host_checkout" | "coupon";
      couponCode?: string | null;
    },
  ) {
    return this.controlService.activateWorkspacePlanInternal(
      this.actorFromHeaders(headers),
      workspaceId,
      body,
    );
  }

  @Post("workspaces/:workspaceId/billing/stripe-checkout")
  createStripeCheckout(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body()
    body: {
      planId: "starter" | "growth" | "scale" | "custom";
      billingCycle: "monthly" | "yearly";
      couponCode?: string | null;
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    return this.controlService.createStripeCheckout(
      this.actorFromHeaders(headers),
      workspaceId,
      body,
    );
  }

  @Post("workspaces/:workspaceId/billing/stripe-checkout/:checkoutSessionId/confirm")
  confirmStripeCheckout(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("checkoutSessionId") checkoutSessionId: string,
  ) {
    return this.controlService.confirmStripeCheckout(
      this.actorFromHeaders(headers),
      workspaceId,
      checkoutSessionId,
    );
  }

  @Post("workspaces/:workspaceId/billing/subscription/cancel")
  cancelWorkspaceSubscription(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body() body: { mode: "period_end" | "immediate" },
  ) {
    return this.controlService.cancelWorkspaceSubscription(
      this.actorFromHeaders(headers),
      workspaceId,
      body,
    );
  }

  @Post("workspaces/:workspaceId/billing/subscription/reactivate")
  reactivateWorkspaceSubscription(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.controlService.reactivateWorkspaceSubscription(
      this.actorFromHeaders(headers),
      workspaceId,
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

  @Get("auth/me")
  getAuthProfile(@Headers() headers: ActorHeaders) {
    return this.controlService.getAuthActorProfile(
      this.actorFromHeaders(headers),
    );
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

  @Get("workspaces/:workspaceId/admin/tiktok-state")
  getWorkspaceAdminTiktokState(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.controlService.getWorkspaceAdminTiktokState(
      workspaceId,
      this.actorFromHeaders(headers),
    );
  }

  @Put("workspaces/:workspaceId/admin/tiktok-state")
  saveWorkspaceAdminTiktokState(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body()
    body: {
      bearerKey?: string;
      workflowRows?: unknown[];
      rotationCursor?: number;
      autoWorkflowRun?: unknown | null;
      operationProgress?: unknown | null;
    },
  ) {
    return this.controlService.saveWorkspaceAdminTiktokState(
      workspaceId,
      this.actorFromHeaders(headers),
      {
        bearerKey: body.bearerKey ?? "",
        workflowRows: Array.isArray(body.workflowRows) ? body.workflowRows : [],
        rotationCursor: Number(body.rotationCursor ?? 0),
        autoWorkflowRun: body.autoWorkflowRun ?? null,
        operationProgress: body.operationProgress ?? null,
      },
    );
  }

  @Get("workspaces/:workspaceId/admin/tiktok-cookie-sources")
  getWorkspaceTiktokCookieSources(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.controlService.getWorkspaceTiktokCookieSources(
      workspaceId,
      this.actorFromHeaders(headers),
    );
  }

  @Put("workspaces/:workspaceId/admin/tiktok-cookie-sources")
  replaceWorkspaceTiktokCookieSources(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body()
    body: {
      rows?: Array<{
        phone?: string;
        apiPhone?: string;
        cookie?: string;
      }>;
    },
  ) {
    return this.controlService.replaceWorkspaceTiktokCookieSources(
      workspaceId,
      this.actorFromHeaders(headers),
      {
        rows: Array.isArray(body.rows) ? body.rows : [],
      },
    );
  }

  @Get("workspaces/:workspaceId/admin/tiktok-automation/accounts")
  getWorkspaceTiktokAutomationAccounts(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Query("flowType") flowType?: "signup" | "signup_seller" | "update_cookie",
  ) {
    return this.controlService.getWorkspaceTiktokAutomationAccounts(
      workspaceId,
      this.actorFromHeaders(headers),
      flowType,
    );
  }

  @Post("workspaces/:workspaceId/admin/tiktok-automation/import")
  importWorkspaceTiktokAutomationAccounts(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body()
    body: {
      rows?: Array<{
        phone?: string;
        apiPhone?: string;
        cookie?: string;
        username?: string;
        password?: string;
        profileId?: string | null;
        profileName?: string | null;
        source?: "excel_import" | "manual" | "bugidea_pull";
      }>;
      force?: boolean;
      flowType?: "signup" | "signup_seller" | "update_cookie";
    },
  ) {
    return this.controlService.importWorkspaceTiktokAutomationAccounts(
      workspaceId,
      this.actorFromHeaders(headers),
      {
        rows: Array.isArray(body.rows) ? body.rows : [],
        force: Boolean(body.force),
        flowType:
          body.flowType === "signup_seller"
            ? "signup_seller"
            : body.flowType === "update_cookie"
              ? "update_cookie"
              : "signup",
      },
    );
  }

  @Delete("workspaces/:workspaceId/admin/tiktok-automation/accounts/:accountId")
  deleteWorkspaceTiktokAutomationAccount(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("accountId") accountId: string,
  ) {
    return this.controlService.deleteWorkspaceTiktokAutomationAccount(
      workspaceId,
      accountId,
      this.actorFromHeaders(headers),
    );
  }

  @Get("workspaces/:workspaceId/admin/tiktok-automation/runs")
  getWorkspaceTiktokAutomationRuns(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Query("flowType") flowType?: "signup" | "signup_seller" | "update_cookie",
  ) {
    return this.controlService.getWorkspaceTiktokAutomationRuns(
      workspaceId,
      this.actorFromHeaders(headers),
      flowType,
    );
  }

  @Get("workspaces/:workspaceId/admin/tiktok-automation/runs/:runId")
  getWorkspaceTiktokAutomationRun(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("runId") runId: string,
  ) {
    return this.controlService.getWorkspaceTiktokAutomationRun(
      workspaceId,
      runId,
      this.actorFromHeaders(headers),
    );
  }

  @Post("workspaces/:workspaceId/admin/tiktok-automation/runs")
  createWorkspaceTiktokAutomationRun(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body()
    body: {
      flowType?: "signup" | "signup_seller" | "update_cookie";
      mode?: "auto" | "semi";
      accountIds?: string[];
    },
  ) {
    return this.controlService.createWorkspaceTiktokAutomationRun(
      workspaceId,
      this.actorFromHeaders(headers),
      {
        flowType:
          body.flowType === "signup_seller"
            ? "signup_seller"
            : body.flowType === "update_cookie"
              ? "update_cookie"
              : "signup",
        mode: body.mode === "auto" ? "auto" : "semi",
        accountIds: Array.isArray(body.accountIds) ? body.accountIds : [],
      },
    );
  }

  @Post("workspaces/:workspaceId/admin/tiktok-automation/runs/:runId/start")
  startWorkspaceTiktokAutomationRun(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("runId") runId: string,
  ) {
    return this.controlService.updateWorkspaceTiktokAutomationRunStatus(
      workspaceId,
      runId,
      this.actorFromHeaders(headers),
      "start",
    );
  }

  @Post("workspaces/:workspaceId/admin/tiktok-automation/runs/:runId/pause")
  pauseWorkspaceTiktokAutomationRun(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("runId") runId: string,
  ) {
    return this.controlService.updateWorkspaceTiktokAutomationRunStatus(
      workspaceId,
      runId,
      this.actorFromHeaders(headers),
      "pause",
    );
  }

  @Post("workspaces/:workspaceId/admin/tiktok-automation/runs/:runId/resume")
  resumeWorkspaceTiktokAutomationRun(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("runId") runId: string,
  ) {
    return this.controlService.updateWorkspaceTiktokAutomationRunStatus(
      workspaceId,
      runId,
      this.actorFromHeaders(headers),
      "resume",
    );
  }

  @Post("workspaces/:workspaceId/admin/tiktok-automation/runs/:runId/stop")
  stopWorkspaceTiktokAutomationRun(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("runId") runId: string,
  ) {
    return this.controlService.updateWorkspaceTiktokAutomationRunStatus(
      workspaceId,
      runId,
      this.actorFromHeaders(headers),
      "stop",
    );
  }

  @Put("workspaces/:workspaceId/admin/tiktok-automation/runs/:runId/items/:itemId")
  updateWorkspaceTiktokAutomationRunItem(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("runId") runId: string,
    @Param("itemId") itemId: string,
    @Body()
    body: {
      status?:
        | "queued"
        | "running"
        | "manual_pending"
        | "step_failed"
        | "blocked"
        | "done"
        | "skipped"
        | "cancelled";
      step?: string;
      attempt?: number;
      profileId?: string | null;
      profileName?: string | null;
      cookiePreview?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ) {
    return this.controlService.updateWorkspaceTiktokAutomationRunItem(
      workspaceId,
      runId,
      itemId,
      this.actorFromHeaders(headers),
      body,
    );
  }

  @Get("workspaces/:workspaceId/admin/tiktok-automation/runs/:runId/events")
  getWorkspaceTiktokAutomationRunEvents(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Param("runId") runId: string,
    @Query("since") since?: string,
  ) {
    return this.controlService.getWorkspaceTiktokAutomationRunEvents(
      workspaceId,
      runId,
      this.actorFromHeaders(headers),
      {
        since: since ?? null,
      },
    );
  }

  @Get("admin/overview")
  getAdminOverview(@Headers() headers: ActorHeaders) {
    return this.controlService.getPlatformAdminOverview(
      this.actorFromHeaders(headers),
    );
  }

  @Post("admin/users")
  createAdminUser(
    @Headers() headers: ActorHeaders,
    @Body()
    body: {
      email?: string;
      password?: string;
      platformRole?: "platform_admin" | null;
    },
  ) {
    return this.controlService.createAuthUserAsAdmin(
      this.actorFromHeaders(headers),
      {
        email: body.email ?? "",
        password: body.password ?? "",
        platformRole: body.platformRole ?? null,
      },
    );
  }

  @Get("admin/users")
  listAdminUsers(
    @Headers() headers: ActorHeaders,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.controlService.listAdminUsers(this.actorFromHeaders(headers), {
      q,
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 25),
    });
  }

  @Get("admin/users/:userId")
  getAdminUserDetail(
    @Headers() headers: ActorHeaders,
    @Param("userId") userId: string,
  ) {
    return this.controlService.getAdminUserDetail(
      this.actorFromHeaders(headers),
      userId,
    );
  }

  @Get("admin/workspaces")
  listAdminWorkspaces(
    @Headers() headers: ActorHeaders,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.controlService.listAdminWorkspaces(this.actorFromHeaders(headers), {
      q,
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 25),
    });
  }

  @Get("admin/workspaces/:workspaceId")
  getAdminWorkspaceDetail(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.controlService.getAdminWorkspaceDetail(
      this.actorFromHeaders(headers),
      workspaceId,
    );
  }

  @Patch("admin/workspaces/:workspaceId/owner")
  transferWorkspaceOwnership(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body() body: { userId: string; reason: string },
  ) {
    return this.controlService.transferWorkspaceOwnershipAsAdmin(
      this.actorFromHeaders(headers),
      workspaceId,
      body.userId,
      body.reason,
    );
  }

  @Get("admin/workspace-health")
  getAdminWorkspaceHealth(@Headers() headers: ActorHeaders) {
    return this.controlService.getPlatformWorkspaceHealth(
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
      maxPerUser?: number;
      maxPerWorkspace?: number;
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

  @Post("workspaces/:workspaceId/licenses/claim")
  claimWorkspaceLicense(
    @Headers() headers: ActorHeaders,
    @Param("workspaceId") workspaceId: string,
    @Body() body: { code: string },
  ) {
    return this.controlService.claimWorkspaceLicense(
      this.actorFromHeaders(headers),
      workspaceId,
      body.code,
    );
  }

  private actorFromHeaders(headers: ActorHeaders) {
    return this.controlService.resolveRequestActor({
      userId: headers["x-user-id"],
      email: headers["x-user-email"],
      hintedRole: headers["x-platform-role"] ?? null,
    });
  }
}
