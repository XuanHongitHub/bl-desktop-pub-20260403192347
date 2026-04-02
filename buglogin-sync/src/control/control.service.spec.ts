import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { scryptSync } from "node:crypto";
import { ControlService } from "./control.service.js";

describe("ControlService", () => {
  let service: ControlService;

  beforeEach(() => {
    service = new ControlService();
  });

  it("requires exact invited email when accepting invite", () => {
    const workspace = service.createWorkspace(
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      },
      "Revenue Ops",
      "team",
    );

    const invite = service.createInvite(
      workspace.id,
      "member@buglogin.local",
      "member",
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      },
    );

    expect(() =>
      service.acceptInvite(invite.token, {
        userId: "user-2",
        email: "wrong@buglogin.local",
        platformRole: null,
      }),
    ).toThrow(UnauthorizedException);
  });

  it("blocks non-owner from assigning owner role", () => {
    const workspace = service.createWorkspace(
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      },
      "Workspace A",
      "team",
    );

    const invite = service.createInvite(
      workspace.id,
      "member-upgrade@buglogin.local",
      "member",
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      },
    );

    service.acceptInvite(invite.token, {
      userId: "member-1",
      email: "member-upgrade@buglogin.local",
      platformRole: null,
    });

    expect(() =>
      service.updateMembershipRole(
        workspace.id,
        "member-1",
        "owner",
        {
          userId: "member-1",
          email: "member-upgrade@buglogin.local",
          platformRole: null,
        },
        "promote self",
      ),
    ).toThrow(UnauthorizedException);
  });

  it("rejects inviting owner/admin roles directly", () => {
    const workspace = service.createWorkspace(
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      },
      "Workspace F",
      "team",
    );

    expect(() =>
      service.createInvite(workspace.id, "owner-invite@buglogin.local", "owner", {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      service.createInvite(workspace.id, "admin-invite@buglogin.local", "admin", {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects expired invite even when actor email matches exactly", () => {
    const workspace = service.createWorkspace(
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      },
      "Workspace B",
      "team",
    );

    const invite = service.createInvite(
      workspace.id,
      "member-expired@buglogin.local",
      "member",
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      },
    );

    // Simulate an expired link while keeping the same token.
    const internalInviteMap = (
      service as unknown as { invites: Map<string, { expiresAt: string }> }
    ).invites;
    const stored = internalInviteMap.get(invite.token);
    if (!stored) {
      throw new Error("expected invite to exist");
    }
    stored.expiresAt = new Date(Date.now() - 60_000).toISOString();

    expect(() =>
      service.acceptInvite(invite.token, {
        userId: "member-1",
        email: "member-expired@buglogin.local",
        platformRole: null,
      }),
    ).toThrow(UnauthorizedException);
  });

  it("rejects duplicate active invites for same email in same workspace", () => {
    const workspace = service.createWorkspace(
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      },
      "Workspace C",
      "team",
    );

    service.createInvite(workspace.id, "member@buglogin.local", "member", {
      userId: "owner-1",
      email: "owner@buglogin.local",
      platformRole: "platform_admin",
    });

    expect(() =>
      service.createInvite(workspace.id, "member@buglogin.local", "member", {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      }),
    ).toThrow(BadRequestException);
  });

  it("requires non-empty reason for sensitive entitlement change", () => {
    const workspace = service.createWorkspace(
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      },
      "Workspace D",
      "team",
    );

    expect(() =>
      service.setEntitlement(
        workspace.id,
        "read_only",
        {
          userId: "owner-1",
          email: "owner@buglogin.local",
          platformRole: "platform_admin",
        },
        " ",
      ),
    ).toThrow(BadRequestException);
  });

  it("allows platform admin to access workspaces without direct membership", () => {
    const workspace = service.createWorkspace(
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: null,
      },
      "Workspace E",
      "team",
    );

    const platformAdminActor = {
      userId: "platform-admin-1",
      email: "platform-admin@buglogin.local",
      platformRole: "platform_admin",
    } as const;

    const visibleWorkspaces = service.listWorkspaces(platformAdminActor, "all");
    expect(visibleWorkspaces.map((item) => item.id)).toContain(workspace.id);

    const overview = service.getWorkspaceOverview(workspace.id, platformAdminActor);
    expect(overview.workspaceId).toBe(workspace.id);
  });

  it("registers and logs in using persisted password credentials", () => {
    const registered = service.registerAuthUser(
      "auth-user@buglogin.local",
      "Password123!",
    );
    expect(registered.user.email).toBe("auth-user@buglogin.local");

    const loggedIn = service.loginAuthUser("auth-user@buglogin.local", "Password123!");
    expect(loggedIn.user.id).toBe(registered.user.id);

    expect(() =>
      service.loginAuthUser("auth-user@buglogin.local", "wrong-password"),
    ).toThrow(UnauthorizedException);
  });

  it("normalizes email and enforces case-insensitive uniqueness", () => {
    const registered = service.registerAuthUser(
      "  Mixed.Case@BugLogin.Local ",
      "Password123!",
    );
    expect(registered.user.email).toBe("mixed.case@buglogin.local");

    expect(() =>
      service.registerAuthUser("MIXED.CASE@buglogin.local", "Password123!"),
    ).toThrow(BadRequestException);
  });

  it("links google provider to existing password account and supports unlink", () => {
    const registered = service.registerAuthUser(
      "linked@buglogin.local",
      "Password123!",
    );

    const googleLogin = service.loginOrRegisterGoogleAuthUser(
      "linked@buglogin.local",
      "google-sub-1",
    );
    expect(googleLogin.user.id).toBe(registered.user.id);

    const unlinked = service.unlinkGoogleAuthProvider(
      "linked@buglogin.local",
      "Password123!",
    );
    expect(unlinked.user.id).toBe(registered.user.id);
  });

  it("requires password linking before password login for google-only accounts", () => {
    service.loginOrRegisterGoogleAuthUser("google-only@buglogin.local", "google-sub-2");
    expect(() =>
      service.loginAuthUser("google-only@buglogin.local", "Password123!"),
    ).toThrow(UnauthorizedException);
  });

  it("rejects mismatched actor identity and ignores spoofed platform role hints", () => {
    const first = service.registerAuthUser(
      "owner-a@buglogin.local",
      "Password123!",
    );
    const second = service.registerAuthUser(
      "owner-b@buglogin.local",
      "Password123!",
    );
    const workspaceA = service.createWorkspace(
      {
        userId: first.user.id,
        email: first.user.email,
        platformRole: first.user.platformRole,
      },
      "Workspace A",
      "team",
    );
    const workspaceB = service.createWorkspace(
      {
        userId: second.user.id,
        email: second.user.email,
        platformRole: second.user.platformRole,
      },
      "Workspace B",
      "team",
    );

    expect(() =>
      service.resolveRequestActor({
        userId: first.user.id,
        email: second.user.email,
        hintedRole: "platform_admin",
      }),
    ).toThrow(UnauthorizedException);

    const secondActor = service.resolveRequestActor({
      userId: second.user.id,
      email: second.user.email,
      hintedRole: "platform_admin",
    });
    expect(secondActor.platformRole).toBeNull();

    const visible = service.listWorkspaces(secondActor);
    expect(visible.map((item) => item.id)).toContain(workspaceB.id);
    expect(visible.map((item) => item.id)).not.toContain(workspaceA.id);
  });

  it("does not auto-grant platform_admin to local registrations", () => {
    const firstUser = service.registerAuthUser(
      "first-admin@buglogin.local",
      "Password123!",
    );
    const secondUser = service.registerAuthUser(
      "second-user@buglogin.local",
      "Password123!",
    );

    expect(firstUser.user.platformRole).toBeNull();
    expect(secondUser.user.platformRole).toBeNull();
  });

  it("reuses the same personal workspace for the same owner", () => {
    const actor = {
      userId: "owner-1",
      email: "owner@buglogin.local",
      platformRole: null,
    } as const;

    const firstWorkspace = service.createWorkspace(actor, "Owner Personal", "personal");
    const secondWorkspace = service.createWorkspace(
      actor,
      "Owner Personal Duplicate",
      "personal",
    );

    expect(secondWorkspace.id).toBe(firstWorkspace.id);

    const visible = service.listWorkspaces(actor);
    const personalWorkspaces = visible.filter((workspace) => workspace.mode === "personal");

    expect(personalWorkspaces).toHaveLength(1);
    expect(personalWorkspaces[0]?.id).toBe(firstWorkspace.id);
  });

  it("keeps existing legacy auth userId on login and workspace visibility", () => {
    const email = "legacy-user@buglogin.local";
    const password = "Password123!";
    const legacyUserId = "legacy-user-id";
    const now = new Date().toISOString();
    const passwordSalt = "legacy-salt";
    const passwordHash = scryptSync(password, passwordSalt, 64).toString("hex");

    const workspace = service.createWorkspace(
      {
        userId: legacyUserId,
        email,
        platformRole: null,
      },
      "Legacy Workspace",
      "team",
    );

    (
      service as unknown as {
        authUsers: Map<
          string,
          {
            userId: string;
            email: string;
            passwordSalt: string;
            passwordHash: string;
            authProvider: "password" | "google" | "password_google";
            googleSub: string | null;
            platformRole: "platform_admin" | null;
            createdAt: string;
            updatedAt: string;
          }
        >;
      }
    ).authUsers.set(email, {
      userId: legacyUserId,
      email,
      passwordSalt,
      passwordHash,
      authProvider: "password",
      googleSub: null,
      platformRole: null,
      createdAt: now,
      updatedAt: now,
    });

    const loggedIn = service.loginAuthUser(email, password);
    expect(loggedIn.user.id).toBe(legacyUserId);

    const workspaces = service.listWorkspaces({
      userId: loggedIn.user.id,
      email,
      platformRole: null,
    });
    expect(workspaces.map((item) => item.id)).toContain(workspace.id);

    const members = service.listMemberships(workspace.id, {
      userId: loggedIn.user.id,
      email,
      platformRole: null,
    });
    expect(members.some((member) => member.userId === loggedIn.user.id)).toBe(true);
  });

  it("requires DATABASE_URL outside test environment", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDatabaseUrl = process.env.DATABASE_URL;

    const restoreEnv = (key: string, value: string | undefined) => {
      if (typeof value === "undefined") {
        delete process.env[key];
        return;
      }
      process.env[key] = value;
    };

    try {
      process.env.NODE_ENV = "development";
      delete process.env.DATABASE_URL;

      expect(() => new ControlService()).toThrow(
        "database_url_required_for_control_plane",
      );
    } finally {
      restoreEnv("NODE_ENV", originalNodeEnv);
      restoreEnv("DATABASE_URL", originalDatabaseUrl);
    }
  });

  it("supports CRUD and test flow for tiktok cookies", () => {
    const actor = {
      userId: "admin-1",
      email: "admin@buglogin.local",
      platformRole: "platform_admin" as const,
    };
    const proxySpy = jest
      .spyOn(service as never, "proxyBugIdeaRequest")
      .mockResolvedValue([{ id: "cookie-1", label: "cookie-a" }] as never);

    void service.listTiktokCookies(actor, "bearer-1");
    void service.createTiktokCookie(actor, "bearer-1", {
      label: "cookie-a",
      cookie: "ttwid=1; sessionid=abc",
      notes: "seed",
    });
    void service.updateTiktokCookie("cookie-1", actor, "bearer-1", {
      notes: "updated",
      status: "active",
    });
    void service.testTiktokCookie("cookie-1", actor, "bearer-1");
    void service.bulkCreateTiktokCookies(actor, "bearer-1", {
      prefix: "seed",
      cookies: ["ttwid=1", "sid_tt=2"],
    });
    void service.deleteTiktokCookie("cookie-1", actor, "bearer-1");

    expect(proxySpy).toHaveBeenCalled();
  });

  it("lists admin users from canonical auth records instead of workspace fan-out", () => {
    const admin = service.registerAuthUser("admin@buglogin.local", "Password123!");
    (
      service as unknown as { platformAdminEmails: Set<string> }
    ).platformAdminEmails.add("admin@buglogin.local");

    const first = service.registerAuthUser("owner-a@buglogin.local", "Password123!");
    const second = service.registerAuthUser("owner-b@buglogin.local", "Password123!");
    const detached = service.registerAuthUser(
      "detached-user@buglogin.local",
      "Password123!",
    );

    const firstWorkspace = service.createWorkspace(
      { userId: first.user.id, email: first.user.email, platformRole: null },
      "Alpha Workspace",
      "team",
    );
    service.createWorkspace(
      { userId: second.user.id, email: second.user.email, platformRole: null },
      "Beta Workspace",
      "team",
    );

    const adminActor = service.resolveRequestActor({
      userId: admin.user.id,
      email: admin.user.email,
      hintedRole: "platform_admin",
    });

    const result = service.listAdminUsers(adminActor, {
      q: "detached-user",
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.email).toBe("detached-user@buglogin.local");
    expect(result.items[0]?.workspaceCount).toBe(0);

    const broadResult = service.listAdminUsers(adminActor, {
      page: 1,
      pageSize: 20,
    });
    expect(broadResult.items.some((item) => item.email === "owner-a@buglogin.local")).toBe(
      true,
    );
    expect(
      broadResult.items.some((item) => item.email === "detached-user@buglogin.local"),
    ).toBe(true);

    const firstDetail = service.getAdminUserDetail(adminActor, first.user.id);
    expect(firstDetail.memberships).toHaveLength(1);
    expect(firstDetail.memberships[0]?.workspaceId).toBe(firstWorkspace.id);
    expect(firstDetail.email).toBe("owner-a@buglogin.local");
  });

  it("returns admin workspace detail and supports owner transfer", () => {
    const admin = service.registerAuthUser("admin@buglogin.local", "Password123!");
    (
      service as unknown as { platformAdminEmails: Set<string> }
    ).platformAdminEmails.add("admin@buglogin.local");

    const owner = service.registerAuthUser("owner@buglogin.local", "Password123!");
    const nextOwner = service.registerAuthUser(
      "next-owner@buglogin.local",
      "Password123!",
    );
    const workspace = service.createWorkspace(
      { userId: owner.user.id, email: owner.user.email, platformRole: null },
      "Managed Workspace",
      "team",
    );

    const invite = service.createInvite(
      workspace.id,
      nextOwner.user.email,
      "member",
      { userId: owner.user.id, email: owner.user.email, platformRole: null },
    );
    service.acceptInvite(invite.token, {
      userId: nextOwner.user.id,
      email: nextOwner.user.email,
      platformRole: null,
    });

    service.overrideWorkspaceSubscriptionAsAdmin(
      {
        userId: admin.user.id,
        email: admin.user.email,
        platformRole: "platform_admin",
      },
      workspace.id,
      {
        planId: "custom",
        billingCycle: "yearly",
        profileLimit: 2500,
        memberLimit: 40,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        planLabel: "Enterprise Custom",
      },
    );

    const detailBefore = service.getAdminWorkspaceDetail(
      {
        userId: admin.user.id,
        email: admin.user.email,
        platformRole: "platform_admin",
      },
      workspace.id,
    );
    expect(detailBefore.owner?.email).toBe("owner@buglogin.local");
    expect(detailBefore.memberLimit).toBe(40);
    expect(detailBefore.planLabel).toBe("Enterprise Custom");

    const detailAfter = service.transferWorkspaceOwnershipAsAdmin(
      {
        userId: admin.user.id,
        email: admin.user.email,
        platformRole: "platform_admin",
      },
      workspace.id,
      nextOwner.user.id,
      "handover",
    );

    expect(detailAfter.owner?.email).toBe("next-owner@buglogin.local");

    const memberships = service.listMemberships(workspace.id, {
      userId: admin.user.id,
      email: admin.user.email,
      platformRole: "platform_admin",
    });
    expect(
      memberships.find((item) => item.userId === nextOwner.user.id)?.role,
    ).toBe("owner");
    expect(memberships.find((item) => item.userId === owner.user.id)?.role).toBe(
      "admin",
    );
  });

  it("keeps memberLimit on workspace listings and coupon quota limits on coupon records", () => {
    const admin = service.registerAuthUser("admin@buglogin.local", "Password123!");
    (
      service as unknown as { platformAdminEmails: Set<string> }
    ).platformAdminEmails.add("admin@buglogin.local");
    const owner = service.registerAuthUser("owner@buglogin.local", "Password123!");
    const workspace = service.createWorkspace(
      { userId: owner.user.id, email: owner.user.email, platformRole: null },
      "Quota Workspace",
      "team",
    );

    service.overrideWorkspaceSubscriptionAsAdmin(
      {
        userId: admin.user.id,
        email: admin.user.email,
        platformRole: "platform_admin",
      },
      workspace.id,
      {
        planId: "scale",
        billingCycle: "monthly",
        profileLimit: 1000,
        memberLimit: 18,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
    );

    const listed = service.listWorkspaces(
      {
        userId: admin.user.id,
        email: admin.user.email,
        platformRole: "platform_admin",
      },
      "all",
    );
    expect(listed.find((item) => item.id === workspace.id)?.memberLimit).toBe(18);

    const coupon = service.createCoupon(
      {
        userId: admin.user.id,
        email: admin.user.email,
        platformRole: "platform_admin",
      },
      {
        code: "SCALE18",
        source: "internal",
        discountPercent: 20,
        maxRedemptions: 100,
        maxPerUser: 2,
        maxPerWorkspace: 1,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    );

    expect(coupon.maxPerUser).toBe(2);
    expect(coupon.maxPerWorkspace).toBe(1);

    const listedCoupons = service.listCoupons({
      userId: admin.user.id,
      email: admin.user.email,
      platformRole: "platform_admin",
    });
    expect(listedCoupons.find((item) => item.id === coupon.id)?.maxPerUser).toBe(2);
    expect(
      listedCoupons.find((item) => item.id === coupon.id)?.maxPerWorkspace,
    ).toBe(1);
  });
});
