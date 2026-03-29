"use client";

import type { ReactNode } from "react";
import { AlertTriangle, BadgeDollarSign, Building2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";

function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-border/70 bg-card/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
          <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground">
          {icon}
        </span>
      </div>
    </article>
  );
}

export default function AdminPage() {
  const { t } = useTranslation();
  const { workspaces } = usePortalBillingData();

  const pastDueCount = workspaces.filter(
    (workspace) => workspace.subscriptionStatus === "past_due",
  ).length;
  const activeCount = workspaces.filter(
    (workspace) => workspace.subscriptionStatus === "active",
  ).length;
  const customCount = workspaces.filter(
    (workspace) => workspace.planLabel.toLowerCase() === "custom",
  ).length;

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.overview.title")}
      description={t("portalSite.admin.overview.description")}
    >
      <section className="grid gap-4 xl:grid-cols-4">
        <Metric
          label={t("portalSite.admin.metrics.workspaces")}
          value={String(workspaces.length)}
          detail={t("portalSite.admin.overview.workspacesDescription")}
          icon={<Building2 className="h-4 w-4" />}
        />
        <Metric
          label={t("portalSite.admin.metrics.activeRevenue")}
          value={String(activeCount)}
          detail={t("portalSite.admin.overview.activeDescription")}
          icon={<BadgeDollarSign className="h-4 w-4" />}
        />
        <Metric
          label={t("portalSite.admin.metrics.highRisk")}
          value={String(pastDueCount)}
          detail={t("portalSite.admin.overview.riskDescription")}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <Metric
          label={t("portalSite.admin.metrics.audits")}
          value={String(customCount)}
          detail={t("portalSite.admin.overview.auditDescription")}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </section>
    </PortalSettingsPage>
  );
}
