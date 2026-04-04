"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listAdminMemberships,
  listAdminUsers,
  updateAdminUserPlatformRole,
  updateWorkspaceMemberRole,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type {
  ControlAdminMembershipItem,
  ControlAdminUserListItem,
  TeamRole,
} from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AdminPermissionsPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();

  const [users, setUsers] = useState<ControlAdminUserListItem[]>([]);
  const [memberships, setMemberships] = useState<ControlAdminMembershipItem[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [membershipQuery, setMembershipQuery] = useState("");

  const refresh = useCallback(async () => {
    if (!connection) {
      setUsers([]);
      setMemberships([]);
      return;
    }
    setLoading(true);
    try {
      const [usersPayload, membershipsPayload] = await Promise.all([
        listAdminUsers(connection, {
          q: userQuery.trim() || undefined,
          page: 1,
          pageSize: 200,
        }),
        listAdminMemberships(connection, {
          q: membershipQuery.trim() || undefined,
          page: 1,
          pageSize: 300,
        }),
      ]);
      setUsers(usersPayload.items ?? []);
      setMemberships(membershipsPayload.items ?? []);
    } catch (error) {
      showErrorToast(t("portalSite.admin.permissions.saveFailed"), {
        description: extractErrorMessage(
          error,
          "load_admin_permissions_failed",
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, membershipQuery, t, userQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const handlePlatformRoleUpdate = useCallback(
    async (userId: string, nextRole: "platform_admin" | null) => {
      if (!connection) return;
      const actionKey = `platform:${userId}`;
      setSavingKey(actionKey);
      try {
        await updateAdminUserPlatformRole(connection, userId, nextRole);
        await refresh();
        showSuccessToast(t("portalSite.admin.permissions.saved"));
      } catch (error) {
        showErrorToast(t("portalSite.admin.permissions.saveFailed"), {
          description: extractErrorMessage(
            error,
            "update_platform_role_failed",
          ),
        });
      } finally {
        setSavingKey(null);
      }
    },
    [connection, refresh, t],
  );

  const handleWorkspaceRoleUpdate = useCallback(
    async (
      workspaceId: string,
      userId: string,
      currentRole: TeamRole,
      nextRole: TeamRole,
    ) => {
      if (!connection || currentRole === nextRole) return;
      const actionKey = `workspace:${workspaceId}:${userId}`;
      setSavingKey(actionKey);
      try {
        await updateWorkspaceMemberRole(
          connection,
          workspaceId,
          userId,
          nextRole,
        );
        await refresh();
        showSuccessToast(t("portalSite.admin.permissions.saved"));
      } catch (error) {
        showErrorToast(t("portalSite.admin.permissions.saveFailed"), {
          description: extractErrorMessage(
            error,
            "update_workspace_role_failed",
          ),
        });
      } finally {
        setSavingKey(null);
      }
    },
    [connection, refresh, t],
  );

  const stats = useMemo(
    () => ({
      totalUsers: users.length,
      platformAdmins: users.filter(
        (item) => item.platformRole === "platform_admin",
      ).length,
      totalMemberships: memberships.length,
    }),
    [memberships.length, users],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.permissions.title")}
      description={t("portalSite.admin.permissions.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto grid w-full max-w-[1280px] gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">users: {stats.totalUsers}</Badge>
          <Badge variant="outline">
            platform_admin: {stats.platformAdmins}
          </Badge>
          <Badge variant="outline">memberships: {stats.totalMemberships}</Badge>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium">
              {t("portalSite.admin.permissions.platformTableTitle")}
            </p>
            <Input
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder={t("portalSite.admin.permissions.searchUser")}
              className="h-8 w-[320px] max-w-full"
            />
          </div>
          <div className="max-h-[38vh] overflow-auto">
            <Table className="table-fixed text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[38%]">
                    {t("portalSite.adminUsers.columns.user")}
                  </TableHead>
                  <TableHead className="w-[20%]">
                    {t("portalSite.adminUsers.columns.provider")}
                  </TableHead>
                  <TableHead className="w-[20%]">
                    {t("portalSite.admin.permissions.scopeType")}
                  </TableHead>
                  <TableHead className="w-[22%]">
                    {t("portalSite.admin.permissions.platformRole")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      {t("portalSite.admin.loading")}
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      {t("portalSite.adminUsers.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const actionKey = `platform:${user.userId}`;
                    return (
                      <TableRow key={user.userId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-border/50">
                              <AvatarFallback className="bg-primary/10 text-primary uppercase text-xs">
                                {user.email.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {user.email}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground font-mono">
                                {user.userId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {user.authProvider}
                        </TableCell>
                        <TableCell>
                          {t("portalSite.admin.permissions.scopePlatform")}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={
                              user.platformRole === "platform_admin"
                                ? "platform_admin"
                                : "none"
                            }
                            onValueChange={(value) =>
                              void handlePlatformRoleUpdate(
                                user.userId,
                                value === "platform_admin"
                                  ? "platform_admin"
                                  : null,
                              )
                            }
                            disabled={savingKey === actionKey}
                          >
                            <SelectTrigger className="h-8 w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                {t("portalSite.adminUsers.create.roleUser")}
                              </SelectItem>
                              <SelectItem value="platform_admin">
                                {t(
                                  "portalSite.adminUsers.create.rolePlatformAdmin",
                                )}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium">
              {t("portalSite.admin.permissions.workspaceTableTitle")}
            </p>
            <Input
              value={membershipQuery}
              onChange={(event) => setMembershipQuery(event.target.value)}
              placeholder={t("portalSite.admin.permissions.searchMembership")}
              className="h-8 w-[360px] max-w-full"
            />
          </div>
          <div className="min-h-[36vh] max-h-[46vh] overflow-auto">
            <Table className="table-fixed text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">
                    {t("portalSite.admin.columns.workspace")}
                  </TableHead>
                  <TableHead className="w-[30%]">
                    {t("portalSite.adminUsers.columns.user")}
                  </TableHead>
                  <TableHead className="w-[16%]">
                    {t("portalSite.admin.permissions.scopeType")}
                  </TableHead>
                  <TableHead className="w-[14%]">
                    {t("portalSite.adminUsers.columns.role")}
                  </TableHead>
                  <TableHead className="w-[10%]">
                    {t("portalSite.adminUsers.columns.joinedAt")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      {t("portalSite.admin.loading")}
                    </TableCell>
                  </TableRow>
                ) : memberships.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      {t("portalSite.admin.memberships.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  memberships.map((row) => {
                    const actionKey = `workspace:${row.workspaceId}:${row.userId}`;
                    return (
                      <TableRow key={`${row.workspaceId}:${row.userId}`}>
                        <TableCell>
                          <p className="truncate font-medium">
                            {row.workspaceName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.workspaceId}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-border/50">
                              <AvatarFallback className="bg-primary/10 text-primary uppercase text-xs">
                                {row.email.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {row.email}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground font-mono">
                                {row.userId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {t("portalSite.admin.permissions.scopeWorkspace")}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.role}
                            onValueChange={(value) =>
                              void handleWorkspaceRoleUpdate(
                                row.workspaceId,
                                row.userId,
                                row.role,
                                value as TeamRole,
                              )
                            }
                            disabled={savingKey === actionKey}
                          >
                            <SelectTrigger className="h-8 w-[130px]">
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
                        </TableCell>
                        <TableCell>
                          {formatLocaleDateTime(row.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
