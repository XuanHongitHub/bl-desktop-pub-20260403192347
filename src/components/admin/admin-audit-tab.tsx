"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import type { ControlAuditLog } from "@/types";

interface AdminAuditTabProps {
  isPlatformAdmin: boolean;
  isBusy: boolean;
  refreshAdminData: () => void;
  auditLogs: ControlAuditLog[];
}

function formatAuditTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatLocaleDateTime(date);
}

export function AdminAuditTab(props: AdminAuditTabProps) {
  const { t } = useTranslation();

  if (!props.isPlatformAdmin) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-5 text-[13px] text-muted-foreground">
        {t("adminWorkspace.noAccessDescription")}
      </div>
    );
  }

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-[14px] font-semibold">
            {t("adminWorkspace.tabs.audit")}
          </CardTitle>
          <CardDescription className="text-[12px]">
            {t("adminWorkspace.modules.audit.description")}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={props.refreshAdminData}
          disabled={props.isBusy}
        >
          {t("adminWorkspace.controlPlane.refresh")}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {props.auditLogs.length === 0 ? (
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
              {props.auditLogs.map((entry) => (
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
  );
}
