import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { Pool } from "pg";
import type {
  AuthUserRecord,
  AuditLogRecord,
  BillingCancellationMode,
  BillingInvoiceRecord,
  BillingPaymentMethod,
  BillingSource,
  BillingCycle,
  BillingPlanId,
  CouponRecord,
  CouponSelectionResult,
  EntitlementRecord,
  EntitlementState,
  InviteRecord,
  LicenseClaimResult,
  LicenseRedemptionRecord,
  MembershipRecord,
  PlatformAdminOverview,
  PlatformAdminWorkspaceHealthRow,
  PlatformAdminEmailRecord,
  StripeCheckoutConfirmResult,
  StripeCheckoutCreateResult,
  StripeCheckoutRecord,
  ShareGrantRecord,
  TiktokCookieRecord,
  TiktokAutomationAccountRecord,
  TiktokAutomationFlowType,
  TiktokAutomationRunItemRecord,
  TiktokAutomationRunMode,
  TiktokAutomationRunRecord,
  TiktokAutomationRunStatus,
  TiktokAutomationItemStatus,
  WorkspaceTiktokCookieSourceRecord,
  WorkspaceBillingState,
  WorkspaceBillingUsage,
  WorkspaceListItem,
  WorkspaceMode,
  WorkspaceOverview,
  WorkspaceRecord,
  WorkspaceRole,
  WorkspaceSubscriptionRecord,
  WorkspaceAdminTiktokStateRecord,
} from "./control.types.js";
import { SyncService } from "../sync/sync.service.js";

type RequestActor = {
  userId: string;
  email: string;
  platformRole: string | null;
};

interface PersistedControlState {
  authUsers: AuthUserRecord[];
  workspaces: WorkspaceRecord[];
  workspaceAdminTiktokStates: WorkspaceAdminTiktokStateRecord[];
  workspaceTiktokCookieSources: WorkspaceTiktokCookieSourceRecord[];
  tiktokAutomationAccounts: TiktokAutomationAccountRecord[];
  tiktokAutomationRuns: TiktokAutomationRunRecord[];
  tiktokAutomationRunItems: TiktokAutomationRunItemRecord[];
  memberships: MembershipRecord[];
  entitlements: EntitlementRecord[];
  invites: InviteRecord[];
  shareGrants: ShareGrantRecord[];
  coupons: CouponRecord[];
  licenseRedemptions: LicenseRedemptionRecord[];
  subscriptions: WorkspaceSubscriptionRecord[];
  invoices: BillingInvoiceRecord[];
  stripeCheckouts: StripeCheckoutRecord[];
  tiktokCookies: TiktokCookieRecord[];
  auditLogs: AuditLogRecord[];
}

interface LicenseCatalogEntry {
  code: string;
  planId: BillingPlanId;
  planLabel: string;
  profileLimit: number;
  billingCycle: BillingCycle;
}

@Injectable()
export class ControlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ControlService.name);
  private readonly authUsers = new Map<string, AuthUserRecord>();
  private readonly platformAdminEmails = new Set<string>();
  private readonly workspaces = new Map<string, WorkspaceRecord>();
  private readonly workspaceAdminTiktokStates = new Map<
    string,
    WorkspaceAdminTiktokStateRecord
  >();
  private readonly workspaceTiktokCookieSources = new Map<
    string,
    WorkspaceTiktokCookieSourceRecord[]
  >();
  private readonly workspaceTiktokAutomationAccounts = new Map<
    string,
    TiktokAutomationAccountRecord[]
  >();
  private readonly workspaceTiktokAutomationRuns = new Map<
    string,
    TiktokAutomationRunRecord[]
  >();
  private readonly tiktokAutomationRunItems = new Map<
    string,
    TiktokAutomationRunItemRecord[]
  >();
  private readonly memberships = new Map<string, MembershipRecord[]>();
  private readonly entitlements = new Map<string, EntitlementRecord>();
  private readonly invites = new Map<string, InviteRecord>();
  private readonly shareGrants = new Map<string, ShareGrantRecord>();
  private readonly coupons = new Map<string, CouponRecord>();
  private readonly licenseRedemptions = new Map<string, LicenseRedemptionRecord>();
  private readonly subscriptions = new Map<string, WorkspaceSubscriptionRecord>();
  private readonly invoices = new Map<string, BillingInvoiceRecord>();
  private readonly stripeCheckouts = new Map<string, StripeCheckoutRecord>();
  private readonly tiktokCookies = new Map<string, TiktokCookieRecord>();
  private readonly auditLogs: AuditLogRecord[] = [];
  private readonly databaseUrl: string | null;
  private readonly postgresPool: Pool | null;
  private persistPostgresQueue: Promise<void> = Promise.resolve();
  private readonly workspaceUsageSnapshots = new Map<
    string,
    { storageUsedBytes: number; proxyBandwidthUsedMb: number; updatedAt: string | null }
  >();
  private readonly usageRefreshInFlight = new Set<string>();
  private readonly usageSnapshotTtlMs = 30_000;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly syncService?: SyncService,
  ) {
    const isTestEnv = process.env.NODE_ENV === "test";
    const embeddedLocalDatabaseUrl =
      process.env.BUGLOGIN_EMBEDDED_LOCAL_CONTROL === "1"
        ? "postgres://postgres:postgres@127.0.0.1:5432/buglogin"
        : null;
    this.databaseUrl =
      this.configService?.get<string>("DATABASE_URL")?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      embeddedLocalDatabaseUrl ||
      null;

    if (!isTestEnv && !this.databaseUrl) {
      throw new Error("database_url_required_for_control_plane");
    }

    this.postgresPool = this.databaseUrl
      ? new Pool({
          connectionString: this.databaseUrl,
        })
      : null;
  }

  async onModuleInit() {
    if (!this.postgresPool) {
      this.refreshWorkspaceUsageSnapshots();
      return;
    }
    await this.loadStateFromPostgres();
    this.refreshWorkspaceUsageSnapshots();
  }

  async onModuleDestroy() {
    if (!this.postgresPool) {
      return;
    }
    try {
      await this.persistPostgresQueue;
      await this.postgresPool.end();
    } catch {
      // Ignore shutdown errors.
    }
  }

  private getDefaultPlanProfileLimit(planId: BillingPlanId): number {
    if (planId === "starter") {
      return 50;
    }
    if (planId === "growth") {
      return 300;
    }
    if (planId === "scale") {
      return 1000;
    }
    return 5000;
  }

  private getPlanPriceUsd(planId: BillingPlanId, billingCycle: BillingCycle): number {
    if (planId === "starter") {
      return billingCycle === "monthly" ? 9 : 90;
    }
    if (planId === "growth") {
      return billingCycle === "monthly" ? 29 : 290;
    }
    if (planId === "scale") {
      return billingCycle === "monthly" ? 79 : 790;
    }
    return billingCycle === "monthly" ? 199 : 1990;
  }

  private getPlanStorageLimitMb(planId: BillingPlanId | null): number {
    if (planId === "starter") return 5 * 1024;
    if (planId === "growth") return 30 * 1024;
    if (planId === "scale") return 120 * 1024;
    if (planId === "custom") return 500 * 1024;
    return 0;
  }

  private getPlanProxyBandwidthLimitMb(planId: BillingPlanId | null): number {
    if (planId === "starter") return 2 * 1024;
    if (planId === "growth") return 20 * 1024;
    if (planId === "scale") return 100 * 1024;
    if (planId === "custom") return 500 * 1024;
    return 0;
  }

  private getWorkspaceBillingUsage(
    workspaceId: string,
    subscription: WorkspaceSubscriptionRecord,
  ): WorkspaceBillingUsage {
    const snapshot = this.workspaceUsageSnapshots.get(workspaceId);
    return {
      storageUsedBytes: snapshot?.storageUsedBytes ?? 0,
      storageLimitMb: this.getPlanStorageLimitMb(subscription.planId),
      proxyBandwidthUsedMb: snapshot?.proxyBandwidthUsedMb ?? 0,
      proxyBandwidthLimitMb: this.getPlanProxyBandwidthLimitMb(subscription.planId),
      updatedAt: snapshot?.updatedAt ?? null,
    };
  }

  private refreshWorkspaceUsageSnapshots(): void {
    for (const workspaceId of this.workspaces.keys()) {
      this.refreshWorkspaceUsageSnapshot(workspaceId);
    }
  }

  private refreshWorkspaceUsageSnapshot(workspaceId: string): void {
    if (!this.syncService) {
      return;
    }
    if (this.usageRefreshInFlight.has(workspaceId)) {
      return;
    }

    this.usageRefreshInFlight.add(workspaceId);
    void this.syncService
      .getWorkspaceStorageUsageBytes(workspaceId)
      .then((storageUsedBytes) => {
        if (storageUsedBytes === null) {
          return;
        }
        const existing = this.workspaceUsageSnapshots.get(workspaceId);
        this.workspaceUsageSnapshots.set(workspaceId, {
          storageUsedBytes,
          proxyBandwidthUsedMb: existing?.proxyBandwidthUsedMb ?? 0,
          updatedAt: new Date().toISOString(),
        });
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to refresh workspace usage for ${workspaceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      })
      .finally(() => {
        this.usageRefreshInFlight.delete(workspaceId);
      });
  }

  private getPlanLabel(planId: BillingPlanId): string {
    if (planId === "starter") {
      return "Starter";
    }
    if (planId === "growth") {
      return "Team";
    }
    if (planId === "scale") {
      return "Scale";
    }
    return "Enterprise";
  }

  private getPlanRank(planId: BillingPlanId | null): number {
    if (planId === "starter") {
      return 1;
    }
    if (planId === "growth") {
      return 2;
    }
    if (planId === "scale") {
      return 3;
    }
    if (planId === "custom") {
      return 4;
    }
    return 0;
  }

  private getActorWorkspaceCount(actor: RequestActor): number {
    if (actor.platformRole === "platform_admin") {
      return this.workspaces.size;
    }
    const workspaceIds = new Set(
      this.getActorMembershipEntries(actor)
        .map((membership) => membership.workspaceId),
    );
    return workspaceIds.size;
  }

  private isMembershipForActor(
    membership: MembershipRecord,
    actor: RequestActor,
  ): boolean {
    if (membership.userId !== actor.userId) {
      return false;
    }
    const normalizedMembershipEmail = this.normalizeEmail(membership.email);
    if (!normalizedMembershipEmail || normalizedMembershipEmail.endsWith("@local")) {
      return true;
    }
    return (
      normalizedMembershipEmail === actor.email
    );
  }

  private getActorMembershipEntries(actor: RequestActor): MembershipRecord[] {
    return Array.from(this.memberships.values())
      .flat()
      .filter((membership) => this.isMembershipForActor(membership, actor));
  }

  private assertPlanChangeAllowed(
    actor: RequestActor,
    workspaceId: string,
    targetPlanId: BillingPlanId,
  ) {
    const current = this.getSubscriptionForWorkspace(workspaceId);
    const currentRank = this.getPlanRank(current.planId);
    const targetRank = this.getPlanRank(targetPlanId);
    const isDowngrade = targetRank < currentRank;
    if (!isDowngrade) {
      return;
    }

    const workspaceCount = this.getActorWorkspaceCount(actor);
    if (workspaceCount > 1) {
      throw new BadRequestException("downgrade_not_allowed_for_multi_workspace");
    }
  }

  private getProrationAdjustment(
    workspaceId: string,
    targetPlanId: BillingPlanId,
    targetBillingCycle: BillingCycle,
  ): {
    baseAmountUsd: number;
    prorationCreditUsd: number;
    remainingDays: number;
  } {
    const fullPriceUsd = this.getPlanPriceUsd(targetPlanId, targetBillingCycle);
    const current = this.getSubscriptionForWorkspace(workspaceId);
    if (!current.planId || !current.expiresAt) {
      return {
        baseAmountUsd: fullPriceUsd,
        prorationCreditUsd: 0,
        remainingDays: 0,
      };
    }

    const currentRank = this.getPlanRank(current.planId);
    const targetRank = this.getPlanRank(targetPlanId);
    if (targetRank <= currentRank) {
      return {
        baseAmountUsd: fullPriceUsd,
        prorationCreditUsd: 0,
        remainingDays: 0,
      };
    }

    const expiresAtMs = new Date(current.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) {
      return {
        baseAmountUsd: fullPriceUsd,
        prorationCreditUsd: 0,
        remainingDays: 0,
      };
    }

    const remainingMs = expiresAtMs - Date.now();
    if (remainingMs <= 0) {
      return {
        baseAmountUsd: fullPriceUsd,
        prorationCreditUsd: 0,
        remainingDays: 0,
      };
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const currentCycle = current.billingCycle ?? "monthly";
    const cycleDays = currentCycle === "yearly" ? 365 : 30;
    const remainingDays = Math.max(
      0,
      Math.min(cycleDays, Math.ceil(remainingMs / dayMs)),
    );
    if (remainingDays <= 0) {
      return {
        baseAmountUsd: fullPriceUsd,
        prorationCreditUsd: 0,
        remainingDays: 0,
      };
    }

    const currentPrice = this.getPlanPriceUsd(current.planId, currentCycle);
    const creditPerDay = currentPrice / cycleDays;
    const prorationCreditUsd = Math.max(
      0,
      Math.round(creditPerDay * remainingDays),
    );

    return {
      baseAmountUsd: Math.max(0, fullPriceUsd - prorationCreditUsd),
      prorationCreditUsd,
      remainingDays,
    };
  }

  private getDefaultSubscriptionForWorkspace(
    workspaceId: string,
    mode: WorkspaceMode,
    nowIso: string,
  ): WorkspaceSubscriptionRecord {
    return {
      workspaceId,
      planId: null,
      planLabel: mode === "personal" ? "Free" : "Starter",
      profileLimit: mode === "personal" ? 3 : 100,
      billingCycle: null,
      status: "active",
      source: "internal",
      startedAt: nowIso,
      expiresAt: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      updatedAt: nowIso,
    };
  }

  private getSubscriptionCancelAt(
    subscription: WorkspaceSubscriptionRecord,
  ): string | null {
    return subscription.cancelAt ?? subscription.expiresAt ?? null;
  }

  private resolveWorkspaceSubscriptionLifecycle(
    workspaceId: string,
    existing: WorkspaceSubscriptionRecord,
  ): WorkspaceSubscriptionRecord {
    if (!existing.cancelAtPeriodEnd) {
      return existing;
    }
    const cancelAt = this.getSubscriptionCancelAt(existing);
    if (!cancelAt) {
      return existing;
    }
    const cancelAtMs = new Date(cancelAt).getTime();
    if (!Number.isFinite(cancelAtMs) || cancelAtMs > Date.now()) {
      return existing;
    }

    const workspace = this.workspaces.get(workspaceId);
    const nowIso = new Date().toISOString();
    const fallback = this.getDefaultSubscriptionForWorkspace(
      workspaceId,
      workspace?.mode ?? "team",
      nowIso,
    );
    this.subscriptions.set(workspaceId, fallback);
    return fallback;
  }

  private getSubscriptionForWorkspace(workspaceId: string): WorkspaceSubscriptionRecord {
    const existing = this.subscriptions.get(workspaceId);
    if (existing) {
      return this.resolveWorkspaceSubscriptionLifecycle(workspaceId, existing);
    }
    const workspace = this.workspaces.get(workspaceId);
    const nowIso = new Date().toISOString();
    const fallback = this.getDefaultSubscriptionForWorkspace(
      workspaceId,
      workspace?.mode ?? "team",
      nowIso,
    );
    this.subscriptions.set(workspaceId, fallback);
    return fallback;
  }

  private isWorkspaceBillingManager(actor: RequestActor, workspaceId: string): boolean {
    if (actor.platformRole === "platform_admin") {
      return true;
    }
    const membership = this.getWorkspaceMembership(workspaceId, actor);
    return membership.role === "owner" || membership.role === "admin";
  }

  private isWorkspaceOperator(actor: RequestActor, workspaceId: string): boolean {
    if (actor.platformRole === "platform_admin") {
      return true;
    }
    const membership = this.getWorkspaceMembership(workspaceId, actor);
    return membership.role === "owner" || membership.role === "admin";
  }

  private ensureWorkspaceOperator(actor: RequestActor, workspaceId: string) {
    if (!this.isWorkspaceOperator(actor, workspaceId)) {
      throw new UnauthorizedException("permission_denied");
    }
  }

  private ensureWorkspaceBillingManager(actor: RequestActor, workspaceId: string) {
    if (!this.isWorkspaceBillingManager(actor, workspaceId)) {
      throw new UnauthorizedException("permission_denied");
    }
  }

  private applyWorkspaceSubscription(input: {
    workspaceId: string;
    actor: RequestActor;
    planId: BillingPlanId;
    billingCycle: BillingCycle;
    source: BillingSource;
    profileLimit?: number;
    planLabel?: string;
    expiresAt?: string | null;
  }): WorkspaceSubscriptionRecord {
    const now = new Date().toISOString();
    const profileLimit =
      input.profileLimit && input.profileLimit > 0
        ? Math.round(input.profileLimit)
        : this.getDefaultPlanProfileLimit(input.planId);
    const planLabel = input.planLabel || this.getPlanLabel(input.planId);
    const expiresAt =
      input.expiresAt ??
      new Date(
        Date.now() +
          (input.billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000,
      ).toISOString();

    const next: WorkspaceSubscriptionRecord = {
      workspaceId: input.workspaceId,
      planId: input.planId,
      planLabel,
      profileLimit,
      billingCycle: input.billingCycle,
      status: "active",
      source: input.source,
      startedAt: now,
      expiresAt,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      updatedAt: now,
    };
    this.subscriptions.set(input.workspaceId, next);

    const entitlement = this.entitlements.get(input.workspaceId);
    if (entitlement && entitlement.state !== "active") {
      this.entitlements.set(input.workspaceId, {
        ...entitlement,
        state: "active",
        graceEndsAt: null,
        updatedAt: now,
      });
    }

    return next;
  }

  private consumeCouponForWorkspace(
    workspaceId: string,
    code: string,
    actor: RequestActor,
  ): CouponRecord {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      throw new BadRequestException("invalid_coupon_code");
    }
    const now = Date.now();
    const coupon = Array.from(this.coupons.values()).find(
      (item) => item.code === normalizedCode,
    );
    if (!coupon) {
      throw new BadRequestException("coupon_not_found");
    }
    if (coupon.revokedAt) {
      throw new BadRequestException("coupon_revoked");
    }
    if (new Date(coupon.expiresAt).getTime() <= now) {
      throw new BadRequestException("coupon_expired");
    }
    if (
      coupon.workspaceAllowlist.length > 0 &&
      !coupon.workspaceAllowlist.includes(workspaceId)
    ) {
      throw new BadRequestException("coupon_not_allowed");
    }
    if (coupon.workspaceDenylist.includes(workspaceId)) {
      throw new BadRequestException("coupon_not_allowed");
    }
    if (coupon.maxRedemptions > 0 && coupon.redeemedCount >= coupon.maxRedemptions) {
      throw new BadRequestException("coupon_limit_reached");
    }
    coupon.redeemedCount += 1;
    this.coupons.set(coupon.id, coupon);
    this.audit("coupon.redeemed", actor.email, workspaceId, coupon.id);
    return coupon;
  }

  private createInvoice(input: {
    workspaceId: string;
    actor: RequestActor;
    planId: BillingPlanId;
    billingCycle: BillingCycle;
    baseAmountUsd: number;
    discountPercent: number;
    method: BillingPaymentMethod;
    source: BillingSource;
    couponCode: string | null;
    stripeSessionId?: string | null;
  }): BillingInvoiceRecord {
    const now = new Date().toISOString();
    const discountPercent = Math.max(0, Math.min(100, Math.round(input.discountPercent)));
    const baseAmountUsd = Math.max(0, Math.round(input.baseAmountUsd));
    const amountUsd = Math.max(
      0,
      Math.round(baseAmountUsd * (1 - discountPercent / 100)),
    );
    const invoice: BillingInvoiceRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      planId: input.planId,
      planLabel: this.getPlanLabel(input.planId),
      billingCycle: input.billingCycle,
      baseAmountUsd,
      amountUsd,
      discountPercent,
      method: input.method,
      source: input.source,
      couponCode: input.couponCode,
      status: "paid",
      createdAt: now,
      paidAt: now,
      actorUserId: input.actor.userId,
      stripeSessionId: input.stripeSessionId ?? null,
    };
    this.invoices.set(invoice.id, invoice);
    this.audit("billing.invoice.created", input.actor.email, input.workspaceId, invoice.id);
    return invoice;
  }

  private getStripeSecretKey(): string | null {
    const fromConfig = this.configService?.get<string>("STRIPE_SECRET_KEY")?.trim();
    if (fromConfig) {
      return fromConfig;
    }
    const fromEnv = process.env.STRIPE_SECRET_KEY?.trim();
    return fromEnv || null;
  }

  private parseBillingPlanId(raw: string): BillingPlanId | null {
    const normalized = raw.trim().toLowerCase();
    if (
      normalized === "starter" ||
      normalized === "growth" ||
      normalized === "scale" ||
      normalized === "custom"
    ) {
      return normalized;
    }
    return null;
  }

  private parseBillingCycle(raw: string): BillingCycle {
    const normalized = raw.trim().toLowerCase();
    return normalized === "yearly" ? "yearly" : "monthly";
  }

  private getLicenseCatalog(): LicenseCatalogEntry[] {
    const configuredRaw =
      this.configService?.get<string>("CONTROL_LICENSE_KEYS")?.trim() ||
      process.env.CONTROL_LICENSE_KEYS?.trim() ||
      "";

    const source = configuredRaw;
    if (!source) {
      return [];
    }

    const entries: LicenseCatalogEntry[] = [];
    const seenCodes = new Set<string>();
    for (const chunk of source.split(",")) {
      const value = chunk.trim();
      if (!value) {
        continue;
      }
      const [rawCode, rawPlanId, rawProfileLimit, rawBillingCycle] =
        value.split(":");
      const code = rawCode?.trim().toUpperCase();
      const planId = this.parseBillingPlanId(rawPlanId ?? "");
      if (!code || !planId || seenCodes.has(code)) {
        continue;
      }

      const parsedProfileLimit = Number(rawProfileLimit);
      const profileLimit =
        Number.isFinite(parsedProfileLimit) && parsedProfileLimit > 0
          ? Math.round(parsedProfileLimit)
          : this.getDefaultPlanProfileLimit(planId);
      const billingCycle = this.parseBillingCycle(rawBillingCycle ?? "monthly");

      entries.push({
        code,
        planId,
        planLabel: this.getPlanLabel(planId),
        profileLimit,
        billingCycle,
      });
      seenCodes.add(code);
    }

    return entries;
  }

  claimWorkspaceLicense(
    actor: RequestActor,
    workspaceId: string,
    code: string,
  ): LicenseClaimResult {
    this.assertWorkspaceAccess(workspaceId, actor);
    this.ensureWorkspaceBillingManager(actor, workspaceId);

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode || !/^[A-Z0-9_-]{3,120}$/.test(normalizedCode)) {
      throw new BadRequestException("invalid_license_code");
    }

    const catalogEntry = this.getLicenseCatalog().find(
      (entry) => entry.code === normalizedCode,
    );
    if (!catalogEntry) {
      throw new BadRequestException("license_not_found");
    }

    const existing = this.licenseRedemptions.get(normalizedCode);
    if (existing) {
      if (existing.workspaceId !== workspaceId) {
        throw new BadRequestException("license_already_redeemed");
      }
      this.applyWorkspaceSubscription({
        workspaceId,
        actor,
        planId: existing.planId,
        billingCycle: existing.billingCycle,
        source: "license",
        profileLimit: existing.profileLimit,
        planLabel: existing.planLabel,
      });
      this.createInvoice({
        workspaceId,
        actor,
        planId: existing.planId,
        billingCycle: existing.billingCycle,
        baseAmountUsd: this.getPlanPriceUsd(existing.planId, existing.billingCycle),
        discountPercent: 100,
        method: "license",
        source: "license",
        couponCode: null,
      });
      this.persistState();
      return {
        code: existing.code,
        planId: existing.planId,
        planLabel: existing.planLabel,
        profileLimit: existing.profileLimit,
        billingCycle: existing.billingCycle,
      };
    }

    const redemption: LicenseRedemptionRecord = {
      code: normalizedCode,
      workspaceId,
      planId: catalogEntry.planId,
      planLabel: catalogEntry.planLabel,
      profileLimit: catalogEntry.profileLimit,
      billingCycle: catalogEntry.billingCycle,
      redeemedAt: new Date().toISOString(),
      redeemedBy: actor.userId,
    };
    this.licenseRedemptions.set(normalizedCode, redemption);
    this.applyWorkspaceSubscription({
      workspaceId,
      actor,
      planId: redemption.planId,
      billingCycle: redemption.billingCycle,
      source: "license",
      profileLimit: redemption.profileLimit,
      planLabel: redemption.planLabel,
    });
    this.createInvoice({
      workspaceId,
      actor,
      planId: redemption.planId,
      billingCycle: redemption.billingCycle,
      baseAmountUsd: this.getPlanPriceUsd(redemption.planId, redemption.billingCycle),
      discountPercent: 100,
      method: "license",
      source: "license",
      couponCode: null,
    });
    this.audit("license.claimed", actor.email, workspaceId, normalizedCode);
    this.persistState();

    return {
      code: redemption.code,
      planId: redemption.planId,
      planLabel: redemption.planLabel,
      profileLimit: redemption.profileLimit,
      billingCycle: redemption.billingCycle,
    };
  }

  registerAuthUser(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      throw new BadRequestException("invalid_email");
    }
    const normalizedPassword = this.validatePassword(password);
    if (this.authUsers.has(normalizedEmail)) {
      throw new BadRequestException("email_already_registered");
    }

    const now = new Date().toISOString();
    const stableUserId = this.deriveStableUserId(normalizedEmail);
    const existingMembership = this.findMembershipByEmail(normalizedEmail);
    if (existingMembership && existingMembership.userId !== stableUserId) {
      this.migrateAuthUserId(
        existingMembership.userId,
        stableUserId,
        normalizedEmail,
      );
    }
    const { salt, hash } = this.hashPassword(normalizedPassword);
    const platformRole = this.resolvePlatformRoleForRegistration(normalizedEmail);
    const record: AuthUserRecord = {
      userId: stableUserId,
      email: normalizedEmail,
      passwordSalt: salt,
      passwordHash: hash,
      platformRole,
      createdAt: now,
      updatedAt: now,
    };
    this.authUsers.set(normalizedEmail, record);

    this.audit("auth.registered", normalizedEmail, undefined, stableUserId);
    this.persistState();
    return {
      user: {
        id: record.userId,
        email: record.email,
        platformRole: record.platformRole,
      },
    };
  }

  loginAuthUser(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      throw new BadRequestException("invalid_email");
    }
    const normalizedPassword = this.validatePassword(password);
    const record = this.authUsers.get(normalizedEmail);
    if (!record) {
      throw new UnauthorizedException("invalid_credentials");
    }
    if (!this.verifyPassword(normalizedPassword, record.passwordSalt, record.passwordHash)) {
      throw new UnauthorizedException("invalid_credentials");
    }

    const stableUserId = this.deriveStableUserId(normalizedEmail);
    let needsPersist = false;
    if (record.userId !== stableUserId) {
      this.migrateAuthUserId(record.userId, stableUserId, normalizedEmail);
      record.userId = stableUserId;
      record.updatedAt = new Date().toISOString();
      needsPersist = true;
    }
    if (this.platformAdminEmails.has(normalizedEmail) && record.platformRole !== "platform_admin") {
      record.platformRole = "platform_admin";
      record.updatedAt = new Date().toISOString();
      needsPersist = true;
    }
    if (needsPersist) {
      this.authUsers.set(normalizedEmail, record);
      this.persistState();
    }

    this.audit("auth.logged_in", normalizedEmail, undefined, record.userId);
    return {
      user: {
        id: record.userId,
        email: record.email,
        platformRole: record.platformRole,
      },
    };
  }

  loginOrRegisterGoogleAuthUser(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      throw new BadRequestException("invalid_email");
    }

    const now = new Date().toISOString();
    let record = this.authUsers.get(normalizedEmail);
    let shouldPersist = false;

    if (!record) {
      const stableUserId = this.deriveStableUserId(normalizedEmail);
      const existingMembership = this.findMembershipByEmail(normalizedEmail);
      if (existingMembership && existingMembership.userId !== stableUserId) {
        this.migrateAuthUserId(
          existingMembership.userId,
          stableUserId,
          normalizedEmail,
        );
      }
      const generatedPassword = randomBytes(32).toString("hex");
      const { salt, hash } = this.hashPassword(generatedPassword);
      record = {
        userId: stableUserId,
        email: normalizedEmail,
        passwordSalt: salt,
        passwordHash: hash,
        platformRole: this.resolvePlatformRoleForRegistration(normalizedEmail),
        createdAt: now,
        updatedAt: now,
      };
      this.authUsers.set(normalizedEmail, record);
      this.audit("auth.google_registered", normalizedEmail, undefined, stableUserId);
      shouldPersist = true;
    } else {
      const stableUserId = this.deriveStableUserId(normalizedEmail);
      if (record.userId !== stableUserId) {
        this.migrateAuthUserId(record.userId, stableUserId, normalizedEmail);
        record.userId = stableUserId;
        record.updatedAt = now;
        shouldPersist = true;
      }
      if (this.platformAdminEmails.has(normalizedEmail) && record.platformRole !== "platform_admin") {
        record.platformRole = "platform_admin";
        record.updatedAt = now;
        shouldPersist = true;
      }
      if (shouldPersist) {
        this.authUsers.set(normalizedEmail, record);
      }
    }

    this.audit("auth.google_logged_in", normalizedEmail, undefined, record.userId);
    if (shouldPersist) {
      this.persistState();
    }

    return {
      user: {
        id: record.userId,
        email: record.email,
        platformRole: record.platformRole,
      },
    };
  }

  createWorkspace(actor: RequestActor, name: string, mode: WorkspaceMode) {
    if (mode === "personal") {
      const existingPersonalWorkspace = this.getPrimaryPersonalWorkspaceForActor(actor);
      if (existingPersonalWorkspace) {
        this.ensurePersonalWorkspaceOwnership(existingPersonalWorkspace, actor);
        return existingPersonalWorkspace;
      }
    }

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
    this.subscriptions.set(
      workspaceId,
      this.getDefaultSubscriptionForWorkspace(workspaceId, mode, now),
    );

    this.audit("workspace.created", actor.email, workspaceId, workspaceId);
    this.persistState();

    return workspace;
  }

  listWorkspaces(
    actor: RequestActor,
    scope: "member" | "all" = "member",
  ): WorkspaceListItem[] {
    const toListItem = (
      workspace: WorkspaceRecord,
      actorRole: WorkspaceRole,
    ): WorkspaceListItem => {
      const subscription = this.getSubscriptionForWorkspace(workspace.id);
      return {
        ...workspace,
        actorRole,
        planLabel: subscription.planLabel,
        profileLimit: subscription.profileLimit,
        billingCycle: subscription.billingCycle,
        subscriptionStatus: subscription.status,
        subscriptionSource: subscription.source,
        expiresAt: subscription.expiresAt,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelAt: subscription.cancelAt,
      };
    };

    if (actor.platformRole === "platform_admin" && scope === "all") {
      return Array.from(this.workspaces.values())
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((workspace) => toListItem(workspace, "admin"));
    }

    const actorMembershipByWorkspaceId = new Map<string, MembershipRecord>();
    for (const membership of this.getActorMembershipEntries(actor)) {
      const current = actorMembershipByWorkspaceId.get(membership.workspaceId);
      if (!current) {
        actorMembershipByWorkspaceId.set(membership.workspaceId, membership);
        continue;
      }
      const currentRank = this.getWorkspaceRoleRank(current.role);
      const candidateRank = this.getWorkspaceRoleRank(membership.role);
      if (candidateRank > currentRank) {
        actorMembershipByWorkspaceId.set(membership.workspaceId, membership);
      }
    }

    const primaryPersonalWorkspaceId =
      this.getPrimaryPersonalWorkspaceForActor(actor)?.id ?? null;

    return Array.from(this.workspaces.values())
      .filter((workspace) => {
        const membership = actorMembershipByWorkspaceId.get(workspace.id);
        if (!membership) {
          return false;
        }
        if (workspace.mode === "personal" && workspace.createdBy !== actor.userId) {
          return false;
        }
        if (
          workspace.mode === "personal" &&
          primaryPersonalWorkspaceId &&
          workspace.id !== primaryPersonalWorkspaceId
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((workspace) => {
        const membership = actorMembershipByWorkspaceId.get(workspace.id);
        if (!membership) {
          throw new UnauthorizedException("permission_denied");
        }
        return toListItem(workspace, membership.role);
      });
  }

  getWorkspaceMembership(workspaceId: string, actor: RequestActor): MembershipRecord {
    if (actor.platformRole === "platform_admin") {
      this.assertWorkspaceExists(workspaceId);
      return {
        workspaceId,
        userId: actor.userId,
        email: actor.email,
        role: "owner",
        createdAt: new Date(0).toISOString(),
      };
    }

    const members = this.memberships.get(workspaceId) || [];
    const membership = members.find((item) =>
      this.isMembershipForActor(item, actor),
    );
    if (!membership) {
      throw new UnauthorizedException("permission_denied");
    }
    const workspace = this.workspaces.get(workspaceId);
    if (workspace?.mode === "personal" && workspace.createdBy !== actor.userId) {
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
    this.persistState();
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
    if (role !== "member" && role !== "viewer") {
      throw new BadRequestException("invalid_invite_role");
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
    this.persistState();
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
    this.persistState();
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
    this.persistState();
    return targetMembership;
  }

  listMemberships(workspaceId: string, actor: RequestActor): MembershipRecord[] {
    this.assertWorkspaceAccess(workspaceId, actor);
    const members = [...(this.memberships.get(workspaceId) || [])];
    const authEmailByUserId = new Map<string, string>();
    for (const authUser of this.authUsers.values()) {
      if (authUser.userId?.trim() && authUser.email?.trim()) {
        authEmailByUserId.set(authUser.userId.trim(), authUser.email.trim().toLowerCase());
      }
    }
    return members.map((member) => {
      const normalizedEmail = member.email?.trim().toLowerCase() || "";
      const emailLooksValid =
        normalizedEmail.includes("@") && !normalizedEmail.endsWith("@local");
      if (emailLooksValid) {
        return member;
      }
      const resolvedAuthEmail = authEmailByUserId.get(member.userId);
      if (resolvedAuthEmail) {
        return {
          ...member,
          email: resolvedAuthEmail,
        };
      }
      if (member.userId === actor.userId) {
        return {
          ...member,
          email: actor.email,
        };
      }
      return {
        ...member,
        email: member.userId,
      };
    });
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
    this.persistState();
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
    const existing = members.find((member) =>
      this.isMembershipForActor(member, actor),
    );

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
    this.persistState();

    return (
      members.find((member) => this.isMembershipForActor(member, actor)) || {
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
    this.persistState();
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
    this.persistState();
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

  getWorkspaceBillingState(
    workspaceId: string,
    actor: RequestActor,
  ): WorkspaceBillingState {
    this.assertWorkspaceAccess(workspaceId, actor);
    const subscription = this.getSubscriptionForWorkspace(workspaceId);
    const recentInvoices = Array.from(this.invoices.values())
      .filter((invoice) => invoice.workspaceId === workspaceId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 30);
    const usage = this.getWorkspaceBillingUsage(workspaceId, subscription);
    const usageUpdatedAtMs = usage.updatedAt ? Date.parse(usage.updatedAt) : 0;
    if (
      !usage.updatedAt ||
      Number.isNaN(usageUpdatedAtMs) ||
      Date.now() - usageUpdatedAtMs > this.usageSnapshotTtlMs
    ) {
      this.refreshWorkspaceUsageSnapshot(workspaceId);
    }
    return {
      workspaceId,
      subscription,
      recentInvoices,
      usage,
    };
  }

  cancelWorkspaceSubscription(
    actor: RequestActor,
    workspaceId: string,
    input: { mode: BillingCancellationMode },
  ): WorkspaceBillingState {
    this.assertWorkspaceAccess(workspaceId, actor);
    this.ensureWorkspaceBillingManager(actor, workspaceId);

    const current = this.getSubscriptionForWorkspace(workspaceId);
    if (!current.planId) {
      throw new BadRequestException("billing_subscription_not_cancelable");
    }

    const mode = input.mode === "immediate" ? "immediate" : "period_end";
    const nowIso = new Date().toISOString();

    if (mode === "immediate") {
      const workspace = this.workspaces.get(workspaceId);
      const fallback = this.getDefaultSubscriptionForWorkspace(
        workspaceId,
        workspace?.mode ?? "team",
        nowIso,
      );
      this.subscriptions.set(workspaceId, fallback);
      this.audit(
        "billing.subscription.canceled_immediately",
        actor.email,
        workspaceId,
        workspaceId,
      );
      this.persistState();
      return this.getWorkspaceBillingState(workspaceId, actor);
    }

    if (!current.expiresAt) {
      throw new BadRequestException("billing_subscription_missing_expiry");
    }

    const next: WorkspaceSubscriptionRecord = {
      ...current,
      cancelAtPeriodEnd: true,
      cancelAt: current.expiresAt,
      updatedAt: nowIso,
    };
    this.subscriptions.set(workspaceId, next);
    this.audit(
      "billing.subscription.cancel_at_period_end",
      actor.email,
      workspaceId,
      workspaceId,
    );
    this.persistState();
    return this.getWorkspaceBillingState(workspaceId, actor);
  }

  reactivateWorkspaceSubscription(
    actor: RequestActor,
    workspaceId: string,
  ): WorkspaceBillingState {
    this.assertWorkspaceAccess(workspaceId, actor);
    this.ensureWorkspaceBillingManager(actor, workspaceId);

    const current = this.getSubscriptionForWorkspace(workspaceId);
    if (!current.planId) {
      throw new BadRequestException("billing_subscription_not_reactivatable");
    }

    const next: WorkspaceSubscriptionRecord = {
      ...current,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      updatedAt: new Date().toISOString(),
    };
    this.subscriptions.set(workspaceId, next);
    this.audit(
      "billing.subscription.reactivated",
      actor.email,
      workspaceId,
      workspaceId,
    );
    this.persistState();
    return this.getWorkspaceBillingState(workspaceId, actor);
  }

  activateWorkspacePlanInternal(
    actor: RequestActor,
    workspaceId: string,
    input: {
      planId: BillingPlanId;
      billingCycle: BillingCycle;
      method: "self_host_checkout" | "coupon";
      couponCode?: string | null;
    },
  ): WorkspaceBillingState {
    this.assertWorkspaceAccess(workspaceId, actor);
    this.ensureWorkspaceBillingManager(actor, workspaceId);
    const planId = this.parseBillingPlanId(input.planId);
    if (!planId) {
      throw new BadRequestException("invalid_plan");
    }
    const billingCycle = this.parseBillingCycle(input.billingCycle);
    this.assertPlanChangeAllowed(actor, workspaceId, planId);
    const proration = this.getProrationAdjustment(
      workspaceId,
      planId,
      billingCycle,
    );
    const baseAmountUsd = proration.baseAmountUsd;
    let discountPercent = 0;
    let couponCode: string | null = null;
    if (input.method === "coupon") {
      if (!input.couponCode?.trim()) {
        throw new BadRequestException("coupon_required");
      }
      const coupon = this.consumeCouponForWorkspace(
        workspaceId,
        input.couponCode,
        actor,
      );
      discountPercent = coupon.discountPercent;
      couponCode = coupon.code;
    }
    const subscription = this.applyWorkspaceSubscription({
      workspaceId,
      actor,
      planId,
      billingCycle,
      source: "internal",
    });
    this.createInvoice({
      workspaceId,
      actor,
      planId,
      billingCycle,
      baseAmountUsd,
      discountPercent,
      method: input.method,
      source: "internal",
      couponCode,
    });
    this.audit("billing.internal_activated", actor.email, workspaceId, workspaceId);
    this.persistState();
    return this.getWorkspaceBillingState(workspaceId, actor);
  }

  async createStripeCheckout(
    actor: RequestActor,
    workspaceId: string,
    input: {
      planId: BillingPlanId;
      billingCycle: BillingCycle;
      couponCode?: string | null;
      successUrl: string;
      cancelUrl: string;
    },
  ): Promise<StripeCheckoutCreateResult> {
    this.assertWorkspaceAccess(workspaceId, actor);
    this.ensureWorkspaceBillingManager(actor, workspaceId);

    const stripeSecretKey = this.getStripeSecretKey();
    if (!stripeSecretKey) {
      throw new BadRequestException("stripe_not_configured");
    }

    const planId = this.parseBillingPlanId(input.planId);
    if (!planId) {
      throw new BadRequestException("invalid_plan");
    }
    const billingCycle = this.parseBillingCycle(input.billingCycle);
    this.assertPlanChangeAllowed(actor, workspaceId, planId);

    let successUrl: URL;
    let cancelUrl: URL;
    try {
      successUrl = new URL(input.successUrl);
      cancelUrl = new URL(input.cancelUrl);
    } catch {
      throw new BadRequestException("invalid_return_url");
    }
    if (
      !/^https?:$/i.test(successUrl.protocol) ||
      !/^https?:$/i.test(cancelUrl.protocol)
    ) {
      throw new BadRequestException("invalid_return_url");
    }

    const proration = this.getProrationAdjustment(
      workspaceId,
      planId,
      billingCycle,
    );
    const baseAmountUsd = proration.baseAmountUsd;
    let discountPercent = 0;
    let couponCode: string | null = null;
    if (input.couponCode?.trim()) {
      const selection = this.selectBestCoupon(actor, workspaceId, [input.couponCode]);
      if (selection.bestCoupon) {
        discountPercent = selection.bestCoupon.discountPercent;
        couponCode = selection.bestCoupon.code;
      }
    }
    const amountUsd = Math.max(
      0,
      Math.round(baseAmountUsd * (1 - discountPercent / 100)),
    );
    const planLabel = this.getPlanLabel(planId);
    const profileLimit = this.getDefaultPlanProfileLimit(planId);
    if (amountUsd <= 0) {
      let finalizedCouponCode: string | null = couponCode;
      let finalizedDiscountPercent = discountPercent;
      if (couponCode) {
        const redeemedCoupon = this.consumeCouponForWorkspace(
          workspaceId,
          couponCode,
          actor,
        );
        finalizedCouponCode = redeemedCoupon.code;
        finalizedDiscountPercent = redeemedCoupon.discountPercent;
      }
      this.applyWorkspaceSubscription({
        workspaceId,
        actor,
        planId,
        billingCycle,
        source: "stripe",
        profileLimit,
        planLabel,
      });
      this.createInvoice({
        workspaceId,
        actor,
        planId,
        billingCycle,
        baseAmountUsd,
        discountPercent: finalizedDiscountPercent,
        method: "stripe",
        source: "stripe",
        couponCode: finalizedCouponCode,
        stripeSessionId: null,
      });
      this.audit("billing.stripe_checkout_instant_activated", actor.email, workspaceId, workspaceId);
      this.persistState();
      return {
        checkoutSessionId: `instant_${randomUUID()}`,
        checkoutUrl: successUrl.toString(),
        amountUsd: 0,
        discountPercent: finalizedDiscountPercent,
        couponCode: finalizedCouponCode,
        immediateActivated: true,
        prorationCreditUsd: proration.prorationCreditUsd,
        prorationRemainingDays: proration.remainingDays,
      };
    }
    const amountCents = Math.max(50, Math.round(amountUsd * 100));

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", successUrl.toString());
    params.set("cancel_url", cancelUrl.toString());
    params.set("locale", "auto");
    params.set("billing_address_collection", "auto");
    params.set("customer_email", actor.email);
    params.set("allow_promotion_codes", couponCode ? "false" : "true");
    params.set("metadata[workspace_id]", workspaceId);
    params.set("metadata[plan_id]", planId);
    params.set("metadata[billing_cycle]", billingCycle);
    params.set("metadata[actor_user_id]", actor.userId);
    if (couponCode) {
      params.set("metadata[coupon_code]", couponCode);
    }
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][unit_amount]", String(amountCents));
    params.set(
      "line_items[0][price_data][recurring][interval]",
      billingCycle === "yearly" ? "year" : "month",
    );
    params.set("line_items[0][price_data][product_data][name]", `BugLogin ${planLabel}`);
    params.set(
      "line_items[0][price_data][product_data][description]",
      `Workspace ${workspaceId} · ${planLabel} · ${billingCycle}`,
    );

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const stripeRaw = await stripeResponse.text();
    if (!stripeResponse.ok) {
      throw new BadRequestException(`stripe_checkout_failed:${stripeResponse.status}:${stripeRaw}`);
    }
    const stripePayload = JSON.parse(stripeRaw) as {
      id?: string;
      url?: string;
    };
    if (!stripePayload.id || !stripePayload.url) {
      throw new BadRequestException("stripe_checkout_invalid_response");
    }

    const checkout: StripeCheckoutRecord = {
      id: randomUUID(),
      workspaceId,
      planId,
      planLabel,
      billingCycle,
      profileLimit,
      baseAmountUsd,
      amountUsd,
      discountPercent,
      couponCode,
      stripeSessionId: stripePayload.id,
      checkoutUrl: stripePayload.url,
      createdAt: new Date().toISOString(),
      completedAt: null,
      actorUserId: actor.userId,
    };
    this.stripeCheckouts.set(stripePayload.id, checkout);
    this.audit("billing.stripe_checkout_created", actor.email, workspaceId, stripePayload.id);
    this.persistState();

    return {
      checkoutSessionId: stripePayload.id,
      checkoutUrl: stripePayload.url,
      amountUsd,
      discountPercent,
      couponCode,
      immediateActivated: false,
      prorationCreditUsd: proration.prorationCreditUsd,
      prorationRemainingDays: proration.remainingDays,
    };
  }

  async confirmStripeCheckout(
    actor: RequestActor,
    workspaceId: string,
    checkoutSessionId: string,
  ): Promise<StripeCheckoutConfirmResult> {
    this.assertWorkspaceAccess(workspaceId, actor);
    this.ensureWorkspaceBillingManager(actor, workspaceId);

    const checkout = this.stripeCheckouts.get(checkoutSessionId);
    if (!checkout || checkout.workspaceId !== workspaceId) {
      throw new NotFoundException("checkout_session_not_found");
    }
    if (checkout.completedAt) {
      const billingState = this.getWorkspaceBillingState(workspaceId, actor);
      const invoice =
        billingState.recentInvoices.find(
          (row) => row.stripeSessionId === checkoutSessionId,
        ) ?? null;
      return {
        status: "paid",
        subscription: billingState.subscription,
        invoice,
      };
    }

    const stripeSecretKey = this.getStripeSecretKey();
    if (!stripeSecretKey) {
      throw new BadRequestException("stripe_not_configured");
    }
    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      },
    );
    const stripeRaw = await stripeResponse.text();
    if (!stripeResponse.ok) {
      throw new BadRequestException(`stripe_checkout_lookup_failed:${stripeResponse.status}:${stripeRaw}`);
    }
    const stripePayload = JSON.parse(stripeRaw) as {
      payment_status?: string;
      status?: string;
    };
    const isPaid =
      stripePayload.payment_status === "paid" &&
      stripePayload.status === "complete";
    if (!isPaid) {
      return {
        status: "pending",
        subscription: null,
        invoice: null,
      };
    }

    let couponCode: string | null = null;
    let discountPercent = checkout.discountPercent;
    if (checkout.couponCode) {
      const redeemedCoupon = this.consumeCouponForWorkspace(
        workspaceId,
        checkout.couponCode,
        actor,
      );
      couponCode = redeemedCoupon.code;
      discountPercent = redeemedCoupon.discountPercent;
    }

    const subscription = this.applyWorkspaceSubscription({
      workspaceId,
      actor,
      planId: checkout.planId,
      billingCycle: checkout.billingCycle,
      source: "stripe",
      profileLimit: checkout.profileLimit,
      planLabel: checkout.planLabel,
    });
    const invoice = this.createInvoice({
      workspaceId,
      actor,
      planId: checkout.planId,
      billingCycle: checkout.billingCycle,
      baseAmountUsd: checkout.baseAmountUsd,
      discountPercent,
      method: "stripe",
      source: "stripe",
      couponCode,
      stripeSessionId: checkoutSessionId,
    });
    checkout.completedAt = new Date().toISOString();
    this.stripeCheckouts.set(checkoutSessionId, checkout);
    this.audit("billing.stripe_checkout_confirmed", actor.email, workspaceId, checkoutSessionId);
    this.persistState();

    return {
      status: "paid",
      subscription,
      invoice,
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

  getPlatformWorkspaceHealth(actor: RequestActor): PlatformAdminWorkspaceHealthRow[] {
    this.assertPlatformAdmin(actor);

    return Array.from(this.workspaces.values())
      .map((workspace) => {
        const subscription = this.getSubscriptionForWorkspace(workspace.id);
        const entitlement = this.entitlements.get(workspace.id);
        const members = this.memberships.get(workspace.id) || [];
        const activeInvites = Array.from(this.invites.values()).filter(
          (invite) => invite.workspaceId === workspace.id && invite.consumedAt === null,
        );
        const activeShareGrants = Array.from(this.shareGrants.values()).filter(
          (grant) => grant.workspaceId === workspace.id && grant.revokedAt === null,
        );
        const latestInvoice = Array.from(this.invoices.values())
          .filter((invoice) => invoice.workspaceId === workspace.id)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

        const usage = this.getWorkspaceBillingUsage(workspace.id, subscription);
        const storagePercent =
          usage.storageLimitMb > 0
            ? Math.min(
                100,
                Math.round(
                  (usage.storageUsedBytes / (usage.storageLimitMb * 1024 * 1024)) * 100,
                ),
              )
            : 0;
        const proxyBandwidthPercent =
          usage.proxyBandwidthLimitMb > 0
            ? Math.min(
                100,
                Math.round(
                  (usage.proxyBandwidthUsedMb / usage.proxyBandwidthLimitMb) * 100,
                ),
              )
            : 0;

        const riskLevel: "low" | "medium" | "high" =
          subscription.status === "past_due" ||
          entitlement?.state === "read_only" ||
          storagePercent >= 90 ||
          proxyBandwidthPercent >= 90
            ? "high"
            : subscription.cancelAtPeriodEnd ||
                entitlement?.state === "grace_active" ||
                storagePercent >= 75 ||
                proxyBandwidthPercent >= 75
              ? "medium"
              : "low";

        return {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          mode: workspace.mode,
          planLabel: subscription.planLabel,
          subscriptionStatus: subscription.status,
          entitlementState: entitlement?.state ?? "active",
          profileLimit: subscription.profileLimit,
          members: members.length,
          activeInvites: activeInvites.length,
          activeShareGrants: activeShareGrants.length,
          storageUsedBytes: usage.storageUsedBytes,
          storageLimitMb: usage.storageLimitMb,
          storagePercent,
          proxyBandwidthUsedMb: usage.proxyBandwidthUsedMb,
          proxyBandwidthLimitMb: usage.proxyBandwidthLimitMb,
          proxyBandwidthPercent,
          latestInvoiceAt: latestInvoice?.createdAt ?? null,
          usageUpdatedAt: usage.updatedAt,
          riskLevel,
        } satisfies PlatformAdminWorkspaceHealthRow;
      })
      .sort((left, right) => {
        if (left.riskLevel !== right.riskLevel) {
          const rank = { high: 3, medium: 2, low: 1 } as const;
          return rank[right.riskLevel] - rank[left.riskLevel];
        }
        return left.workspaceName.localeCompare(right.workspaceName);
      });
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
    if (input.discountPercent > 100) {
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
    this.persistState();
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
    this.persistState();
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

    return {
      bestCoupon,
      reason: "best_discount_selected",
    };
  }

  private assertWorkspaceAccess(workspaceId: string, actor: RequestActor) {
    this.assertWorkspaceExists(workspaceId);
    if (actor.platformRole === "platform_admin") {
      return;
    }
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

  private getWorkspaceRoleRank(role: WorkspaceRole): number {
    if (role === "owner") {
      return 4;
    }
    if (role === "admin") {
      return 3;
    }
    if (role === "member") {
      return 2;
    }
    return 1;
  }

  private deriveStableUserId(normalizedEmail: string): string {
    const digest = createHash("sha256").update(normalizedEmail).digest("hex");
    return `usr_${digest.slice(0, 24)}`;
  }

  private migrateAuthUserId(
    previousUserId: string,
    nextUserId: string,
    normalizedEmail: string,
  ) {
    const previous = previousUserId.trim();
    const next = nextUserId.trim();
    if (!previous || !next || previous === next) {
      return;
    }

    const now = new Date().toISOString();

    // Security hardening: only migrate the authenticated email record.
    // Never fan out to all auth records sharing the same legacy user-id,
    // because that can merge unrelated accounts/workspaces.
    const currentAuthRecord = this.authUsers.get(normalizedEmail);
    if (currentAuthRecord && currentAuthRecord.userId === previous) {
      this.authUsers.set(normalizedEmail, {
        ...currentAuthRecord,
        userId: next,
        updatedAt: now,
      });
    }

    // Conservatively migrate memberships only when both user-id and email match.
    // This avoids cross-account contamination in legacy datasets.
    for (const [workspaceId, members] of this.memberships.entries()) {
      let changed = false;
      const nextMembers = members.map((member) => {
        if (
          member.userId !== previous ||
          this.normalizeEmail(member.email) !== normalizedEmail
        ) {
          return member;
        }
        changed = true;
        return {
          ...member,
          userId: next,
          email: normalizedEmail,
        };
      });
      if (!changed) {
        continue;
      }
      const deduped = new Map<string, MembershipRecord>();
      for (const member of nextMembers) {
        const existing = deduped.get(member.userId);
        if (!existing) {
          deduped.set(member.userId, member);
          continue;
        }
        const existingRank = this.getWorkspaceRoleRank(existing.role);
        const candidateRank = this.getWorkspaceRoleRank(member.role);
        const keepCandidate =
          candidateRank > existingRank ||
          (candidateRank === existingRank &&
            member.createdAt < existing.createdAt);
        const preferred = keepCandidate ? member : existing;
        deduped.set(member.userId, {
          ...preferred,
          createdAt:
            existing.createdAt < member.createdAt
              ? existing.createdAt
              : member.createdAt,
        });
      }
      this.memberships.set(
        workspaceId,
        Array.from(deduped.values()).sort((left, right) =>
          left.createdAt.localeCompare(right.createdAt),
        ),
      );
    }
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

  private getPrimaryPersonalWorkspaceForActor(
    actor: RequestActor,
  ): WorkspaceRecord | null {
    return (
      Array.from(this.workspaces.values())
        .filter(
          (workspace) =>
            workspace.mode === "personal" && workspace.createdBy === actor.userId,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ??
      null
    );
  }

  private ensurePersonalWorkspaceOwnership(
    workspace: WorkspaceRecord,
    actor: RequestActor,
  ) {
    const members = this.memberships.get(workspace.id) || [];
    const alreadyOwner = members.some(
      (member) => this.isMembershipForActor(member, actor) && member.role === "owner",
    );
    const now = new Date().toISOString();
    let shouldPersist = false;

    if (!alreadyOwner) {
      members.unshift({
        workspaceId: workspace.id,
        userId: actor.userId,
        email: actor.email,
        role: "owner",
        createdAt: now,
      });
      this.memberships.set(workspace.id, members);
      shouldPersist = true;
    }

    if (!this.entitlements.has(workspace.id)) {
      this.entitlements.set(workspace.id, {
        workspaceId: workspace.id,
        state: "active",
        graceEndsAt: null,
        updatedAt: now,
      });
      shouldPersist = true;
    }

    if (!this.subscriptions.has(workspace.id)) {
      this.subscriptions.set(
        workspace.id,
        this.getDefaultSubscriptionForWorkspace(workspace.id, workspace.mode, now),
      );
      shouldPersist = true;
    }

    if (shouldPersist) {
      this.persistState();
    }
  }

  private clearInMemoryState() {
    this.authUsers.clear();
    this.workspaces.clear();
    this.workspaceAdminTiktokStates.clear();
    this.workspaceTiktokCookieSources.clear();
    this.workspaceTiktokAutomationAccounts.clear();
    this.workspaceTiktokAutomationRuns.clear();
    this.tiktokAutomationRunItems.clear();
    this.memberships.clear();
    this.entitlements.clear();
    this.invites.clear();
    this.shareGrants.clear();
    this.coupons.clear();
    this.licenseRedemptions.clear();
    this.subscriptions.clear();
    this.invoices.clear();
    this.stripeCheckouts.clear();
    this.tiktokCookies.clear();
    this.auditLogs.splice(0, this.auditLogs.length);
  }

  private getSnapshot(): PersistedControlState {
    return {
      authUsers: Array.from(this.authUsers.values()),
      workspaces: Array.from(this.workspaces.values()),
      workspaceAdminTiktokStates: Array.from(this.workspaceAdminTiktokStates.values()),
      workspaceTiktokCookieSources: Array.from(this.workspaceTiktokCookieSources.values()).flat(),
      tiktokAutomationAccounts: Array.from(
        this.workspaceTiktokAutomationAccounts.values(),
      ).flat(),
      tiktokAutomationRuns: Array.from(this.workspaceTiktokAutomationRuns.values()).flat(),
      tiktokAutomationRunItems: Array.from(this.tiktokAutomationRunItems.values()).flat(),
      memberships: Array.from(this.memberships.values()).flat(),
      entitlements: Array.from(this.entitlements.values()),
      invites: Array.from(this.invites.values()),
      shareGrants: Array.from(this.shareGrants.values()),
      coupons: Array.from(this.coupons.values()),
      licenseRedemptions: Array.from(this.licenseRedemptions.values()),
      subscriptions: Array.from(this.subscriptions.values()),
      invoices: Array.from(this.invoices.values()),
      stripeCheckouts: Array.from(this.stripeCheckouts.values()),
      tiktokCookies: Array.from(this.tiktokCookies.values()),
      auditLogs: [...this.auditLogs],
    };
  }

  private applySnapshot(parsed: PersistedControlState) {
    this.clearInMemoryState();

    for (const authUser of parsed.authUsers || []) {
      const normalizedEmail = this.normalizeEmail(authUser.email);
      if (!normalizedEmail) {
        continue;
      }
      this.authUsers.set(normalizedEmail, {
        ...authUser,
        email: normalizedEmail,
      });
    }

    for (const workspace of parsed.workspaces || []) {
      this.workspaces.set(workspace.id, workspace);
    }

    for (const state of parsed.workspaceAdminTiktokStates || []) {
      this.workspaceAdminTiktokStates.set(state.workspaceId, {
        workspaceId: state.workspaceId,
        bearerKey: state.bearerKey ?? "",
        workflowRows: Array.isArray(state.workflowRows) ? state.workflowRows : [],
        rotationCursor: Number(state.rotationCursor) || 0,
        autoWorkflowRun: state.autoWorkflowRun ?? null,
        updatedAt: state.updatedAt ?? new Date().toISOString(),
      });
    }

    for (const sourceRecord of parsed.workspaceTiktokCookieSources || []) {
      const current = this.workspaceTiktokCookieSources.get(sourceRecord.workspaceId) || [];
      current.push(sourceRecord);
      this.workspaceTiktokCookieSources.set(sourceRecord.workspaceId, current);
    }

    for (const account of parsed.tiktokAutomationAccounts || []) {
      const current =
        this.workspaceTiktokAutomationAccounts.get(account.workspaceId) || [];
      current.push(account);
      this.workspaceTiktokAutomationAccounts.set(account.workspaceId, current);
    }

    for (const run of parsed.tiktokAutomationRuns || []) {
      const current = this.workspaceTiktokAutomationRuns.get(run.workspaceId) || [];
      current.push(run);
      this.workspaceTiktokAutomationRuns.set(run.workspaceId, current);
    }

    for (const item of parsed.tiktokAutomationRunItems || []) {
      const current = this.tiktokAutomationRunItems.get(item.runId) || [];
      current.push(item);
      this.tiktokAutomationRunItems.set(item.runId, current);
    }

    for (const membership of parsed.memberships || []) {
      const current = this.memberships.get(membership.workspaceId) || [];
      current.push(membership);
      this.memberships.set(membership.workspaceId, current);
    }

    for (const entitlement of parsed.entitlements || []) {
      this.entitlements.set(entitlement.workspaceId, entitlement);
    }

    for (const invite of parsed.invites || []) {
      this.invites.set(invite.token, invite);
    }

    for (const shareGrant of parsed.shareGrants || []) {
      this.shareGrants.set(shareGrant.id, shareGrant);
    }

    for (const coupon of parsed.coupons || []) {
      this.coupons.set(coupon.id, coupon);
    }

    for (const redemption of parsed.licenseRedemptions || []) {
      this.licenseRedemptions.set(redemption.code, redemption);
    }

    for (const subscription of parsed.subscriptions || []) {
      this.subscriptions.set(subscription.workspaceId, {
        ...subscription,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
        cancelAt: subscription.cancelAt ?? null,
      });
    }

    for (const invoice of parsed.invoices || []) {
      this.invoices.set(invoice.id, invoice);
    }

    for (const checkout of parsed.stripeCheckouts || []) {
      this.stripeCheckouts.set(checkout.stripeSessionId, checkout);
    }

    for (const record of parsed.tiktokCookies || []) {
      this.tiktokCookies.set(record.id, {
        id: record.id,
        label: record.label,
        cookie: record.cookie,
        status: record.status ?? "untested",
        notes: record.notes ?? null,
        testedAt: record.testedAt ?? null,
        createdAt: record.createdAt ?? new Date().toISOString(),
        updatedAt: record.updatedAt ?? new Date().toISOString(),
      });
    }

    for (const workspace of this.workspaces.values()) {
      if (!this.subscriptions.has(workspace.id)) {
        this.subscriptions.set(
          workspace.id,
          this.getDefaultSubscriptionForWorkspace(
            workspace.id,
            workspace.mode,
            workspace.createdAt,
          ),
        );
      }
    }

    for (const auditLog of parsed.auditLogs || []) {
      this.auditLogs.push(auditLog);
    }
  }

  private async ensurePostgresSchema() {
    if (!this.postgresPool) {
      return;
    }

    // Prevent concurrent service instances from running DDL at the same time.
    const schemaLockId = 8_613_420_017;
    await this.postgresPool.query("select pg_advisory_lock($1)", [schemaLockId]);
    try {
      await this.postgresPool.query(`
      create table if not exists users (
        id text primary key,
        email text not null unique,
        created_at timestamptz not null default now()
      );

      create table if not exists user_credentials (
        user_id text primary key references users(id) on delete cascade,
        password_salt text not null,
        password_hash text not null,
        platform_role text null check (platform_role in ('platform_admin')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists workspaces (
        id text primary key,
        name text not null,
        mode text not null check (mode in ('personal', 'team')),
        created_by text not null references users(id),
        created_at timestamptz not null default now()
      );

      create table if not exists platform_admin_emails (
        email text primary key,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists workspace_admin_tiktok_state (
        workspace_id text primary key references workspaces(id) on delete cascade,
        bearer_key text not null default '',
        workflow_rows jsonb not null default '[]'::jsonb,
        auto_workflow_run jsonb null,
        operation_progress jsonb null,
        rotation_cursor integer not null default 0,
        updated_at timestamptz not null default now()
      );

      create table if not exists workspace_tiktok_cookie_sources (
        id text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        phone text not null default '',
        api_phone text not null default '',
        cookie text not null,
        source text not null default 'excel_import' check (source in ('excel_import')),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists workspace_tiktok_automation_accounts (
        id text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        phone text not null default '',
        api_phone text not null default '',
        cookie text not null default '',
        username text not null default '',
        password text not null default '',
        profile_id text null,
        profile_name text null,
        status text not null default 'queued',
        last_step text null,
        last_error text null,
        source text not null default 'excel_import',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists workspace_tiktok_automation_runs (
        id text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        flow_type text not null check (flow_type in ('signup', 'update_cookie')),
        mode text not null check (mode in ('auto', 'semi')),
        status text not null check (status in ('queued', 'running', 'paused', 'stopped', 'completed', 'failed')),
        account_ids jsonb not null default '[]'::jsonb,
        current_index integer not null default 0,
        active_item_id text null,
        total_count integer not null default 0,
        done_count integer not null default 0,
        failed_count integer not null default 0,
        blocked_count integer not null default 0,
        created_by text not null references users(id),
        started_at timestamptz null,
        finished_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists workspace_tiktok_automation_run_items (
        id text primary key,
        run_id text not null references workspace_tiktok_automation_runs(id) on delete cascade,
        workspace_id text not null references workspaces(id) on delete cascade,
        account_id text not null,
        phone text not null default '',
        api_phone text not null default '',
        profile_id text null,
        profile_name text null,
        status text not null default 'queued',
        step text not null default 'queued',
        attempt integer not null default 0,
        username text not null default '',
        password text not null default '',
        cookie_preview text null,
        error_code text null,
        error_message text null,
        started_at timestamptz null,
        finished_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists tiktok_cookie_records (
        id text primary key,
        label text not null,
        cookie text not null,
        status text not null default 'untested',
        notes text null,
        tested_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists workspace_memberships (
        workspace_id text not null references workspaces(id) on delete cascade,
        user_id text not null references users(id) on delete cascade,
        role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
        created_at timestamptz not null default now(),
        primary key (workspace_id, user_id)
      );

      create table if not exists entitlements (
        workspace_id text primary key references workspaces(id) on delete cascade,
        state text not null check (state in ('active', 'grace_active', 'read_only')),
        grace_ends_at timestamptz null,
        updated_at timestamptz not null default now()
      );

      create table if not exists invites (
        id text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        email text not null,
        role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
        token text not null unique,
        expires_at timestamptz not null,
        consumed_at timestamptz null,
        created_by text not null references users(id),
        created_at timestamptz not null default now()
      );

      create table if not exists share_grants (
        id text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        resource_type text not null check (resource_type in ('profile', 'group')),
        resource_id text not null,
        recipient_email text not null,
        access_mode text not null check (access_mode in ('full', 'run_sync_limited')),
        revoked_at timestamptz null,
        created_by text not null references users(id),
        created_at timestamptz not null default now()
      );

      create table if not exists coupons (
        id text primary key,
        code text not null,
        source text not null check (source in ('internal', 'stripe')),
        discount_percent integer not null,
        workspace_allowlist text[] not null default '{}',
        workspace_denylist text[] not null default '{}',
        max_redemptions integer not null,
        redeemed_count integer not null default 0,
        expires_at timestamptz not null,
        revoked_at timestamptz null,
        created_by text not null references users(id),
        created_at timestamptz not null default now()
      );

      create table if not exists license_redemptions (
        code text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        plan_id text not null check (plan_id in ('starter', 'growth', 'scale', 'custom')),
        plan_label text not null,
        profile_limit integer not null,
        billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
        redeemed_at timestamptz not null,
        redeemed_by text not null references users(id)
      );

      create table if not exists workspace_subscriptions (
        workspace_id text primary key references workspaces(id) on delete cascade,
        plan_id text null check (plan_id in ('starter', 'growth', 'scale', 'custom')),
        plan_label text not null,
        profile_limit integer not null,
        billing_cycle text null check (billing_cycle in ('monthly', 'yearly')),
        status text not null check (status in ('active', 'past_due', 'canceled')),
        source text not null check (source in ('internal', 'license', 'stripe')),
        started_at timestamptz not null,
        expires_at timestamptz null,
        cancel_at_period_end boolean not null default false,
        cancel_at timestamptz null,
        updated_at timestamptz not null
      );

      create table if not exists billing_invoices (
        id text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        plan_id text not null check (plan_id in ('starter', 'growth', 'scale', 'custom')),
        plan_label text not null,
        billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
        base_amount_usd integer not null,
        amount_usd integer not null,
        discount_percent integer not null,
        method text not null check (method in ('self_host_checkout', 'coupon', 'license', 'stripe')),
        source text not null check (source in ('internal', 'license', 'stripe')),
        coupon_code text null,
        status text not null check (status in ('paid')),
        created_at timestamptz not null,
        paid_at timestamptz not null,
        actor_user_id text not null references users(id),
        stripe_session_id text null
      );

      create table if not exists stripe_checkout_sessions (
        stripe_session_id text primary key,
        id text not null,
        workspace_id text not null references workspaces(id) on delete cascade,
        plan_id text not null check (plan_id in ('starter', 'growth', 'scale', 'custom')),
        plan_label text not null,
        billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
        profile_limit integer not null,
        base_amount_usd integer not null,
        amount_usd integer not null,
        discount_percent integer not null,
        coupon_code text null,
        checkout_url text not null,
        created_at timestamptz not null,
        completed_at timestamptz null,
        actor_user_id text not null references users(id)
      );

      create table if not exists audit_logs (
        id text primary key,
        action text not null,
        actor text not null,
        workspace_id text null references workspaces(id) on delete set null,
        target_id text null,
        reason text null,
        created_at timestamptz not null default now()
      );

      create index if not exists idx_workspace_memberships_user on workspace_memberships(user_id);
      create index if not exists idx_workspace_tiktok_cookie_sources_workspace on workspace_tiktok_cookie_sources(workspace_id, updated_at desc);
      create index if not exists idx_workspace_tiktok_automation_accounts_workspace on workspace_tiktok_automation_accounts(workspace_id, updated_at desc);
      create index if not exists idx_workspace_tiktok_automation_runs_workspace on workspace_tiktok_automation_runs(workspace_id, updated_at desc);
      create index if not exists idx_workspace_tiktok_automation_run_items_run on workspace_tiktok_automation_run_items(run_id, updated_at desc);
      create index if not exists idx_user_credentials_platform_role on user_credentials(platform_role);
      create index if not exists idx_invites_workspace on invites(workspace_id);
      create index if not exists idx_share_grants_workspace on share_grants(workspace_id);
      create index if not exists idx_license_redemptions_workspace on license_redemptions(workspace_id);
      create index if not exists idx_workspace_subscriptions_status on workspace_subscriptions(status);
      create index if not exists idx_billing_invoices_workspace_created on billing_invoices(workspace_id, created_at desc);
      create index if not exists idx_stripe_checkout_workspace_created on stripe_checkout_sessions(workspace_id, created_at desc);
      create index if not exists idx_audit_logs_workspace_created on audit_logs(workspace_id, created_at desc);
      create unique index if not exists idx_coupons_code_active on coupons(code) where revoked_at is null;
    `);

      await this.postgresPool.query(`
      alter table workspace_admin_tiktok_state
      add column if not exists auto_workflow_run jsonb null;

      alter table workspace_admin_tiktok_state
      add column if not exists operation_progress jsonb null;

      alter table workspace_subscriptions
      add column if not exists cancel_at_period_end boolean not null default false;

      alter table workspace_subscriptions
      add column if not exists cancel_at timestamptz null;
    `);
    } finally {
      await this.postgresPool
        .query("select pg_advisory_unlock($1)", [schemaLockId])
        .catch(() => undefined);
    }
  }

  private async loadStateFromPostgres() {
    if (!this.postgresPool) {
      return;
    }

    try {
      await this.ensurePostgresSchema();

      const [
        usersResult,
        authUsersResult,
        platformAdminEmailsResult,
        workspacesResult,
        workspaceAdminTiktokStateResult,
        workspaceTiktokCookieSourcesResult,
        workspaceTiktokAutomationAccountsResult,
        workspaceTiktokAutomationRunsResult,
        workspaceTiktokAutomationRunItemsResult,
        membershipsResult,
        entitlementsResult,
        invitesResult,
        shareGrantsResult,
        couponsResult,
        licenseRedemptionsResult,
        subscriptionsResult,
        invoicesResult,
        stripeCheckoutsResult,
        tiktokCookiesResult,
        auditLogsResult,
      ] = await Promise.all([
        this.postgresPool.query<{
          id: string;
          email: string;
        }>("select id, email from users"),
        this.postgresPool.query<{
          user_id: string;
          password_salt: string;
          password_hash: string;
          platform_role: string | null;
          created_at: string;
          updated_at: string;
        }>(
          "select user_id, password_salt, password_hash, platform_role, created_at, updated_at from user_credentials",
        ),
        this.postgresPool.query<{
          email: string;
        }>("select email from platform_admin_emails"),
        this.postgresPool.query(
          "select id, name, mode, created_by, created_at from workspaces",
        ),
        this.postgresPool.query(
          "select workspace_id, bearer_key, workflow_rows, auto_workflow_run, operation_progress, rotation_cursor, updated_at from workspace_admin_tiktok_state",
        ),
        this.postgresPool.query(
          "select id, workspace_id, phone, api_phone, cookie, source, created_at, updated_at from workspace_tiktok_cookie_sources order by updated_at desc",
        ),
        this.postgresPool.query(
          "select id, workspace_id, phone, api_phone, cookie, username, password, profile_id, profile_name, status, last_step, last_error, source, created_at, updated_at from workspace_tiktok_automation_accounts order by updated_at desc",
        ),
        this.postgresPool.query(
          "select id, workspace_id, flow_type, mode, status, account_ids, current_index, active_item_id, total_count, done_count, failed_count, blocked_count, created_by, started_at, finished_at, created_at, updated_at from workspace_tiktok_automation_runs order by updated_at desc",
        ),
        this.postgresPool.query(
          "select id, run_id, workspace_id, account_id, phone, api_phone, profile_id, profile_name, status, step, attempt, username, password, cookie_preview, error_code, error_message, started_at, finished_at, created_at, updated_at from workspace_tiktok_automation_run_items order by updated_at desc",
        ),
        this.postgresPool.query(
          "select workspace_id, user_id, role, created_at from workspace_memberships",
        ),
        this.postgresPool.query(
          "select workspace_id, state, grace_ends_at, updated_at from entitlements",
        ),
        this.postgresPool.query(
          "select id, workspace_id, email, role, token, expires_at, created_at, created_by, consumed_at from invites",
        ),
        this.postgresPool.query(
          "select id, workspace_id, resource_type, resource_id, recipient_email, access_mode, created_at, created_by, revoked_at from share_grants",
        ),
        this.postgresPool.query(
          "select id, code, source, discount_percent, workspace_allowlist, workspace_denylist, max_redemptions, redeemed_count, expires_at, revoked_at, created_at, created_by from coupons",
        ),
        this.postgresPool.query(
          "select code, workspace_id, plan_id, plan_label, profile_limit, billing_cycle, redeemed_at, redeemed_by from license_redemptions",
        ),
        this.postgresPool.query(
          "select workspace_id, plan_id, plan_label, profile_limit, billing_cycle, status, source, started_at, expires_at, cancel_at_period_end, cancel_at, updated_at from workspace_subscriptions",
        ),
        this.postgresPool.query(
          "select id, workspace_id, plan_id, plan_label, billing_cycle, base_amount_usd, amount_usd, discount_percent, method, source, coupon_code, status, created_at, paid_at, actor_user_id, stripe_session_id from billing_invoices",
        ),
        this.postgresPool.query(
          "select stripe_session_id, id, workspace_id, plan_id, plan_label, billing_cycle, profile_limit, base_amount_usd, amount_usd, discount_percent, coupon_code, checkout_url, created_at, completed_at, actor_user_id from stripe_checkout_sessions",
        ),
        this.postgresPool.query(
          "select id, label, cookie, status, notes, tested_at, created_at, updated_at from tiktok_cookie_records",
        ),
        this.postgresPool.query(
          "select id, action, actor, workspace_id, target_id, reason, created_at from audit_logs order by created_at asc",
        ),
      ]);

      const userEmailById = new Map<string, string>();
      for (const row of usersResult.rows) {
        userEmailById.set(row.id, row.email.toLowerCase());
      }

      this.platformAdminEmails.clear();
      for (const row of platformAdminEmailsResult.rows) {
        const normalized = this.normalizeEmail(row.email);
        if (normalized) {
          this.platformAdminEmails.add(normalized);
        }
      }

      const snapshot: PersistedControlState = {
        authUsers: authUsersResult.rows
          .map((row) => {
            const email = userEmailById.get(row.user_id);
            if (!email) {
              return null;
            }
            return {
              userId: row.user_id,
              email,
              passwordSalt: row.password_salt,
              passwordHash: row.password_hash,
              platformRole:
                row.platform_role === "platform_admin" ? "platform_admin" : null,
              createdAt: new Date(row.created_at).toISOString(),
              updatedAt: new Date(row.updated_at).toISOString(),
            } satisfies AuthUserRecord;
          })
          .filter((row): row is AuthUserRecord => row !== null),
        workspaces: workspacesResult.rows.map((row) => ({
          id: row.id as string,
          name: row.name as string,
          mode: row.mode as WorkspaceMode,
          createdAt: new Date(row.created_at as string).toISOString(),
          createdBy: row.created_by as string,
        })),
        workspaceAdminTiktokStates: workspaceAdminTiktokStateResult.rows.map(
          (row) => ({
            workspaceId: row.workspace_id as string,
            bearerKey: (row.bearer_key as string) ?? "",
            workflowRows: Array.isArray(row.workflow_rows)
              ? (row.workflow_rows as unknown[])
              : [],
            autoWorkflowRun: row.auto_workflow_run ?? null,
            operationProgress: row.operation_progress ?? null,
            rotationCursor: Number(row.rotation_cursor) || 0,
            updatedAt: new Date(row.updated_at as string).toISOString(),
          }),
        ),
        workspaceTiktokCookieSources: workspaceTiktokCookieSourcesResult.rows.map(
          (row) => ({
            id: row.id as string,
            workspaceId: row.workspace_id as string,
            phone: (row.phone as string) ?? "",
            apiPhone: (row.api_phone as string) ?? "",
            cookie: row.cookie as string,
            source: (row.source as "excel_import") ?? "excel_import",
            createdAt: new Date(row.created_at as string).toISOString(),
            updatedAt: new Date(row.updated_at as string).toISOString(),
          }),
        ),
        tiktokAutomationAccounts: workspaceTiktokAutomationAccountsResult.rows.map(
          (row) => ({
            id: row.id as string,
            workspaceId: row.workspace_id as string,
            phone: (row.phone as string) ?? "",
            apiPhone: (row.api_phone as string) ?? "",
            cookie: (row.cookie as string) ?? "",
            username: (row.username as string) ?? "",
            password: (row.password as string) ?? "",
            profileId: (row.profile_id as string | null) ?? null,
            profileName: (row.profile_name as string | null) ?? null,
            status: ((row.status as string) ?? "queued") as TiktokAutomationItemStatus,
            lastStep: (row.last_step as string | null) ?? null,
            lastError: (row.last_error as string | null) ?? null,
            source: ((row.source as string) ?? "excel_import") as
              | "excel_import"
              | "manual"
              | "bugidea_pull",
            createdAt: new Date(row.created_at as string).toISOString(),
            updatedAt: new Date(row.updated_at as string).toISOString(),
          }),
        ),
        tiktokAutomationRuns: workspaceTiktokAutomationRunsResult.rows.map((row) => ({
          id: row.id as string,
          workspaceId: row.workspace_id as string,
          flowType: ((row.flow_type as string) ?? "signup") as TiktokAutomationFlowType,
          mode: ((row.mode as string) ?? "semi") as TiktokAutomationRunMode,
          status: ((row.status as string) ?? "queued") as TiktokAutomationRunStatus,
          accountIds: Array.isArray(row.account_ids)
            ? (row.account_ids as string[])
            : [],
          currentIndex: Number(row.current_index) || 0,
          activeItemId: (row.active_item_id as string | null) ?? null,
          totalCount: Number(row.total_count) || 0,
          doneCount: Number(row.done_count) || 0,
          failedCount: Number(row.failed_count) || 0,
          blockedCount: Number(row.blocked_count) || 0,
          createdBy: (row.created_by as string) ?? "control-user",
          startedAt: row.started_at
            ? new Date(row.started_at as string).toISOString()
            : null,
          finishedAt: row.finished_at
            ? new Date(row.finished_at as string).toISOString()
            : null,
          createdAt: new Date(row.created_at as string).toISOString(),
          updatedAt: new Date(row.updated_at as string).toISOString(),
        })),
        tiktokAutomationRunItems:
          workspaceTiktokAutomationRunItemsResult.rows.map((row) => ({
            id: row.id as string,
            runId: row.run_id as string,
            workspaceId: row.workspace_id as string,
            accountId: row.account_id as string,
            phone: (row.phone as string) ?? "",
            apiPhone: (row.api_phone as string) ?? "",
            profileId: (row.profile_id as string | null) ?? null,
            profileName: (row.profile_name as string | null) ?? null,
            status: ((row.status as string) ?? "queued") as TiktokAutomationItemStatus,
            step: (row.step as string) ?? "queued",
            attempt: Number(row.attempt) || 0,
            username: (row.username as string) ?? "",
            password: (row.password as string) ?? "",
            cookiePreview: (row.cookie_preview as string | null) ?? null,
            errorCode: (row.error_code as string | null) ?? null,
            errorMessage: (row.error_message as string | null) ?? null,
            startedAt: row.started_at
              ? new Date(row.started_at as string).toISOString()
              : null,
            finishedAt: row.finished_at
              ? new Date(row.finished_at as string).toISOString()
              : null,
            createdAt: new Date(row.created_at as string).toISOString(),
            updatedAt: new Date(row.updated_at as string).toISOString(),
          })),
        memberships: membershipsResult.rows.map((row) => {
          const userId = row.user_id as string;
          const resolvedEmail = userEmailById.get(userId);
          return {
            workspaceId: row.workspace_id as string,
            userId,
            email: resolvedEmail && !resolvedEmail.endsWith("@local")
              ? resolvedEmail
              : userId,
            role: row.role as WorkspaceRole,
            createdAt: new Date(row.created_at as string).toISOString(),
          };
        }),
        entitlements: entitlementsResult.rows.map((row) => ({
          workspaceId: row.workspace_id as string,
          state: row.state as EntitlementState,
          graceEndsAt: row.grace_ends_at
            ? new Date(row.grace_ends_at as string).toISOString()
            : null,
          updatedAt: new Date(row.updated_at as string).toISOString(),
        })),
        invites: invitesResult.rows.map((row) => ({
          id: row.id as string,
          workspaceId: row.workspace_id as string,
          email: row.email as string,
          role: row.role as WorkspaceRole,
          token: row.token as string,
          expiresAt: new Date(row.expires_at as string).toISOString(),
          createdAt: new Date(row.created_at as string).toISOString(),
          createdBy: row.created_by as string,
          consumedAt: row.consumed_at
            ? new Date(row.consumed_at as string).toISOString()
            : null,
        })),
        shareGrants: shareGrantsResult.rows.map((row) => ({
          id: row.id as string,
          workspaceId: row.workspace_id as string,
          resourceType: row.resource_type as "profile" | "group",
          resourceId: row.resource_id as string,
          recipientEmail: row.recipient_email as string,
          accessMode: row.access_mode as "full" | "run_sync_limited",
          createdAt: new Date(row.created_at as string).toISOString(),
          createdBy: row.created_by as string,
          revokedAt: row.revoked_at
            ? new Date(row.revoked_at as string).toISOString()
            : null,
        })),
        coupons: couponsResult.rows.map((row) => ({
          id: row.id as string,
          code: row.code as string,
          source: row.source as "internal" | "stripe",
          discountPercent: Number(row.discount_percent),
          workspaceAllowlist: Array.isArray(row.workspace_allowlist)
            ? (row.workspace_allowlist as string[])
            : [],
          workspaceDenylist: Array.isArray(row.workspace_denylist)
            ? (row.workspace_denylist as string[])
            : [],
          maxRedemptions: Number(row.max_redemptions),
          redeemedCount: Number(row.redeemed_count),
          expiresAt: new Date(row.expires_at as string).toISOString(),
          revokedAt: row.revoked_at
            ? new Date(row.revoked_at as string).toISOString()
            : null,
          createdAt: new Date(row.created_at as string).toISOString(),
          createdBy: row.created_by as string,
        })),
        licenseRedemptions: licenseRedemptionsResult.rows.map((row) => ({
          code: row.code as string,
          workspaceId: row.workspace_id as string,
          planId: row.plan_id as BillingPlanId,
          planLabel: row.plan_label as string,
          profileLimit: Number(row.profile_limit),
          billingCycle: row.billing_cycle as BillingCycle,
          redeemedAt: new Date(row.redeemed_at as string).toISOString(),
          redeemedBy: row.redeemed_by as string,
        })),
        subscriptions: subscriptionsResult.rows.map((row) => ({
          workspaceId: row.workspace_id as string,
          planId: (row.plan_id as BillingPlanId | null) ?? null,
          planLabel: row.plan_label as string,
          profileLimit: Number(row.profile_limit),
          billingCycle: (row.billing_cycle as BillingCycle | null) ?? null,
          status: row.status as "active" | "past_due" | "canceled",
          source: row.source as "internal" | "license" | "stripe",
          startedAt: new Date(row.started_at as string).toISOString(),
          expiresAt: row.expires_at
            ? new Date(row.expires_at as string).toISOString()
            : null,
          cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
          cancelAt: row.cancel_at
            ? new Date(row.cancel_at as string).toISOString()
            : null,
          updatedAt: new Date(row.updated_at as string).toISOString(),
        })),
        invoices: invoicesResult.rows.map((row) => ({
          id: row.id as string,
          workspaceId: row.workspace_id as string,
          planId: row.plan_id as BillingPlanId,
          planLabel: row.plan_label as string,
          billingCycle: row.billing_cycle as BillingCycle,
          baseAmountUsd: Number(row.base_amount_usd),
          amountUsd: Number(row.amount_usd),
          discountPercent: Number(row.discount_percent),
          method: row.method as BillingPaymentMethod,
          source: row.source as BillingSource,
          couponCode: (row.coupon_code as string | null) ?? null,
          status: "paid",
          createdAt: new Date(row.created_at as string).toISOString(),
          paidAt: new Date(row.paid_at as string).toISOString(),
          actorUserId: row.actor_user_id as string,
          stripeSessionId: (row.stripe_session_id as string | null) ?? null,
        })),
        stripeCheckouts: stripeCheckoutsResult.rows.map((row) => ({
          id: row.id as string,
          workspaceId: row.workspace_id as string,
          planId: row.plan_id as BillingPlanId,
          planLabel: row.plan_label as string,
          billingCycle: row.billing_cycle as BillingCycle,
          profileLimit: Number(row.profile_limit),
          baseAmountUsd: Number(row.base_amount_usd),
          amountUsd: Number(row.amount_usd),
          discountPercent: Number(row.discount_percent),
          couponCode: (row.coupon_code as string | null) ?? null,
          stripeSessionId: row.stripe_session_id as string,
          checkoutUrl: row.checkout_url as string,
          createdAt: new Date(row.created_at as string).toISOString(),
          completedAt: row.completed_at
            ? new Date(row.completed_at as string).toISOString()
            : null,
          actorUserId: row.actor_user_id as string,
        })),
        tiktokCookies: tiktokCookiesResult.rows.map((row) => ({
          id: row.id as string,
          label: row.label as string,
          cookie: row.cookie as string,
          status: (row.status as string) ?? "untested",
          notes: (row.notes as string | null) ?? null,
          testedAt: row.tested_at
            ? new Date(row.tested_at as string).toISOString()
            : null,
          createdAt: new Date(row.created_at as string).toISOString(),
          updatedAt: new Date(row.updated_at as string).toISOString(),
        })),
        auditLogs: auditLogsResult.rows.map((row) => ({
          id: row.id as string,
          action: row.action as string,
          actor: row.actor as string,
          workspaceId: (row.workspace_id as string | null) ?? undefined,
          targetId: (row.target_id as string | null) ?? undefined,
          reason: (row.reason as string | null) ?? undefined,
          createdAt: new Date(row.created_at as string).toISOString(),
        })),
      };

      this.applySnapshot(snapshot);
    } catch (error) {
      console.warn("[control-state] Failed to load state from PostgreSQL:", error);
      this.clearInMemoryState();
    }
  }

  private queuePersistStateToPostgres() {
    if (!this.postgresPool) {
      return;
    }
    this.persistPostgresQueue = this.persistPostgresQueue
      .then(() => this.persistStateToPostgres())
      .catch((error) => {
        console.warn("[control-state] Failed to persist state to PostgreSQL:", error);
      });
  }

  private async persistStateToPostgres() {
    if (!this.postgresPool) {
      return;
    }

    await this.ensurePostgresSchema();
    const snapshot = this.getSnapshot();
    const client = await this.postgresPool.connect();

    const usersById = new Map<string, string>();
    const isPlaceholderLocalEmail = (value?: string | null) =>
      typeof value === "string" &&
      value.trim().toLowerCase().endsWith("@local");
    const registerUser = (id: string, email?: string) => {
      const normalizedId = id.trim();
      if (!normalizedId) {
        return;
      }
      const normalizedEmail = email?.trim().toLowerCase() || `${normalizedId}@local`;
      const current = usersById.get(normalizedId);
      if (!current) {
        usersById.set(normalizedId, normalizedEmail);
        return;
      }
      if (isPlaceholderLocalEmail(current) && !isPlaceholderLocalEmail(normalizedEmail)) {
        usersById.set(normalizedId, normalizedEmail);
      }
    };

    for (const authUser of snapshot.authUsers) {
      registerUser(authUser.userId, authUser.email);
    }
    for (const workspace of snapshot.workspaces) {
      registerUser(workspace.createdBy);
    }
    for (const membership of snapshot.memberships) {
      registerUser(membership.userId, membership.email);
    }
    for (const invite of snapshot.invites) {
      registerUser(invite.createdBy);
    }
    for (const shareGrant of snapshot.shareGrants) {
      registerUser(shareGrant.createdBy);
    }
    for (const coupon of snapshot.coupons) {
      registerUser(coupon.createdBy);
    }
    for (const redemption of snapshot.licenseRedemptions) {
      registerUser(redemption.redeemedBy);
    }
    for (const invoice of snapshot.invoices) {
      registerUser(invoice.actorUserId);
    }
    for (const checkout of snapshot.stripeCheckouts) {
      registerUser(checkout.actorUserId);
    }

    try {
      await client.query("begin");
      await client.query(`
        truncate table
          audit_logs,
          tiktok_cookie_records,
          workspace_tiktok_automation_run_items,
          workspace_tiktok_automation_runs,
          workspace_tiktok_automation_accounts,
          workspace_tiktok_cookie_sources,
          stripe_checkout_sessions,
          billing_invoices,
          workspace_subscriptions,
          license_redemptions,
          coupons,
          share_grants,
          invites,
          entitlements,
          workspace_memberships,
          workspace_admin_tiktok_state,
          workspaces,
          user_credentials,
          users
        restart identity cascade
      `);

      for (const [userId, email] of usersById.entries()) {
        await client.query(
          `
            insert into users (id, email, created_at)
            values ($1, $2, now())
            on conflict (id) do update set email = excluded.email
          `,
          [userId, email],
        );
      }

      for (const authUser of snapshot.authUsers) {
        await client.query(
          `
            insert into user_credentials
              (user_id, password_salt, password_hash, platform_role, created_at, updated_at)
            values ($1, $2, $3, $4, $5, $6)
            on conflict (user_id)
            do update set
              password_salt = excluded.password_salt,
              password_hash = excluded.password_hash,
              platform_role = excluded.platform_role,
              updated_at = excluded.updated_at
          `,
          [
            authUser.userId,
            authUser.passwordSalt,
            authUser.passwordHash,
            authUser.platformRole,
            authUser.createdAt,
            authUser.updatedAt,
          ],
        );
      }

      for (const workspace of snapshot.workspaces) {
        await client.query(
          `
            insert into workspaces (id, name, mode, created_by, created_at)
            values ($1, $2, $3, $4, $5)
          `,
          [
            workspace.id,
            workspace.name,
            workspace.mode,
            workspace.createdBy,
            workspace.createdAt,
          ],
        );
      }

      for (const state of snapshot.workspaceAdminTiktokStates) {
        await client.query(
          `
            insert into workspace_admin_tiktok_state
              (workspace_id, bearer_key, workflow_rows, auto_workflow_run, operation_progress, rotation_cursor, updated_at)
            values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7)
          `,
          [
            state.workspaceId,
            state.bearerKey,
            JSON.stringify(state.workflowRows ?? []),
            state.autoWorkflowRun ? JSON.stringify(state.autoWorkflowRun) : null,
            state.operationProgress
              ? JSON.stringify(state.operationProgress)
              : null,
            state.rotationCursor,
            state.updatedAt,
          ],
        );
      }

      for (const sourceRecord of snapshot.workspaceTiktokCookieSources) {
        await client.query(
          `
            insert into workspace_tiktok_cookie_sources
              (id, workspace_id, phone, api_phone, cookie, source, created_at, updated_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            sourceRecord.id,
            sourceRecord.workspaceId,
            sourceRecord.phone,
            sourceRecord.apiPhone,
            sourceRecord.cookie,
            sourceRecord.source,
            sourceRecord.createdAt,
            sourceRecord.updatedAt,
          ],
        );
      }

      for (const account of snapshot.tiktokAutomationAccounts) {
        await client.query(
          `
            insert into workspace_tiktok_automation_accounts
              (id, workspace_id, phone, api_phone, cookie, username, password, profile_id, profile_name, status, last_step, last_error, source, created_at, updated_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `,
          [
            account.id,
            account.workspaceId,
            account.phone,
            account.apiPhone,
            account.cookie,
            account.username,
            account.password,
            account.profileId,
            account.profileName,
            account.status,
            account.lastStep,
            account.lastError,
            account.source,
            account.createdAt,
            account.updatedAt,
          ],
        );
      }

      for (const run of snapshot.tiktokAutomationRuns) {
        await client.query(
          `
            insert into workspace_tiktok_automation_runs
              (id, workspace_id, flow_type, mode, status, account_ids, current_index, active_item_id, total_count, done_count, failed_count, blocked_count, created_by, started_at, finished_at, created_at, updated_at)
            values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          `,
          [
            run.id,
            run.workspaceId,
            run.flowType,
            run.mode,
            run.status,
            JSON.stringify(run.accountIds ?? []),
            run.currentIndex,
            run.activeItemId,
            run.totalCount,
            run.doneCount,
            run.failedCount,
            run.blockedCount,
            run.createdBy,
            run.startedAt,
            run.finishedAt,
            run.createdAt,
            run.updatedAt,
          ],
        );
      }

      for (const item of snapshot.tiktokAutomationRunItems) {
        await client.query(
          `
            insert into workspace_tiktok_automation_run_items
              (id, run_id, workspace_id, account_id, phone, api_phone, profile_id, profile_name, status, step, attempt, username, password, cookie_preview, error_code, error_message, started_at, finished_at, created_at, updated_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          `,
          [
            item.id,
            item.runId,
            item.workspaceId,
            item.accountId,
            item.phone,
            item.apiPhone,
            item.profileId,
            item.profileName,
            item.status,
            item.step,
            item.attempt,
            item.username,
            item.password,
            item.cookiePreview,
            item.errorCode,
            item.errorMessage,
            item.startedAt,
            item.finishedAt,
            item.createdAt,
            item.updatedAt,
          ],
        );
      }

      for (const membership of snapshot.memberships) {
        await client.query(
          `
            insert into workspace_memberships (workspace_id, user_id, role, created_at)
            values ($1, $2, $3, $4)
          `,
          [
            membership.workspaceId,
            membership.userId,
            membership.role,
            membership.createdAt,
          ],
        );
      }

      for (const entitlement of snapshot.entitlements) {
        await client.query(
          `
            insert into entitlements (workspace_id, state, grace_ends_at, updated_at)
            values ($1, $2, $3, $4)
          `,
          [
            entitlement.workspaceId,
            entitlement.state,
            entitlement.graceEndsAt,
            entitlement.updatedAt,
          ],
        );
      }

      for (const invite of snapshot.invites) {
        await client.query(
          `
            insert into invites
              (id, workspace_id, email, role, token, expires_at, consumed_at, created_by, created_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            invite.id,
            invite.workspaceId,
            invite.email,
            invite.role,
            invite.token,
            invite.expiresAt,
            invite.consumedAt,
            invite.createdBy,
            invite.createdAt,
          ],
        );
      }

      for (const shareGrant of snapshot.shareGrants) {
        await client.query(
          `
            insert into share_grants
              (id, workspace_id, resource_type, resource_id, recipient_email, access_mode, revoked_at, created_by, created_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            shareGrant.id,
            shareGrant.workspaceId,
            shareGrant.resourceType,
            shareGrant.resourceId,
            shareGrant.recipientEmail,
            shareGrant.accessMode,
            shareGrant.revokedAt,
            shareGrant.createdBy,
            shareGrant.createdAt,
          ],
        );
      }

      for (const coupon of snapshot.coupons) {
        await client.query(
          `
            insert into coupons
              (id, code, source, discount_percent, workspace_allowlist, workspace_denylist, max_redemptions, redeemed_count, expires_at, revoked_at, created_by, created_at)
            values ($1, $2, $3, $4, $5::text[], $6::text[], $7, $8, $9, $10, $11, $12)
          `,
          [
            coupon.id,
            coupon.code,
            coupon.source,
            coupon.discountPercent,
            coupon.workspaceAllowlist,
            coupon.workspaceDenylist,
            coupon.maxRedemptions,
            coupon.redeemedCount,
            coupon.expiresAt,
            coupon.revokedAt,
            coupon.createdBy,
            coupon.createdAt,
          ],
        );
      }

      for (const redemption of snapshot.licenseRedemptions) {
        await client.query(
          `
            insert into license_redemptions
              (code, workspace_id, plan_id, plan_label, profile_limit, billing_cycle, redeemed_at, redeemed_by)
            values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            redemption.code,
            redemption.workspaceId,
            redemption.planId,
            redemption.planLabel,
            redemption.profileLimit,
            redemption.billingCycle,
            redemption.redeemedAt,
            redemption.redeemedBy,
          ],
        );
      }

      for (const subscription of snapshot.subscriptions) {
        await client.query(
          `
            insert into workspace_subscriptions
              (workspace_id, plan_id, plan_label, profile_limit, billing_cycle, status, source, started_at, expires_at, cancel_at_period_end, cancel_at, updated_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `,
          [
            subscription.workspaceId,
            subscription.planId,
            subscription.planLabel,
            subscription.profileLimit,
            subscription.billingCycle,
            subscription.status,
            subscription.source,
            subscription.startedAt,
            subscription.expiresAt,
            subscription.cancelAtPeriodEnd,
            subscription.cancelAt,
            subscription.updatedAt,
          ],
        );
      }

      for (const invoice of snapshot.invoices) {
        await client.query(
          `
            insert into billing_invoices
              (id, workspace_id, plan_id, plan_label, billing_cycle, base_amount_usd, amount_usd, discount_percent, method, source, coupon_code, status, created_at, paid_at, actor_user_id, stripe_session_id)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          `,
          [
            invoice.id,
            invoice.workspaceId,
            invoice.planId,
            invoice.planLabel,
            invoice.billingCycle,
            invoice.baseAmountUsd,
            invoice.amountUsd,
            invoice.discountPercent,
            invoice.method,
            invoice.source,
            invoice.couponCode,
            invoice.status,
            invoice.createdAt,
            invoice.paidAt,
            invoice.actorUserId,
            invoice.stripeSessionId,
          ],
        );
      }

      for (const checkout of snapshot.stripeCheckouts) {
        await client.query(
          `
            insert into stripe_checkout_sessions
              (stripe_session_id, id, workspace_id, plan_id, plan_label, billing_cycle, profile_limit, base_amount_usd, amount_usd, discount_percent, coupon_code, checkout_url, created_at, completed_at, actor_user_id)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `,
          [
            checkout.stripeSessionId,
            checkout.id,
            checkout.workspaceId,
            checkout.planId,
            checkout.planLabel,
            checkout.billingCycle,
            checkout.profileLimit,
            checkout.baseAmountUsd,
            checkout.amountUsd,
            checkout.discountPercent,
            checkout.couponCode,
            checkout.checkoutUrl,
            checkout.createdAt,
            checkout.completedAt,
            checkout.actorUserId,
          ],
        );
      }

      for (const record of snapshot.tiktokCookies) {
        await client.query(
          `
            insert into tiktok_cookie_records
              (id, label, cookie, status, notes, tested_at, created_at, updated_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            record.id,
            record.label,
            record.cookie,
            record.status,
            record.notes,
            record.testedAt,
            record.createdAt,
            record.updatedAt,
          ],
        );
      }

      for (const auditLog of snapshot.auditLogs) {
        await client.query(
          `
            insert into audit_logs (id, action, actor, workspace_id, target_id, reason, created_at)
            values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            auditLog.id,
            auditLog.action,
            auditLog.actor,
            auditLog.workspaceId ?? null,
            auditLog.targetId ?? null,
            auditLog.reason ?? null,
            auditLog.createdAt,
          ],
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private persistState() {
    if (this.postgresPool) {
      this.queuePersistStateToPostgres();
    }
  }

  private resolvePlatformRoleForRegistration(
    normalizedEmail: string,
  ): "platform_admin" | null {
    if (this.platformAdminEmails.has(normalizedEmail)) {
      return "platform_admin";
    }
    return null;
  }

  resolveEffectivePlatformRole(
    email: string,
    _hintedRole?: string | null,
  ): "platform_admin" | null {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }
    if (this.platformAdminEmails.has(normalizedEmail)) {
      return "platform_admin";
    }
    if (this.authUsers.get(normalizedEmail)?.platformRole === "platform_admin") {
      return "platform_admin";
    }
    return null;
  }

  resolveRequestActor(input: {
    userId?: string | null;
    email?: string | null;
    hintedRole?: string | null;
  }): RequestActor {
    const providedUserId = input.userId?.trim();
    const normalizedEmail = this.normalizeEmail(input.email ?? "");
    if (!providedUserId || !normalizedEmail) {
      throw new BadRequestException("missing_actor_headers");
    }

    const record = this.authUsers.get(normalizedEmail);
    if (!record) {
      throw new UnauthorizedException("actor_not_authenticated");
    }

    const stableUserId = this.deriveStableUserId(normalizedEmail);
    if (record.userId !== stableUserId) {
      this.migrateAuthUserId(record.userId, stableUserId, normalizedEmail);
      record.userId = stableUserId;
      record.updatedAt = new Date().toISOString();
      this.authUsers.set(normalizedEmail, record);
      this.persistState();
    }

    if (providedUserId !== record.userId) {
      throw new UnauthorizedException("actor_identity_mismatch");
    }

    return {
      userId: record.userId,
      email: normalizedEmail,
      platformRole: this.resolveEffectivePlatformRole(
        normalizedEmail,
        input.hintedRole ?? null,
      ),
    };
  }

  getAuthActorProfile(actor: RequestActor) {
    return {
      id: actor.userId,
      email: actor.email,
      platformRole: actor.platformRole === "platform_admin" ? "platform_admin" : null,
    };
  }

  getAuthActorProfileByEmail(input: {
    userId: string;
    email: string;
    hintedRole?: string | null;
  }) {
    return this.getAuthActorProfile(this.resolveRequestActor(input));
  }

  async getWorkspaceAdminTiktokState(workspaceId: string, actor: RequestActor) {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      throw new BadRequestException("workspace_id_required");
    }
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);

    return (
      this.workspaceAdminTiktokStates.get(normalizedWorkspaceId) ?? {
        workspaceId: normalizedWorkspaceId,
        bearerKey: "",
        workflowRows: [],
        rotationCursor: 0,
        autoWorkflowRun: null,
        operationProgress: null,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  async saveWorkspaceAdminTiktokState(
    workspaceId: string,
    actor: RequestActor,
    input: {
      bearerKey: string;
      workflowRows: unknown[];
      rotationCursor: number;
      autoWorkflowRun?: unknown | null;
      operationProgress?: unknown | null;
    },
  ) {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      throw new BadRequestException("workspace_id_required");
    }
    const now = new Date().toISOString();
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);

    const nextState: WorkspaceAdminTiktokStateRecord = {
      workspaceId: normalizedWorkspaceId,
      bearerKey: input.bearerKey,
      workflowRows: input.workflowRows ?? [],
      rotationCursor: Number.isFinite(input.rotationCursor) ? input.rotationCursor : 0,
      autoWorkflowRun: input.autoWorkflowRun ?? null,
      operationProgress: input.operationProgress ?? null,
      updatedAt: now,
    };
    this.workspaceAdminTiktokStates.set(normalizedWorkspaceId, nextState);
    this.persistState();
    return nextState;
  }

  async getWorkspaceTiktokCookieSources(workspaceId: string, actor: RequestActor) {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      throw new BadRequestException("workspace_id_required");
    }
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);

    return [
      ...(this.workspaceTiktokCookieSources.get(normalizedWorkspaceId) ?? []),
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async replaceWorkspaceTiktokCookieSources(
    workspaceId: string,
    actor: RequestActor,
    input: {
      rows: Array<{
        phone?: string;
        apiPhone?: string;
        cookie?: string;
      }>;
    },
  ) {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      throw new BadRequestException("workspace_id_required");
    }
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);

    const now = new Date().toISOString();
    const nextRows: WorkspaceTiktokCookieSourceRecord[] = [];
    for (const row of input.rows ?? []) {
        const cookie = row.cookie?.trim() ?? "";
        if (!cookie) {
          continue;
        }
        nextRows.push({
          id: randomUUID(),
          workspaceId: normalizedWorkspaceId,
          phone: row.phone?.trim() ?? "",
          apiPhone: row.apiPhone?.trim() ?? "",
          cookie,
          source: "excel_import" as const,
          createdAt: now,
          updatedAt: now,
        });
    }

    this.workspaceTiktokCookieSources.set(normalizedWorkspaceId, nextRows);
    this.persistState();
    return nextRows;
  }

  private normalizeAutomationPhone(value?: string): string {
    const raw = value?.trim() ?? "";
    if (!raw) {
      return "";
    }
    const digits = raw.replace(/\D/g, "");
    return digits || raw;
  }

  private resolveAutomationUsername(phone: string, fallback?: string | null): string {
    const direct = fallback?.trim();
    if (direct) {
      return direct;
    }
    const normalizedPhone = this.normalizeAutomationPhone(phone);
    if (!normalizedPhone) {
      return "";
    }
    return `${normalizedPhone}.bug`;
  }

  private resolveAutomationPassword(phone: string, fallback?: string | null): string {
    const direct = fallback?.trim();
    if (direct) {
      return direct;
    }
    const normalizedPhone = this.normalizeAutomationPhone(phone);
    if (!normalizedPhone) {
      return "";
    }
    return `${normalizedPhone}bug!`;
  }

  private sortAutomationAccounts(
    rows: TiktokAutomationAccountRecord[],
  ): TiktokAutomationAccountRecord[] {
    return [...rows].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private sortAutomationRuns(
    rows: TiktokAutomationRunRecord[],
  ): TiktokAutomationRunRecord[] {
    return [...rows].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private isAutomationItemTerminal(status: TiktokAutomationItemStatus): boolean {
    return (
      status === "done" ||
      status === "blocked" ||
      status === "step_failed" ||
      status === "skipped" ||
      status === "cancelled"
    );
  }

  private recalcAutomationRunProgress(
    run: TiktokAutomationRunRecord,
    items: TiktokAutomationRunItemRecord[],
  ): TiktokAutomationRunRecord {
    const doneCount = items.filter((item) => item.status === "done").length;
    const failedCount = items.filter((item) => item.status === "step_failed").length;
    const blockedCount = items.filter((item) => item.status === "blocked").length;
    const allTerminal = items.length > 0 && items.every((item) => this.isAutomationItemTerminal(item.status));
    const now = new Date().toISOString();
    return {
      ...run,
      doneCount,
      failedCount,
      blockedCount,
      totalCount: items.length,
      status:
        run.status === "stopped"
          ? "stopped"
          : allTerminal
            ? failedCount > 0 || blockedCount > 0
              ? "failed"
              : "completed"
            : run.status,
      finishedAt:
        allTerminal && run.status !== "running" && run.status !== "paused"
          ? run.finishedAt
          : allTerminal
            ? now
            : run.finishedAt,
      updatedAt: now,
    };
  }

  private ensureWorkspaceAutomationAccounts(workspaceId: string) {
    if (!this.workspaceTiktokAutomationAccounts.has(workspaceId)) {
      this.workspaceTiktokAutomationAccounts.set(workspaceId, []);
    }
    return this.workspaceTiktokAutomationAccounts.get(workspaceId) || [];
  }

  private ensureWorkspaceAutomationRuns(workspaceId: string) {
    if (!this.workspaceTiktokAutomationRuns.has(workspaceId)) {
      this.workspaceTiktokAutomationRuns.set(workspaceId, []);
    }
    return this.workspaceTiktokAutomationRuns.get(workspaceId) || [];
  }

  async getWorkspaceTiktokAutomationAccounts(workspaceId: string, actor: RequestActor) {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      throw new BadRequestException("workspace_id_required");
    }
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);
    const rows = this.ensureWorkspaceAutomationAccounts(normalizedWorkspaceId);
    return this.sortAutomationAccounts(rows);
  }

  async importWorkspaceTiktokAutomationAccounts(
    workspaceId: string,
    actor: RequestActor,
    input: {
      rows: Array<{
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
    },
  ) {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      throw new BadRequestException("workspace_id_required");
    }
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);

    const now = new Date().toISOString();
    const currentRows = this.ensureWorkspaceAutomationAccounts(normalizedWorkspaceId);
    const nextRows = [...currentRows];
    const force = Boolean(input.force);

    const findExistingIndex = (phone: string, apiPhone: string) =>
      nextRows.findIndex(
        (row) =>
          this.normalizeAutomationPhone(row.phone) === this.normalizeAutomationPhone(phone) &&
          row.apiPhone.trim() === apiPhone.trim(),
      );

    for (const row of input.rows ?? []) {
      const phone = this.normalizeAutomationPhone(row.phone);
      const apiPhone = row.apiPhone?.trim() ?? "";
      const cookie = row.cookie?.trim() ?? "";

      if (!phone && !apiPhone && !cookie) {
        continue;
      }

      const index = findExistingIndex(phone, apiPhone);
      const existing = index >= 0 ? nextRows[index] : null;
      if (
        existing &&
        !force &&
        (existing.status === "running" ||
          existing.status === "manual_pending" ||
          existing.status === "done")
      ) {
        continue;
      }

      const next: TiktokAutomationAccountRecord = {
        id: existing?.id ?? randomUUID(),
        workspaceId: normalizedWorkspaceId,
        phone: phone || existing?.phone || "",
        apiPhone: apiPhone || existing?.apiPhone || "",
        cookie: cookie || existing?.cookie || "",
        username: this.resolveAutomationUsername(
          phone || existing?.phone || "",
          row.username ?? existing?.username ?? null,
        ),
        password: this.resolveAutomationPassword(
          phone || existing?.phone || "",
          row.password ?? existing?.password ?? null,
        ),
        profileId:
          row.profileId !== undefined
            ? row.profileId
            : existing?.profileId ?? null,
        profileName:
          row.profileName !== undefined
            ? row.profileName
            : existing?.profileName ?? null,
        status: existing?.status ?? "queued",
        lastStep: existing?.lastStep ?? null,
        lastError: existing?.lastError ?? null,
        source: row.source ?? existing?.source ?? "excel_import",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      if (index >= 0) {
        nextRows[index] = next;
      } else {
        nextRows.push(next);
      }
    }

    this.workspaceTiktokAutomationAccounts.set(normalizedWorkspaceId, nextRows);
    this.persistState();
    return this.sortAutomationAccounts(nextRows);
  }

  async getWorkspaceTiktokAutomationRuns(workspaceId: string, actor: RequestActor) {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      throw new BadRequestException("workspace_id_required");
    }
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);
    return this.sortAutomationRuns(this.ensureWorkspaceAutomationRuns(normalizedWorkspaceId));
  }

  async getWorkspaceTiktokAutomationRun(
    workspaceId: string,
    runId: string,
    actor: RequestActor,
  ) {
    const normalizedWorkspaceId = workspaceId.trim();
    const normalizedRunId = runId.trim();
    if (!normalizedWorkspaceId) {
      throw new BadRequestException("workspace_id_required");
    }
    if (!normalizedRunId) {
      throw new BadRequestException("run_id_required");
    }
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);

    const run = this
      .ensureWorkspaceAutomationRuns(normalizedWorkspaceId)
      .find((row) => row.id === normalizedRunId);
    if (!run) {
      throw new NotFoundException("run_not_found");
    }
    const items = [...(this.tiktokAutomationRunItems.get(run.id) ?? [])].sort(
      (left, right) => left.createdAt.localeCompare(right.createdAt),
    );
    return { run, items };
  }

  async createWorkspaceTiktokAutomationRun(
    workspaceId: string,
    actor: RequestActor,
    input: {
      flowType: TiktokAutomationFlowType;
      mode: TiktokAutomationRunMode;
      accountIds: string[];
    },
  ) {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      throw new BadRequestException("workspace_id_required");
    }
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);

    const accounts = this.ensureWorkspaceAutomationAccounts(normalizedWorkspaceId);
    const requestedIds = Array.from(
      new Set(
        (input.accountIds ?? [])
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
    const accountRows =
      requestedIds.length > 0
        ? accounts.filter((account) => requestedIds.includes(account.id))
        : accounts;
    if (accountRows.length === 0) {
      throw new BadRequestException("automation_accounts_required");
    }

    const now = new Date().toISOString();
    const run: TiktokAutomationRunRecord = {
      id: randomUUID(),
      workspaceId: normalizedWorkspaceId,
      flowType: input.flowType,
      mode: input.mode,
      status: "queued",
      accountIds: accountRows.map((account) => account.id),
      currentIndex: 0,
      activeItemId: null,
      totalCount: accountRows.length,
      doneCount: 0,
      failedCount: 0,
      blockedCount: 0,
      createdBy: actor.userId,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const runItems: TiktokAutomationRunItemRecord[] = accountRows.map(
      (account, index) => ({
        id: randomUUID(),
        runId: run.id,
        workspaceId: normalizedWorkspaceId,
        accountId: account.id,
        phone: account.phone,
        apiPhone: account.apiPhone,
        profileId: account.profileId,
        profileName: account.profileName,
        status: index === 0 ? "queued" : "queued",
        step: "queued",
        attempt: 0,
        username: account.username,
        password: account.password,
        cookiePreview: account.cookie || null,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const runs = this.ensureWorkspaceAutomationRuns(normalizedWorkspaceId);
    runs.unshift(run);
    this.workspaceTiktokAutomationRuns.set(normalizedWorkspaceId, runs);
    this.tiktokAutomationRunItems.set(run.id, runItems);
    this.persistState();
    return { run, items: runItems };
  }

  async updateWorkspaceTiktokAutomationRunStatus(
    workspaceId: string,
    runId: string,
    actor: RequestActor,
    action: "start" | "pause" | "resume" | "stop",
  ) {
    const normalizedWorkspaceId = workspaceId.trim();
    const normalizedRunId = runId.trim();
    if (!normalizedWorkspaceId || !normalizedRunId) {
      throw new BadRequestException("workspace_and_run_required");
    }
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);

    const runs = this.ensureWorkspaceAutomationRuns(normalizedWorkspaceId);
    const runIndex = runs.findIndex((row) => row.id === normalizedRunId);
    if (runIndex < 0) {
      throw new NotFoundException("run_not_found");
    }
    const now = new Date().toISOString();
    const items = this.tiktokAutomationRunItems.get(normalizedRunId) ?? [];
    const run = { ...runs[runIndex] };

    if (action === "start" || action === "resume") {
      run.status = "running";
      run.startedAt = run.startedAt ?? now;
      const activeItem =
        items.find((item) => item.id === run.activeItemId) ??
        items.find((item) => item.status === "queued");
      if (activeItem) {
        const activeIndex = items.findIndex((item) => item.id === activeItem.id);
        items[activeIndex] = {
          ...activeItem,
          status: "running",
          step: activeItem.step === "queued" ? "launch_profile" : activeItem.step,
          startedAt: activeItem.startedAt ?? now,
          updatedAt: now,
        };
        run.activeItemId = activeItem.id;
        run.currentIndex = Math.max(0, activeIndex);
      }
    } else if (action === "pause") {
      run.status = "paused";
    } else if (action === "stop") {
      run.status = "stopped";
      run.finishedAt = now;
      for (let index = 0; index < items.length; index += 1) {
        if (this.isAutomationItemTerminal(items[index].status)) {
          continue;
        }
        items[index] = {
          ...items[index],
          status: "cancelled",
          step: "cancelled",
          finishedAt: now,
          updatedAt: now,
        };
      }
      run.activeItemId = null;
    }

    this.tiktokAutomationRunItems.set(normalizedRunId, items);
    runs[runIndex] = this.recalcAutomationRunProgress(
      {
        ...run,
        updatedAt: now,
      },
      items,
    );
    this.workspaceTiktokAutomationRuns.set(normalizedWorkspaceId, runs);
    this.persistState();
    return { run: runs[runIndex], items };
  }

  async updateWorkspaceTiktokAutomationRunItem(
    workspaceId: string,
    runId: string,
    itemId: string,
    actor: RequestActor,
    input: {
      status?: TiktokAutomationItemStatus;
      step?: string;
      attempt?: number;
      profileId?: string | null;
      profileName?: string | null;
      cookiePreview?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ) {
    const normalizedWorkspaceId = workspaceId.trim();
    const normalizedRunId = runId.trim();
    const normalizedItemId = itemId.trim();
    if (!normalizedWorkspaceId || !normalizedRunId || !normalizedItemId) {
      throw new BadRequestException("workspace_run_item_required");
    }
    this.ensureWorkspaceOperator(actor, normalizedWorkspaceId);

    const runs = this.ensureWorkspaceAutomationRuns(normalizedWorkspaceId);
    const runIndex = runs.findIndex((row) => row.id === normalizedRunId);
    if (runIndex < 0) {
      throw new NotFoundException("run_not_found");
    }

    const items = this.tiktokAutomationRunItems.get(normalizedRunId) ?? [];
    const itemIndex = items.findIndex((row) => row.id === normalizedItemId);
    if (itemIndex < 0) {
      throw new NotFoundException("run_item_not_found");
    }

    const now = new Date().toISOString();
    const currentItem = items[itemIndex];
    const nextStatus = input.status ?? currentItem.status;
    const nextStep = input.step?.trim() || currentItem.step;
    const nextAttempt =
      Number.isFinite(input.attempt) && input.attempt !== undefined
        ? Math.max(0, Number(input.attempt))
        : currentItem.attempt;
    const updatedItem: TiktokAutomationRunItemRecord = {
      ...currentItem,
      status: nextStatus,
      step: nextStep,
      attempt: nextAttempt,
      profileId:
        input.profileId !== undefined ? input.profileId : currentItem.profileId,
      profileName:
        input.profileName !== undefined
          ? input.profileName
          : currentItem.profileName,
      cookiePreview:
        input.cookiePreview !== undefined
          ? input.cookiePreview
          : currentItem.cookiePreview,
      errorCode:
        input.errorCode !== undefined ? input.errorCode : currentItem.errorCode,
      errorMessage:
        input.errorMessage !== undefined
          ? input.errorMessage
          : currentItem.errorMessage,
      startedAt:
        nextStatus === "running"
          ? currentItem.startedAt ?? now
          : currentItem.startedAt,
      finishedAt: this.isAutomationItemTerminal(nextStatus)
        ? now
        : currentItem.finishedAt,
      updatedAt: now,
    };
    items[itemIndex] = updatedItem;

    const accounts = this.ensureWorkspaceAutomationAccounts(normalizedWorkspaceId);
    const accountIndex = accounts.findIndex((row) => row.id === updatedItem.accountId);
    if (accountIndex >= 0) {
      accounts[accountIndex] = {
        ...accounts[accountIndex],
        status: updatedItem.status,
        lastStep: updatedItem.step,
        lastError: updatedItem.errorMessage,
        cookie: updatedItem.cookiePreview ?? accounts[accountIndex].cookie,
        profileId: updatedItem.profileId,
        profileName: updatedItem.profileName,
        updatedAt: now,
      };
      this.workspaceTiktokAutomationAccounts.set(normalizedWorkspaceId, accounts);
    }

    const run = { ...runs[runIndex] };
    if (run.status === "running" && this.isAutomationItemTerminal(updatedItem.status)) {
      const nextQueued = items.find((item) => item.status === "queued");
      if (nextQueued) {
        const nextQueuedIndex = items.findIndex((item) => item.id === nextQueued.id);
        items[nextQueuedIndex] = {
          ...nextQueued,
          status: "running",
          step: nextQueued.step === "queued" ? "launch_profile" : nextQueued.step,
          startedAt: nextQueued.startedAt ?? now,
          updatedAt: now,
        };
        run.activeItemId = nextQueued.id;
        run.currentIndex = nextQueuedIndex;
      } else {
        run.activeItemId = null;
      }
    } else if (updatedItem.status === "running") {
      run.activeItemId = updatedItem.id;
      run.currentIndex = itemIndex;
    }

    this.tiktokAutomationRunItems.set(normalizedRunId, items);
    runs[runIndex] = this.recalcAutomationRunProgress(
      {
        ...run,
        updatedAt: now,
      },
      items,
    );
    this.workspaceTiktokAutomationRuns.set(normalizedWorkspaceId, runs);
    this.persistState();

    return { run: runs[runIndex], item: updatedItem, items };
  }

  async getWorkspaceTiktokAutomationRunEvents(
    workspaceId: string,
    runId: string,
    actor: RequestActor,
    input: {
      since?: string | null;
    },
  ) {
    const payload = await this.getWorkspaceTiktokAutomationRun(workspaceId, runId, actor);
    const since = input.since ? Date.parse(input.since) : NaN;
    if (!Number.isFinite(since)) {
      return payload;
    }
    return {
      run: payload.run,
      items: payload.items.filter(
        (row) => Date.parse(row.updatedAt) > since,
      ),
    };
  }

  private getBugIdeaBaseUrl(): string {
    const configured =
      this.configService?.get<string>("BUGIDEA_BASE_URL")?.trim() ||
      process.env.BUGIDEA_BASE_URL?.trim() ||
      "https://bugidea.com";
    return configured.replace(/\/$/, "");
  }

  private async proxyBugIdeaRequest<T>(
    actor: RequestActor,
    bearerToken: string,
    path: string,
    init?: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      body?: unknown;
    },
  ): Promise<T> {
    this.assertPlatformAdmin(actor);
    const token = bearerToken.trim();
    if (!token) {
      throw new UnauthorizedException("bugidea_bearer_required");
    }

    const response = await fetch(`${this.getBugIdeaBaseUrl()}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    }).catch((error) => {
      throw new InternalServerErrorException(
        `bugidea_request_failed:${(error as Error).message}`,
      );
    });

    const rawBody = await response.text().catch(() => "");
    if (!response.ok) {
      throw new BadRequestException(
        `bugidea_${response.status}:${rawBody || response.statusText}`,
      );
    }

    if (!rawBody) {
      return undefined as T;
    }

    try {
      return JSON.parse(rawBody) as T;
    } catch {
      return rawBody as T;
    }
  }

  listTiktokCookies(actor: RequestActor, bearerToken: string) {
    return this.proxyBugIdeaRequest<unknown[]>(
      actor,
      bearerToken,
      "/api/tiktok-cookies",
      { method: "GET" },
    );
  }

  createTiktokCookie(
    actor: RequestActor,
    bearerToken: string,
    input: { label: string; cookie: string; notes?: string | null },
  ) {
    return this.proxyBugIdeaRequest(
      actor,
      bearerToken,
      "/api/tiktok-cookies",
      {
        method: "POST",
        body: {
          label: input.label,
          cookie: input.cookie,
          notes: input.notes ?? undefined,
        },
      },
    );
  }

  updateTiktokCookie(
    id: string,
    actor: RequestActor,
    bearerToken: string,
    input: {
      label?: string;
      cookie?: string;
      status?: string;
      notes?: string | null;
    },
  ) {
    return this.proxyBugIdeaRequest(
      actor,
      bearerToken,
      `/api/tiktok-cookies/${id}`,
      {
        method: "PUT",
        body: input,
      },
    );
  }

  deleteTiktokCookie(id: string, actor: RequestActor, bearerToken: string) {
    return this.proxyBugIdeaRequest<void>(
      actor,
      bearerToken,
      `/api/tiktok-cookies/${id}`,
      { method: "DELETE" },
    );
  }

  testTiktokCookie(id: string, actor: RequestActor, bearerToken: string) {
    return this.proxyBugIdeaRequest(
      actor,
      bearerToken,
      `/api/tiktok-cookies/${id}/test`,
      { method: "POST" },
    );
  }

  bulkCreateTiktokCookies(
    actor: RequestActor,
    bearerToken: string,
    input: { cookies: string[]; prefix?: string | null },
  ) {
    return this.proxyBugIdeaRequest(
      actor,
      bearerToken,
      "/api/tiktok-cookies/bulk",
      {
        method: "POST",
        body: {
          cookies: input.cookies,
          prefix: input.prefix ?? undefined,
        },
      },
    );
  }

  private validatePassword(password: string): string {
    if (typeof password !== "string") {
      throw new BadRequestException("password_required");
    }
    if (password.length < 8) {
      throw new BadRequestException("password_too_short");
    }
    if (password.length > 256) {
      throw new BadRequestException("password_too_long");
    }
    return password;
  }

  private hashPassword(password: string): { salt: string; hash: string } {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return { salt, hash };
  }

  private verifyPassword(password: string, salt: string, hash: string): boolean {
    try {
      const derived = scryptSync(password, salt, 64);
      const expected = Buffer.from(hash, "hex");
      if (expected.length !== derived.length) {
        return false;
      }
      return timingSafeEqual(expected, derived);
    } catch {
      return false;
    }
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
