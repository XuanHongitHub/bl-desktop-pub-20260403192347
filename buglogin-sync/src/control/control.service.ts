import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
  StripeCheckoutConfirmResult,
  StripeCheckoutCreateResult,
  StripeCheckoutRecord,
  ShareGrantRecord,
  WorkspaceBillingState,
  WorkspaceListItem,
  WorkspaceMode,
  WorkspaceOverview,
  WorkspaceRecord,
  WorkspaceRole,
  WorkspaceSubscriptionRecord,
} from "./control.types.js";

type RequestActor = {
  userId: string;
  email: string;
  platformRole: string | null;
};

interface PersistedControlState {
  authUsers: AuthUserRecord[];
  workspaces: WorkspaceRecord[];
  memberships: MembershipRecord[];
  entitlements: EntitlementRecord[];
  invites: InviteRecord[];
  shareGrants: ShareGrantRecord[];
  coupons: CouponRecord[];
  licenseRedemptions: LicenseRedemptionRecord[];
  subscriptions: WorkspaceSubscriptionRecord[];
  invoices: BillingInvoiceRecord[];
  stripeCheckouts: StripeCheckoutRecord[];
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
  private readonly authUsers = new Map<string, AuthUserRecord>();
  private readonly workspaces = new Map<string, WorkspaceRecord>();
  private readonly memberships = new Map<string, MembershipRecord[]>();
  private readonly entitlements = new Map<string, EntitlementRecord>();
  private readonly invites = new Map<string, InviteRecord>();
  private readonly shareGrants = new Map<string, ShareGrantRecord>();
  private readonly coupons = new Map<string, CouponRecord>();
  private readonly licenseRedemptions = new Map<string, LicenseRedemptionRecord>();
  private readonly subscriptions = new Map<string, WorkspaceSubscriptionRecord>();
  private readonly invoices = new Map<string, BillingInvoiceRecord>();
  private readonly stripeCheckouts = new Map<string, StripeCheckoutRecord>();
  private readonly auditLogs: AuditLogRecord[] = [];
  private readonly stateFilePath: string | null;
  private readonly databaseUrl: string | null;
  private readonly postgresPool: Pool | null;
  private readonly sqliteDatabase: DatabaseSync | null;
  private persistPostgresQueue: Promise<void> = Promise.resolve();

  constructor(@Optional() private readonly configService?: ConfigService) {
    const isTestEnv = process.env.NODE_ENV === "test";
    this.databaseUrl = isTestEnv
      ? null
      : this.configService?.get<string>("DATABASE_URL")?.trim() ||
        process.env.DATABASE_URL?.trim() ||
        null;
    this.postgresPool = this.databaseUrl
      ? new Pool({
          connectionString: this.databaseUrl,
        })
      : null;

    const defaultStatePath = resolve(process.cwd(), ".data", "control-state.json");
    const configuredStatePath =
      this.configService?.get<string>("CONTROL_STATE_FILE")?.trim() ||
      process.env.CONTROL_STATE_FILE?.trim();
    const defaultSqlitePath = resolve(process.cwd(), ".data", "control-state.sqlite");
    const configuredSqlitePath =
      this.configService?.get<string>("CONTROL_SQLITE_FILE")?.trim() ||
      process.env.CONTROL_SQLITE_FILE?.trim();

    if (isTestEnv) {
      this.stateFilePath = null;
      this.sqliteDatabase = null;
      return;
    }

    if (this.postgresPool) {
      this.stateFilePath = null;
      this.sqliteDatabase = null;
      return;
    }

    this.stateFilePath = configuredStatePath || defaultStatePath;
    const sqliteFilePath = configuredSqlitePath || defaultSqlitePath;
    mkdirSync(dirname(sqliteFilePath), { recursive: true });
    this.sqliteDatabase = new DatabaseSync(sqliteFilePath);
    this.sqliteDatabase.exec("pragma foreign_keys = on;");
  }

  async onModuleInit() {
    if (this.postgresPool) {
      await this.loadStateFromPostgres();
      return;
    }
    if (this.sqliteDatabase) {
      const loadedFromSqlite = this.loadStateFromSqlite();
      if (!loadedFromSqlite && this.loadStateFromDisk() && this.hasInMemoryState()) {
        this.persistStateToSqlite();
      }
      return;
    }
    this.loadStateFromDisk();
  }

  async onModuleDestroy() {
    if (this.postgresPool) {
      try {
        await this.persistPostgresQueue;
        await this.postgresPool.end();
      } catch {
        // Ignore shutdown errors.
      }
      return;
    }

    if (this.sqliteDatabase) {
      try {
        this.persistStateToSqlite();
        this.sqliteDatabase.close();
      } catch {
        // Ignore shutdown errors.
      }
    }
  }

  private getDefaultPlanProfileLimit(planId: BillingPlanId): number {
    if (planId === "starter") {
      return 100;
    }
    if (planId === "growth") {
      return 300;
    }
    if (planId === "scale") {
      return 1000;
    }
    return 2000;
  }

  private getPlanPriceUsd(planId: BillingPlanId, billingCycle: BillingCycle): number {
    if (planId === "starter") {
      return billingCycle === "monthly" ? 5 : 4;
    }
    if (planId === "growth") {
      return billingCycle === "monthly" ? 15 : 12;
    }
    if (planId === "scale") {
      return billingCycle === "monthly" ? 49 : 39;
    }
    return billingCycle === "monthly" ? 99 : 79;
  }

  private getPlanLabel(planId: BillingPlanId): string {
    if (planId === "starter") {
      return "Starter";
    }
    if (planId === "growth") {
      return "Growth";
    }
    if (planId === "scale") {
      return "Scale";
    }
    return "Custom";
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
      Array.from(this.memberships.values())
        .flat()
        .filter((membership) => membership.userId === actor.userId)
        .map((membership) => membership.workspaceId),
    );
    return workspaceIds.size;
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
      updatedAt: nowIso,
    };
  }

  private getSubscriptionForWorkspace(workspaceId: string): WorkspaceSubscriptionRecord {
    const existing = this.subscriptions.get(workspaceId);
    if (existing) {
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

  private isWorkspaceBillingManager(actor: RequestActor, workspaceId: string): boolean {
    if (actor.platformRole === "platform_admin") {
      return true;
    }
    const membership = this.getWorkspaceMembership(workspaceId, actor);
    return membership.role === "owner" || membership.role === "admin";
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

    const source =
      configuredRaw ||
      (process.env.NODE_ENV === "production"
        ? ""
        : "BUG-STARTER-CLAIM:starter:100:monthly,BUG-GROWTH-CLAIM:growth:300:monthly,BUG-SCALE-CLAIM:scale:1000:monthly,BUG-CUSTOM-CLAIM:custom:2000:monthly");
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
    if (record.userId !== stableUserId) {
      this.migrateAuthUserId(record.userId, stableUserId, normalizedEmail);
      record.userId = stableUserId;
      record.updatedAt = new Date().toISOString();
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
    this.subscriptions.set(
      workspaceId,
      this.getDefaultSubscriptionForWorkspace(workspaceId, mode, now),
    );

    this.audit("workspace.created", actor.email, workspaceId, workspaceId);
    this.persistState();

    return workspace;
  }

  listWorkspaces(actor: RequestActor): WorkspaceListItem[] {
    const toListItem = (workspace: WorkspaceRecord): WorkspaceListItem => {
      const subscription = this.getSubscriptionForWorkspace(workspace.id);
      return {
        ...workspace,
        planLabel: subscription.planLabel,
        profileLimit: subscription.profileLimit,
        billingCycle: subscription.billingCycle,
        subscriptionStatus: subscription.status,
        subscriptionSource: subscription.source,
        expiresAt: subscription.expiresAt,
      };
    };

    if (actor.platformRole === "platform_admin") {
      return Array.from(this.workspaces.values())
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((workspace) => toListItem(workspace));
    }

    const ownedMemberships = Array.from(this.memberships.values()).flat();
    const workspaceIds = new Set(
      ownedMemberships
        .filter((membership) => membership.userId === actor.userId)
        .map((membership) => membership.workspaceId),
    );

    return Array.from(this.workspaces.values())
      .filter((workspace) => workspaceIds.has(workspace.id))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((workspace) => toListItem(workspace));
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
    this.persistState();

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
    return {
      workspaceId,
      subscription,
      recentInvoices,
    };
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
    params.set("mode", "payment");
    params.set("success_url", successUrl.toString());
    params.set("cancel_url", cancelUrl.toString());
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

    for (const [email, authUser] of this.authUsers.entries()) {
      if (authUser.userId !== previous) {
        continue;
      }
      this.authUsers.set(email, {
        ...authUser,
        userId: next,
        updatedAt: now,
      });
    }

    for (const workspace of this.workspaces.values()) {
      if (workspace.createdBy === previous) {
        workspace.createdBy = next;
      }
    }

    for (const [workspaceId, members] of this.memberships.entries()) {
      const deduped = new Map<string, MembershipRecord>();
      for (const member of members) {
        const migratedUserId = member.userId === previous ? next : member.userId;
        const candidate: MembershipRecord = {
          ...member,
          userId: migratedUserId,
          email: migratedUserId === next ? normalizedEmail : member.email,
        };
        const existing = deduped.get(migratedUserId);
        if (!existing) {
          deduped.set(migratedUserId, candidate);
          continue;
        }
        const existingRank = this.getWorkspaceRoleRank(existing.role);
        const candidateRank = this.getWorkspaceRoleRank(candidate.role);
        const keepCandidate =
          candidateRank > existingRank ||
          (candidateRank === existingRank &&
            candidate.createdAt < existing.createdAt);
        const preferred = keepCandidate ? candidate : existing;
        deduped.set(migratedUserId, {
          ...preferred,
          email: migratedUserId === next ? normalizedEmail : preferred.email,
          createdAt:
            existing.createdAt < candidate.createdAt
              ? existing.createdAt
              : candidate.createdAt,
        });
      }
      this.memberships.set(
        workspaceId,
        Array.from(deduped.values()).sort((left, right) =>
          left.createdAt.localeCompare(right.createdAt),
        ),
      );
    }

    for (const invite of this.invites.values()) {
      if (invite.createdBy === previous) {
        invite.createdBy = next;
      }
    }

    for (const shareGrant of this.shareGrants.values()) {
      if (shareGrant.createdBy === previous) {
        shareGrant.createdBy = next;
      }
    }

    for (const coupon of this.coupons.values()) {
      if (coupon.createdBy === previous) {
        coupon.createdBy = next;
      }
    }

    for (const redemption of this.licenseRedemptions.values()) {
      if (redemption.redeemedBy === previous) {
        redemption.redeemedBy = next;
      }
    }

    for (const invoice of this.invoices.values()) {
      if (invoice.actorUserId === previous) {
        invoice.actorUserId = next;
      }
    }

    for (const checkout of this.stripeCheckouts.values()) {
      if (checkout.actorUserId === previous) {
        checkout.actorUserId = next;
      }
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

  private clearInMemoryState() {
    this.authUsers.clear();
    this.workspaces.clear();
    this.memberships.clear();
    this.entitlements.clear();
    this.invites.clear();
    this.shareGrants.clear();
    this.coupons.clear();
    this.licenseRedemptions.clear();
    this.subscriptions.clear();
    this.invoices.clear();
    this.stripeCheckouts.clear();
    this.auditLogs.splice(0, this.auditLogs.length);
  }

  private getSnapshot(): PersistedControlState {
    return {
      authUsers: Array.from(this.authUsers.values()),
      workspaces: Array.from(this.workspaces.values()),
      memberships: Array.from(this.memberships.values()).flat(),
      entitlements: Array.from(this.entitlements.values()),
      invites: Array.from(this.invites.values()),
      shareGrants: Array.from(this.shareGrants.values()),
      coupons: Array.from(this.coupons.values()),
      licenseRedemptions: Array.from(this.licenseRedemptions.values()),
      subscriptions: Array.from(this.subscriptions.values()),
      invoices: Array.from(this.invoices.values()),
      stripeCheckouts: Array.from(this.stripeCheckouts.values()),
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
      this.subscriptions.set(subscription.workspaceId, subscription);
    }

    for (const invoice of parsed.invoices || []) {
      this.invoices.set(invoice.id, invoice);
    }

    for (const checkout of parsed.stripeCheckouts || []) {
      this.stripeCheckouts.set(checkout.stripeSessionId, checkout);
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
        workspacesResult,
        membershipsResult,
        entitlementsResult,
        invitesResult,
        shareGrantsResult,
        couponsResult,
        licenseRedemptionsResult,
        subscriptionsResult,
        invoicesResult,
        stripeCheckoutsResult,
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
        this.postgresPool.query(
          "select id, name, mode, created_by, created_at from workspaces",
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
          "select workspace_id, plan_id, plan_label, profile_limit, billing_cycle, status, source, started_at, expires_at, updated_at from workspace_subscriptions",
        ),
        this.postgresPool.query(
          "select id, workspace_id, plan_id, plan_label, billing_cycle, base_amount_usd, amount_usd, discount_percent, method, source, coupon_code, status, created_at, paid_at, actor_user_id, stripe_session_id from billing_invoices",
        ),
        this.postgresPool.query(
          "select stripe_session_id, id, workspace_id, plan_id, plan_label, billing_cycle, profile_limit, base_amount_usd, amount_usd, discount_percent, coupon_code, checkout_url, created_at, completed_at, actor_user_id from stripe_checkout_sessions",
        ),
        this.postgresPool.query(
          "select id, action, actor, workspace_id, target_id, reason, created_at from audit_logs order by created_at asc",
        ),
      ]);

      const userEmailById = new Map<string, string>();
      for (const row of usersResult.rows) {
        userEmailById.set(row.id, row.email.toLowerCase());
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
        memberships: membershipsResult.rows.map((row) => {
          const userId = row.user_id as string;
          return {
            workspaceId: row.workspace_id as string,
            userId,
            email: userEmailById.get(userId) ?? `${userId}@local`,
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
    const registerUser = (id: string, email?: string) => {
      const normalizedId = id.trim();
      if (!normalizedId) {
        return;
      }
      const normalizedEmail = email?.trim().toLowerCase() || `${normalizedId}@local`;
      usersById.set(normalizedId, normalizedEmail);
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
          stripe_checkout_sessions,
          billing_invoices,
          workspace_subscriptions,
          license_redemptions,
          coupons,
          share_grants,
          invites,
          entitlements,
          workspace_memberships,
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
              (workspace_id, plan_id, plan_label, profile_limit, billing_cycle, status, source, started_at, expires_at, updated_at)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

  private hasInMemoryState(): boolean {
    return (
      this.authUsers.size > 0 ||
      this.workspaces.size > 0 ||
      this.memberships.size > 0 ||
      this.entitlements.size > 0 ||
      this.invites.size > 0 ||
      this.shareGrants.size > 0 ||
      this.coupons.size > 0 ||
      this.licenseRedemptions.size > 0 ||
      this.subscriptions.size > 0 ||
      this.invoices.size > 0 ||
      this.stripeCheckouts.size > 0 ||
      this.auditLogs.length > 0
    );
  }

  private ensureSqliteSchema() {
    if (!this.sqliteDatabase) {
      return;
    }
    this.sqliteDatabase.exec(`
      create table if not exists control_state_snapshot (
        id integer primary key check (id = 1),
        payload text not null,
        updated_at text not null
      );
    `);
  }

  private loadStateFromSqlite(): boolean {
    if (!this.sqliteDatabase) {
      return false;
    }
    this.ensureSqliteSchema();

    try {
      const row = this.sqliteDatabase
        .prepare(
          "select payload from control_state_snapshot where id = 1 limit 1",
        )
        .get() as { payload: string } | undefined;
      if (!row?.payload) {
        return false;
      }
      const parsed = JSON.parse(row.payload) as PersistedControlState;
      this.applySnapshot(parsed);
      return true;
    } catch (error) {
      console.warn("[control-state] Failed to load persisted SQLite state:", error);
      this.clearInMemoryState();
      return false;
    }
  }

  private persistStateToSqlite() {
    if (!this.sqliteDatabase) {
      return;
    }
    this.ensureSqliteSchema();
    const snapshot = this.getSnapshot();
    const payload = JSON.stringify(snapshot);
    const nowIso = new Date().toISOString();
    try {
      this.sqliteDatabase.exec("begin immediate");
      this.sqliteDatabase
        .prepare(
          `
            insert into control_state_snapshot (id, payload, updated_at)
            values (1, ?, ?)
            on conflict(id)
            do update set
              payload = excluded.payload,
              updated_at = excluded.updated_at
          `,
        )
        .run(payload, nowIso);
      this.sqliteDatabase.exec("commit");
    } catch (error) {
      try {
        this.sqliteDatabase.exec("rollback");
      } catch {
        // Ignore rollback errors.
      }
      console.warn("[control-state] Failed to persist SQLite state:", error);
    }
  }

  private loadStateFromDisk(): boolean {
    if (!this.stateFilePath) {
      return false;
    }

    try {
      const raw = readFileSync(this.stateFilePath, "utf-8");
      const parsed = JSON.parse(raw) as PersistedControlState;
      this.applySnapshot(parsed);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      console.warn("[control-state] Failed to load persisted control-plane state:", error);
      return false;
    }
  }

  private persistState() {
    if (this.postgresPool) {
      this.queuePersistStateToPostgres();
      return;
    }
    if (this.sqliteDatabase) {
      this.persistStateToSqlite();
      return;
    }
    this.persistStateToDisk();
  }

  private persistStateToDisk() {
    if (!this.stateFilePath) {
      return;
    }

    const snapshot = this.getSnapshot();

    try {
      mkdirSync(dirname(this.stateFilePath), { recursive: true });
      writeFileSync(this.stateFilePath, JSON.stringify(snapshot, null, 2));
    } catch (error) {
      console.warn("[control-state] Failed to persist control-plane state:", error);
    }
  }

  private resolvePlatformRoleForRegistration(
    normalizedEmail: string,
  ): "platform_admin" | null {
    const configuredEmails = new Set<string>();
    const fromConfig = this.configService
      ?.get<string>("CONTROL_PLATFORM_ADMIN_EMAILS")
      ?.trim();
    const fromEnv = process.env.CONTROL_PLATFORM_ADMIN_EMAILS?.trim();
    const source = fromConfig || fromEnv || "";
    for (const entry of source.split(",")) {
      const candidate = this.normalizeEmail(entry);
      if (candidate) {
        configuredEmails.add(candidate);
      }
    }
    if (configuredEmails.has(normalizedEmail)) {
      return "platform_admin";
    }

    const hasExistingPlatformAdmin = Array.from(this.authUsers.values()).some(
      (record) => record.platformRole === "platform_admin",
    );
    if (!hasExistingPlatformAdmin && this.authUsers.size === 0) {
      return "platform_admin";
    }
    return null;
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
