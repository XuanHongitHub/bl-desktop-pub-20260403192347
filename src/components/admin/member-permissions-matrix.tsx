"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, LayoutGrid, KeyRound, MonitorSmartphone, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ControlMembership, ControlShareGrant } from "@/types";

interface ResourceItem {
  id: string;
  name: string;
  type: "profile" | "group";
}

interface MemberPermissionsMatrixProps {
  memberships: ControlMembership[];
  shareGrants: ControlShareGrant[];
  availableResources: ResourceItem[]; // Profiles and groups available in workspace
  onToggleGrant: (userId: string, resourceId: string, resourceType: "profile" | "group", currentStatus: boolean) => void;
  isPlatformAdmin?: boolean;
}

export function MemberPermissionsMatrix({ 
  memberships, 
  shareGrants, 
  availableResources,
  onToggleGrant 
}: MemberPermissionsMatrixProps) {
  const [searchMember, setSearchMember] = useState("");
  const [searchResource, setSearchResource] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(memberships[0]?.userId ?? null);
  const [resourceFilter, setResourceFilter] = useState<"all" | "group" | "profile">("all");

  const activeMember = memberships.find(m => m.userId === selectedUserId);

  // Show all members including owners so admins can inspect any member's grants
  const manageableMembers = useMemo(() => {
    return memberships.filter(m => {
      if (!searchMember) return true;
      return m.email.toLowerCase().includes(searchMember.toLowerCase());
    });
  }, [memberships, searchMember]);

  const filteredResources = useMemo(() => {
    return availableResources.filter(r => {
      if (resourceFilter !== "all" && r.type !== resourceFilter) return false;
      if (!searchResource) return true;
      return r.name.toLowerCase().includes(searchResource.toLowerCase());
    });
  }, [availableResources, searchResource, resourceFilter]);

  const getUserShareStatus = (userId: string, resourceId: string) => {
    // Ideally map by email for shareGrants since Backend uses recipient_email.
    const memberEmail = memberships.find(m => m.userId === userId)?.email;
    return shareGrants.some(
      g => g.recipientEmail === memberEmail && g.resourceId === resourceId && !g.revokedAt
    );
  };

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] w-full gap-4 overflow-hidden rounded-xl border border-border/70 bg-background/50 shadow-sm backdrop-blur-sm">
      
      {/* LEFT: MEMBER LIST */}
      <div className="flex w-[320px] flex-col border-r border-border/70 bg-card/30">
        <div className="border-b border-border/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Chọn Member (User)</span>
            <Badge variant="secondary" className="px-1.5 py-0">
              {manageableMembers.length}
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo email..."
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
              className="h-8 w-full bg-background/50 pl-8 text-xs"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {manageableMembers.map((member) => (
              <button
                key={member.userId}
                onClick={() => setSelectedUserId(member.userId)}
                className={cn(
                  "group relative flex w-full items-center justify-between rounded-md p-3 text-left transition-all duration-200",
                  selectedUserId === member.userId 
                    ? "bg-primary/10 border border-primary/20" 
                    : "border border-transparent hover:bg-muted/50"
                )}
              >
                <div className="flex items-start gap-3 overflow-hidden">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-inner">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 truncate">
                    <p className={cn(
                      "truncate text-sm font-medium",
                      selectedUserId === member.userId ? "text-primary" : "text-foreground"
                    )}>
                      {member.email}
                    </p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {member.role}
                    </p>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "h-4 w-4 shrink-0 transition-transform", 
                  selectedUserId === member.userId ? "text-primary opacity-100" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                )} />
              </button>
            ))}
            
            {manageableMembers.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Không tìm thấy member nào
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT: RESOURCE MATRIX */}
      <div className="flex flex-1 flex-col bg-background/50">
        {activeMember ? (
          <>
            <div className="border-b border-border/60 p-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Phân quyền vùng dữ liệu
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Bật/tắt các Profile và Group mà <span className="font-semibold text-foreground">{activeMember.email}</span> được phép truy cập.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <Tabs value={resourceFilter} onValueChange={(v) => setResourceFilter(v as any)} className="w-[300px]">
                  <TabsList className="grid w-full grid-cols-3 h-8">
                    <TabsTrigger value="all" className="text-xs">Tất cả</TabsTrigger>
                    <TabsTrigger value="group" className="text-xs">Chỉ Group</TabsTrigger>
                    <TabsTrigger value="profile" className="text-xs">Chỉ Profile</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm tên resource..."
                    value={searchResource}
                    onChange={(e) => setSearchResource(e.target.value)}
                    className="h-8 w-full bg-background/50 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-6">
              <div className="mx-auto max-w-4xl grid gap-3 sm:grid-cols-2 xl:grid-cols-3 pb-10">
                <AnimatePresence mode="popLayout">
                  {filteredResources.map((resource) => {
                    const isGranted = getUserShareStatus(activeMember.userId, resource.id);
                    
                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        key={resource.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors",
                          isGranted 
                            ? "border-primary/40 bg-primary/[0.02]" 
                            : "border-border/60 bg-card/30"
                        )}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                            resource.type === "group" 
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-500" 
                              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                          )}>
                            {resource.type === "group" ? <LayoutGrid className="h-4 w-4" /> : <MonitorSmartphone className="h-4 w-4" />}
                          </div>
                          
                          <div className="truncate">
                            <p className="truncate text-sm font-medium text-foreground">
                              {resource.name}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {resource.type}
                            </p>
                          </div>
                        </div>

                        <Switch
                          checked={isGranted}
                          onCheckedChange={() => onToggleGrant(activeMember.userId, resource.id, resource.type, isGranted)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                
                {filteredResources.length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    <KeyRound className="mx-auto mb-3 h-8 w-8 opacity-20" />
                    <p>Không có vùng dữ liệu nào khớp với bộ lọc.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Users className="mb-4 h-12 w-12 opacity-20" />
            <p>Chọn một thành viên từ danh sách để phân quyền</p>
          </div>
        )}
      </div>
    </div>
  );
}
