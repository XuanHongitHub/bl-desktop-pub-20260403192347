"use client";

import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminWorkspaceTab } from "@/components/admin/admin-workspace-tab";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  inviteWorkspaceMember,
  listWorkspaceInvites,
  listWorkspaceMembers,
  revokeWorkspaceInvite,
  updateWorkspaceMemberRole,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { buildControlApiUrl } from "@/lib/control-api-routes";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { ControlInvite, ControlMembership, TeamRole } from "@/types";

export default function AccountMembersPage() {
  const { t } = useTranslation();
  const { connection, selectedWorkspaceId, selectedWorkspace } =
    usePortalBillingData();

  const activeWorkspaceRole = selectedWorkspace?.actorRole ?? "viewer";
  const isTeamOperator =
    activeWorkspaceRole === "owner" || activeWorkspaceRole === "admin";

  const [activeTab, setActiveTab] = useState<"directory" | "permissions">(
    "directory",
  );
  const [isBusy, setIsBusy] = useState(false);
  const [memberships, setMemberships] = useState<ControlMembership[]>([]);
  const [invites, setInvites] = useState<ControlInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("member");
  const [membershipRoleDrafts, setMembershipRoleDrafts] = useState<
    Record<string, TeamRole>
  >({});

  const reloadData = useCallback(async () => {
    if (!connection || !selectedWorkspaceId) return;
    setIsBusy(true);
    try {
      const [membersData, invitesData] = await Promise.all([
        listWorkspaceMembers(connection, selectedWorkspaceId),
        listWorkspaceInvites(connection, selectedWorkspaceId),
      ]);
      setMemberships(membersData);
      setInvites(invitesData);
    } catch (e) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description: e instanceof Error ? e.message : "Failed to load members",
      });
    } finally {
      setIsBusy(false);
    }
  }, [connection, selectedWorkspaceId, t]);

  useEffect(() => {
    if (connection && selectedWorkspaceId) {
      void reloadData();
    } else {
      setMemberships([]);
      setInvites([]);
    }
  }, [connection, selectedWorkspaceId, reloadData]);

  const handleCreateInvite = async () => {
    if (!connection || !selectedWorkspaceId) return;
    if (!inviteEmail.trim()) {
      showErrorToast(t("portalSite.commerce.errors.requiredFields"));
      return;
    }
    setIsBusy(true);
    try {
      await inviteWorkspaceMember(connection, selectedWorkspaceId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      showSuccessToast(t("adminWorkspace.api.inviteSent"));
      setInviteEmail("");
      await reloadData();
    } catch (error) {
      showErrorToast(t("adminWorkspace.api.inviteFailed"), {
        description:
          error instanceof Error ? error.message : "Failed to invite",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!connection || !selectedWorkspaceId) return;
    setIsBusy(true);
    try {
      await revokeWorkspaceInvite(connection, selectedWorkspaceId, inviteId);
      showSuccessToast(t("adminWorkspace.api.inviteRevoked"));
      await reloadData();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description:
          error instanceof Error ? error.message : "Failed to revoke",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdateRole = async (userId: string) => {
    if (!connection || !selectedWorkspaceId) return;
    const newRole = membershipRoleDrafts[userId];
    if (!newRole) return;
    setIsBusy(true);
    try {
      await updateWorkspaceMemberRole(
        connection,
        selectedWorkspaceId,
        userId,
        newRole,
      );
      showSuccessToast(t("adminWorkspace.api.roleUpdated"));
      await reloadData();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description:
          error instanceof Error ? error.message : "Failed to update role",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!connection || !selectedWorkspaceId) return;
    setIsBusy(true);
    try {
      const response = await fetch(
        `${buildControlApiUrl(connection.controlBaseUrl, "workspaceMembers", { workspaceId: selectedWorkspaceId })}/${encodeURIComponent(userId)}/remove`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${connection.controlToken}`,
            "x-user-id": connection.userId,
            "x-user-email": connection.userEmail,
            ...(connection.platformRole
              ? { "x-platform-role": connection.platformRole }
              : {}),
          },
          body: JSON.stringify({ reason: "removed_from_portal" }),
        },
      );

      if (!response.ok) {
        let msg = response.statusText;
        try {
          const body = await response.json();
          if (body.message)
            msg = Array.isArray(body.message)
              ? body.message.join(", ")
              : body.message;
        } catch (_) {}
        throw new Error(msg);
      }

      showSuccessToast(t("adminWorkspace.api.memberRemoved"));
      await reloadData();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description:
          error instanceof Error ? error.message : "Failed to remove member",
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] p-4 lg:p-8">
      {!isTeamOperator ? (
        <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center md:py-24">
          <ShieldCheck className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
          <h2 className="text-lg font-semibold text-foreground">
            {t("billingPage.ownerOnlyTitle")}
          </h2>
          <p className="mt-2 max-w-[560px] text-sm text-muted-foreground">
            {t("billingPage.ownerOnlyDescription")}
          </p>
        </section>
      ) : null}
      {isTeamOperator ? (
        <>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                {t("adminWorkspace.ui.memberList", "Thành viên")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "adminWorkspace.ui.memberRoleDesc",
                  "Quản lý và cấp quyền phân bổ tài nguyên Profile/Group cho các thành viên.",
                )}
              </p>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(val) =>
              setActiveTab(val as "directory" | "permissions")
            }
            className="w-full"
          >
            <TabsList className="mb-6 grid w-full max-w-[400px] grid-cols-2">
              <TabsTrigger value="directory" className="text-sm font-medium">
                {t("shell.auth.roles.member", "Thành viên")}
              </TabsTrigger>
              <TabsTrigger value="permissions" className="text-sm font-medium">
                {t("shell.nav.permissions", "Phân quyền")}
              </TabsTrigger>
            </TabsList>

            <AdminWorkspaceTab
              isBusy={isBusy}
              runtimeBaseUrl={null}
              isPlatformAdmin={false}
              isTeamOperator={isTeamOperator}
              workspaceRole={activeWorkspaceRole}
              workspaces={[]}
              selectedWorkspaceId={selectedWorkspaceId}
              selectedWorkspace={null}
              overview={null}
              memberships={memberships}
              invites={invites}
              shareGrants={[]}
              workspaceName=""
              setWorkspaceName={() => {}}
              workspaceMode="team"
              setWorkspaceMode={() => {}}
              workspacePlanId="starter"
              setWorkspacePlanId={() => {}}
              workspaceBillingCycle="monthly"
              setWorkspaceBillingCycle={() => {}}
              inviteEmail={inviteEmail}
              setInviteEmail={setInviteEmail}
              inviteRole={inviteRole}
              setInviteRole={setInviteRole}
              shareResourceType="profile"
              setShareResourceType={() => {}}
              shareResourceId=""
              setShareResourceId={() => {}}
              shareRecipientEmail=""
              setShareRecipientEmail={() => {}}
              handleCreateWorkspace={() => {}}
              setSelectedWorkspaceId={() => {}}
              handleCreateInvite={handleCreateInvite}
              handleRevokeInvite={handleRevokeInvite}
              membershipRoleDrafts={membershipRoleDrafts}
              setMembershipRoleDrafts={setMembershipRoleDrafts}
              handleUpdateRole={handleUpdateRole}
              handleRemoveMember={handleRemoveMember}
              handleCreateShare={() => {}}
              handleRevokeShare={() => {}}
              currentUserEmail={connection?.userEmail ?? null}
              currentUserId={connection?.userId ?? null}
              workspaceScopedOnly={true}
              forcedFlow={activeTab}
              showFlowTabs={false}
            />
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
