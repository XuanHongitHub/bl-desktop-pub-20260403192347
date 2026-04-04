"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getAdminUserDetail,
  listAdminUsers,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminUserDetail, ControlAdminUserListItem } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AdminImpersonationCenterPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const searchParams = useSearchParams();
  const initialUserId = searchParams.get("userId")?.trim() ?? "";
  const initialSection = searchParams.get("section")?.trim() ?? "";
  const detailOnlyMode = searchParams.get("mode")?.trim() === "detail";
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ControlAdminUserListItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDetail, setSelectedDetail] =
    useState<ControlAdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);

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
          pageSize: 100,
        });
        const items = payload.items ?? [];
        setRows(items);
        setSelectedUserId((current) =>
          current && items.some((item) => item.userId === current)
            ? current
            : (items[0]?.userId ?? ""),
        );
      } catch (error) {
        showErrorToast(t("portalSite.admin.impersonationCenter.loadFailed"), {
          description: extractErrorMessage(
            error,
            "load_impersonation_targets_failed",
          ),
        });
      } finally {
        setLoading(false);
      }
    },
    [connection, query, t],
  );

  const refreshDetail = useCallback(
    async (userId: string) => {
      if (!connection || !userId) {
        setSelectedDetail(null);
        return;
      }
      try {
        const detail = await getAdminUserDetail(connection, userId);
        setSelectedDetail(detail);
      } catch (error) {
        setSelectedDetail(null);
        showErrorToast(t("portalSite.admin.impersonationCenter.loadFailed"), {
          description: extractErrorMessage(
            error,
            "load_impersonation_detail_failed",
          ),
        });
      }
    },
    [connection, t],
  );

  useEffect(() => {
    if (!initialUserId) {
      return;
    }
    setSelectedUserId(initialUserId);
  }, [initialUserId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh(query);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, refresh]);

  useEffect(() => {
    void refreshDetail(selectedUserId);
  }, [refreshDetail, selectedUserId]);

  useEffect(() => {
    if (!initialSection || !selectedDetail) {
      return;
    }
    const node = document.getElementById(initialSection);
    if (!node) {
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialSection, selectedDetail]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.impersonationCenter.title")}
      description={t("portalSite.admin.impersonationCenter.description")}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/impersonation-center">
              {t("portalSite.admin.impersonationCenter.title")}
            </Link>
          </Button>
          {detailOnlyMode ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/impersonation-center/manage">
                {t("portalSite.admin.workspaces.actions.manage")}
              </Link>
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refresh(query)}
          >
            {t("portalSite.admin.refresh")}
          </Button>
        </div>
      }
    >
      <section className="mx-auto w-full max-w-[1180px] space-y-4 text-sm">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Badge variant="warning">
                {t("portalSite.admin.impersonationCenter.disabledBadge")}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {t("portalSite.admin.impersonationCenter.disabledDescription")}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/support-console">
                {t("portalSite.admin.impersonationCenter.openSupportConsole")}
              </Link>
            </Button>
          </div>
        </div>

        <div
          className={`grid gap-4 ${
            detailOnlyMode
              ? "xl:grid-cols-1"
              : "xl:grid-cols-[360px_minmax(0,1fr)]"
          }`}
        >
          {!detailOnlyMode ? (
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("portalSite.admin.impersonationCenter.search")}
                  className="h-9"
                />
              </div>
              <ScrollArea className="h-[520px]">
                <div className="divide-y divide-border">
                  {loading ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      {t("portalSite.admin.loading")}
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      {t("portalSite.admin.impersonationCenter.empty")}
                    </div>
                  ) : (
                    rows.map((row) => (
                      <button
                        key={row.userId}
                        type="button"
                        onClick={() => setSelectedUserId(row.userId)}
                        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {row.email}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.workspaceCount} ws · {row.authProvider}
                          </p>
                        </div>
                        {row.platformRole ? (
                          <Badge variant="info">{row.platformRole}</Badge>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : null}

          <div
            id="checklist"
            className="rounded-xl border border-border bg-card p-4"
          >
            {!selectedDetail ? (
              <p className="text-sm text-muted-foreground">
                {t("portalSite.admin.impersonationCenter.emptySelection")}
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedDetail.email}
                  </p>
                  <Badge variant="outline">{selectedDetail.authProvider}</Badge>
                  {selectedDetail.platformRole ? (
                    <Badge variant="info">{selectedDetail.platformRole}</Badge>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      {t("portalSite.admin.impersonationCenter.memberships")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {selectedDetail.memberships.length}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      {t("portalSite.admin.impersonationCenter.lastActive")}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {selectedDetail.lastActiveAt
                        ? formatLocaleDateTime(selectedDetail.lastActiveAt)
                        : "--"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      {t("portalSite.admin.impersonationCenter.accountState")}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {selectedDetail.accountState}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border">
                  <div className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
                    {t("portalSite.admin.impersonationCenter.reviewChecklist")}
                  </div>
                  <div className="space-y-2 px-3 py-3 text-sm text-muted-foreground">
                    <p>
                      {t(
                        "portalSite.admin.impersonationCenter.checklist.identity",
                      )}
                    </p>
                    <p>
                      {t(
                        "portalSite.admin.impersonationCenter.checklist.memberships",
                      )}
                    </p>
                    <p>
                      {t(
                        "portalSite.admin.impersonationCenter.checklist.audit",
                      )}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border">
                  <div className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
                    {t("portalSite.admin.impersonationCenter.membershipTitle")}
                  </div>
                  <div className="divide-y divide-border">
                    {selectedDetail.memberships.map((membership) => (
                      <div
                        key={`${membership.workspaceId}:${membership.userId}`}
                        className="flex items-center justify-between gap-3 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">
                            {membership.workspaceName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatLocaleDateTime(membership.createdAt)}
                          </p>
                        </div>
                        <Badge variant="outline">{membership.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
