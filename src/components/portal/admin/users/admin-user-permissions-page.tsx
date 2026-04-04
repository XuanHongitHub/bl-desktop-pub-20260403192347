"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAdminUserDetail,
  updateWorkspaceMemberRole,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { ControlAdminUserDetail, TeamRole } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function AdminUserPermissionsPage({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [detail, setDetail] = useState<ControlAdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connection || !userId.trim()) return;
    setLoading(true);
    try {
      const payload = await getAdminUserDetail(connection, userId);
      setDetail(payload);
    } catch (error) {
      showErrorToast(t("portalSite.adminUsers.errors.loadFailed"), {
        description: extractErrorMessage(
          error,
          "load_admin_user_detail_failed",
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRoleChange = useCallback(
    async (
      workspaceId: string,
      currentRole: TeamRole,
      nextRole: TeamRole,
    ): Promise<void> => {
      if (!connection || !detail) return;
      if (currentRole === nextRole) return;
      const actionKey = `${workspaceId}:${detail.userId}`;
      setSavingKey(actionKey);
      try {
        await updateWorkspaceMemberRole(
          connection,
          workspaceId,
          detail.userId,
          nextRole,
        );
        await load();
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
    [connection, detail, load, t],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.adminUsers.eyebrow")}
      title={`${t("portalSite.adminUsers.actions.permissions")}: ${
        detail?.email || t("portalSite.adminUsers.create.roleUser")
      }`}
      description={detail?.userId || ""}
      actions={
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href={`/admin/users/${encodeURIComponent(userId)}`}>
            {t("portalSite.adminUsers.actions.backToDetail")}
          </Link>
        </Button>
      }
    >
      <section className="mx-auto grid w-full max-w-[1200px] gap-3 text-sm">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {t("portalSite.adminUsers.detail.platformRole")}:{" "}
              {detail?.platformRole ||
                t("portalSite.adminUsers.create.roleUser")}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {t("portalSite.adminUsers.columns.workspaceCount")}:{" "}
              {detail?.memberships.length || 0}
            </Badge>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">
            {t("portalSite.adminUsers.permissions.workspaceAssignments")}
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">
                    {t("portalSite.admin.columns.workspace")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("portalSite.adminUsers.columns.role")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("portalSite.adminUsers.columns.joinedAt")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                      {t("portalSite.admin.loading")}
                    </td>
                  </tr>
                ) : detail?.memberships.length ? (
                  detail.memberships.map((membership) => {
                    const actionKey = `${membership.workspaceId}:${membership.userId}`;
                    return (
                      <tr key={actionKey} className="border-b border-border/60">
                        <td className="px-3 py-2">
                          <p className="truncate font-medium">
                            {membership.workspaceName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {membership.workspaceId}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={membership.role}
                            onValueChange={(value) =>
                              void handleRoleChange(
                                membership.workspaceId,
                                membership.role,
                                value as TeamRole,
                              )
                            }
                            disabled={savingKey === actionKey}
                          >
                            <SelectTrigger className="h-8 w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">owner</SelectItem>
                              <SelectItem value="admin">admin</SelectItem>
                              <SelectItem value="member">member</SelectItem>
                              <SelectItem value="viewer">viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          {formatLocaleDateTime(membership.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                      {t("portalSite.adminUsers.permissions.noMemberships")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
