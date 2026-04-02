"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getControlConfigStatus,
  getAdminOverview,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminOverview, SyncServerConfigStatus } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

type RolloutGate = {
  id: string;
  label: string;
  ready: boolean;
  description: string;
};

export default function AdminFeatureFlagsPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [config, setConfig] = useState<SyncServerConfigStatus | null>(null);
  const [overview, setOverview] = useState<ControlAdminOverview | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!connection) {
      setConfig(null);
      setOverview(null);
      return;
    }
    setLoading(true);
    try {
      const [configStatus, nextOverview] = await Promise.all([
        getControlConfigStatus(connection),
        getAdminOverview(connection),
      ]);
      setConfig(configStatus);
      setOverview(nextOverview);
    } catch (error) {
      showErrorToast(t("portalSite.admin.featureFlags.loadFailed"), {
        description: extractErrorMessage(error, "load_feature_flags_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const gates = useMemo<RolloutGate[]>(() => {
    if (!config) {
      return [];
    }
    return [
      {
        id: "auth",
        label: t("portalSite.admin.featureFlags.gates.auth"),
        ready: config.auth.syncTokenConfigured && config.auth.syncJwtConfigured,
        description: t("portalSite.admin.featureFlags.descriptions.auth"),
      },
      {
        id: "control",
        label: t("portalSite.admin.featureFlags.gates.control"),
        ready:
          config.control.controlApiTokenConfigured &&
          Boolean(config.control.databaseUrlConfigured),
        description: t("portalSite.admin.featureFlags.descriptions.control"),
      },
      {
        id: "stripe",
        label: t("portalSite.admin.featureFlags.gates.stripe"),
        ready: config.stripe.stripeSecretConfigured && config.stripe.stripeWebhookConfigured,
        description: t("portalSite.admin.featureFlags.descriptions.stripe"),
      },
      {
        id: "s3",
        label: t("portalSite.admin.featureFlags.gates.sync"),
        ready: config.s3.s3BucketConfigured && config.s3.s3EndpointConfigured,
        description: t("portalSite.admin.featureFlags.descriptions.sync"),
      },
    ];
  }, [config, t]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.featureFlags.title")}
      description={t("portalSite.admin.featureFlags.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto w-full max-w-[1180px] space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.featureFlags.metrics.ready")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {gates.filter((gate) => gate.ready).length}/{gates.length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.featureFlags.metrics.audit")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {overview?.auditsLast24h ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.featureFlags.metrics.entitlement")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {overview?.entitlementActive ?? 0}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {loading && gates.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              {t("portalSite.admin.loading")}
            </div>
          ) : (
            gates.map((gate) => (
              <div key={gate.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{gate.label}</p>
                  <Badge variant={gate.ready ? "success" : "warning"}>
                    {gate.ready
                      ? t("portalSite.admin.system.ready")
                      : t("portalSite.admin.system.pending")}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{gate.description}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </PortalSettingsPage>
  );
}
