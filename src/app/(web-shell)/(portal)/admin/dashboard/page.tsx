"use client";

import {
  AlertTriangle,
  ArrowRight,
  ChartNoAxesCombined,
  Layers3,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  getWorkspaceBillingState,
  listAdminWorkspaceHealth,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime, formatLocaleNumber } from "@/lib/locale-format";
import type {
  ControlAdminWorkspaceHealthRow,
  ControlBillingInvoice,
} from "@/types";

type DashboardDateRange =
  | "today"
  | "yesterday"
  | "last7Days"
  | "thisMonth"
  | "lastMonth"
  | "statistics"
  | "all";
type QueueStatusFilter = "all" | "active" | "past_due" | "canceled";
type QueueRiskFilter = "all" | "low" | "medium" | "high";

type InvoiceTrendPoint = {
  date: string;
  amount: number;
  count: number;
};

type DateWindow = {
  startMs: number | null;
  endMs: number | null;
};

type InsightCard = {
  key: string;
  title: string;
  value: string;
  hint: string;
  deltaPercent: number | null;
  invertDelta?: boolean;
};

const DATE_RANGE_PRESETS: DashboardDateRange[] = [
  "today",
  "yesterday",
  "last7Days",
  "thisMonth",
  "lastMonth",
  "statistics",
  "all",
];

const STATUS_FILTER_PRESETS: QueueStatusFilter[] = [
  "all",
  "active",
  "past_due",
  "canceled",
];

const RISK_FILTER_PRESETS: QueueRiskFilter[] = ["all", "low", "medium", "high"];

function normalizeDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 10);
}

function buildInvoiceTrend(
  invoices: ControlBillingInvoice[],
  maxPoints: number,
): InvoiceTrendPoint[] {
  const map = new Map<string, InvoiceTrendPoint>();
  for (const invoice of invoices) {
    const key = normalizeDateKey(invoice.paidAt || invoice.createdAt);
    const current = map.get(key);
    if (!current) {
      map.set(key, { date: key, amount: invoice.amountUsd, count: 1 });
      continue;
    }
    current.amount += invoice.amountUsd;
    current.count += 1;
  }
  return [...map.values()]
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(-maxPoints);
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function shiftDay(date: Date, offset: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + offset);
  return value;
}

function shiftMonth(date: Date, offset: number): Date {
  const value = new Date(date);
  value.setMonth(value.getMonth() + offset);
  return value;
}

function buildDateWindow(
  range: DashboardDateRange,
  now = new Date(),
): DateWindow {
  if (range === "all") {
    return { startMs: null, endMs: null };
  }

  if (range === "today") {
    return {
      startMs: startOfDay(now).getTime(),
      endMs: endOfDay(now).getTime(),
    };
  }

  if (range === "yesterday") {
    const previous = shiftDay(now, -1);
    return {
      startMs: startOfDay(previous).getTime(),
      endMs: endOfDay(previous).getTime(),
    };
  }

  if (range === "last7Days") {
    return {
      startMs: startOfDay(shiftDay(now, -6)).getTime(),
      endMs: endOfDay(now).getTime(),
    };
  }

  if (range === "thisMonth") {
    return {
      startMs: startOfMonth(now).getTime(),
      endMs: endOfDay(now).getTime(),
    };
  }

  if (range === "lastMonth") {
    const previousMonth = shiftMonth(now, -1);
    return {
      startMs: startOfMonth(previousMonth).getTime(),
      endMs: endOfMonth(previousMonth).getTime(),
    };
  }

  return {
    startMs: startOfDay(shiftDay(now, -89)).getTime(),
    endMs: endOfDay(now).getTime(),
  };
}

function buildPreviousWindow(window: DateWindow): DateWindow | null {
  if (window.startMs === null || window.endMs === null) {
    return null;
  }

  const span = window.endMs - window.startMs + 1;
  return {
    startMs: window.startMs - span,
    endMs: window.startMs - 1,
  };
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isInsideWindow(
  value: string | null | undefined,
  window: DateWindow,
): boolean {
  if (window.startMs === null || window.endMs === null) {
    return true;
  }

  const timestamp = parseTimestamp(value);
  if (timestamp === null) {
    return false;
  }

  return timestamp >= window.startMs && timestamp <= window.endMs;
}

function riskWeight(
  level: ControlAdminWorkspaceHealthRow["riskLevel"],
): number {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function statusTone(
  status: ControlAdminWorkspaceHealthRow["subscriptionStatus"],
):
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info" {
  if (status === "past_due") return "destructive";
  if (status === "canceled") return "warning";
  return "success";
}

function riskTone(
  level: ControlAdminWorkspaceHealthRow["riskLevel"],
):
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info" {
  if (level === "high") return "destructive";
  if (level === "medium") return "warning";
  return "info";
}

function resolveTrendPointLimit(range: DashboardDateRange): number {
  if (range === "today" || range === "yesterday") {
    return 2;
  }
  if (range === "last7Days") {
    return 7;
  }
  if (range === "thisMonth" || range === "lastMonth") {
    return 31;
  }
  if (range === "statistics") {
    return 90;
  }
  return 60;
}

function workspaceTimestamp(
  row: ControlAdminWorkspaceHealthRow,
): string | null {
  return row.latestInvoiceAt || row.usageUpdatedAt || null;
}

function calculateDeltaPercent(
  current: number,
  previous: number,
): number | null {
  if (previous <= 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const { connection, workspaces, loadingWorkspaces, refreshWorkspaces } =
    usePortalBillingData();

  const [healthRows, setHealthRows] = useState<
    ControlAdminWorkspaceHealthRow[]
  >([]);
  const [allInvoices, setAllInvoices] = useState<ControlBillingInvoice[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<QueueRiskFilter>("all");
  const [dateRange, setDateRange] = useState<DashboardDateRange>("all");

  const trendChartConfig = useMemo(
    () =>
      ({
        amount: {
          label: t("portalSite.admin.nav.revenue"),
          color: "hsl(var(--chart-1))",
        },
      }) satisfies ChartConfig,
    [t],
  );

  const refreshDashboard = useCallback(async () => {
    await refreshWorkspaces();

    if (!connection) {
      setHealthRows([]);
      setAllInvoices([]);
      setHealthError(null);
      setRevenueError(null);
      return;
    }

    setLoadingHealth(true);
    try {
      const payload = await listAdminWorkspaceHealth(connection);
      setHealthRows(Array.isArray(payload) ? payload : []);
      setHealthError(null);
    } catch (error) {
      setHealthRows([]);
      setHealthError(
        error instanceof Error && error.message.trim()
          ? error.message
          : t("portalSite.admin.dashboard.errors.loadFailed"),
      );
    } finally {
      setLoadingHealth(false);
    }

    setLoadingRevenue(true);
    try {
      const targets = workspaces.length > 0 ? workspaces : [];
      if (targets.length === 0) {
        setAllInvoices([]);
        setRevenueError(null);
      } else {
        const responses = await Promise.allSettled(
          targets.map((workspace) =>
            getWorkspaceBillingState(connection, workspace.id),
          ),
        );
        const invoices = responses
          .filter((item) => item.status === "fulfilled")
          .flatMap((item) =>
            item.status === "fulfilled"
              ? (item.value.recentInvoices ?? [])
              : [],
          );

        const unique = new Map<string, ControlBillingInvoice>();
        for (const invoice of invoices) {
          if (!unique.has(invoice.id)) {
            unique.set(invoice.id, invoice);
          }
        }

        setAllInvoices([...unique.values()]);
        if (responses.every((item) => item.status === "rejected")) {
          setRevenueError(
            t("portalSite.admin.dashboard.errors.loadRevenueFailed"),
          );
        } else {
          setRevenueError(null);
        }
      }
    } catch (error) {
      setAllInvoices([]);
      setRevenueError(
        error instanceof Error && error.message.trim()
          ? error.message
          : t("portalSite.admin.dashboard.errors.loadRevenueFailed"),
      );
    } finally {
      setLoadingRevenue(false);
    }
  }, [connection, refreshWorkspaces, t, workspaces]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const dateRangeOptions = useMemo(
    () =>
      DATE_RANGE_PRESETS.map((value) => ({
        value,
        label: t(`portalSite.admin.dashboard.timeRanges.${value}`),
      })),
    [t],
  );

  const statusFilterOptions = useMemo(
    () =>
      STATUS_FILTER_PRESETS.map((value) => ({
        value,
        label: t(`portalSite.admin.dashboard.filters.status.${value}`),
      })),
    [t],
  );

  const riskFilterOptions = useMemo(
    () =>
      RISK_FILTER_PRESETS.map((value) => ({
        value,
        label: t(`portalSite.admin.dashboard.filters.risk.${value}`),
      })),
    [t],
  );

  const currentWindow = useMemo(() => buildDateWindow(dateRange), [dateRange]);

  const previousWindow = useMemo(
    () => buildPreviousWindow(currentWindow),
    [currentWindow],
  );

  const filteredInvoices = useMemo(
    () =>
      allInvoices.filter((invoice) =>
        isInsideWindow(invoice.paidAt || invoice.createdAt, currentWindow),
      ),
    [allInvoices, currentWindow],
  );

  const previousInvoices = useMemo(() => {
    if (!previousWindow) {
      return [] as ControlBillingInvoice[];
    }

    return allInvoices.filter((invoice) =>
      isInsideWindow(invoice.paidAt || invoice.createdAt, previousWindow),
    );
  }, [allInvoices, previousWindow]);

  const filteredHealthRows = useMemo(
    () =>
      healthRows.filter((row) =>
        isInsideWindow(workspaceTimestamp(row), currentWindow),
      ),
    [currentWindow, healthRows],
  );

  const previousHealthRows = useMemo(() => {
    if (!previousWindow) {
      return [] as ControlAdminWorkspaceHealthRow[];
    }

    return healthRows.filter((row) =>
      isInsideWindow(workspaceTimestamp(row), previousWindow),
    );
  }, [healthRows, previousWindow]);

  const metrics = useMemo(() => {
    const totalWorkspaces =
      dateRange === "all"
        ? healthRows.length || workspaces.length
        : filteredHealthRows.length;

    const activeSubscriptions = filteredHealthRows.filter(
      (item) => item.subscriptionStatus === "active",
    ).length;
    const highRiskWorkspaces = filteredHealthRows.filter(
      (item) => item.riskLevel === "high",
    ).length;
    const totalMembers = filteredHealthRows.reduce(
      (sum, item) => sum + item.members,
      0,
    );
    const revenueInWindow = filteredInvoices.reduce(
      (sum, invoice) => sum + invoice.amountUsd,
      0,
    );
    const averageInvoice =
      filteredInvoices.length > 0
        ? revenueInWindow / filteredInvoices.length
        : 0;
    const totalProfiles = filteredHealthRows.reduce(
      (sum, item) => sum + item.profileLimit,
      0,
    );

    return {
      totalWorkspaces,
      activeSubscriptions,
      highRiskWorkspaces,
      totalMembers,
      totalProfiles,
      averageInvoice,
    };
  }, [
    dateRange,
    filteredHealthRows,
    filteredInvoices,
    healthRows.length,
    workspaces.length,
  ]);

  const insights = useMemo(() => {
    const revenueNow = filteredInvoices.reduce(
      (sum, invoice) => sum + invoice.amountUsd,
      0,
    );
    const revenuePrevious = previousInvoices.reduce(
      (sum, invoice) => sum + invoice.amountUsd,
      0,
    );

    const invoiceCountNow = filteredInvoices.length;
    const invoiceCountPrevious = previousInvoices.length;

    const pastDueNow = filteredHealthRows.filter(
      (item) => item.subscriptionStatus === "past_due",
    ).length;
    const pastDuePrevious = previousHealthRows.filter(
      (item) => item.subscriptionStatus === "past_due",
    ).length;

    const highRiskRatioNow =
      filteredHealthRows.length > 0
        ? (filteredHealthRows.filter((item) => item.riskLevel === "high")
            .length /
            filteredHealthRows.length) *
          100
        : 0;

    const highRiskRatioPrevious =
      previousHealthRows.length > 0
        ? (previousHealthRows.filter((item) => item.riskLevel === "high")
            .length /
            previousHealthRows.length) *
          100
        : 0;

    return [
      {
        key: "revenue",
        title: t("portalSite.admin.dashboard.revenueInWindow"),
        value: `$${formatLocaleNumber(revenueNow, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        hint: t("portalSite.admin.dashboard.insightHints.revenue"),
        deltaPercent: calculateDeltaPercent(revenueNow, revenuePrevious),
      },
      {
        key: "invoices",
        title: t("portalSite.admin.dashboard.invoicesInWindow"),
        value: formatLocaleNumber(invoiceCountNow),
        hint: t("portalSite.admin.dashboard.insightHints.invoices"),
        deltaPercent: calculateDeltaPercent(
          invoiceCountNow,
          invoiceCountPrevious,
        ),
      },
      {
        key: "past_due",
        title: t("portalSite.admin.dashboard.pastDueWorkspaces"),
        value: formatLocaleNumber(pastDueNow),
        hint: t("portalSite.admin.dashboard.insightHints.pastDue"),
        deltaPercent: calculateDeltaPercent(pastDueNow, pastDuePrevious),
        invertDelta: true,
      },
      {
        key: "high_risk_ratio",
        title: t("portalSite.admin.dashboard.highRiskRatio"),
        value: `${formatLocaleNumber(highRiskRatioNow, {
          maximumFractionDigits: 1,
        })}%`,
        hint: t("portalSite.admin.dashboard.insightHints.risk"),
        deltaPercent: calculateDeltaPercent(
          highRiskRatioNow,
          highRiskRatioPrevious,
        ),
        invertDelta: true,
      },
    ] satisfies InsightCard[];
  }, [
    filteredHealthRows,
    filteredInvoices,
    previousHealthRows,
    previousInvoices,
    t,
  ]);

  const attentionQueue = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return filteredHealthRows
      .filter((item) =>
        statusFilter === "all"
          ? true
          : item.subscriptionStatus === statusFilter,
      )
      .filter((item) =>
        riskFilter === "all" ? true : item.riskLevel === riskFilter,
      )
      .filter((item) => {
        if (!keyword) {
          return true;
        }
        return [
          item.workspaceName,
          item.planLabel,
          item.subscriptionStatus,
          item.riskLevel,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => {
        const riskDiff = riskWeight(b.riskLevel) - riskWeight(a.riskLevel);
        if (riskDiff !== 0) {
          return riskDiff;
        }
        return (
          (Date.parse(b.latestInvoiceAt ?? b.usageUpdatedAt ?? "") || 0) -
          (Date.parse(a.latestInvoiceAt ?? a.usageUpdatedAt ?? "") || 0)
        );
      });
  }, [filteredHealthRows, query, riskFilter, statusFilter]);

  const trendPoints = useMemo(
    () =>
      buildInvoiceTrend(filteredInvoices, resolveTrendPointLimit(dateRange)),
    [dateRange, filteredInvoices],
  );

  const planMix = useMemo(() => {
    const buckets = new Map<string, number>();

    for (const row of filteredHealthRows) {
      const key = row.planLabel || t("portalSite.account.notAvailable");
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    if (buckets.size === 0) {
      return [] as { plan: string; count: number; percent: number }[];
    }

    const total = Math.max(1, filteredHealthRows.length);
    return [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([plan, count]) => ({
        plan,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .slice(0, 6);
  }, [filteredHealthRows, t]);

  const topRiskRows = attentionQueue.slice(0, 5);
  const loading = loadingHealth || loadingWorkspaces || loadingRevenue;

  const currentRangeLabel = t(
    `portalSite.admin.dashboard.timeRanges.${dateRange}`,
  );

  const windowLabel = useMemo(() => {
    if (currentWindow.startMs === null || currentWindow.endMs === null) {
      return t("portalSite.admin.dashboard.windowAll");
    }

    const formatter = new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return t("portalSite.admin.dashboard.windowValue", {
      start: formatter.format(new Date(currentWindow.startMs)),
      end: formatter.format(new Date(currentWindow.endMs)),
    });
  }, [currentWindow.endMs, currentWindow.startMs, t]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.dashboard.title")}
      description={t("portalSite.admin.dashboard.description")}
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refreshDashboard()}
            disabled={loading}
          >
            {loading
              ? t("portalSite.admin.loading")
              : t("portalSite.admin.refresh")}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/workspaces">
              {t("portalSite.admin.nav.workspaces")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      }
    >
      {healthError ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-chart-5" />
            <p>{healthError}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t("portalSite.admin.dashboard.timeRangeLabel")}
          </p>
          {dateRangeOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={dateRange === option.value ? "secondary" : "outline"}
              className="h-8"
              onClick={() => setDateRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
          <Badge variant="outline" className="sm:ml-auto">
            {windowLabel}
          </Badge>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              key: "workspaces",
              icon: Layers3,
              iconClassName: "text-chart-2",
              title: t("portalSite.admin.dashboard.activeValue", {
                count: metrics.activeSubscriptions,
              }),
              value: formatLocaleNumber(metrics.totalWorkspaces),
              hint: t("portalSite.admin.nav.workspaces"),
            },
            {
              key: "profiles",
              icon: ShieldAlert,
              iconClassName: "text-chart-5",
              title: t("portalSite.admin.dashboard.highRiskValue", {
                count: metrics.highRiskWorkspaces,
              }),
              value: formatLocaleNumber(metrics.totalProfiles),
              hint: t("portalSite.admin.dashboard.totalProfiles"),
            },
            {
              key: "members",
              icon: Users,
              iconClassName: "text-chart-1",
              title: t("portalSite.admin.dashboard.totalMembers"),
              value: formatLocaleNumber(metrics.totalMembers),
              hint: t("portalSite.admin.dashboard.workspaceLeaderboard"),
            },
            {
              key: "invoice",
              icon: ChartNoAxesCombined,
              iconClassName: "text-chart-4",
              title: t("portalSite.admin.dashboard.averageInvoiceValue"),
              value: `$${formatLocaleNumber(metrics.averageInvoice, {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              })}`,
              hint: t("portalSite.admin.dashboard.revenueWindow"),
            },
          ].map((item, index) => (
            <article key={item.key} className="relative p-4 sm:p-5">
              {index > 0 ? (
                <span className="absolute inset-y-4 left-0 hidden w-px bg-border xl:block" />
              ) : null}
              {index > 0 ? (
                <span className="absolute inset-x-4 top-0 h-px bg-border xl:hidden" />
              ) : null}
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {item.title}
                </p>
                <item.icon className={`h-4 w-4 ${item.iconClassName}`} />
              </div>
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {t("portalSite.admin.dashboard.insightsTitle")}
          </h2>
          <Badge variant="secondary">{currentRangeLabel}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {insights.map((item) => {
            const adjustedDelta =
              item.deltaPercent === null
                ? null
                : item.invertDelta
                  ? item.deltaPercent * -1
                  : item.deltaPercent;

            const deltaLabel =
              adjustedDelta === null
                ? t("portalSite.admin.dashboard.deltaUnavailable")
                : t("portalSite.admin.dashboard.deltaCompared", {
                    value: `${adjustedDelta >= 0 ? "+" : ""}${formatLocaleNumber(
                      adjustedDelta,
                      {
                        maximumFractionDigits: 1,
                      },
                    )}%`,
                  });

            return (
              <article
                key={item.key}
                className="rounded-lg border border-border bg-muted/30 p-3"
              >
                <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  {item.title}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {item.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.hint}
                </p>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  {adjustedDelta === null ? null : adjustedDelta >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  <span>{deltaLabel}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("portalSite.admin.dashboard.revenueTrend")}
            </h2>
            <Badge variant="info">
              {formatLocaleNumber(trendPoints.length)}
            </Badge>
          </div>

          {revenueError ? (
            <p className="text-sm text-muted-foreground">{revenueError}</p>
          ) : trendPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("portalSite.admin.placeholder.noData")}
            </p>
          ) : (
            <ChartContainer
              config={trendChartConfig}
              className="h-[280px] w-full"
            >
              <AreaChart
                accessibilityLayer
                data={trendPoints}
                margin={{ left: 12, right: 12 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => String(value).slice(5)}
                />
                <ChartTooltip cursor={false} />
                <Area
                  dataKey="amount"
                  type="natural"
                  fill="var(--color-amount)"
                  fillOpacity={0.22}
                  stroke="var(--color-amount)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("portalSite.admin.dashboard.planMix")}
            </h2>
            <Badge variant="secondary">
              {formatLocaleNumber(planMix.length)}
            </Badge>
          </div>
          <div className="space-y-3">
            {planMix.length > 0 ? (
              planMix.map((item) => (
                <article key={item.plan} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-foreground">{item.plan}</span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.max(4, item.percent)}%` }}
                    />
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("portalSite.admin.placeholder.noData")}
              </p>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("portalSite.admin.dashboard.attentionQueue")}
            </h2>
            <Badge variant="warning">
              {formatLocaleNumber(attentionQueue.length)}
            </Badge>
          </div>

          <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.dashboard.searchPlaceholder")}
            />
            <div className="flex flex-wrap gap-1">
              {statusFilterOptions.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={
                    statusFilter === option.value ? "secondary" : "outline"
                  }
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {riskFilterOptions.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={
                    riskFilter === option.value ? "secondary" : "outline"
                  }
                  onClick={() => setRiskFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="px-3 py-2">
                    {t("portalSite.admin.columns.workspace")}
                  </th>
                  <th className="px-3 py-2">
                    {t("portalSite.admin.columns.plan")}
                  </th>
                  <th className="px-3 py-2">
                    {t("portalSite.admin.dashboard.totalProfiles")}
                  </th>
                  <th className="px-3 py-2">
                    {t("portalSite.admin.columns.members")}
                  </th>
                  <th className="px-3 py-2">
                    {t("portalSite.admin.columns.risk")}
                  </th>
                  <th className="px-3 py-2">
                    {t("portalSite.admin.columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {attentionQueue.slice(0, 8).map((row) => (
                  <tr
                    key={row.workspaceId}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <td className="px-3 py-2 text-foreground">
                      {row.workspaceName}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.planLabel}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatLocaleNumber(row.profileLimit)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatLocaleNumber(row.members)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={riskTone(row.riskLevel)}>
                        {t(`portalSite.admin.risk.${row.riskLevel}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusTone(row.subscriptionStatus)}>
                        {t(
                          `portalSite.admin.dashboard.subscriptionStatus.${row.subscriptionStatus}`,
                        )}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {attentionQueue.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-4 text-sm text-muted-foreground"
                      colSpan={6}
                    >
                      {loading
                        ? t("portalSite.admin.loading")
                        : t("portalSite.admin.placeholder.noData")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("portalSite.admin.dashboard.topRiskTitle")}
            </h2>
            <ShieldAlert className="h-4 w-4 text-chart-5" />
          </div>
          <div className="space-y-2">
            {topRiskRows.length > 0 ? (
              topRiskRows.map((row) => (
                <article
                  key={row.workspaceId}
                  className="rounded-lg border border-border bg-muted/30 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.workspaceName}
                    </p>
                    <Badge variant={riskTone(row.riskLevel)}>
                      {t(`portalSite.admin.risk.${row.riskLevel}`)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{row.planLabel}</span>
                    <span>
                      {row.latestInvoiceAt || row.usageUpdatedAt
                        ? formatLocaleDateTime(
                            row.latestInvoiceAt || row.usageUpdatedAt || "",
                          )
                        : t("portalSite.account.notAvailable")}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("portalSite.admin.placeholder.noData")}
              </p>
            )}
          </div>
          <div className="my-4 h-px w-full bg-border" />
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("portalSite.admin.dashboard.capacityLeaders")}
            </h3>
            <ShieldCheck className="h-4 w-4 text-chart-2" />
          </div>
          <div className="space-y-2">
            {attentionQueue.slice(0, 5).map((row) => (
              <article
                key={`${row.workspaceId}-capacity`}
                className="rounded-lg border border-border bg-muted/30 p-2.5"
              >
                <p className="truncate text-sm font-medium text-foreground">
                  {row.workspaceName}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>
                    {t("portalSite.admin.dashboard.totalProfiles")}:{" "}
                    {formatLocaleNumber(row.profileLimit)}
                  </span>
                  <span>
                    {t("portalSite.admin.dashboard.totalMembers")}:{" "}
                    {formatLocaleNumber(row.members)}
                  </span>
                </div>
              </article>
            ))}
            {attentionQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("portalSite.admin.placeholder.noData")}
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </PortalSettingsPage>
  );
}
