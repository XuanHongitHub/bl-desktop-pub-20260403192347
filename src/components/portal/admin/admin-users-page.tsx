"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createAdminUser,
  listAdminWorkspaceHealth,
  listWorkspaceMembers,
  updateWorkspaceMemberRole,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { ControlMembership, TeamRole } from "@/types";

type UserRow = ControlMembership & { workspaceName: string };

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [workspaceOptions, setWorkspaceOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserPlatformRole, setNewUserPlatformRole] = useState<
    "none" | "platform_admin"
  >("none");
  const [creatingUser, setCreatingUser] = useState(false);

  const refresh = useCallback(async () => {
    if (!connection) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const workspaceHealthRows = await listAdminWorkspaceHealth(connection);
      const uniqueWorkspaceMap = new Map<string, string>();
      if (Array.isArray(workspaceHealthRows)) {
        for (const item of workspaceHealthRows) {
          if (!uniqueWorkspaceMap.has(item.workspaceId)) {
            uniqueWorkspaceMap.set(item.workspaceId, item.workspaceName);
          }
        }
      }
      const uniqueWorkspaces = Array.from(uniqueWorkspaceMap.entries()).map(
        ([id, name]) => ({ id, name }),
      );
      setWorkspaceOptions(uniqueWorkspaces);

      const allRows = await Promise.all(
        uniqueWorkspaces.map(async (workspace) => {
          const memberships = await listWorkspaceMembers(connection, workspace.id);
          return memberships.map((membership) => ({
            ...membership,
            workspaceName: workspace.name,
          }));
        }),
      );
      setRows(allRows.flat());
    } catch (error) {
      showErrorToast(t("portalSite.adminUsers.errors.loadFailed"), {
        description: extractErrorMessage(error, "load_users_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter((item) => {
      if (workspaceFilter !== "all" && item.workspaceId !== workspaceFilter) {
        return false;
      }
      if (roleFilter !== "all" && item.role !== roleFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [item.email, item.userId, item.workspaceName]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [query, roleFilter, rows, workspaceFilter]);

  const handleRoleChange = async (
    row: UserRow,
    nextRole: TeamRole,
  ): Promise<void> => {
    if (!connection) {
      showErrorToast(t("portalSite.adminUsers.errors.connectionMissing"));
      return;
    }
    if (row.role === nextRole) {
      return;
    }
    const actionKey = `${row.workspaceId}:${row.userId}`;
    setSavingKey(actionKey);
    try {
      const updated = await updateWorkspaceMemberRole(
        connection,
        row.workspaceId,
        row.userId,
        nextRole,
      );
      setRows((current) =>
        current.map((item) =>
          item.workspaceId === row.workspaceId && item.userId === row.userId
            ? { ...item, role: updated.role }
            : item,
        ),
      );
      showSuccessToast(t("portalSite.adminUsers.toasts.roleUpdated"));
    } catch (error) {
      showErrorToast(t("portalSite.adminUsers.errors.updateFailed"), {
        description: extractErrorMessage(error, "update_role_failed"),
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateUser = async () => {
    if (!connection) {
      showErrorToast(t("portalSite.adminUsers.errors.connectionMissing"));
      return;
    }
    const email = newUserEmail.trim().toLowerCase();
    const password = newUserPassword;
    if (!email || !email.includes("@")) {
      showErrorToast(t("portalSite.adminUsers.errors.createInvalidEmail"));
      return;
    }
    if (!password || password.length < 8) {
      showErrorToast(t("portalSite.adminUsers.errors.createInvalidPassword"));
      return;
    }

    setCreatingUser(true);
    try {
      await createAdminUser(connection, {
        email,
        password,
        platformRole:
          newUserPlatformRole === "platform_admin" ? "platform_admin" : null,
      });
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserPlatformRole("none");
      showSuccessToast(t("portalSite.adminUsers.toasts.userCreated"));
      await refresh();
    } catch (error) {
      showErrorToast(t("portalSite.adminUsers.errors.createFailed"), {
        description: extractErrorMessage(error, "create_user_failed"),
      });
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.adminUsers.eyebrow")}
      title={t("portalSite.adminUsers.title")}
      description={t("portalSite.adminUsers.description")}
      actions={
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          {t("portalSite.adminUsers.actions.refresh")}
        </Button>
      }
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-foreground">
            {t("portalSite.adminUsers.create.title")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("portalSite.adminUsers.create.description")}
          </p>
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_160px_120px]">
            <Input
              value={newUserEmail}
              onChange={(event) => setNewUserEmail(event.target.value)}
              placeholder={t("portalSite.adminUsers.create.emailPlaceholder")}
              className="h-9"
              disabled={creatingUser}
            />
            <Input
              value={newUserPassword}
              onChange={(event) => setNewUserPassword(event.target.value)}
              type="password"
              placeholder={t("portalSite.adminUsers.create.passwordPlaceholder")}
              className="h-9"
              disabled={creatingUser}
            />
            <Select
              value={newUserPlatformRole}
              onValueChange={(value) =>
                setNewUserPlatformRole(value as "none" | "platform_admin")
              }
              disabled={creatingUser}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t("portalSite.adminUsers.create.roleUser")}
                </SelectItem>
                <SelectItem value="platform_admin">
                  {t("portalSite.adminUsers.create.rolePlatformAdmin")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => void handleCreateUser()}
              className="h-9"
              disabled={creatingUser}
            >
              {t("portalSite.adminUsers.create.action")}
            </Button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("portalSite.adminUsers.search")}
            className="h-9 md:col-span-2"
          />
          <Select value={workspaceFilter} onValueChange={setWorkspaceFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("portalSite.adminUsers.filters.allWorkspaces")}
              </SelectItem>
              {workspaceOptions.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("portalSite.adminUsers.filters.allRoles")}
              </SelectItem>
              <SelectItem value="owner">{t("portalSite.adminUsers.roles.owner")}</SelectItem>
              <SelectItem value="admin">{t("portalSite.adminUsers.roles.admin")}</SelectItem>
              <SelectItem value="member">{t("portalSite.adminUsers.roles.member")}</SelectItem>
              <SelectItem value="viewer">{t("portalSite.adminUsers.roles.viewer")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="secondary">{t("portalSite.adminUsers.scopeBadge")}</Badge>
          <Badge variant="outline">{filteredRows.length}</Badge>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.adminUsers.columns.user")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.adminUsers.columns.workspace")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.adminUsers.columns.role")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.adminUsers.columns.joinedAt")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.adminUsers.loading")}
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.adminUsers.empty")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const actionKey = `${row.workspaceId}:${row.userId}`;
                  return (
                    <tr key={`${row.workspaceId}:${row.userId}`} className="border-t border-border/70">
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">{row.email}</p>
                        <p className="text-xs text-muted-foreground">{row.userId}</p>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.workspaceName}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={row.role}
                          onValueChange={(value) =>
                            void handleRoleChange(row, value as TeamRole)
                          }
                          disabled={savingKey === actionKey}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">
                              {t("portalSite.adminUsers.roles.owner")}
                            </SelectItem>
                            <SelectItem value="admin">
                              {t("portalSite.adminUsers.roles.admin")}
                            </SelectItem>
                            <SelectItem value="member">
                              {t("portalSite.adminUsers.roles.member")}
                            </SelectItem>
                            <SelectItem value="viewer">
                              {t("portalSite.adminUsers.roles.viewer")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.createdAt ? formatLocaleDateTime(row.createdAt) : "--"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
