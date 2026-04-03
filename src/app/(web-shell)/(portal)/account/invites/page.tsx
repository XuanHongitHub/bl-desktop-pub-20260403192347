"use client";

import { Check, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  acceptAuthInvite,
  declineAuthInvite,
  listAuthInvites,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { ControlAuthInvite } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AccountInvitesPage() {
  const { t } = useTranslation();
  const { connection, refreshWorkspaces } = usePortalBillingData();
  const [rows, setRows] = useState<ControlAuthInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingInviteId, setActingInviteId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => rows.filter((item) => item.actionable).length,
    [rows],
  );

  const load = useCallback(async () => {
    if (!connection) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const payload = await listAuthInvites(connection);
      setRows(payload);
    } catch (error) {
      showErrorToast(t("portalSite.invites.loadFailed"), {
        description: extractErrorMessage(error, "load_invites_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAccept = useCallback(
    async (inviteId: string) => {
      if (!connection) {
        showErrorToast(t("portalSite.invites.connectionMissing"));
        return;
      }
      setActingInviteId(inviteId);
      try {
        await acceptAuthInvite(connection, inviteId);
        showSuccessToast(t("portalSite.invites.accepted"));
        await refreshWorkspaces();
        await load();
      } catch (error) {
        showErrorToast(t("portalSite.invites.acceptFailed"), {
          description: extractErrorMessage(error, "accept_invite_failed"),
        });
      } finally {
        setActingInviteId(null);
      }
    },
    [connection, load, refreshWorkspaces, t],
  );

  const handleDecline = useCallback(
    async (inviteId: string) => {
      if (!connection) {
        showErrorToast(t("portalSite.invites.connectionMissing"));
        return;
      }
      setActingInviteId(inviteId);
      try {
        await declineAuthInvite(connection, inviteId);
        showSuccessToast(t("portalSite.invites.declined"));
        await load();
      } catch (error) {
        showErrorToast(t("portalSite.invites.declineFailed"), {
          description: extractErrorMessage(error, "decline_invite_failed"),
        });
      } finally {
        setActingInviteId(null);
      }
    },
    [connection, load, t],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.account.eyebrow")}
      title={t("portalSite.invites.pageTitle")}
      description={t("portalSite.invites.pageDescription")}
      actions={
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("portalSite.invites.refresh")}
        </Button>
      }
    >
      <section className="mx-auto w-full max-w-[1120px] space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-6 text-[11px]">
            {t("portalSite.invites.pendingCount", { count: pendingCount })}
          </Badge>
          <Badge variant="outline" className="h-6 text-[11px]">
            {t("portalSite.invites.totalCount", { count: rows.length })}
          </Badge>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid grid-cols-[minmax(220px,1.3fr)_minmax(90px,0.6fr)_minmax(110px,0.7fr)_minmax(170px,1fr)_minmax(170px,1fr)_180px] gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
            <span>{t("portalSite.invites.columns.workspace")}</span>
            <span>{t("portalSite.invites.columns.role")}</span>
            <span>{t("portalSite.invites.columns.status")}</span>
            <span>{t("portalSite.invites.columns.expiresAt")}</span>
            <span>{t("portalSite.invites.columns.createdAt")}</span>
            <span>{t("portalSite.invites.columns.actions")}</span>
          </div>

          {loading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t("portalSite.admin.loading")}
            </p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {t("portalSite.invites.empty")}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((invite) => (
                <div
                  key={invite.id}
                  className="grid grid-cols-[minmax(220px,1.3fr)_minmax(90px,0.6fr)_minmax(110px,0.7fr)_minmax(170px,1fr)_minmax(170px,1fr)_180px] items-center gap-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {invite.workspaceName}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {invite.workspaceId}
                    </p>
                  </div>

                  <div>
                    <Badge
                      variant="outline"
                      className="h-6 text-[11px] capitalize"
                    >
                      {invite.role}
                    </Badge>
                  </div>

                  <p className="text-[12px] text-muted-foreground">
                    {t(`portalSite.invites.status.${invite.status}`)}
                  </p>

                  <p className="text-[12px] text-muted-foreground">
                    {formatLocaleDateTime(invite.expiresAt) ?? invite.expiresAt}
                  </p>

                  <p className="text-[12px] text-muted-foreground">
                    {formatLocaleDateTime(invite.createdAt) ?? invite.createdAt}
                  </p>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={
                        actingInviteId === invite.id || !invite.actionable
                      }
                      onClick={() => void handleAccept(invite.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t("portalSite.invites.accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      disabled={
                        actingInviteId === invite.id || !invite.actionable
                      }
                      onClick={() => void handleDecline(invite.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                      {t("portalSite.invites.decline")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </PortalSettingsPage>
  );
}
