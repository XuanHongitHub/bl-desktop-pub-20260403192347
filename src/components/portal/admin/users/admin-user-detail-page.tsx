"use client";

import { Edit3, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminUserDetail } from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminUserDetail } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function AdminUserDetailPage({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [detail, setDetail] = useState<ControlAdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.adminUsers.eyebrow")}
      title={detail?.email || t("portalSite.adminUsers.detail.title")}
      description={detail?.userId || ""}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link
              href={`/admin/users/${encodeURIComponent(userId)}/permissions`}
            >
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              {t("portalSite.adminUsers.actions.permissions")}
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8">
            <Link href={`/admin/users/${encodeURIComponent(userId)}/edit`}>
              <Edit3 className="mr-1 h-3.5 w-3.5" />
              {t("portalSite.adminUsers.actions.editUser")}
            </Link>
          </Button>
        </div>
      }
    >
      <section className="mx-auto grid w-full max-w-[1280px] gap-3 text-sm">
        <div className="rounded-lg border border-border bg-card p-3">
          {loading || !detail ? (
            <p className="text-muted-foreground">
              {t("portalSite.admin.loading")}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.adminUsers.panel.email")}
                </p>
                <p className="truncate font-medium">{detail.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.adminUsers.columns.provider")}
                </p>
                <p className="capitalize">{detail.authProvider}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.adminUsers.detail.platformRole")}
                </p>
                <Badge variant="outline" className="text-xs">
                  {detail.platformRole || "user"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.adminUsers.columns.lastActive")}
                </p>
                <p>
                  {detail.lastActiveAt
                    ? formatLocaleDateTime(detail.lastActiveAt)
                    : "--"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">
            {t("portalSite.adminUsers.detail.workspaceMemberships")}
          </div>
          <div className="overflow-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("portalSite.admin.columns.workspace")}
                  </TableHead>
                  <TableHead>
                    {t("portalSite.adminUsers.columns.role")}
                  </TableHead>
                  <TableHead>
                    {t("portalSite.adminUsers.columns.joinedAt")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("portalSite.admin.columns.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail?.memberships.length ? (
                  detail.memberships.map((membership) => (
                    <TableRow
                      key={`${membership.workspaceId}:${membership.userId}`}
                    >
                      <TableCell>
                        <p className="truncate font-medium">
                          {membership.workspaceName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {membership.workspaceId}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {membership.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatLocaleDateTime(membership.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8"
                        >
                          <Link
                            href={`/admin/workspaces/${encodeURIComponent(membership.workspaceId)}/members`}
                          >
                            {t("portalSite.adminUsers.detail.workspaceAction")}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      {t("portalSite.adminUsers.panel.emptyUsers")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
