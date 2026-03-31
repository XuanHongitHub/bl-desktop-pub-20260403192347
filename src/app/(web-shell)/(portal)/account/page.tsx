"use client";

import {
  AlertTriangle,
  ArrowRight,
  HardDrive,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime, formatLocaleNumber } from "@/lib/locale-format";

type AccountQueueSeverity = "low" | "medium" | "high";

interface AccountQueueItem {
  id: string;
  issue: string;
  detail: string;
  severity: AccountQueueSeverity;
  href: string;
  cta: string;
}

export default function AccountOverviewPage() {
  const { t } = useTranslation();
  const {
    selectedWorkspace,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    workspaces,
    billingState,
    refreshBilling,
    refreshWorkspaces,
    loadingBilling,
    loadingWorkspaces,
  } = usePortalBillingData();

  const [workspaceQuery, setWorkspaceQuery] = useState("");

  const subscription = billingState?.subscription ?? null;
  const usage = billingState?.usage ?? null;
  const invoices = billingState?.recentInvoices ?? [];
  const hasPaidPlan = Boolean(subscription?.planId);

  const storagePercent = usage?.storageLimitMb
    ? Math.min(
        100,
        Math.round(
          (usage.storageUsedBytes / (usage.storageLimitMb * 1024 * 1024)) * 100,
        ),
      )
    : 0;

  const latestInvoice = invoices[0] ?? null;
  const paidTotal = invoices.reduce(
    (acc, invoice) => acc + invoice.amountUsd,
    0,
  );

  const filteredWorkspaces = useMemo(() => {
    const keyword = workspaceQuery.trim().toLowerCase();
    if (!keyword) {
      return workspaces;
    }

    return workspaces.filter((workspace) => {
      const searchable = [
        workspace.name,
        workspace.planLabel,
        workspace.subscriptionStatus,
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(keyword);
    });
  }, [workspaceQuery, workspaces]);

  const queueItems = useMemo<AccountQueueItem[]>(() => {
    const items: AccountQueueItem[] = [];

    if (!hasPaidPlan) {
      items.push({
        id: "plan-required",
        issue: t("portalSite.account.planRequiredHint"),
        detail: t("portalSite.account.queue.planRequiredDetail"),
        severity: "high",
        href: "/pricing",
        cta: t("portalSite.account.openPricing"),
      });
    }

    if (subscription?.cancelAtPeriodEnd) {
      items.push({
        id: "reactivate",
        issue: t("portalSite.account.queue.cancelScheduled"),
        detail: t("portalSite.account.queue.cancelScheduledDetail"),
        severity: "medium",
        href: "/account/billing",
        cta: t("portalSite.account.nav.billing"),
      });
    }

    if (storagePercent >= 80) {
      items.push({
        id: "capacity",
        issue: t("portalSite.account.queue.capacityWarning"),
        detail: t("portalSite.account.queue.capacityWarningDetail"),
        severity: "medium",
        href: "/pricing",
        cta: t("portalSite.account.changePlan"),
      });
    }

    if (latestInvoice && latestInvoice.status !== "paid") {
      items.push({
        id: "invoice-followup",
        issue: t("portalSite.account.queue.invoicePending"),
        detail: t("portalSite.account.queue.invoicePendingDetail"),
        severity: "low",
        href: "/account/invoices",
        cta: t("portalSite.account.openInvoices"),
      });
    }

    return items;
  }, [
    hasPaidPlan,
    latestInvoice,
    storagePercent,
    subscription?.cancelAtPeriodEnd,
    t,
  ]);

  const severityBadgeVariant = (severity: AccountQueueSeverity) => {
    if (severity === "high") return "destructive" as const;
    if (severity === "medium") return "secondary" as const;
    return "outline" as const;
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.account.eyebrow")}
      title={t("portalSite.account.dashboardTitle")}
      description={t("portalSite.account.dashboardDescription")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loadingBilling || loadingWorkspaces}
            onClick={() => {
              void Promise.all([refreshWorkspaces(), refreshBilling()]);
            }}
          >
            {t("portalSite.account.refresh")}
          </Button>
          <Button asChild size="sm">
            <Link href="/account/billing">
              {t("portalSite.account.openBilling")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      }
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="grid gap-2 lg:grid-cols-[1fr_220px]">
          <Input
            value={workspaceQuery}
            onChange={(event) => setWorkspaceQuery(event.target.value)}
            placeholder={t("portalSite.account.workspaceSearchPlaceholder")}
            className="h-9"
          />
          <Select
            value={selectedWorkspaceId}
            onValueChange={setSelectedWorkspaceId}
          >
            <SelectTrigger className="h-9">
              <SelectValue
                placeholder={t("portalSite.account.workspacePlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {filteredWorkspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70">
        <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
          <div className="border-b border-border/70 p-4 xl:border-b-0 xl:border-r">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.account.workspace")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {selectedWorkspace?.name ??
                t("portalSite.account.workspaceEmpty")}
            </p>
          </div>
          <div className="border-b border-border/70 p-4 md:border-l md:border-border/70 xl:border-b-0 xl:border-r">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.account.plan")}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                {subscription?.planLabel ?? t("portalSite.account.noPlan")}
              </p>
              <Badge variant="outline" className="h-5 px-2 text-[10px]">
                {subscription?.billingCycle ??
                  t("portalSite.account.notAvailable")}
              </Badge>
            </div>
          </div>
          <div className="border-b border-border/70 p-4 xl:border-b-0 xl:border-r">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.account.status")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {subscription?.status ?? t("portalSite.account.notAvailable")}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.account.renewal")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {subscription?.expiresAt
                ? formatLocaleDateTime(subscription.expiresAt)
                : t("portalSite.account.notAvailable")}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            {t("portalSite.account.queue.title")}
          </h2>
          <Badge variant="outline">{queueItems.length}</Badge>
        </div>

        {queueItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("portalSite.account.queue.empty")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/70">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("portalSite.account.queue.issue")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("portalSite.account.queue.severity")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("portalSite.admin.columns.action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {queueItems.map((item) => (
                  <tr key={item.id} className="border-t border-border/70">
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-foreground">
                        {item.issue}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={severityBadgeVariant(item.severity)}>
                        {t(`portalSite.admin.risk.${item.severity}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={item.href}>{item.cta}</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-xl border border-border bg-card/70 p-4">
          <div className="mb-4 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("portalSite.account.usageSnapshot")}
            </h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("portalSite.account.storageUsage")}
                </span>
                <span className="font-medium text-foreground">
                  {storagePercent}%
                </span>
              </div>
              <Progress value={storagePercent} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("portalSite.account.usageUpdatedAt")}:{" "}
              {usage?.updatedAt
                ? formatLocaleDateTime(usage.updatedAt)
                : t("portalSite.account.notAvailable")}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card/70 p-4">
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("portalSite.account.latestInvoices")}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">
                {t("portalSite.account.invoicesCount")}
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {invoices.length}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">
                {t("portalSite.account.billedAmount")}
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                $
                {formatLocaleNumber(paidTotal, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">
                {t("portalSite.account.invoiceDate")}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {latestInvoice
                  ? formatLocaleDateTime(
                      latestInvoice.paidAt || latestInvoice.createdAt,
                    )
                  : t("portalSite.account.notAvailable")}
              </p>
            </div>
          </div>
          {!hasPaidPlan ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("portalSite.account.planRequiredHint")}
            </p>
          ) : null}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {t("portalSite.account.quickActions")}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/account/billing">
              {t("portalSite.account.nav.billing")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/account/invoices">
              {t("portalSite.account.nav.invoices")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/pricing">{t("portalSite.nav.pricing")}</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/checkout">{t("portalSite.account.goToCheckout")}</Link>
          </Button>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
