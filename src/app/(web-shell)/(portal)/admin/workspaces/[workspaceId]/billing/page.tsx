"use client";

import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { useEffect, useState } from "react";
import { 
  getWorkspaceBillingState, 
  overrideWorkspaceSubscriptionAsAdmin
} from "@/components/web-billing/control-api";
import type { ControlWorkspaceBillingState } from "@/types";
import { PageLoader } from "@/components/ui/page-loader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AdminPlanBadge } from "@/components/admin/ui/admin-plan-badge";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { extractRootError } from "@/lib/error-utils";
import { getUnifiedPlanLabel } from "@/lib/plan-display";
import type { BillingCycle } from "@/lib/billing-plans";

function toDatetimeLocalValue(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mi = String(parsed.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function WorkspaceBillingPage() {
  const { t } = useTranslation();
  const params = useParams();
  const workspaceId = decodeURIComponent(params.workspaceId as string);
  const { connection } = usePortalBillingData();
  const [billing, setBilling] = useState<ControlWorkspaceBillingState | null>(null);
  const [loading, setLoading] = useState(true);

  const [formPlanId, setFormPlanId] = useState<"starter" | "team" | "scale" | "enterprise">("starter");
  const [formBillingCycle, setFormBillingCycle] = useState<BillingCycle>("monthly");
  const [formProfileLimit, setFormProfileLimit] = useState("0");
  const [formMemberLimit, setFormMemberLimit] = useState("0");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    if (!connection) return;
    setLoading(true);
    getWorkspaceBillingState(connection, workspaceId)
      .then((state) => {
        setBilling(state);
        setFormPlanId(state.subscription.planId || "starter");
        setFormBillingCycle(state.subscription.billingCycle || "monthly");
        setFormProfileLimit(String(state.subscription.profileLimit || 0));
        setFormMemberLimit(String(state.subscription.memberLimit || 0));
        setFormExpiresAt(toDatetimeLocalValue(state.subscription.expiresAt));
      })
      .catch((err) => {
        showErrorToast("Lỗi tải thông tin Billing", { description: extractRootError(err) });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [connection, workspaceId]);

  const handleSave = async () => {
    if (!connection || !billing) return;

    const profileLimit = Number.parseInt(formProfileLimit, 10);
    const memberLimit = Number.parseInt(formMemberLimit, 10);
    
    if (!Number.isFinite(profileLimit) || profileLimit <= 0) {
      showErrorToast("Giới hạn profile không hợp lệ");
      return;
    }

    if (!Number.isFinite(memberLimit) || memberLimit <= 0) {
      showErrorToast("Giới hạn member không hợp lệ");
      return;
    }

    let expiresAt: string | null = null;
    if (formExpiresAt.trim()) {
      const parsed = Date.parse(formExpiresAt.trim());
      if (!Number.isFinite(parsed) || parsed <= Date.now()) {
        showErrorToast("Ngày hết hạn không hợp lệ");
        return;
      }
      expiresAt = new Date(parsed).toISOString();
    }

    setSaving(true);
    try {
      await overrideWorkspaceSubscriptionAsAdmin(connection, workspaceId, {
        planId: formPlanId,
        billingCycle: formBillingCycle,
        profileLimit,
        memberLimit,
        expiresAt,
        planLabel: getUnifiedPlanLabel({ planId: formPlanId })
      });
      showSuccessToast("Cập nhật thành công cấu hình Billing!");
      loadData();
    } catch (err) {
      showErrorToast("Cập nhật thất bại", { description: extractRootError(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!billing) return <div className="text-center py-20 text-muted-foreground">Không tìm thấy thông tin Billing</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="border-border/50 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <AdminStatusBadge status={billing.subscription.status} />
        </div>
        <CardHeader className="pb-4">
          <CardTitle className="text-base uppercase tracking-tight text-foreground/80">Cấu hình Cấp phép</CardTitle>
          <CardDescription>Ghi đè thủ công Gói và Giới hạn (Force Override)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Gói đăng ký</label>
              <Select value={formPlanId} onValueChange={(v) => setFormPlanId(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="scale">Scale</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Chu kỳ</label>
              <Select value={formBillingCycle} onValueChange={(v) => setFormBillingCycle(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Theo tháng</SelectItem>
                  <SelectItem value="yearly">Theo năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Limit Profiles</label>
              <Input type="number" min="1" value={formProfileLimit} onChange={(e) => setFormProfileLimit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Limit Members</label>
              <Input type="number" min="1" value={formMemberLimit} onChange={(e) => setFormMemberLimit(e.target.value)} />
            </div>
            
             <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium">Buộc hết hạn (Expires At)</label>
              <Input type="datetime-local" value={formExpiresAt} onChange={(e) => setFormExpiresAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">Bỏ trống nếu không muốn ép hạn sử dụng.</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t py-3 justify-end">
          <Button onClick={handleSave} disabled={saving} variant="default">
            {saving ? "Đang xử lý..." : "Lưu Override Gói"}
          </Button>
        </CardFooter>
      </Card>

      <div className="flex flex-col gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base uppercase tracking-tight text-foreground/80">Lịch sử Hóa đơn</CardTitle>
            <CardDescription>{billing.recentInvoices.length} hóa đơn gần nhất</CardDescription>
          </CardHeader>
          <CardContent>
            {billing.recentInvoices.length > 0 ? (
              <div className="space-y-3">
                {billing.recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between items-center text-sm p-3 border rounded-md">
                    <div>
                      <div className="font-semibold">{inv.planLabel}</div>
                      <div className="text-muted-foreground text-xs">{inv.id}</div>
                    </div>
                    <AdminPlanBadge planId={inv.planId} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground bg-muted/20 border border-dashed rounded-md">
                Chưa có hóa đơn nào.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
