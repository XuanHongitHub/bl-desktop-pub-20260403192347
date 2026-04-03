"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import {
  deleteAdminUser,
  getAdminUserDetail,
  resetAdminUserPassword,
  updateAdminUserPlatformRole,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { ControlAdminUserDetail } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function AdminUserEditPage({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { connection, session } = usePortalBillingData();
  const router = useRouter();
  const [detail, setDetail] = useState<ControlAdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");

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

  const handlePlatformRoleChange = useCallback(
    async (value: string) => {
      if (!connection || !detail) return;
      const nextRole = value === "platform_admin" ? "platform_admin" : null;
      if (nextRole === detail.platformRole) return;
      setSavingRole(true);
      try {
        await updateAdminUserPlatformRole(connection, detail.userId, nextRole);
        await load();
        showSuccessToast(t("portalSite.admin.permissions.saved"));
      } catch (error) {
        showErrorToast(t("portalSite.admin.permissions.saveFailed"), {
          description: extractErrorMessage(
            error,
            "update_platform_role_failed",
          ),
        });
      } finally {
        setSavingRole(false);
      }
    },
    [connection, detail, load, t],
  );

  const handleResetPassword = useCallback(async () => {
    if (!connection || !detail) return;
    if (password.length < 8) {
      showErrorToast(t("portalSite.adminUsers.errors.createInvalidPassword"));
      return;
    }
    setSavingPassword(true);
    try {
      await resetAdminUserPassword(connection, detail.userId, password);
      setPassword("");
      showSuccessToast(t("portalSite.adminUsers.edit.passwordUpdated"));
    } catch (error) {
      showErrorToast(t("portalSite.adminUsers.edit.passwordUpdateFailed"), {
        description: extractErrorMessage(
          error,
          "update_admin_user_password_failed",
        ),
      });
    } finally {
      setSavingPassword(false);
    }
  }, [connection, detail, password, t]);

  const handleDelete = useCallback(async () => {
    if (!connection || !detail) return;
    if (detail.email === session?.user.email) {
      showErrorToast(t("portalSite.adminUsers.edit.cannotDeleteSelf"));
      return;
    }
    const confirmed = window.confirm(
      t("portalSite.adminUsers.edit.deleteConfirm", { email: detail.email }),
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteAdminUser(connection, detail.userId);
      showSuccessToast(t("portalSite.adminUsers.edit.deleteSuccess"));
      router.push("/admin/users");
    } catch (error) {
      showErrorToast(t("portalSite.adminUsers.edit.deleteFailed"), {
        description: extractErrorMessage(error, "delete_admin_user_failed"),
      });
    } finally {
      setDeleting(false);
    }
  }, [connection, detail, router, session?.user.email, t]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.adminUsers.eyebrow")}
      title={detail?.email || t("portalSite.adminUsers.edit.title")}
      description={detail?.userId || ""}
      actions={
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href={`/admin/users/${encodeURIComponent(userId)}`}>
            {t("portalSite.adminUsers.actions.backToDetail")}
          </Link>
        </Button>
      }
    >
      <section className="mx-auto grid w-full max-w-[960px] gap-3 text-sm">
        <div className="rounded-lg border border-border bg-card p-4">
          {loading || !detail ? (
            <p className="text-muted-foreground">
              {t("portalSite.admin.loading")}
            </p>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.adminUsers.panel.email")}
                </p>
                <p className="font-medium">{detail.email}</p>
              </div>

              <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.adminUsers.detail.platformRole")}
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    value={
                      detail.platformRole === "platform_admin"
                        ? "platform_admin"
                        : "none"
                    }
                    onValueChange={(value) =>
                      void handlePlatformRoleChange(value)
                    }
                    disabled={savingRole}
                  >
                    <SelectTrigger className="h-9 w-[220px]">
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
                  <Badge variant="outline" className="text-xs capitalize">
                    {detail.platformRole || "user"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.adminUsers.edit.resetPassword")}
                </p>
                <div className="flex w-full max-w-md items-center gap-2">
                  <Input
                    value={password}
                    type="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t(
                      "portalSite.adminUsers.create.passwordPlaceholder",
                    )}
                    className="h-9"
                  />
                  <Button
                    className="h-9"
                    disabled={savingPassword}
                    onClick={() => void handleResetPassword()}
                  >
                    {t("portalSite.adminUsers.edit.save")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-destructive/40 bg-card p-4">
          <p className="text-sm font-medium">
            {t("portalSite.adminUsers.edit.dangerTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("portalSite.adminUsers.edit.dangerDescription")}
          </p>
          <Button
            variant="destructive"
            className="mt-3 h-8"
            disabled={deleting || loading || !detail}
            onClick={() => void handleDelete()}
          >
            {t("portalSite.adminUsers.edit.deleteUser")}
          </Button>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
