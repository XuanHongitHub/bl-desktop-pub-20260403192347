import { BadRequestException, UnauthorizedException } from "@nestjs/common";
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
      "admin@buglogin.local",
      "admin",
      {
        userId: "owner-1",
        email: "owner@buglogin.local",
        platformRole: "platform_admin",
      },
    );

    service.acceptInvite(invite.token, {
      userId: "admin-1",
      email: "admin@buglogin.local",
      platformRole: null,
    });

    expect(() =>
      service.updateMembershipRole(
        workspace.id,
        "admin-1",
        "owner",
        {
          userId: "admin-1",
          email: "admin@buglogin.local",
          platformRole: null,
        },
        "promote self",
      ),
    ).toThrow(UnauthorizedException);
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
});
