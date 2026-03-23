"use client";

import {
  Activity,
  Database,
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
  authReady,
  stripeReady,
  syncReady,
}: AdminOverviewTabProps) {
  const { t } = useTranslation();

  const metricRows = useMemo(
    () => [
      {
        key: "workspaces",
        label: t("adminWorkspace.metrics.workspaces"),
        value: adminOverview?.workspaces ?? workspaces.length,
        icon: LayoutDashboard,
        color: "text-blue-500 dark:text-blue-400",
        bg: "bg-blue-500/10",
      },
      {
        key: "members",
        label: t("adminWorkspace.metrics.members"),
        value: adminOverview?.members ?? memberships.length,
        icon: Users,
        color: "text-emerald-500 dark:text-emerald-400",
        bg: "bg-emerald-500/10",
      },
      {
        key: "invites",
        label: t("adminWorkspace.metrics.invites"),
        value: adminOverview?.activeInvites ?? invites.length,
        icon: MailOpen,
        color: "text-orange-500 dark:text-orange-400",
        bg: "bg-orange-500/10",
      },
      {
        key: "audits",
        label: t("adminWorkspace.metrics.audits24h"),
        value: adminOverview?.auditsLast24h ?? auditLogs.length,
        icon: Activity,
        color: "text-purple-500 dark:text-purple-400",
        bg: "bg-purple-500/10",
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
    },
    {
      key: "stripe",
      label: t("adminWorkspace.ui.serviceStripe"),
      isReady: stripeReady,
    },
    {
      key: "sync",
      label: t("adminWorkspace.ui.serviceSync"),
      isReady: syncReady,
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

  if (workspaceScopedOnly) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/50 shadow-sm bg-card rounded-xl">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-[13px] font-medium text-muted-foreground">
                {t("adminWorkspace.ui.currentWorkspace")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5 px-5">
              <p className="text-[16px] font-bold tracking-tight text-foreground line-clamp-1">
                {selectedWorkspace?.name ??
                  t("adminWorkspace.controlPlane.noWorkspaceSelected")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-card rounded-xl">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-[13px] font-medium text-muted-foreground">
                {t("adminWorkspace.metrics.members")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5 px-5">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {overview?.members ?? memberships.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-card rounded-xl">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-[13px] font-medium text-muted-foreground">
                {t("adminWorkspace.metrics.invites")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5 px-5">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {overview?.activeInvites ?? invites.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm bg-card rounded-xl">
            <CardHeader className="pb-2 pt-5 px-5">
              <CardTitle className="text-[13px] font-medium text-muted-foreground">
                {t("adminWorkspace.share.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5 px-5">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {overview?.activeShareGrants ?? shareGrants.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-[15px] font-semibold">
              {t("adminWorkspace.ui.userPermissionOverviewTitle")}
            </CardTitle>
            <CardDescription className="text-[13px]">
              {t("adminWorkspace.ui.userPermissionOverviewDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 bg-card">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.roles.owner")}
                </p>
                <p className="mt-0.5 text-[16px] font-semibold text-foreground">
                  {roleDistribution.owner}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.roles.admin")}
                </p>
                <p className="mt-0.5 text-[16px] font-semibold text-foreground">
                  {roleDistribution.admin}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.roles.member")}
                </p>
                <p className="mt-0.5 text-[16px] font-semibold text-foreground">
                  {roleDistribution.member}
                </p>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.roles.viewer")}
                </p>
                <p className="mt-0.5 text-[16px] font-semibold text-foreground">
                  {roleDistribution.viewer}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[12px] font-medium text-foreground">
                {t("adminWorkspace.ui.userPermissionGuidanceTitle")}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {t("adminWorkspace.ui.userPermissionGuidanceDescription")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/50 shadow-sm bg-card hover:shadow-md transition-shadow relative overflow-hidden rounded-xl">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  {t("adminWorkspace.controlPlane.workspaceDetails")}
                </CardTitle>
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <LayoutDashboard className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-5 px-5">
              <p className="text-[16px] font-bold tracking-tight text-foreground line-clamp-1">
                {selectedWorkspace?.name ??
                  t("adminWorkspace.controlPlane.noWorkspaceSelected")}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm bg-card hover:shadow-md transition-shadow relative overflow-hidden rounded-xl">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  {t("adminWorkspace.members.title")}
                </CardTitle>
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Users className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-5 px-5">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {overview?.members ?? memberships.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm bg-card hover:shadow-md transition-shadow relative overflow-hidden rounded-xl">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  {t("adminWorkspace.metrics.invites")}
                </CardTitle>
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <MailOpen className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-5 px-5">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {overview?.activeInvites ?? invites.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm bg-card hover:shadow-md transition-shadow relative overflow-hidden rounded-xl">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  {t("adminWorkspace.share.title")}
                </CardTitle>
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Activity className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-5 px-5">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {overview?.activeShareGrants ?? shareGrants.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              {t("adminWorkspace.panel.workspaceOverviewTitle")}
            </CardTitle>
            <CardDescription className="text-[13px]">
              {t("adminWorkspace.panel.workspaceOverviewDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 bg-card">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                <p className="text-[12px] font-medium text-muted-foreground mb-1">
                  {t("adminWorkspace.overview.configStatus")}
                </p>
                <p className="text-[13px] font-semibold text-foreground">
                  {configSummary}
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                <p className="text-[12px] font-medium text-muted-foreground mb-1">
                  {t("adminWorkspace.overview.controlPlane")}
                </p>
                <p className="text-[13px] font-semibold text-foreground">
                  {controlPlaneStatus}
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                <p className="text-[12px] font-medium text-muted-foreground mb-1">
                  {t("adminWorkspace.overview.entitlement")}
                </p>
                <Badge
                  variant="outline"
                  className="text-[13px] font-bold py-0.5 px-2 border-primary/30 bg-primary/5 text-primary"
                >
                  {entitlementLabel}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricRows.map((metric) => (
          <Card
            key={metric.key}
            className="border-border/50 shadow-sm hover:shadow-md transition-shadow bg-card relative overflow-hidden rounded-xl group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
              <metric.icon className={`w-24 h-24 ${metric.color}`} />
            </div>
            <CardHeader className="pb-2 pt-5 px-5 relative z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">
                  {metric.label}
                </CardTitle>
                <div className={`p-2 rounded-lg ${metric.bg}`}>
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-5 px-5 relative z-10">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {metric.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border/50 shadow-sm rounded-xl xl:col-span-2 overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              {t("adminWorkspace.ui.healthTitle")}
            </CardTitle>
            <CardDescription className="text-[13px]">
              {t("adminWorkspace.ui.healthDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6 flex-1 bg-card">
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-muted/50 to-transparent p-4 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
              <div className="flex items-start gap-3 relative z-10">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0 mt-0.5">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-foreground">
                    {t("adminWorkspace.overview.controlPlane")}
                  </h4>
                  <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
                    {t("common.labels.status")}:{" "}
                    <span className="font-medium text-foreground">
                      {controlPlaneStatus}
                    </span>
                    . {controlSecuritySummary}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {serviceRows.map((service) => (
                <div
                  key={service.key}
                  className="rounded-xl border border-border/50 bg-card p-4 hover:border-primary/30 transition-colors shadow-sm"
                >
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      {service.key === "auth" && (
                        <Shield className="w-4 h-4 text-emerald-500" />
                      )}
                      {service.key === "stripe" && (
                        <Database className="w-4 h-4 text-blue-500" />
                      )}
                      {service.key === "sync" && (
                        <Activity className="w-4 h-4 text-purple-500" />
                      )}
                      {service.label}
                    </p>
                  </div>
                  <Badge
                    variant={service.isReady ? "default" : "secondary"}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${service.isReady ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/20" : ""}`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${service.isReady ? "bg-emerald-500" : "bg-muted-foreground"}`}
                    />
                    {service.isReady
                      ? t("adminWorkspace.modules.statusReady")
                      : t("common.status.pending")}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
              <p className="text-[13px] font-semibold text-foreground mb-1">
                {t("adminWorkspace.overview.configStatus")}
              </p>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                {configSummary}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm rounded-xl flex flex-col">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-[15px] font-semibold">
              {t("adminWorkspace.ui.entitlementTitle")}
            </CardTitle>
            <CardDescription className="text-[13px]">
              {t("adminWorkspace.ui.entitlementDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 flex-1 bg-card">
            <div className="rounded-xl border border-border/50 bg-background p-4 shadow-sm">
              <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {t("adminWorkspace.overview.entitlement")}
              </p>
              <Badge
                variant="outline"
                className="text-[14px] font-bold py-1 px-3 border-primary/30 bg-primary/5 text-primary"
              >
                {entitlementLabel}
              </Badge>
            </div>
            <div className="rounded-xl border border-border/50 bg-background p-4 shadow-sm">
              <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {t("adminWorkspace.overview.auditRetention")}
              </p>
              <p className="text-[14px] font-semibold text-foreground">
                {t("adminWorkspace.overview.auditRetentionValue")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-[15px] font-semibold">
            {t("adminWorkspace.ui.latestAuditTitle")}
          </CardTitle>
          <CardDescription className="text-[13px]">
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
