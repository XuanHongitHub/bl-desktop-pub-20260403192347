"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminWorkspaceHealth } from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminWorkspaceHealthRow } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AdminAbuseTrustOverviewPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [rows, setRows] = useState<ControlAdminWorkspaceHealthRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");

  const refresh = useCallback(async () => {
    if (!connection) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const payload = await listAdminWorkspaceHealth(connection);
      setRows(payload);
    } catch (error) {
      showErrorToast(t("portalSite.admin.abuseTrust.loadFailed"), {
        description: extractErrorMessage(error, "load_abuse_trust_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchRisk =
        riskFilter === "all" ? true : row.riskLevel === riskFilter;
      const matchQuery = keyword
        ? [
            row.workspaceName,
            row.workspaceId,
            row.subscriptionStatus,
            row.entitlementState,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        : true;
      return matchRisk && matchQuery;
    });
  }, [query, riskFilter, rows]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.abuseTrust.title")}
      description={t("portalSite.admin.abuseTrust.description")}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            {t("portalSite.admin.refresh")}
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/abuse-trust/manage">
              {t("portalSite.admin.workspaces.actions.manage")}
            </Link>
          </Button>
        </div>
      }
    >
      <section className="mx-auto grid w-full max-w-[1320px] gap-4 text-sm">
        <div className="rounded-xl border border-border bg-card">
          <div className="grid gap-2 border-b border-border p-4 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.workspaces.searchPlaceholder")}
              className="h-9"
            />
            <Select
              value={riskFilter}
              onValueChange={(value) =>
                setRiskFilter(value as typeof riskFilter)
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("portalSite.admin.workspaces.allStatuses")}
                </SelectItem>
                <SelectItem value="high">high</SelectItem>
                <SelectItem value="medium">medium</SelectItem>
                <SelectItem value="low">low</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{filteredRows.length}</Badge>
              <Badge variant="outline">
                {filteredRows.filter((r) => r.riskLevel === "high").length}
              </Badge>
            </div>
          </div>

          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>{t("portalSite.admin.columns.workspace")}</TableHead>
                <TableHead>{t("portalSite.admin.columns.status")}</TableHead>
                <TableHead>{t("portalSite.admin.columns.risk")}</TableHead>
                <TableHead>{t("portalSite.admin.columns.members")}</TableHead>
                <TableHead>{t("portalSite.admin.columns.storage")}</TableHead>
                <TableHead>{t("portalSite.admin.columns.time")}</TableHead>
                <TableHead>{t("portalSite.admin.columns.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-sm text-muted-foreground"
                  >
                    {t("portalSite.admin.loading")}
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-sm text-muted-foreground"
                  >
                    {t("portalSite.admin.abuseTrust.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={row.workspaceId}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {row.workspaceName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.workspaceId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {row.subscriptionStatus}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.riskLevel === "high" ? "destructive" : "outline"
                        }
                      >
                        {row.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.members}</TableCell>
                    <TableCell>{Math.round(row.storagePercent)}%</TableCell>
                    <TableCell>
                      {row.usageUpdatedAt
                        ? formatLocaleDateTime(row.usageUpdatedAt)
                        : "--"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                        >
                          <Link
                            href={`/admin/abuse-trust/manage/${row.workspaceId}?section=queue`}
                          >
                            Review
                          </Link>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                        >
                          <Link
                            href={`/admin/workspaces/${row.workspaceId}/billing`}
                          >
                            Billing
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
