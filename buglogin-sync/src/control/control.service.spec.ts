import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { scryptSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("accepts expired invite when actor email matches exactly", () => {
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

    const membership = service.acceptInvite(invite.token, {
      userId: "member-1",
      email: "member-expired@buglogin.local",
      platformRole: null,
    });

    expect(membership.workspaceId).toBe(workspace.id);
    expect(membership.role).toBe("member");
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

    const visibleWorkspaces = service.listWorkspaces(platformAdminActor);
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

  it("grants platform_admin to the first registered local account", () => {
    const firstUser = service.registerAuthUser(
      "first-admin@buglogin.local",
      "Password123!",
    );
    const secondUser = service.registerAuthUser(
      "second-user@buglogin.local",
      "Password123!",
    );

    expect(firstUser.user.platformRole).toBe("platform_admin");
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

  it("migrates legacy auth userId on login and keeps workspace visibility", () => {
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
      platformRole: null,
      createdAt: now,
      updatedAt: now,
    });

    const loggedIn = service.loginAuthUser(email, password);
    expect(loggedIn.user.id).not.toBe(legacyUserId);

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
    expect(members.some((member) => member.userId === legacyUserId)).toBe(false);
  });

  it("persists auth and workspace state in local sqlite without DATABASE_URL", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalSqliteFile = process.env.CONTROL_SQLITE_FILE;
    const originalStateFile = process.env.CONTROL_STATE_FILE;
    const tempDir = mkdtempSync(join(tmpdir(), "buglogin-control-sqlite-"));
    const sqliteFilePath = join(tempDir, "control-state.sqlite");

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
      process.env.CONTROL_SQLITE_FILE = sqliteFilePath;
      delete process.env.CONTROL_STATE_FILE;

      const first = new ControlService();
      await first.onModuleInit();
      const registered = first.registerAuthUser(
        "sqlite-user@buglogin.local",
        "Password123!",
      );
      const workspace = first.createWorkspace(
        {
          userId: registered.user.id,
          email: registered.user.email,
          platformRole: registered.user.platformRole,
        },
        "SQLite Workspace",
        "team",
      );
      await first.onModuleDestroy();

      const second = new ControlService();
      await second.onModuleInit();
      const loggedIn = second.loginAuthUser(
        "sqlite-user@buglogin.local",
        "Password123!",
      );
      const workspaces = second.listWorkspaces({
        userId: loggedIn.user.id,
        email: loggedIn.user.email,
        platformRole: loggedIn.user.platformRole,
      });
      expect(workspaces.map((item) => item.id)).toContain(workspace.id);

      second.saveWorkspaceAdminTiktokState(
        workspace.id,
        {
          userId: loggedIn.user.id,
          email: loggedIn.user.email,
          platformRole: "platform_admin",
        },
        {
          bearerKey: "bearer-1",
          workflowRows: [{ profileId: "profile-1" }],
          rotationCursor: 2,
        },
      );
      const cookie = second.createTiktokCookie(
        {
          userId: loggedIn.user.id,
          email: loggedIn.user.email,
          platformRole: "platform_admin",
        },
        {
          label: "cookie-main",
          cookie: "ttwid=1; sessionid=abc",
          notes: "seed",
        },
      );
      await second.onModuleDestroy();

      const third = new ControlService();
      await third.onModuleInit();
      const savedState = await third.getWorkspaceAdminTiktokState(workspace.id, {
        userId: loggedIn.user.id,
        email: loggedIn.user.email,
        platformRole: "platform_admin",
      });
      expect(savedState.bearerKey).toBe("bearer-1");
      expect(savedState.rotationCursor).toBe(2);
      const cookies = third.listTiktokCookies({
        userId: loggedIn.user.id,
        email: loggedIn.user.email,
        platformRole: "platform_admin",
      });
      expect(cookies.some((item) => item.id === cookie.id)).toBe(true);
      await third.onModuleDestroy();
    } finally {
      restoreEnv("NODE_ENV", originalNodeEnv);
      restoreEnv("DATABASE_URL", originalDatabaseUrl);
      restoreEnv("CONTROL_SQLITE_FILE", originalSqliteFile);
      restoreEnv("CONTROL_STATE_FILE", originalStateFile);
      rmSync(tempDir, { recursive: true, force: true });
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
});
