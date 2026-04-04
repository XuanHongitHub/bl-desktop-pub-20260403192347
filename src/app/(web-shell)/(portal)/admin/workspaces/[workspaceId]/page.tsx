"use client";

import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { useEffect, useState } from "react";
import { getAdminWorkspaceDetail, transferAdminWorkspaceOwner, listAdminUsers } from "@/components/web-billing/control-api";
import type { ControlAdminWorkspaceDetail } from "@/types";
import { PageLoader } from "@/components/ui/page-loader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AdminPlanBadge } from "@/components/admin/ui/admin-plan-badge";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { extractRootError } from "@/lib/error-utils";

export default function WorkspaceOverviewPage() {
  const { t } = useTranslation();
  const params = useParams();
  const workspaceId = decodeURIComponent(params.workspaceId as string);
  const { connection } = usePortalBillingData();
  const [detail, setDetail] = useState<ControlAdminWorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Transfer Owner form
  const [ownerUserId, setOwnerUserId] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<Array<{ userId: string; email: string }>>([]);
  const [ownerQuery, setOwnerQuery] = useState("");
  const [transferring, setTransferring] = useState(false);/

  const loadData = () => {
    if (!connection) return;
    setLoading(true);
    getAdminWorkspaceDetail(connection, workspaceId)
      .then((data) => {
        setDetail(data);
        setOwnerUserId(data.owner?.userId ?? "");
      })
      .catch((err) => {
        showErrorToast("Lỗi tải Workspace", { description: extractRootError(err) });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [connection, workspaceId]);

  useEffect(() => {
    if (!connection || !ownerQuery) {
      setOwnerOptions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const payload = await listAdminUsers(connection, {
          q: ownerQuery.trim(),
          page: 1,
          pageSize: 10,
        });
        setOwnerOptions((payload.items ?? []).map((i) => ({ userId: i.userId, email: i.email })));
      } catch {
        setOwnerOptions([]);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [connection, ownerQuery]);

  const handleTransfer = async () => {
    if (!connection || !detail) return;
    if (ownerUserId === detail.owner?.userId) return;
    
    setTransferring(true);
    try {
      await transferAdminWorkspaceOwner(connection, workspaceId, ownerUserId, "transfer_from_super_admin");
      showSuccessToast("Thành công", { description: "Đã chuyển nhượng chủ sở hữu Workspace." });
      loadData();
    } catch (err) {
      showErrorToast("Thất bại", { description: extractRootError(err) });
    } finally {
      setTransferring(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!detail) return <div className="text-center py-20 text-muted-foreground">Không tìm thấy Workspace</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base uppercase tracking-tight text-foreground/80">Thông tin chung</CardTitle>
          <CardDescription>ID: <span className="font-mono text-xs">{detail.workspaceId}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Tên Workspace</span>
            <span className="font-semibold">{detail.workspaceName}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Chế độ</span>
            <span className="capitalize">{detail.workspaceMode}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Gói hiện tại</span>
            <AdminPlanBadge planId={detail.planId} />
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Trạng thái Sub</span>
            <AdminStatusBadge status={detail.subscriptionStatus} />
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Ngày tạo</span>
            <span>{formatLocaleDateTime(detail.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base uppercase tracking-tight text-foreground/80">Chủ Sở Hữu</CardTitle>
          <CardDescription>Cập nhật người đứng đầu Workspace này</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted/20 border rounded-md">
            <div className="text-xs text-muted-foreground mb-1">Hiện tại</div>
            <div className="font-medium">{detail.owner?.email ?? "Không có"}</div>
            <div className="text-[11px] font-mono text-muted-foreground">{detail.owner?.userId}</div>
          </div>
          
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold">Chuyển nhượng cho</label>
            <Input
              value={ownerQuery}
              onChange={(e) => {
                setOwnerQuery(e.target.value);
                const match = ownerOptions.find((o) => o.email.toLowerCase() === e.target.value.toLowerCase());
                if (match) setOwnerUserId(match.userId);
              }}
              placeholder="Nhập email user..."
              list="admin-user-transfer-list"
            />
            <datalist id="admin-user-transfer-list">
              {ownerOptions.map((opt) => (
                <option key={opt.userId} value={opt.email} />
              ))}
            </datalist>
            <p className="text-[10px] text-muted-foreground">UID: {ownerUserId}</p>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t py-3">
          <Button 
            disabled={transferring || !ownerUserId || ownerUserId === detail.owner?.userId} 
            onClick={handleTransfer}
            className="w-full"
          >
            Lưu thay đổi Owner
          </Button>
        </CardFooter>
      </Card>
      
      {/* Cảnh báo Risk Level có thể thêm ở đây */}
      {detail.riskLevel === "high" && (
        <div className="col-span-1 md:col-span-2 p-4 border border-rose-500/20 bg-rose-500/5 rounded-md text-rose-600 dark:text-rose-400 font-medium">
          Workspace này đang bị đưa vào diện rủi ro cao (High Risk).
        </div>
      )}
    </div>
  );
}
