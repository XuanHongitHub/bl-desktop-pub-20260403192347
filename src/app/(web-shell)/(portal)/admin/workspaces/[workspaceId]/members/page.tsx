"use client";

import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { useEffect, useState } from "react";
import { 
  getAdminWorkspaceDetail, 
  inviteWorkspaceMember
} from "@/components/web-billing/control-api";
import type { ControlAdminWorkspaceDetail, TeamRole } from "@/types";
import { PageLoader } from "@/components/ui/page-loader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserPlus, ShieldCheck, Eye, Users } from "lucide-react";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { extractRootError } from "@/lib/error-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function WorkspaceMembersPage() {
  const { t } = useTranslation();
  const params = useParams();
  const workspaceId = decodeURIComponent(params.workspaceId as string);
  const { connection } = usePortalBillingData();
  const [detail, setDetail] = useState<ControlAdminWorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("member");
  const [inviting, setInviting] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const loadData = () => {
    if (!connection) return;
    setLoading(true);
    getAdminWorkspaceDetail(connection, workspaceId)
      .then(setDetail)
      .catch((err) => {
        showErrorToast("Lỗi tải thành viên", { description: extractRootError(err) });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [connection, workspaceId]);

  const handleInvite = async () => {
    if (!connection) return;
    if (!inviteEmail.includes("@")) {
      showErrorToast("Email không hợp lệ");
      return;
    }
    setInviting(true);
    try {
      await inviteWorkspaceMember(connection, workspaceId, {
        email: inviteEmail,
        role: inviteRole,
      });
      showSuccessToast("Đã mời thành viên thành công");
      setInviteEmail("");
      setInviteRole("member");
      setInviteDialogOpen(false);
      loadData();
    } catch (err) {
      showErrorToast("Thất bại", { description: extractRootError(err) });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = () => {
    showErrorToast("Chức năng tạm khóa", { description: "API xóa member từ portal chưa được cấu hình." });
  };

  if (loading) return <PageLoader />;
  if (!detail) return <div className="text-center py-20 text-muted-foreground">Không tìm thấy Workspace</div>;

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base uppercase tracking-tight text-foreground/80">Quản lý Thành viên</CardTitle>
            <CardDescription>
              Kiểm soát quyền truy cập của {detail.memberships.length} người dùng
            </CardDescription>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Mời thành viên
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm thành viên vào Workspace</DialogTitle>
                <DialogDescription>
                  Chỉ định email và phân quyền cho họ trong hệ thống Workspace này.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email người dùng</label>
                  <Input 
                    placeholder="ví dụ: a@buglogin.com" 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Vai trò (Role)</label>
                  <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as TeamRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Quản trị viên (Admin)</SelectItem>
                      <SelectItem value="member">Thành viên (Member)</SelectItem>
                      <SelectItem value="viewer">Chỉ xem (Viewer)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={inviting}>Hủy bỏ</Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                  {inviting ? "Đang xử lý..." : "Mời ngay"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[300px]">Thành viên</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Hệ thống</TableHead>
                  <TableHead>Ngày tham gia</TableHead>
                  <TableHead className="text-right">Tác vụ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.memberships.map((m) => {
                  const isOwner = detail.owner?.userId === m.userId;
                  return (
                    <TableRow key={m.userId} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-border/50">
                            <AvatarFallback className="bg-primary/5 font-semibold text-primary/80 uppercase text-xs">
                              {m.email.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium flex items-center gap-2">
                              {m.email}
                              {isOwner && (
                                <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] uppercase tracking-wider bg-orange-500/10 text-orange-600 border-none">
                                  Owner
                                </Badge>
                              )}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono truncate">{m.userId}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="capitalize font-medium text-sm">
                          {m.role === 'admin' ? (
                            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Admin</span>
                          ) : m.role === 'viewer' ? (
                            <span className="text-slate-500 flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Viewer</span>
                          ) : (
                            <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Member</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-xs">Standard</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatLocaleDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={isOwner}
                          onClick={handleRemove}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {detail.memberships.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Không có thành viên nào.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
