"use client";

import { Activity, Cpu, Database, Info, RefreshCw, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AdminSystemTabProps {
  isPlatformAdmin: boolean;
  isBusy: boolean;
  refreshServerConfigStatus: () => void;
  authReady: boolean;
  stripeReady: boolean;
  syncReady: boolean;
}

export function AdminSystemTab(props: AdminSystemTabProps) {
  const { t } = useTranslation();

  if (!props.isPlatformAdmin) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-5 text-[13px] text-muted-foreground">
        {t("adminWorkspace.noAccessDescription")}
      </div>
    );
  }

  const rows = [
    {
      key: "auth",
      icon: Shield,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      title: t("adminWorkspace.ui.serviceAuth"),
      ready: props.authReady,
      description: t("adminWorkspace.ui.serviceAuthDescription"),
    },
    {
      key: "stripe",
      icon: Database,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      title: t("adminWorkspace.ui.serviceStripe"),
      ready: props.stripeReady,
      description: t("adminWorkspace.ui.serviceStripeDescription"),
    },
    {
      key: "sync",
      icon: Activity,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      title: t("adminWorkspace.ui.serviceSync"),
      ready: props.syncReady,
      description: t("adminWorkspace.ui.serviceSyncDescription"),
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden flex flex-col">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4 flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              {t("adminWorkspace.tabs.system")}
            </CardTitle>
            <CardDescription className="text-[13px]">
              {t("adminWorkspace.modules.systemConfig.description")}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shadow-sm hover:shadow-md transition-shadow border-border/50 bg-background"
            onClick={props.refreshServerConfigStatus}
            disabled={props.isBusy}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            {t("adminWorkspace.controlPlane.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-4 bg-card">
          <div className="grid gap-4 md:grid-cols-3">
            {rows.map((row) => (
              <div
                key={row.key}
                className="rounded-xl border border-border/50 bg-muted/10 p-5 hover:border-primary/30 transition-colors shadow-sm relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-3 opacity-5 transform translate-x-3 -translate-y-3 group-hover:scale-110 transition-transform duration-500">
                  <row.icon className={`w-16 h-16 ${row.color}`} />
                </div>
                <div className="flex items-center justify-between gap-2 relative z-10 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${row.bg}`}>
                      <row.icon className={`w-4 h-4 ${row.color}`} />
                    </div>
                    <p className="text-[14px] font-semibold text-foreground">
                      {row.title}
                    </p>
                  </div>
                  <Badge
                    variant={row.ready ? "default" : "secondary"}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${row.ready ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/20" : ""}`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${row.ready ? "bg-emerald-500" : "bg-muted-foreground"}`}
                    />
                    {row.ready
                      ? t("adminWorkspace.modules.statusReady")
                      : t("common.status.pending")}
                  </Badge>
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed relative z-10">
                  {row.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden flex flex-col">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            {t("adminWorkspace.ui.systemGuidanceTitle")}
          </CardTitle>
          <CardDescription className="text-[13px]">
            {t("adminWorkspace.ui.systemGuidanceDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-3 text-[13px] text-muted-foreground bg-card">
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
            <p className="leading-relaxed">
              {t("adminWorkspace.ui.systemGuidanceItem1")}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
            <p className="leading-relaxed">
              {t("adminWorkspace.ui.systemGuidanceItem2")}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
            <p className="leading-relaxed">
              {t("adminWorkspace.ui.systemGuidanceItem3")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
