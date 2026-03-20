"use client";

import { invoke } from "@tauri-apps/api/core";
import { BarChart3, CreditCard, FileText, ShieldCheck, Sliders, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EntitlementSnapshot, RuntimeConfigStatus } from "@/types";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

interface PlatformAdminWorkspaceProps {
  runtimeConfig: RuntimeConfigStatus | null;
  entitlement: EntitlementSnapshot | null;
}

type ModuleCard = {
  id: string;
  icon: typeof Users;
  titleKey: string;
  descriptionKey: string;
};

const MODULE_CARDS: ModuleCard[] = [
  {
    id: "workspaceUsers",
    icon: Users,
    titleKey: "adminWorkspace.modules.workspaceUsers.title",
    descriptionKey: "adminWorkspace.modules.workspaceUsers.description",
  },
  {
    id: "billingEntitlement",
    icon: CreditCard,
    titleKey: "adminWorkspace.modules.billingEntitlement.title",
    descriptionKey: "adminWorkspace.modules.billingEntitlement.description",
  },
  {
    id: "coupon",
    icon: Sliders,
    titleKey: "adminWorkspace.modules.coupon.title",
    descriptionKey: "adminWorkspace.modules.coupon.description",
  },
  {
    id: "audit",
    icon: FileText,
    titleKey: "adminWorkspace.modules.audit.title",
    descriptionKey: "adminWorkspace.modules.audit.description",
  },
  {
    id: "systemConfig",
    icon: ShieldCheck,
    titleKey: "adminWorkspace.modules.systemConfig.title",
    descriptionKey: "adminWorkspace.modules.systemConfig.description",
  },
  {
    id: "analytics",
    icon: BarChart3,
    titleKey: "adminWorkspace.modules.analytics.title",
    descriptionKey: "adminWorkspace.modules.analytics.description",
  },
];

export function PlatformAdminWorkspace({
  runtimeConfig,
  entitlement,
}: PlatformAdminWorkspaceProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [isUpdatingEntitlement, setIsUpdatingEntitlement] = useState(false);

  const configSummary = useMemo(() => {
    if (!runtimeConfig) {
      return t("adminWorkspace.status.unknown");
    }

    const issues: string[] = [];
    if (runtimeConfig.auth === "pending_config") {
      issues.push(t("adminWorkspace.status.authPending"));
    }
    if (runtimeConfig.stripe === "pending_config") {
      issues.push(t("adminWorkspace.status.stripePending"));
    }
    if (runtimeConfig.s3_sync === "pending_config") {
      issues.push(t("adminWorkspace.status.syncPending"));
    }

    if (issues.length === 0) {
      return t("adminWorkspace.status.allReady");
    }

    return issues.join(" • ");
  }, [runtimeConfig, t]);

  const entitlementLabel =
    entitlement?.state === "read_only"
      ? t("adminWorkspace.status.entitlementReadOnly")
      : entitlement?.state === "grace_active"
        ? t("adminWorkspace.status.entitlementGrace")
        : t("adminWorkspace.status.entitlementActive");

  const handleSetEntitlement = async (
    nextState: "active" | "grace_active" | "read_only",
  ) => {
    if (!reason.trim()) {
      showErrorToast(t("adminWorkspace.reasonRequired"));
      return;
    }

    try {
      setIsUpdatingEntitlement(true);
      await invoke("set_entitlement_state", {
        state: nextState,
        reason,
      });
      showSuccessToast(t("adminWorkspace.entitlementUpdated"));
    } catch {
      showErrorToast(t("adminWorkspace.entitlementUpdateFailed"));
    } finally {
      setIsUpdatingEntitlement(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("adminWorkspace.overview.title")}</CardTitle>
          <CardDescription>{t("adminWorkspace.overview.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">
              {t("adminWorkspace.overview.configStatus")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{configSummary}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">
              {t("adminWorkspace.overview.entitlement")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{entitlementLabel}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">
              {t("adminWorkspace.overview.auditRetention")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">
              {t("adminWorkspace.overview.auditRetentionValue")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("adminWorkspace.entitlementControl.title")}</CardTitle>
          <CardDescription>{t("adminWorkspace.entitlementControl.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            placeholder={t("adminWorkspace.entitlementControl.reasonPlaceholder")}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isUpdatingEntitlement}
              onClick={() => {
                void handleSetEntitlement("active");
              }}
            >
              {t("adminWorkspace.entitlementControl.setActive")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isUpdatingEntitlement}
              onClick={() => {
                void handleSetEntitlement("grace_active");
              }}
            >
              {t("adminWorkspace.entitlementControl.setGrace")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isUpdatingEntitlement}
              onClick={() => {
                void handleSetEntitlement("read_only");
              }}
            >
              {t("adminWorkspace.entitlementControl.setReadOnly")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MODULE_CARDS.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.id}>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary">{t("adminWorkspace.modules.statusReady")}</Badge>
                </div>
                <CardTitle className="text-base">{t(module.titleKey)}</CardTitle>
                <CardDescription>{t(module.descriptionKey)}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
