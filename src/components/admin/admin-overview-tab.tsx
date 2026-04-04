"use client";

import {
  Activity,
  LayoutDashboard,
  MailOpen,
  Server,
  Shield,
  Users,
  Zap,
} from "lucide-react";
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
  ControlAuditLog,
  ControlInvite,
  ControlMembership,
  ControlShareGrant,
  ControlWorkspace,
  ControlWorkspaceOverview,
} from "@/types";

interface AdminOverviewTabProps {
  isPlatformAdmin: boolean;
  workspaceScopedOnly?: boolean;
  configSummary: string;
  entitlementLabel: string;
  controlPlaneStatus: string;
  controlSecuritySummary: string;
  selectedWorkspace: ControlWorkspace | null;
  adminOverview: ControlAdminOverview | null;
  auditLogs: ControlAuditLog[];
  workspaces: ControlWorkspace[];
  memberships: ControlMembership[];
  invites: ControlInvite[];
  shareGrants: ControlShareGrant[];
  overview: ControlWorkspaceOverview | null;
  adminWorkspaceHealth: ControlAdminWorkspaceHealthRow[];
  authReady: boolean;
  stripeReady: boolean;
  syncReady: boolean;
}

function formatAuditTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatLocaleDateTime(date);
}

function statusBadgeVariant(
  status: ControlAdminWorkspaceHealthRow["subscriptionStatus"],
) {
  if (status === "past_due") return "destructive" as const;
  if (status === "canceled") return "warning" as const;
  return "success" as const;
}

function riskBadgeVariant(level: ControlAdminWorkspaceHealthRow["riskLevel"]) {
  if (level === "high") return "destructive" as const;
  if (level === "medium") return "warning" as const;
  return "info" as const;
}

export function AdminOverviewTab({
  isPlatformAdmin,
  workspaceScopedOnly = false,
  configSummary,
  entitlementLabel,
  controlPlaneStatus,
  controlSecuritySummary,
  selectedWorkspace,
  adminOverview,
  auditLogs,
  workspaces,
  memberships,
  invites,
  shareGrants,
  overview,
  adminWorkspaceHealth,
  authReady,
  stripeReady,
  syncReady,
}: AdminOverviewTabProps) {
  const { t } = useTranslation();
  const canViewOwnerInsights =
    isPlatformAdmin || selectedWorkspace?.actorRole === "owner";

  const metricRows = useMemo(
    () => [
      {
        key: "workspaces",
        label: t("adminWorkspace.metrics.workspaces"),
        value: adminOverview?.workspaces ?? workspaces.length,
        icon: LayoutDashboard,
      },
      {
        key: "members",
        label: t("adminWorkspace.metrics.members"),
        value: adminOverview?.members ?? memberships.length,
        icon: Users,
      },
      {
        key: "invites",
        label: t("adminWorkspace.metrics.invites"),
        value: adminOverview?.activeInvites ?? invites.length,
        icon: MailOpen,
      },
      {
        key: "audits",
        label: t("adminWorkspace.metrics.audits24h"),
        value: adminOverview?.auditsLast24h ?? auditLogs.length,
        icon: Activity,
      },
    ],
    [
      adminOverview,
      auditLogs.length,
      invites.length,
      memberships.length,
      t,
      workspaces.length,
    ],
  );

  const serviceRows = [
    {
      key: "auth",
      label: t("adminWorkspace.ui.serviceAuth"),
      isReady: authReady,
      icon: Shield,
    },
    {
      key: "stripe",
      label: t("adminWorkspace.ui.serviceStripe"),
      isReady: stripeReady,
      icon: Zap,
    },
    {
      key: "sync",
      label: t("adminWorkspace.ui.serviceSync"),
      isReady: syncReady,
      icon: Activity,
    },
  ];

  const roleDistribution = useMemo(() => {
    return {
      owner: memberships.filter((member) => member.role === "owner").length,
      admin: memberships.filter((member) => member.role === "admin").length,
      member: memberships.filter((member) => member.role === "member").length,
      viewer: memberships.filter((member) => member.role === "viewer").length,
    };
  }, [memberships]);

  const operationalQueue = useMemo(() => {
    if (!isPlatformAdmin) {
      return [];
    }

    const priorityRank = {
      high_risk: 0,
      past_due: 1,
      capacity: 2,
      review: 3,
    } as const;

    return adminWorkspaceHealth
      .map((row: ControlAdminWorkspaceHealthRow) => {
        const isPastDue = row.subscriptionStatus === "past_due";
        const isHighRisk = row.riskLevel === "high";
        const isNearCapacity = row.storagePercent >= 85;

        let priority: keyof typeof priorityRank = "review";
        let actionKey = "actionReviewAccess";
        let reasonKey = "reasonShareAndInvite";

        if (isHighRisk) {
          priority = "high_risk";
          actionKey = "actionStabilizeSync";
          reasonKey = "reasonHighRisk";
        } else if (isPastDue) {
          priority = "past_due";
          actionKey = "actionRecoverBilling";
          reasonKey = "reasonPastDue";
        } else if (isNearCapacity) {
          priority = "capacity";
          actionKey = "actionReviewCapacity";
          reasonKey = "reasonCapacity";
        }

        return {
          row,
          priority,
          actionLabel: t(`adminWorkspace.ui.${actionKey}`),
          reasonLabel: t(`adminWorkspace.ui.${reasonKey}`),
        };
      })
      .sort((left, right) => {
        if (priorityRank[left.priority] !== priorityRank[right.priority]) {
          return priorityRank[left.priority] - priorityRank[right.priority];
        }
        if (left.row.riskLevel !== right.row.riskLevel) {
          const riskScore = { high: 0, medium: 1, low: 2 } as const;
          return riskScore[left.row.riskLevel] - riskScore[right.row.riskLevel];
        }
        return left.row.workspaceName.localeCompare(right.row.workspaceName);
      })
      .slice(0, 8);
  }, [adminWorkspaceHealth, isPlatformAdmin, t]);

  if (workspaceScopedOnly) {
    return (
      <div className="space-y-4">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold">
              {t("adminWorkspace.ui.workspaceOpsTitle")}
            </CardTitle>
            <CardDescription className="text-[12px]">
              {t("adminWorkspace.ui.workspaceOpsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-4">
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.ui.currentWorkspace")}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-foreground line-clamp-1">
                  {selectedWorkspace?.name ??
                    t("adminWorkspace.controlPlane.noWorkspaceSelected")}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.metrics.members")}
                </p>
                <p className="mt-1 text-[16px] font-semibold text-foreground">
                  {overview?.members ?? memberships.length}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.metrics.invites")}
                </p>
                <p className="mt-1 text-[16px] font-semibold text-foreground">
                  {overview?.activeInvites ?? invites.length}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.share.title")}
                </p>
                <p className="mt-1 text-[16px] font-semibold text-foreground">
                  {overview?.activeShareGrants ?? shareGrants.length}
                </p>
              </div>
            </div>

            {canViewOwnerInsights ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t("adminWorkspace.roles.owner")}
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-foreground">
                      {roleDistribution.owner}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t("adminWorkspace.roles.admin")}
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-foreground">
                      {roleDistribution.admin}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t("adminWorkspace.roles.member")}
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-foreground">
                      {roleDistribution.member}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t("adminWorkspace.roles.viewer")}
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-foreground">
                      {roleDistribution.viewer}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t("adminWorkspace.ui.planLabel")}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-foreground">
                      {selectedWorkspace?.planLabel ??
                        t("adminWorkspace.ui.noPlanLabel")}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t("pricingPage.heroStatProfiles")}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-foreground">
                      {selectedWorkspace?.profileLimit ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t("webBilling.fieldCycle")}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-foreground">
                      {selectedWorkspace?.billingCycle ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t("adminWorkspace.ui.expiry")}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-foreground">
                      {selectedWorkspace?.expiresAt ?? "-"}
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metricRows.map((metric) => (
          <Card key={metric.key} className="border-border/70 shadow-none">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-[11px] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-1 text-[20px] font-semibold text-foreground">
                  {metric.value}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/30 p-1.5">
                <metric.icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
              <Server className="h-4 w-4 text-muted-foreground" />
              {t("adminWorkspace.ui.healthTitle")}
            </CardTitle>
            <CardDescription className="text-[12px]">
              {t("adminWorkspace.ui.healthDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border/70 bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.overview.controlPlane")}
              </p>
              <p className="mt-1 text-[13px] font-medium text-foreground">
                {controlPlaneStatus}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {controlSecuritySummary}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {serviceRows.map((service) => {
                const Icon = service.icon;
                return (
                  <div
                    key={service.key}
                    className="rounded-md border border-border/70 bg-background p-3"
                  >
                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {service.label}
                    </p>
                    <Badge
                      variant={service.isReady ? "success" : "warning"}
                      className="mt-2 h-5 px-2 text-[10px]"
                    >
                      {service.isReady
                        ? t("adminWorkspace.modules.statusReady")
                        : t("common.status.pending")}
                    </Badge>
                  </div>
                );
              })}
            </div>

            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.overview.configStatus")}
              </p>
              <p className="mt-1 text-[12px] text-foreground">
                {configSummary}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px] font-semibold">
              {t("adminWorkspace.ui.entitlementTitle")}
            </CardTitle>
            <CardDescription className="text-[12px]">
              {isPlatformAdmin
                ? t("adminWorkspace.ui.entitlementDescription")
                : t("adminWorkspace.workspaceSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border/70 bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.overview.entitlement")}
              </p>
              <Badge
                variant="secondary"
                className="mt-2 h-6 px-2.5 text-[11px]"
              >
                {entitlementLabel}
              </Badge>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.overview.auditRetention")}
              </p>
              <p className="mt-1 text-[13px] font-medium text-foreground">
                {t("adminWorkspace.overview.auditRetentionValue")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-[14px] font-semibold">
            {t("adminWorkspace.ui.operationQueueTitle")}
          </CardTitle>
          <CardDescription className="text-[12px]">
            {t("adminWorkspace.ui.operationQueueDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {operationalQueue.length === 0 ? (
            <div className="px-4 pb-4 text-[12px] text-muted-foreground">
              {t("adminWorkspace.ui.operationQueueEmpty")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("adminWorkspace.analytics.columns.workspace")}
                  </TableHead>
                  <TableHead>
                    {t("adminWorkspace.analytics.columns.plan")}
                  </TableHead>
                  <TableHead>
                    {t("adminWorkspace.analytics.columns.risk")}
                  </TableHead>
                  <TableHead>{t("adminWorkspace.columns.action")}</TableHead>
                  <TableHead>{t("adminWorkspace.columns.reason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operationalQueue.map((queueItem) => (
                  <TableRow key={queueItem.row.workspaceId}>
                    <TableCell className="text-[12px] font-medium">
                      {queueItem.row.workspaceName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px]">
                          {queueItem.row.planLabel}
                        </span>
                        <Badge
                          variant={statusBadgeVariant(
                            queueItem.row.subscriptionStatus,
                          )}
                          className="text-[10px]"
                        >
                          {t(
                            `adminWorkspace.analytics.subscription.${queueItem.row.subscriptionStatus}`,
                          )}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={riskBadgeVariant(queueItem.row.riskLevel)}
                        className="text-[10px]"
                      >
                        {t(
                          `adminWorkspace.analytics.risk.${queueItem.row.riskLevel}`,
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[12px] font-medium">
                      {queueItem.actionLabel}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {queueItem.reasonLabel}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-[14px] font-semibold">
            {t("adminWorkspace.ui.latestAuditTitle")}
          </CardTitle>
          <CardDescription className="text-[12px]">
            {t("adminWorkspace.ui.latestAuditDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {auditLogs.length === 0 ? (
            <div className="px-4 pb-4 text-[12px] text-muted-foreground">
              {t("adminWorkspace.audit.none")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminWorkspace.columns.time")}</TableHead>
                  <TableHead>{t("adminWorkspace.columns.action")}</TableHead>
                  <TableHead>{t("adminWorkspace.columns.actor")}</TableHead>
                  <TableHead>{t("adminWorkspace.columns.reason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.slice(0, 8).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {formatAuditTimestamp(entry.createdAt)}
                    </TableCell>
                    <TableCell className="text-[12px] font-medium">
                      {entry.action}
                    </TableCell>
                    <TableCell className="text-[12px]">{entry.actor}</TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {entry.reason || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
