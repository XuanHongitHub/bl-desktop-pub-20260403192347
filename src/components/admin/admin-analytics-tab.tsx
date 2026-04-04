"use client";

import { AlertTriangle, Database, ShieldCheck, Users } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLocaleDateTime } from "@/lib/locale-format";
import type {
  ControlAdminOverview,
  ControlAdminWorkspaceHealthRow,
} from "@/types";

interface AdminAnalyticsTabProps {
  isPlatformAdmin: boolean;
  adminOverview: ControlAdminOverview | null;
  adminWorkspaceHealth: ControlAdminWorkspaceHealthRow[];
  fallbackWorkspaceCount: number;
  fallbackMemberCount: number;
  fallbackInviteCount: number;
  fallbackAuditCount: number;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0%";
  return `${Math.min(100, Math.round(value))}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return formatLocaleDateTime(parsed);
}

function getRiskBadgeVariant(riskLevel: "low" | "medium" | "high") {
  if (riskLevel === "high") return "destructive" as const;
  if (riskLevel === "medium") return "secondary" as const;
  return "outline" as const;
}

function getSubscriptionBadgeVariant(
  status: "active" | "past_due" | "canceled",
) {
  if (status === "past_due") return "destructive" as const;
  if (status === "canceled") return "secondary" as const;
  return "default" as const;
}

export function AdminAnalyticsTab({
  isPlatformAdmin,
  adminOverview,
  adminWorkspaceHealth,
  fallbackWorkspaceCount,
  fallbackMemberCount,
  fallbackInviteCount,
  fallbackAuditCount,
}: AdminAnalyticsTabProps) {
  const { t } = useTranslation();

  const summary = useMemo(() => {
    const rows = adminWorkspaceHealth;
    const total = rows.length;
    const highRisk = rows.filter((row) => row.riskLevel === "high").length;
    const mediumRisk = rows.filter((row) => row.riskLevel === "medium").length;
    const totalStorageBytes = rows.reduce(
      (sum, row) => sum + row.storageUsedBytes,
      0,
    );
    const avgStoragePercent =
      total > 0
        ? Math.round(
            rows.reduce((sum, row) => sum + row.storagePercent, 0) / total,
          )
        : 0;
    const pastDue = rows.filter(
      (row) => row.subscriptionStatus === "past_due",
    ).length;

    return {
      total,
      highRisk,
      mediumRisk,
      totalStorageBytes,
      avgStoragePercent,
      pastDue,
    };
  }, [adminWorkspaceHealth]);

  const workspaceCount = adminOverview?.workspaces ?? fallbackWorkspaceCount;
  const memberCount = adminOverview?.members ?? fallbackMemberCount;
  const inviteCount = adminOverview?.activeInvites ?? fallbackInviteCount;
  const auditCount = adminOverview?.auditsLast24h ?? fallbackAuditCount;

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[14px] font-semibold">
            {t("adminWorkspace.analytics.title")}
          </CardTitle>
          <CardDescription className="text-[12px]">
            {t("adminWorkspace.analytics.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-muted-foreground">
                {t("adminWorkspace.analytics.kpis.workspaces")}
              </p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-[18px] font-semibold text-foreground">
              {workspaceCount}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.analytics.kpis.membersFallback", {
                count: memberCount,
              })}
            </p>
          </div>

          <div className="rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-muted-foreground">
                {t("adminWorkspace.analytics.kpis.highRisk")}
              </p>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-[18px] font-semibold text-foreground">
              {summary.highRisk}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.analytics.kpis.mediumRisk", {
                count: summary.mediumRisk,
              })}
            </p>
          </div>

          <div className="rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-muted-foreground">
                {t("adminWorkspace.analytics.kpis.storage")}
              </p>
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-[18px] font-semibold text-foreground">
              {formatBytes(summary.totalStorageBytes)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.analytics.kpis.averageUsage", {
                percent: formatPercent(summary.avgStoragePercent),
              })}
            </p>
          </div>

          <div className="rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-muted-foreground">
                {t("adminWorkspace.analytics.kpis.pastDue")}
              </p>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-[18px] font-semibold text-foreground">
              {summary.pastDue}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.analytics.kpis.invitesAndAudits", {
                invites: inviteCount,
                audits: auditCount,
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[14px] font-semibold">
            {t("adminWorkspace.analytics.table.title")}
          </CardTitle>
          <CardDescription className="text-[12px]">
            {t("adminWorkspace.analytics.table.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {!isPlatformAdmin && (
            <div className="px-6 pb-4 text-[12px] text-muted-foreground">
              {t("adminWorkspace.analytics.platformAdminHint")}
            </div>
          )}
          <ScrollArea className="h-[460px] px-6 pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("adminWorkspace.analytics.columns.workspace")}
                  </TableHead>
                  <TableHead>{t("adminWorkspace.analytics.columns.plan")}</TableHead>
                  <TableHead>{t("adminWorkspace.analytics.columns.access")}</TableHead>
                  <TableHead>{t("adminWorkspace.analytics.columns.members")}</TableHead>
                  <TableHead>{t("adminWorkspace.analytics.columns.storage")}</TableHead>
                  <TableHead>{t("adminWorkspace.analytics.columns.proxy")}</TableHead>
                  <TableHead>{t("adminWorkspace.analytics.columns.risk")}</TableHead>
                  <TableHead>{t("adminWorkspace.analytics.columns.updatedAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminWorkspaceHealth.length > 0 ? (
                  adminWorkspaceHealth.map((row) => (
                    <TableRow key={row.workspaceId}>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {row.workspaceName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.workspaceId}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <p className="text-sm text-foreground">{row.planLabel}</p>
                          <Badge
                            variant={getSubscriptionBadgeVariant(
                              row.subscriptionStatus,
                            )}
                            className="text-[11px]"
                          >
                            {t(
                              `adminWorkspace.analytics.subscription.${row.subscriptionStatus}`,
                            )}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className="text-[11px]">
                          {t(
                            `adminWorkspace.analytics.entitlement.${row.entitlementState}`,
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <p className="text-sm text-foreground">
                          {row.members} / {row.profileLimit}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("adminWorkspace.analytics.membersMeta", {
                            invites: row.activeInvites,
                            shares: row.activeShareGrants,
                          })}
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <p className="text-sm text-foreground">
                          {formatPercent(row.storagePercent)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(row.storageUsedBytes)} /{" "}
                          {row.storageLimitMb} MB
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <p className="text-sm text-foreground">
                          {Math.round(row.proxyBandwidthUsedMb)} MB
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant={getRiskBadgeVariant(row.riskLevel)}
                          className="text-[11px]"
                        >
                          {t(`adminWorkspace.analytics.risk.${row.riskLevel}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(row.usageUpdatedAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("adminWorkspace.analytics.invoiceAt", {
                            at: formatDateTime(row.latestInvoiceAt),
                          })}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {t("adminWorkspace.analytics.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
