"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createAdminUser,
  getAdminUserDetail,
  listAdminUsers,
  updateWorkspaceMemberRole,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type {
  ControlAdminUserDetail,
  ControlAdminUserListItem,
  TeamRole,
} from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function formatAuthProvider(value: ControlAdminUserListItem["authProvider"]): string {
  if (value === "password_google") {
    return "password + google";
  }
  return value;
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [rows, setRows] = useState<ControlAdminUserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<ControlAdminUserDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserPlatformRole, setNewUserPlatformRole] = useState<
    "none" | "platform_admin"
  >("none");
  const [creatingUser, setCreatingUser] = useState(false);

  const refresh = useCallback(
    async (keyword = query) => {
      if (!connection) {
        setRows([]);
        setSelectedUserId("");
        setSelectedDetail(null);
        return;
      }
      setLoading(true);
      try {
        const payload = await listAdminUsers(connection, {
          q: keyword.trim() || undefined,
          page: 1,
          pageSize: 200,
        });
        const items = payload.items ?? [];
        setRows(items);
        setSelectedUserId((current) => {
          if (current && items.some((item) => item.userId === current)) {
            return current;
          }
          return items[0]?.userId ?? "";
        });
      } catch (error) {
        showErrorToast(t("portalSite.adminUsers.errors.loadFailed"), {
          description: extractErrorMessage(error, "load_admin_users_failed"),
        });
      } finally {
        setLoading(false);
      }
    },
    [connection, query, t],
  );

  const refreshDetail = useCallback(
    async (userId: string) => {
      if (!connection || !userId.trim()) {
        setSelectedDetail(null);
        return;
      }
      setDetailLoading(true);
      try {
        const detail = await getAdminUserDetail(connection, userId);
        setSelectedDetail(detail);
      } catch (error) {
        setSelectedDetail(null);
        showErrorToast(t("portalSite.adminUsers.errors.loadFailed"), {
          description: extractErrorMessage(error, "load_admin_user_detail_failed"),
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [connection, t],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh(query);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, refresh]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedDetail(null);
      return;
    }
    void refreshDetail(selectedUserId);
  }, [refreshDetail, selectedUserId]);

  const handleRoleChange = async (
    workspaceId: string,
    userId: string,
    currentRole: TeamRole,
    nextRole: TeamRole,
  ): Promise<void> => {
    if (!connection) {
      showErrorToast(t("portalSite.adminUsers.errors.connectionMissing"));
      return;
    }
    if (currentRole === nextRole) {
      return;
    }
    const actionKey = `${workspaceId}:${userId}`;
    setSavingKey(actionKey);
    try {
      await updateWorkspaceMemberRole(connection, workspaceId, userId, nextRole);
      await Promise.all([refresh(query), refreshDetail(userId)]);
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
    if (!email || !email.includes("@")) {
      showErrorToast(t("portalSite.adminUsers.errors.createInvalidEmail"));
      return;
    }
    if (!newUserPassword || newUserPassword.length < 8) {
      showErrorToast(t("portalSite.adminUsers.errors.createInvalidPassword"));
      return;
    }

    setCreatingUser(true);
    try {
      const created = await createAdminUser(connection, {
        email,
        password: newUserPassword,
        platformRole:
          newUserPlatformRole === "platform_admin" ? "platform_admin" : null,
      });
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserPlatformRole("none");
      await refresh(query);
      setSelectedUserId(created.user.id);
      showSuccessToast(t("portalSite.adminUsers.toasts.userCreated"));
    } catch (error) {
      showErrorToast(t("portalSite.adminUsers.errors.createFailed"), {
        description: extractErrorMessage(error, "create_user_failed"),
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const listSummary = useMemo(
    () => ({
      total: rows.length,
      platformAdmins: rows.filter((item) => item.platformRole === "platform_admin").length,
    }),
    [rows],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.adminUsers.eyebrow")}
      title={t("portalSite.adminUsers.title")}
      description={t("portalSite.adminUsers.description")}
      actions={
        <Button variant="outline" size="sm" onClick={() => void refresh(query)}>
          {t("portalSite.adminUsers.actions.refresh")}
        </Button>
      }
    >
      <section className="mx-auto grid w-full max-w-[1280px] gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-2">
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
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_112px]">
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
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="space-y-3 p-4">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("portalSite.adminUsers.search")}
                className="h-9"
              />
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{t("portalSite.adminUsers.scopeBadge")}</Badge>
                <Badge variant="outline">{listSummary.total}</Badge>
                <Badge variant="outline">{listSummary.platformAdmins}</Badge>
              </div>
            </div>
            <Separator />
            <ScrollArea className="h-[620px]">
              <div className="p-2">
                {loading ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    {t("portalSite.adminUsers.loading")}
                  </div>
                ) : rows.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    {t("portalSite.adminUsers.empty")}
                  </div>
                ) : (
                  rows.map((row) => {
                    const selected = row.userId === selectedUserId;
                    return (
                      <button
                        key={row.userId}
                        type="button"
                        onClick={() => setSelectedUserId(row.userId)}
                        className={[
                          "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                          selected
                            ? "border-border bg-muted"
                            : "border-transparent bg-background hover:border-border hover:bg-muted/60",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {row.email}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.userId}
                            </p>
                          </div>
                          {row.platformRole === "platform_admin" ? (
                            <Badge variant="secondary" className="shrink-0">
                              {t("portalSite.adminUsers.create.rolePlatformAdmin")}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="font-normal">
                            {formatAuthProvider(row.authProvider)}
                          </Badge>
                          <span>
                            {t("portalSite.adminUsers.panel.workspaceCount", {
                              count: row.workspaceCount,
                            })}
                          </span>
                          <span>
                            {row.lastActiveAt
                              ? formatLocaleDateTime(row.lastActiveAt)
                              : "--"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          {!selectedUserId ? (
            <div className="flex h-full min-h-[620px] items-center justify-center p-6 text-sm text-muted-foreground">
              {t("portalSite.adminUsers.panel.emptySelection")}
            </div>
          ) : detailLoading || !selectedDetail ? (
            <div className="flex h-full min-h-[620px] items-center justify-center p-6 text-sm text-muted-foreground">
              {t("portalSite.adminUsers.loading")}
            </div>
          ) : (
            <div className="grid h-full min-h-[620px] grid-rows-[auto_auto_minmax(0,1fr)]">
              <div className="grid gap-0 border-b border-border md:grid-cols-4">
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">
                    {t("portalSite.adminUsers.panel.email")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedDetail.email}
                  </p>
                </div>
                <div className="p-4 md:border-l md:border-border">
                  <p className="text-xs text-muted-foreground">
                    {t("portalSite.adminUsers.panel.auth")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {formatAuthProvider(selectedDetail.authProvider)}
                  </p>
                </div>
                <div className="p-4 md:border-l md:border-border">
                  <p className="text-xs text-muted-foreground">
                    {t("portalSite.adminUsers.panel.lastActive")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedDetail.lastActiveAt
                      ? formatLocaleDateTime(selectedDetail.lastActiveAt)
                      : "--"}
                  </p>
                </div>
                <div className="p-4 md:border-l md:border-border">
                  <p className="text-xs text-muted-foreground">
                    {t("portalSite.adminUsers.panel.createdAt")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {formatLocaleDateTime(selectedDetail.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 py-3">
                <Badge variant="outline">{selectedDetail.userId}</Badge>
                <Badge variant="outline">
                  {t("portalSite.adminUsers.panel.workspaceCount", {
                    count: selectedDetail.workspaceCount,
                  })}
                </Badge>
                {selectedDetail.platformRole === "platform_admin" ? (
                  <Badge variant="secondary">
                    {t("portalSite.adminUsers.create.rolePlatformAdmin")}
                  </Badge>
                ) : null}
              </div>

              <div className="grid min-h-0 gap-0 border-t border-border xl:grid-cols-[minmax(0,1.2fr)_360px]">
                <div className="min-h-0">
                  <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
                    {t("portalSite.adminUsers.panel.memberships")}
                  </div>
                  <ScrollArea className="h-[420px]">
                    <div className="divide-y divide-border">
                      {selectedDetail.memberships.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          {t("portalSite.adminUsers.empty")}
                        </div>
                      ) : (
                        selectedDetail.memberships.map((membership) => {
                          const actionKey = `${membership.workspaceId}:${selectedDetail.userId}`;
                          return (
                            <div
                              key={`${membership.workspaceId}:${selectedDetail.userId}`}
                              className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_148px_132px]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {membership.workspaceName}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {membership.workspaceId}
                                </p>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatLocaleDateTime(membership.createdAt)}
                              </div>
                              <Select
                                value={membership.role}
                                onValueChange={(value) =>
                                  void handleRoleChange(
                                    membership.workspaceId,
                                    selectedDetail.userId,
                                    membership.role,
                                    value as TeamRole,
                                  )
                                }
                                disabled={savingKey === actionKey}
                              >
                                <SelectTrigger className="h-8 w-full">
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
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="min-h-0 border-t border-border xl:border-l xl:border-t-0">
                  <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
                    {t("portalSite.adminUsers.panel.activity")}
                  </div>
                  <ScrollArea className="h-[420px]">
                    <div className="divide-y divide-border">
                      {selectedDetail.recentAuditLogs.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          {t("portalSite.adminUsers.panel.emptyActivity")}
                        </div>
                      ) : (
                        selectedDetail.recentAuditLogs.map((log) => (
                          <div key={log.id} className="space-y-1 px-4 py-3">
                            <p className="text-sm font-medium text-foreground">{log.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatLocaleDateTime(log.createdAt)}
                            </p>
                            {log.workspaceId ? (
                              <p className="text-xs text-muted-foreground">
                                {log.workspaceId}
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </PortalSettingsPage>
  );
}
