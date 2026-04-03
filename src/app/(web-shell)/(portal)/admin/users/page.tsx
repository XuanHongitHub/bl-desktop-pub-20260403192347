"use client";

import { MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  createAdminUser,
  listAdminUsers,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { ControlAdminUserListItem } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function formatAuthProvider(
  value: ControlAdminUserListItem["authProvider"],
): string {
  if (value === "password_google") return "password + google";
  return value;
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();

  const [rows, setRows] = useState<ControlAdminUserListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"none" | "platform_admin">("none");
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(
    async (keyword = query) => {
      if (!connection) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const payload = await listAdminUsers(connection, {
          q: keyword.trim() || undefined,
          page: 1,
          pageSize: 200,
        });
        setRows(payload.items ?? []);
      } catch (error) {
        showErrorToast(t("portalSite.adminUsers.errors.loadFailed"), {
          description: extractErrorMessage(error, "load_admin_users_failed"),
        });
      } finally {
        setLoading(false);
      }
    },
    [connection, query, t],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh(query);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, refresh]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      admins: rows.filter((item) => item.platformRole === "platform_admin")
        .length,
      google: rows.filter((item) => item.hasGoogleAuth).length,
    }),
    [rows],
  );

  const handleCreateUser = useCallback(async () => {
    if (!connection) {
      showErrorToast(t("portalSite.adminUsers.errors.connectionMissing"));
      return;
    }
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      showErrorToast(t("portalSite.adminUsers.errors.createInvalidEmail"));
      return;
    }
    if (newPassword.length < 8) {
      showErrorToast(t("portalSite.adminUsers.errors.createInvalidPassword"));
      return;
    }

    setCreating(true);
    try {
      await createAdminUser(connection, {
        email,
        password: newPassword,
        platformRole: newRole === "platform_admin" ? "platform_admin" : null,
      });
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewRole("none");
      await refresh();
      showSuccessToast(t("portalSite.adminUsers.toasts.userCreated"));
    } catch (error) {
      showErrorToast(t("portalSite.adminUsers.errors.createFailed"), {
        description: extractErrorMessage(error, "create_user_failed"),
      });
    } finally {
      setCreating(false);
    }
  }, [connection, newEmail, newPassword, newRole, refresh, t]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.adminUsers.eyebrow")}
      title={t("portalSite.adminUsers.title")}
      description={t("portalSite.adminUsers.description")}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => void refresh(query)}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            {t("portalSite.adminUsers.actions.refresh")}
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8">
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t("portalSite.adminUsers.create.action")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {t("portalSite.adminUsers.create.title")}
                </DialogTitle>
                <DialogDescription>
                  {t("portalSite.adminUsers.create.description")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <Input
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder={t(
                    "portalSite.adminUsers.create.emailPlaceholder",
                  )}
                  className="h-9"
                />
                <Input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  placeholder={t(
                    "portalSite.adminUsers.create.passwordPlaceholder",
                  )}
                  className="h-9"
                />
                <Select
                  value={newRole}
                  onValueChange={(value) =>
                    setNewRole(value as "none" | "platform_admin")
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("portalSite.adminUsers.create.roleUser")}
                    </SelectItem>
                    <SelectItem value="platform_admin">
                      {t("portalSite.adminUsers.create.rolePlatformAdmin")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  {t("portalSite.adminUsers.actions.cancel")}
                </Button>
                <Button
                  disabled={creating}
                  onClick={() => void handleCreateUser()}
                >
                  {t("portalSite.adminUsers.create.action")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <section className="mx-auto grid w-full max-w-[1280px] gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {t("portalSite.adminUsers.stats.filtered", { count: stats.total })}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {t("portalSite.adminUsers.stats.platformAdmins")}: {stats.admins}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {t("portalSite.adminUsers.labels.google")}: {stats.google}
          </Badge>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.adminUsers.search")}
              className="h-8 max-w-md"
            />
          </div>
          <div className="min-h-[64vh] overflow-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("portalSite.adminUsers.columns.user")}
                  </TableHead>
                  <TableHead>
                    {t("portalSite.adminUsers.columns.provider")}
                  </TableHead>
                  <TableHead>
                    {t("portalSite.adminUsers.columns.role")}
                  </TableHead>
                  <TableHead>
                    {t("portalSite.adminUsers.columns.workspaceCount")}
                  </TableHead>
                  <TableHead>
                    {t("portalSite.adminUsers.columns.lastActive")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("portalSite.admin.columns.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t("portalSite.admin.loading")}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t("portalSite.adminUsers.panel.emptyUsers")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <p className="truncate font-medium">{user.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.userId}
                        </p>
                      </TableCell>
                      <TableCell className="capitalize">
                        {formatAuthProvider(user.authProvider)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {user.platformRole === "platform_admin"
                            ? t(
                                "portalSite.adminUsers.create.rolePlatformAdmin",
                              )
                            : t("portalSite.adminUsers.create.roleUser")}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.workspaceCount}</TableCell>
                      <TableCell>
                        {user.lastActiveAt
                          ? formatLocaleDateTime(user.lastActiveAt)
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/admin/users/${encodeURIComponent(user.userId)}`}
                              >
                                {t("portalSite.adminUsers.actions.viewDetail")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/admin/users/${encodeURIComponent(user.userId)}/edit`}
                              >
                                {t("portalSite.adminUsers.actions.editUser")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/admin/users/${encodeURIComponent(user.userId)}/permissions`}
                              >
                                {t("portalSite.adminUsers.actions.permissions")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/admin/memberships?q=${encodeURIComponent(user.email)}`}
                              >
                                Memberships
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
