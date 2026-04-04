"use client";

import {
  AlertCircle,
  LockKeyhole,
  PowerOff,
  RefreshCw,
  Server,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminCommandCenterPage() {
  const [isBusy, setIsBusy] = useState(false);

  const mockAction = (actionName: string) => {
    setIsBusy(true);
    setTimeout(() => {
      setIsBusy(false);
      console.log(`Executed: ${actionName}`);
    }, 1000);
  };

  return (
    <PortalSettingsPage
      eyebrow="Quản trị Hệ thống"
      title="Command Center"
      description="Trung tâm điều khiển các hoạt động bảo trì, bảo mật, và cấu hình lõi của hệ thống nội bộ."
    >
      <div className="space-y-6">
        <Alert
          variant="destructive"
          className="bg-destructive/10 border-destructive/20 text-destructive"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-semibold tracking-tight">
            Khu vực Nguy hiểm
          </AlertTitle>
          <AlertDescription>
            Tất cả các hành động ở đây tác động trực tiếp lên toàn bộ hệ thống
            (Global Scope). Vui lòng cẩn trọng.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-2">
          {/* System Control */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                Kiểm soát Hệ thống
              </CardTitle>
              <CardDescription>
                Bật/tắt các luồng hoạt động chính
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 bg-muted/20">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    Chế độ Bảo trì{" "}
                    <Badge
                      variant="secondary"
                      className="px-1.5 h-5 text-[10px] font-mono"
                    >
                      MAINTENANCE
                    </Badge>
                  </span>
                  <p className="text-xs text-muted-foreground mr-6">
                    Chặn mọi truy cập vào App, chỉ Admin được phép đăng nhập.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mockAction("maintenance")}
                  disabled={isBusy}
                >
                  <LockKeyhole className="h-4 w-4 mr-2" />
                  Kích hoạt
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 bg-muted/20">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    Khởi động lại Worker{" "}
                    <Badge
                      variant="outline"
                      className="px-1.5 h-5 text-[10px] bg-blue-500/10 text-blue-500 font-mono"
                    >
                      ASYNC QUEUE
                    </Badge>
                  </span>
                  <p className="text-xs text-muted-foreground mr-6">
                    Tái khởi động các luồng background sync và queue workers.
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => mockAction("restart-workers")}
                  disabled={isBusy}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restart
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Identity & Session Control */}
          <Card className="border-border/70 shadow-sm border-destructive/20">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-4 w-4" />
                Phiên làm việc & Bảo mật
              </CardTitle>
              <CardDescription>
                Quản lý rủi ro và các phiên đăng nhập
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 bg-muted/20">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    Đăng xuất Hàng loạt
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Buộc tất cả user (trừ bạn) thoát phiên làm việc ngay lập
                    tức.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => mockAction("force-logout")}
                  disabled={isBusy}
                >
                  <PowerOff className="h-4 w-4 mr-2" />
                  Buộc Exit
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 bg-muted/20">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    Xóa Cache & Session Rác
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Dọn dẹp Redis cache và các session đã hết hạn trong DB.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mockAction("clear-cache")}
                  disabled={isBusy}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Cache
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalSettingsPage>
  );
}
