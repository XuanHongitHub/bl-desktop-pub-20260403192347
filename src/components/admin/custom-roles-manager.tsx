"use client";

import { motion } from "framer-motion";
import { Key, Plus, Settings2, Shield, Trash2, Users } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type PermissionCategory = "general" | "profiles" | "billing" | "team";

export interface RoleCapability {
  id: string;
  label: string;
  description: string;
  category: PermissionCategory;
}

export const AVAILABLE_CAPABILITIES: RoleCapability[] = [
  {
    id: "manage_settings",
    label: "Quản lý cài đặt Workspace",
    description: "Sửa đổi tên, thông tin và cấu hình chung",
    category: "general",
  },
  {
    id: "create_profile",
    label: "Tạo Profile & Nhóm",
    description: "Cho phép tạo mới các trình duyệt và nhóm",
    category: "profiles",
  },
  {
    id: "edit_profile",
    label: "Chỉnh sửa Profile",
    description: "Sửa tên, gắn thẻ và thay đổi cấu hình kỹ thuật",
    category: "profiles",
  },
  {
    id: "delete_profile",
    label: "Xóa Profile",
    description: "Cho phép xóa vĩnh viễn trình duyệt",
    category: "profiles",
  },
  {
    id: "manage_proxy",
    label: "Quản lý Proxy",
    description: "Mua mới, cập nhật hoặc gỡ proxy",
    category: "profiles",
  },
  {
    id: "manage_billing",
    label: "Quản lý Thanh toán",
    description: "Nâng cấp gói, xem hóa đơn, cấn trừ ví",
    category: "billing",
  },
  {
    id: "invite_members",
    label: "Mời & Quản lý nhân sự",
    description: "Gửi invite mới vào Workspace",
    category: "team",
  },
  {
    id: "remove_members",
    label: "Xóa thành viên",
    description: "Hủy tư cách thành viên của người khác",
    category: "team",
  },
  {
    id: "manage_roles",
    label: "Quản trị Vai trò (Roles)",
    description: "Tạo, sửa bộ quyền tùy chỉnh",
    category: "team",
  },
];

export interface CustomRoleDefinition {
  id: string;
  name: string;
  isSystem?: boolean;
  capabilities: string[];
}

interface CustomRolesManagerProps {
  roles: CustomRoleDefinition[];
  onAddRole: (name: string) => void;
  onUpdateRole: (id: string, updates: Partial<CustomRoleDefinition>) => void;
  onDeleteRole: (id: string) => void;
  isPlatformAdmin?: boolean;
  viewMode?: "workspace" | "superadmin";
}

const CATEGORY_MAP: Record<
  PermissionCategory,
  { label: string; icon: React.ElementType }
> = {
  general: { label: "Cấu hình chung", icon: Settings2 },
  profiles: { label: "Dữ liệu Trình duyệt", icon: Key },
  team: { label: "Nhân sự & Phân quyền", icon: Users },
  billing: { label: "Thanh toán", icon: Shield }, // Or standard icons
};

export function CustomRolesManager({
  roles,
  onAddRole,
  onUpdateRole,
  onDeleteRole,
  isPlatformAdmin,
  viewMode = "workspace",
}: CustomRolesManagerProps) {
  const { t } = useTranslation();
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    roles[0]?.id ?? "",
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const activeRole = roles.find((r) => r.id === selectedRoleId);

  const handleToggleCapability = (capabilityId: string) => {
    if (!activeRole || activeRole.isSystem) return;

    // Admin checking or owner checking applied up the chain, we just trigger UI state
    const current = new Set(activeRole.capabilities);
    if (current.has(capabilityId)) {
      current.delete(capabilityId);
    } else {
      current.add(capabilityId);
    }

    onUpdateRole(activeRole.id, { capabilities: Array.from(current) });
  };

  const handleConfirmCreate = () => {
    if (!newRoleName.trim()) return;
    onAddRole(newRoleName.trim());
    setNewRoleName("");
    setIsCreating(false);
  };

  // Group capabilities
  const groupedCaps = AVAILABLE_CAPABILITIES.reduce(
    (acc, cap) => {
      if (!acc[cap.category]) acc[cap.category] = [];
      acc[cap.category].push(cap);
      return acc;
    },
    {} as Record<PermissionCategory, RoleCapability[]>,
  );

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] w-full gap-4 overflow-hidden rounded-xl border border-border/70 bg-background/50 shadow-sm backdrop-blur-sm">
      {/* LEFT SIDEBAR: ROLE LIST */}
      <div className="flex w-[260px] flex-col border-r border-border/70 bg-card/30">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <span className="text-sm font-semibold text-foreground">
            Vai trò hệ thống
          </span>
          {viewMode === "superadmin" && (
            <Badge variant="default" className="scale-90 text-[10px]">
              Super Admin
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={cn(
                  "group relative flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-all duration-200",
                  selectedRoleId === role.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Shield
                    className={cn(
                      "h-4 w-4",
                      role.isSystem ? "opacity-70" : "text-primary/70",
                    )}
                  />
                  <span className="truncate">{role.name}</span>
                </div>

                {role.isSystem && (
                  <Badge
                    variant="outline"
                    className="scale-75 px-1 py-0 border-primary/20 text-primary"
                  >
                    System
                  </Badge>
                )}
              </button>
            ))}

            {isCreating ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-2 space-y-2 rounded-md border border-border/70 bg-muted/30 p-2"
              >
                <Input
                  autoFocus
                  placeholder="Tên vai trò mới..."
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setIsCreating(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={handleConfirmCreate}
                  >
                    Tạo
                  </Button>
                </div>
              </motion.div>
            ) : (
              <Button
                variant="ghost"
                className="mt-2 w-full justify-start gap-2 border border-dashed border-border/70 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm vai trò Custom
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT SIDEBAR: CAPABILITY MATRIX */}
      <div className="flex flex-1 flex-col bg-background/50">
        {activeRole ? (
          <>
            <div className="flex items-end justify-between border-b border-border/60 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  {activeRole.name}
                  {activeRole.isSystem && (
                    <Badge variant="secondary" className="font-normal">
                      Mặc định hệ thống
                    </Badge>
                  )}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeRole.isSystem
                    ? "Đây là vai trò mặc định của hệ thống, không thể chỉnh sửa các quyền cốt lõi."
                    : "Cấp phát các quyền hạn truy cập tương ứng cho vai trò này."}
                </p>
              </div>

              {!activeRole.isSystem && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={() => onDeleteRole(activeRole.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa vai trò
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 p-6">
              <div className="mx-auto max-w-3xl space-y-8 pb-10">
                {(Object.keys(groupedCaps) as PermissionCategory[]).map(
                  (category) => {
                    const items = groupedCaps[category];
                    const CatIcon = CATEGORY_MAP[category].icon;

                    return (
                      <motion.div
                        key={category}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                          <CatIcon className="h-4 w-4" />
                          {CATEGORY_MAP[category].label}
                        </h3>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {items.map((cap) => {
                            const isEnabled = activeRole.capabilities.includes(
                              cap.id,
                            );

                            return (
                              <div
                                key={cap.id}
                                className={cn(
                                  "flex items-start justify-between gap-4 rounded-xl border p-4 transition-all duration-200",
                                  isEnabled
                                    ? "border-primary/40 bg-primary/[0.02] shadow-sm"
                                    : "border-border/60 bg-card/30 hover:border-border",
                                  activeRole.isSystem && "opacity-80",
                                )}
                              >
                                <div className="space-y-1 leading-none">
                                  <p
                                    className={cn(
                                      "text-sm font-medium",
                                      isEnabled
                                        ? "text-foreground"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {cap.label}
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {cap.description}
                                  </p>
                                </div>

                                <Switch
                                  disabled={activeRole.isSystem}
                                  checked={isEnabled}
                                  onCheckedChange={() =>
                                    handleToggleCapability(cap.id)
                                  }
                                  className={cn(
                                    "data-[state=checked]:bg-primary",
                                    activeRole.isSystem &&
                                      "cursor-not-allowed opacity-50",
                                  )}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  },
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Shield className="mb-4 h-12 w-12 opacity-20" />
            <p>Chọn một vai trò từ danh sách để xem cấp quyền</p>
          </div>
        )}
      </div>
    </div>
  );
}
