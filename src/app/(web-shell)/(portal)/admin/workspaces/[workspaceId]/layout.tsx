"use client";

import { useTranslation } from "react-i18next";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { useEffect, useState } from "react";
import { getAdminWorkspaceDetail } from "@/components/web-billing/control-api";
import type { ControlAdminWorkspaceDetail } from "@/types";
import { PageLoader } from "@/components/ui/page-loader";

export default function AdminWorkspaceDetailLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const params = useParams();
  const pathname = usePathname();
  const workspaceId = decodeURIComponent(params.workspaceId as string);
  const { connection } = usePortalBillingData();
  const [detail, setDetail] = useState<ControlAdminWorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!connection) return;
    setLoading(true);
    getAdminWorkspaceDetail(connection, workspaceId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [connection, workspaceId]);

  const getTabValue = () => {
    if (pathname.endsWith("/members")) return "members";
    if (pathname.endsWith("/billing")) return "billing";
    return "overview";
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={detail ? `Chi tiết: ${detail.workspaceName}` : `Workspace ID: ${workspaceId}`}
      description="Quản trị cấu hình, thành viên và phân quyền Workspace."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/workspaces">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Trở về
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col space-y-6">
        <Tabs value={getTabValue()} className="w-full max-w-[1120px] mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" asChild>
              <Link href={`/admin/workspaces/${encodeURIComponent(workspaceId)}`}>Tổng quan</Link>
            </TabsTrigger>
            <TabsTrigger value="members" asChild>
              <Link href={`/admin/workspaces/${encodeURIComponent(workspaceId)}/members`}>Thành viên</Link>
            </TabsTrigger>
            <TabsTrigger value="billing" asChild>
              <Link href={`/admin/workspaces/${encodeURIComponent(workspaceId)}/billing`}>Gói & Cước phí</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="w-full max-w-[1120px] mx-auto">
          {loading ? <PageLoader /> : children}
        </div>
      </div>
    </PortalSettingsPage>
  );
}
