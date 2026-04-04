"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  MonitorSmartphone,
  LayoutGrid,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ControlMembership, ControlShareGrant } from "@/types";

interface ResourceItem {
  id: string;
  name: string;
  type: "profile" | "group";
}

export interface MemberPermissionsMatrixProps {
  memberships: ControlMembership[];
  shareGrants: ControlShareGrant[];
  availableResources: ResourceItem[];
  onBulkManage: (
    userIds: string[],
    resources: { id: string; type: "profile" | "group" }[],
    action: "grant" | "revoke"
  ) => void;
  isPlatformAdmin?: boolean;
}

export function MemberPermissionsMatrix({
  memberships,
  shareGrants,
  availableResources,
  onBulkManage,
}: MemberPermissionsMatrixProps) {
  const [searchMember, setSearchMember] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Sheet states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetSearch, setSheetSearch] = useState("");
  const [sheetSelectedResources, setSheetSelectedResources] = useState<Set<string>>(new Set());
  const [sheetMode, setSheetMode] = useState<"grant" | "revoke">("grant");

  // Handle member table
  const manageableMembers = useMemo(() => {
    return memberships.filter((m) => {
      if (!searchMember) return true;
      return m.email.toLowerCase().includes(searchMember.toLowerCase());
    });
  }, [memberships, searchMember]);

  const toggleUserSelection = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedUserIds(next);
  };

  const toggleAllUsers = () => {
    if (selectedUserIds.size === manageableMembers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(manageableMembers.map((m) => m.userId)));
    }
  };

  const getResourceCount = (memberEmail: string, type: "profile" | "group") => {
    return shareGrants.filter(
      (g) => g.recipientEmail === memberEmail && g.resourceType === type && !g.revokedAt
    ).length;
  };

  // Sheet interactions
  const openSheet = (userIds: string[], mode: "grant" | "revoke") => {
    // If we only selected one user to manage, auto-select those they already have/don't have?
    // Actually simpler: just blank slate and let user select resources.
    setSheetSelectedResources(new Set());
    setSelectedUserIds(new Set(userIds));
    setSheetMode(mode);
    setIsSheetOpen(true);
  };

  const filteredResources = useMemo(() => {
    return availableResources.filter((r) => {
      if (!sheetSearch) return true;
      return r.name.toLowerCase().includes(sheetSearch.toLowerCase());
    });
  }, [availableResources, sheetSearch]);

  const toggleResourceSelection = (resId: string) => {
    const next = new Set(sheetSelectedResources);
    if (next.has(resId)) next.delete(resId);
    else next.add(resId);
    setSheetSelectedResources(next);
  };

  const toggleAllResources = () => {
    if (sheetSelectedResources.size === filteredResources.length) {
      setSheetSelectedResources(new Set());
    } else {
      setSheetSelectedResources(new Set(filteredResources.map((r) => r.id)));
    }
  };

  const handleApplyBulk = () => {
    const userIds = Array.from(selectedUserIds);
    const resources = Array.from(sheetSelectedResources).map((id) => {
      const res = availableResources.find((r) => r.id === id);
      return { id, type: res!.type };
    });
    
    if (userIds.length > 0 && resources.length > 0) {
      onBulkManage(userIds, resources, sheetMode);
    }
    
    setIsSheetOpen(false);
    setSelectedUserIds(new Set());
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-border/70 bg-card p-3">
        <div className="flex items-center gap-2">
          <div className="relative w-[280px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm user..."
              className="pl-8 h-9"
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="h-6">
            {manageableMembers.length} thành viên
          </Badge>
        </div>

        {selectedUserIds.size > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
            <span className="text-sm font-medium text-foreground px-2">
              Đã chọn {selectedUserIds.size}
            </span>
            <Button
              size="sm"
              variant="default"
              onClick={() => openSheet(Array.from(selectedUserIds), "grant")}
            >
              Cấp quyền Hàng loạt
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => openSheet(Array.from(selectedUserIds), "revoke")}
            >
              Gỡ quyền Hàng loạt
            </Button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="rounded-md border border-border/70 bg-card shadow-sm">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader className="bg-muted/30 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[50px] text-center">
                  <Checkbox
                    checked={
                      manageableMembers.length > 0 &&
                      selectedUserIds.size === manageableMembers.length
                    }
                    onCheckedChange={toggleAllUsers}
                  />
                </TableHead>
                <TableHead>User / Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead className="text-center">Profile đã gán</TableHead>
                <TableHead className="text-center">Group đã gán</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manageableMembers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Không tìm thấy thành viên.
                  </TableCell>
                </TableRow>
              ) : (
                manageableMembers.map((member) => (
                  <TableRow
                    key={member.userId}
                    data-state={selectedUserIds.has(member.userId) ? "selected" : undefined}
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedUserIds.has(member.userId)}
                        onCheckedChange={() => toggleUserSelection(member.userId)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {member.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="px-2 font-mono">
                        {getResourceCount(member.email, "profile")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="px-2 font-mono text-blue-500">
                        {getResourceCount(member.email, "group")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openSheet([member.userId], "grant")}
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        Quản lý...
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Sheet / Drawer for choosing multiple resources */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-[480px] sm:max-w-md flex flex-col p-0 h-full">
          <SheetHeader className="p-6 pb-4 border-b border-border/70">
            <SheetTitle className="flex items-center gap-2">
              {sheetMode === "grant" ? "Cấp quyền truy cập" : "Gỡ quyền truy cập"}
              {sheetMode === "revoke" && <ShieldAlert className="h-4 w-4 text-destructive" />}
            </SheetTitle>
            <SheetDescription>
              {(sheetMode === "grant" ? "Chỉ định" : "Thu hồi")} quyền trên các Profile/Group dưới đây cho{" "}
              <strong className="text-foreground">{selectedUserIds.size} thành viên</strong>.
            </SheetDescription>
          </SheetHeader>

          <div className="px-6 py-3 border-b border-border/70">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm Profile hoặc Group..."
                className="pl-8"
                value={sheetSearch}
                onChange={(e) => setSheetSearch(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="flex-1 px-6">
            <div className="py-2 flex flex-col gap-2">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer rounded-md hover:bg-muted/50 border border-transparent"
                onClick={toggleAllResources}
              >
                <Checkbox
                  checked={
                    filteredResources.length > 0 &&
                    sheetSelectedResources.size === filteredResources.length
                  }
                />
                <span className="text-sm font-semibold">Chọn tất cả hiện thị ({filteredResources.length})</span>
              </div>
              
              {filteredResources.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-md mt-4">
                  Trống.
                </div>
              ) : (
                filteredResources.map((res) => (
                  <label
                    key={res.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md border border-border/70 bg-card hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Checkbox
                        checked={sheetSelectedResources.has(res.id)}
                        onCheckedChange={() => toggleResourceSelection(res.id)}
                      />
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          res.type === "group"
                            ? "bg-blue-500/10 border-blue-500/20 text-blue-500"
                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                        )}
                      >
                        {res.type === "group" ? (
                          <LayoutGrid className="h-4 w-4" />
                        ) : (
                          <MonitorSmartphone className="h-4 w-4" />
                        )}
                      </div>
                      <div className="truncate">
                        <p className="truncate text-sm font-medium text-foreground leading-tight">
                          {res.name}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                          {res.type}
                        </p>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>

          <SheetFooter className="p-6 border-t border-border/70 flex flex-col sm:flex-row sm:justify-between items-center sm:space-x-2 bg-muted/20">
            <div className="text-sm text-foreground mb-4 sm:mb-0 space-x-1">
              Đã chọn: <strong>{sheetSelectedResources.size}</strong> tài nguyên
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
                Hủy
              </Button>
              <Button
                variant={sheetMode === "grant" ? "default" : "destructive"}
                disabled={sheetSelectedResources.size === 0}
                onClick={handleApplyBulk}
              >
                {sheetMode === "grant" ? "Lưu cấp quyền" : "Xác nhận gỡ"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
