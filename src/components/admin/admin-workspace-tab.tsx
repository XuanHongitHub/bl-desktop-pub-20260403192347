"use client";

import {
  Building2,
  CalendarDays,
  Link,
  PlusCircle,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  Users,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatLocaleDate } from "@/lib/locale-format";
import { cn } from "@/lib/utils";
import type {
  ControlInvite,
  ControlMembership,
  ControlShareGrant,
  ControlWorkspace,
  ControlWorkspaceOverview,
  TeamRole,
} from "@/types";

interface AdminWorkspaceTabProps {
  isBusy: boolean;
  runtimeBaseUrl: string | null;
  isPlatformAdmin: boolean;
  isTeamOperator: boolean;
  workspaces: ControlWorkspace[];
  selectedWorkspaceId: string | null;
  selectedWorkspace: ControlWorkspace | null;
  overview: ControlWorkspaceOverview | null;
  memberships: ControlMembership[];
  invites: ControlInvite[];
  shareGrants: ControlShareGrant[];
  workspaceName: string;
  setWorkspaceName: (name: string) => void;
  workspaceMode: "personal" | "team";
  setWorkspaceMode: (mode: "personal" | "team") => void;
  inviteEmail: string;
  setInviteEmail: (email: string) => void;
  inviteRole: TeamRole;
  setInviteRole: (role: TeamRole) => void;
  shareResourceType: "profile" | "group";
  setShareResourceType: (type: "profile" | "group") => void;
  shareResourceId: string;
  setShareResourceId: (id: string) => void;
  shareRecipientEmail: string;
  setShareRecipientEmail: (email: string) => void;
  handleCreateWorkspace: () => void;
  setSelectedWorkspaceId: (id: string | null) => void;
  handleCreateInvite: () => void;
  handleRevokeInvite: (id: string) => void;
  membershipRoleDrafts: Record<string, TeamRole>;
  setMembershipRoleDrafts: Dispatch<SetStateAction<Record<string, TeamRole>>>;
  handleUpdateRole: (id: string) => void;
  handleRemoveMember: (id: string) => void;
  handleCreateShare: () => void;
  handleRevokeShare: (id: string) => void;
  workspaceScopedOnly?: boolean;
  forcedFlow?: WorkspaceAdminFlow;
  showFlowTabs?: boolean;
}

export type WorkspaceAdminFlow = "directory" | "permissions";

type PermissionKey =
  | "profiles_manage"
  | "profiles_delete"
  | "network_manage"
  | "integrations_manage"
  | "members_invite"
  | "members_role"
  | "share_manage"
  | "billing_manage";

type RolePermissionDrafts = Record<TeamRole, Record<PermissionKey, boolean>>;

const PERMISSION_KEYS: PermissionKey[] = [
  "profiles_manage",
  "profiles_delete",
  "network_manage",
  "integrations_manage",
  "members_invite",
  "members_role",
  "share_manage",
  "billing_manage",
];

const DEFAULT_ROLE_PERMISSION_DRAFTS: RolePermissionDrafts = {
  owner: {
    profiles_manage: true,
    profiles_delete: true,
    network_manage: true,
    integrations_manage: true,
    members_invite: true,
    members_role: true,
    share_manage: true,
    billing_manage: true,
  },
  admin: {
    profiles_manage: true,
    profiles_delete: true,
    network_manage: true,
    integrations_manage: true,
    members_invite: true,
    members_role: true,
    share_manage: true,
    billing_manage: false,
  },
  member: {
    profiles_manage: true,
    profiles_delete: false,
    network_manage: false,
    integrations_manage: false,
    members_invite: false,
    members_role: false,
    share_manage: false,
    billing_manage: false,
  },
  viewer: {
    profiles_manage: false,
    profiles_delete: false,
    network_manage: false,
    integrations_manage: false,
    members_invite: false,
    members_role: false,
    share_manage: false,
    billing_manage: false,
  },
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatLocaleDate(date);
}

export function AdminWorkspaceTab(props: AdminWorkspaceTabProps) {
  const { t } = useTranslation();
  const [internalFlow, setInternalFlow] = useState<WorkspaceAdminFlow>(
    props.forcedFlow ?? "directory",
  );
  const activeFlow = props.forcedFlow ?? internalFlow;
  const showFlowTabs = props.showFlowTabs ?? true;
  const workspaceScopedOnly = props.workspaceScopedOnly ?? false;
  const showGovernanceFlows = workspaceScopedOnly;
  const showWorkspaceFlowTabs = showGovernanceFlows && showFlowTabs;
  const [rolePermissionDrafts, setRolePermissionDrafts] =
    useState<RolePermissionDrafts>(DEFAULT_ROLE_PERMISSION_DRAFTS);
  const [selectedPolicyRole, setSelectedPolicyRole] =
    useState<TeamRole>("member");

  const {
    isBusy,
    memberships,
    invites,
    shareGrants,
    overview,
    isPlatformAdmin,
    isTeamOperator,
    selectedWorkspace,
  } = props;
  const isLocalMode = !props.runtimeBaseUrl;
  const canManageWorkspace = isPlatformAdmin || isTeamOperator;
  const isActionDisabled = isBusy || !canManageWorkspace;

  useEffect(() => {
    if (!props.forcedFlow) {
      return;
    }
    setInternalFlow(props.forcedFlow);
  }, [props.forcedFlow]);

  const activeInvites = useMemo(
    () => invites.filter((invite) => !invite.consumedAt).length,
    [invites],
  );
  const activeShares = useMemo(
    () => shareGrants.filter((shareGrant) => !shareGrant.revokedAt).length,
    [shareGrants],
  );
  const ownerCount = useMemo(
    () => memberships.filter((member) => member.role === "owner").length,
    [memberships],
  );

  const sortedInvites = useMemo(
    () =>
      [...invites].sort((left, right) => {
        const leftPending = left.consumedAt ? 1 : 0;
        const rightPending = right.consumedAt ? 1 : 0;
        if (leftPending !== rightPending) {
          return leftPending - rightPending;
        }
        return right.createdAt.localeCompare(left.createdAt);
      }),
    [invites],
  );

  const sortedShareGrants = useMemo(
    () =>
      [...shareGrants].sort((left, right) => {
        const leftRevoked = left.revokedAt ? 1 : 0;
        const rightRevoked = right.revokedAt ? 1 : 0;
        if (leftRevoked !== rightRevoked) {
          return leftRevoked - rightRevoked;
        }
        return right.createdAt.localeCompare(left.createdAt);
      }),
    [shareGrants],
  );

  const entitlementLabel = useMemo(() => {
    if (!overview) {
      return t("adminWorkspace.status.unknown");
    }
    if (overview.entitlementState === "read_only") {
      return t("adminWorkspace.status.entitlementReadOnly");
    }
    if (overview.entitlementState === "grace_active") {
      return t("adminWorkspace.status.entitlementGrace");
    }
    return t("adminWorkspace.status.entitlementActive");
  }, [overview, t]);

  const scopeLabel = isPlatformAdmin
    ? t("adminWorkspace.ui.scopePlatform")
    : isTeamOperator
      ? t("adminWorkspace.ui.scopeTeam")
      : t("adminWorkspace.ui.scopeReadOnly");
  const workspaceOpsTitle = workspaceScopedOnly
    ? t("adminWorkspace.ui.workspaceOpsTitle")
    : t("adminWorkspace.ui.workspaceDirectoryTitle");
  const workspaceOpsDescription = workspaceScopedOnly
    ? t("adminWorkspace.ui.workspaceOpsDescription")
    : t("adminWorkspace.ui.workspaceDirectoryOpsDescription");

  const selectedWorkspacePlanLabel =
    selectedWorkspace?.planLabel &&
    selectedWorkspace.planLabel.trim().length > 0
      ? selectedWorkspace.planLabel
      : t("adminWorkspace.ui.noPlanLabel");

  const selectedRolePermissions = rolePermissionDrafts[selectedPolicyRole];

  const toggleRolePermission = (
    permissionKey: PermissionKey,
    enabled: boolean,
  ) => {
    if (selectedPolicyRole === "owner") {
      return;
    }
    setRolePermissionDrafts((current) => ({
      ...current,
      [selectedPolicyRole]: {
        ...current[selectedPolicyRole],
        [permissionKey]: enabled,
      },
    }));
  };

  const renderWorkspaceSnapshotPanel = () => (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/70 bg-background p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              {t("adminWorkspace.ui.selectedWorkspaceTitle")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.selectedWorkspaceDescription")}
            </p>
          </div>
          <Badge variant="secondary" className="h-6 px-2.5 text-[11px]">
            {selectedWorkspace
              ? t(
                  selectedWorkspace.mode === "team"
                    ? "adminWorkspace.controlPlane.modeTeam"
                    : "adminWorkspace.controlPlane.modePersonal",
                )
              : t("adminWorkspace.ui.notSelected")}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.currentWorkspace")}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-foreground">
              {selectedWorkspace?.name ??
                t("adminWorkspace.controlPlane.noWorkspaceSelected")}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.workspaceId")}
            </p>
            <p className="mt-0.5 truncate font-mono text-[12px] text-foreground">
              {selectedWorkspace?.id ?? "-"}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.createdAt")}
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-foreground">
              {selectedWorkspace
                ? formatDate(selectedWorkspace.createdAt)
                : "-"}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.createdBy")}
            </p>
            <p className="mt-0.5 truncate font-mono text-[12px] text-foreground">
              {selectedWorkspace?.createdBy ?? "-"}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.planLabel")}
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-foreground">
              {selectedWorkspacePlanLabel}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.snapshotEntitlement")}
            </p>
            <Badge variant="secondary" className="mt-1 text-[11px]">
              {entitlementLabel}
            </Badge>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-2 md:grid-cols-2",
          workspaceScopedOnly ? "xl:grid-cols-3" : "xl:grid-cols-4",
        )}
      >
        {!workspaceScopedOnly && (
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.metrics.workspaces")}
            </p>
            <p className="mt-0.5 text-[16px] font-semibold text-foreground">
              {props.workspaces.length}
            </p>
          </div>
        )}
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {t("adminWorkspace.metrics.members")}
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-foreground">
            {memberships.length}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {t("adminWorkspace.metrics.invites")}
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-foreground">
            {activeInvites}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {t("adminWorkspace.share.title")}
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-foreground">
            {activeShares}
          </p>
        </div>
      </div>
    </div>
  );

  const renderWorkspaceDirectoryFlow = () => {
    if (workspaceScopedOnly) {
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
            {t("adminWorkspace.ui.workspaceScopedModeHint")}
          </div>
          {renderWorkspaceSnapshotPanel()}
        </div>
      );
    }
    return (
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-background p-3">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-foreground">
                  {t("adminWorkspace.controlPlane.workspaceList")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.ui.workspaceDirectoryDescription")}
                </p>
              </div>
              <Badge variant="outline" className="h-5 px-2 text-[10px]">
                {t("adminWorkspace.controlPlane.workspaceCount", {
                  count: props.workspaces.length,
                })}
              </Badge>
            </div>

            <ScrollArea className="h-[260px] pr-2">
              <div className="space-y-2">
                {props.workspaces.map((workspace) => {
                  const isSelected = workspace.id === props.selectedWorkspaceId;
                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      onClick={() => props.setSelectedWorkspaceId(workspace.id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/70 bg-background hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {workspace.name}
                        </p>
                        <Badge
                          variant="outline"
                          className="h-5 px-2 text-[10px]"
                        >
                          {t(
                            workspace.mode === "team"
                              ? "adminWorkspace.controlPlane.modeTeam"
                              : "adminWorkspace.controlPlane.modePersonal",
                          )}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{formatDate(workspace.createdAt)}</span>
                      </div>
                    </button>
                  );
                })}

                {props.workspaces.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border px-3 py-4 text-[12px] text-muted-foreground">
                    {t("adminWorkspace.controlPlane.noWorkspaceSelected")}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              {t("adminWorkspace.ui.quickCreateWorkspace")}
            </p>
            <Input
              value={props.workspaceName}
              onChange={(event) => props.setWorkspaceName(event.target.value)}
              placeholder={t(
                "adminWorkspace.controlPlane.workspaceNamePlaceholder",
              )}
              disabled={isActionDisabled}
              className="h-9 bg-background"
            />
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <Select
                value={props.workspaceMode}
                onValueChange={(value) =>
                  props.setWorkspaceMode(value as "personal" | "team")
                }
                disabled={isActionDisabled}
              >
                <SelectTrigger className="h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">
                    {t("adminWorkspace.controlPlane.modeTeam")}
                  </SelectItem>
                  <SelectItem value="personal">
                    {t("adminWorkspace.controlPlane.modePersonal")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={props.handleCreateWorkspace}
                disabled={isActionDisabled || !props.workspaceName.trim()}
                className="h-9"
              >
                <PlusCircle className="mr-1 h-4 w-4" />
                {t("adminWorkspace.controlPlane.createWorkspace")}
              </Button>
            </div>
            {!canManageWorkspace && (
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.ui.readOnlyHint")}
              </p>
            )}
          </div>
        </div>

        {renderWorkspaceSnapshotPanel()}
      </div>
    );
  };

  const renderMembersInvitesFlow = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/70 bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              {t("adminWorkspace.ui.memberAccessTitle")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.memberAccessDescription")}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="h-5 px-2 text-[10px]">
              {t("adminWorkspace.controlPlane.memberCount", {
                count: memberships.length,
              })}
            </Badge>
            <Badge variant="outline" className="h-5 px-2 text-[10px]">
              {t("adminWorkspace.controlPlane.inviteCount", {
                count: activeInvites,
              })}
            </Badge>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_140px]">
          <Input
            value={props.inviteEmail}
            onChange={(event) => props.setInviteEmail(event.target.value)}
            placeholder={t("adminWorkspace.members.inviteEmailPlaceholder")}
            disabled={isActionDisabled}
            className="h-9"
          />
          <Select
            value={props.inviteRole}
            onValueChange={(value) => props.setInviteRole(value as TeamRole)}
            disabled={isActionDisabled}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">
                {t("adminWorkspace.roles.member")}
              </SelectItem>
              <SelectItem value="viewer">
                {t("adminWorkspace.roles.viewer")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={props.handleCreateInvite}
            disabled={isActionDisabled || !props.inviteEmail.trim()}
            className="h-9"
          >
            {t("adminWorkspace.ui.sendInvite")}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("adminWorkspace.members.inviteRoleRestrictedHint")}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border/70 overflow-hidden bg-background">
          <div className="border-b border-border/70 bg-muted/20 px-3 py-2 text-[11px] font-medium text-muted-foreground">
            {t("adminWorkspace.ui.memberList")}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminWorkspace.columns.email")}</TableHead>
                <TableHead>{t("adminWorkspace.columns.role")}</TableHead>
                <TableHead>{t("adminWorkspace.columns.status")}</TableHead>
                <TableHead className="text-right">
                  {t("adminWorkspace.columns.action")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-muted-foreground"
                  >
                    {t("adminWorkspace.controlPlane.noMembers")}
                  </TableCell>
                </TableRow>
              ) : (
                memberships.map((membership) => (
                  <TableRow key={membership.userId}>
                    <TableCell className="font-medium">
                      {membership.email}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={
                          props.membershipRoleDrafts[membership.userId] ??
                          membership.role
                        }
                        onValueChange={(value) => {
                          props.setMembershipRoleDrafts((prev) => ({
                            ...prev,
                            [membership.userId]: value as TeamRole,
                          }));
                        }}
                        disabled={isActionDisabled}
                      >
                        <SelectTrigger className="h-8 w-[132px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">
                            {t("adminWorkspace.roles.owner")}
                          </SelectItem>
                          <SelectItem value="admin">
                            {t("adminWorkspace.roles.admin")}
                          </SelectItem>
                          <SelectItem value="member">
                            {t("adminWorkspace.roles.member")}
                          </SelectItem>
                          <SelectItem value="viewer">
                            {t("adminWorkspace.roles.viewer")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px]">
                        {t("adminWorkspace.ui.memberActive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            props.handleUpdateRole(membership.userId)
                          }
                          disabled={
                            isActionDisabled ||
                            props.membershipRoleDrafts[membership.userId] ===
                              membership.role ||
                            !props.membershipRoleDrafts[membership.userId]
                          }
                        >
                          <UserRoundCog className="h-3.5 w-3.5" />
                          {t("adminWorkspace.members.updateRole")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            props.handleRemoveMember(membership.userId)
                          }
                          disabled={isActionDisabled}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border border-border/70 overflow-hidden bg-background">
          <div className="border-b border-border/70 bg-muted/20 px-3 py-2 text-[11px] font-medium text-muted-foreground">
            {t("adminWorkspace.ui.inviteList")}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminWorkspace.columns.email")}</TableHead>
                <TableHead>{t("adminWorkspace.columns.role")}</TableHead>
                <TableHead>{t("adminWorkspace.columns.time")}</TableHead>
                <TableHead>{t("adminWorkspace.columns.status")}</TableHead>
                <TableHead className="text-right">
                  {t("adminWorkspace.columns.action")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedInvites.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-6 text-center text-muted-foreground"
                  >
                    {t("adminWorkspace.controlPlane.noInvites")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">
                      {invite.email}
                    </TableCell>
                    <TableCell>
                      {t(`adminWorkspace.roles.${invite.role}`)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span className="text-[12px]">
                          {formatDate(invite.expiresAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={invite.consumedAt ? "outline" : "secondary"}
                        className="text-[11px]"
                      >
                        {invite.consumedAt
                          ? t("adminWorkspace.members.inviteUsed")
                          : t("adminWorkspace.members.invitePending")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!invite.consumedAt && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => props.handleRevokeInvite(invite.id)}
                          disabled={isActionDisabled}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {!canManageWorkspace && (
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
          {t("adminWorkspace.ui.readOnlyHint")}
        </div>
      )}
    </div>
  );

  const renderRolePermissionFlow = () => (
    <div className="rounded-lg border border-border/70 bg-background">
      <div className="border-b border-border/70 px-4 py-3">
        <p className="text-[13px] font-semibold text-foreground">
          {t("adminWorkspace.ui.userPermissionTitle")}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("adminWorkspace.ui.userPermissionDescription")}
        </p>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {(["owner", "admin", "member", "viewer"] as TeamRole[]).map(
            (role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedPolicyRole(role)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  selectedPolicyRole === role
                    ? "border-primary/30 bg-primary/10 text-foreground"
                    : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`adminWorkspace.roles.${role}`)}
              </button>
            ),
          )}
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          {selectedPolicyRole === "owner"
            ? t("adminWorkspace.permissions.ownerLockedHint")
            : t("adminWorkspace.permissions.editorHint")}
        </div>

        <div className="space-y-2">
          {PERMISSION_KEYS.map((permissionKey) => (
            <div
              key={permissionKey}
              className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground">
                  {t(`adminWorkspace.permissions.items.${permissionKey}.title`)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    `adminWorkspace.permissions.items.${permissionKey}.description`,
                  )}
                </p>
              </div>
              <Switch
                checked={Boolean(selectedRolePermissions?.[permissionKey])}
                onCheckedChange={(checked) =>
                  toggleRolePermission(permissionKey, checked)
                }
                disabled={isActionDisabled || selectedPolicyRole === "owner"}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderUserPermissionFlow = () => (
    <div className="space-y-4">
      {renderRolePermissionFlow()}
      {renderMembersInvitesFlow()}
      {renderAccessPolicyFlow()}
    </div>
  );

  const renderAccessPolicyFlow = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <div className="rounded-lg border border-border/70 bg-background">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              {t("adminWorkspace.ui.shareControlTitle")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.shareDescription")}
            </p>
          </div>
          <Badge variant="outline" className="h-5 px-2 text-[10px]">
            {t("adminWorkspace.controlPlane.shareCount", {
              count: activeShares,
            })}
          </Badge>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid gap-2 md:grid-cols-[132px_minmax(0,1fr)_minmax(0,1fr)_140px]">
            <Select
              value={props.shareResourceType}
              onValueChange={(value) =>
                props.setShareResourceType(value as "profile" | "group")
              }
              disabled={isActionDisabled}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profile">
                  {t("adminWorkspace.share.resourceType.profile")}
                </SelectItem>
                <SelectItem value="group">
                  {t("adminWorkspace.share.resourceType.group")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={props.shareResourceId}
              onChange={(event) => props.setShareResourceId(event.target.value)}
              placeholder={t("adminWorkspace.share.resourceIdPlaceholder")}
              disabled={isActionDisabled}
              className="h-9"
            />
            <Input
              value={props.shareRecipientEmail}
              onChange={(event) =>
                props.setShareRecipientEmail(event.target.value)
              }
              placeholder={t("adminWorkspace.share.recipientPlaceholder")}
              disabled={isActionDisabled}
              className="h-9"
            />
            <Button
              onClick={props.handleCreateShare}
              disabled={
                isActionDisabled ||
                !props.shareResourceId.trim() ||
                !props.shareRecipientEmail.trim()
              }
              className="h-9"
            >
              <Link className="mr-1 h-4 w-4" />
              {t("adminWorkspace.ui.createShare")}
            </Button>
          </div>

          <div className="rounded-lg border border-border/70 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminWorkspace.columns.resource")}</TableHead>
                  <TableHead>{t("adminWorkspace.columns.recipient")}</TableHead>
                  <TableHead>{t("adminWorkspace.columns.access")}</TableHead>
                  <TableHead>{t("adminWorkspace.columns.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("adminWorkspace.columns.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedShareGrants.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center text-muted-foreground"
                    >
                      {t("adminWorkspace.share.none")}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedShareGrants.map((shareGrant) => (
                    <TableRow key={shareGrant.id}>
                      <TableCell className="font-medium">
                        <Badge variant="outline" className="mr-2 text-[10px]">
                          {shareGrant.resourceType}
                        </Badge>
                        {shareGrant.resourceId}
                      </TableCell>
                      <TableCell>{shareGrant.recipientEmail}</TableCell>
                      <TableCell>
                        {t(
                          `adminWorkspace.share.accessMode.${shareGrant.accessMode}`,
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            shareGrant.revokedAt ? "outline" : "secondary"
                          }
                          className="text-[11px]"
                        >
                          {shareGrant.revokedAt
                            ? t("adminWorkspace.share.revokedStatus")
                            : t("adminWorkspace.share.activeStatus")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!shareGrant.revokedAt && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              props.handleRevokeShare(shareGrant.id)
                            }
                            disabled={isActionDisabled}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
          <p className="text-[12px] font-semibold text-foreground">
            {t("adminWorkspace.ui.policyChecklistTitle")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("adminWorkspace.ui.policyChecklistDescription")}
          </p>
          <div className="mt-3 space-y-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">
                  {t(`adminWorkspace.ui.policyChecklistItem${item}`)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-background p-4">
          <p className="text-[12px] font-semibold text-foreground">
            {t("adminWorkspace.ui.policySnapshotTitle")}
          </p>
          <div className="mt-3 space-y-2">
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.roles.owner")}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-foreground">
                {ownerCount}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.metrics.members")}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-foreground">
                {memberships.length}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.share.title")}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-foreground">
                {activeShares}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFlowContent = (flow: WorkspaceAdminFlow) => {
    if (flow === "permissions") {
      return renderUserPermissionFlow();
    }
    return renderWorkspaceDirectoryFlow();
  };

  return (
    <div className="space-y-4">
      {isLocalMode && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
          {t("adminWorkspace.ui.localModeEnabled")}
        </div>
      )}

      <section className="rounded-xl border border-border/70 bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">
              {workspaceOpsTitle}
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {workspaceOpsDescription}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.currentWorkspace")}:{" "}
              <span className="font-medium text-foreground">
                {selectedWorkspace?.name ??
                  t("adminWorkspace.controlPlane.noWorkspaceSelected")}
              </span>
            </p>
          </div>
          <Badge
            variant="secondary"
            className="h-6 px-2.5 text-[11px] font-medium"
          >
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            {scopeLabel}
          </Badge>
        </div>

        {selectedWorkspace && (
          <div className="grid gap-2 border-b border-border/70 px-4 py-3 md:grid-cols-4">
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.ui.snapshotEntitlement")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="text-[11px]">
                  {entitlementLabel}
                </Badge>
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.ui.snapshotMembers")}
              </p>
              <p className="mt-0.5 text-[16px] font-semibold text-foreground">
                {overview?.members ?? memberships.length}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.ui.snapshotInvites")}
              </p>
              <p className="mt-0.5 text-[16px] font-semibold text-foreground">
                {overview?.activeInvites ?? activeInvites}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.ui.snapshotShares")}
              </p>
              <p className="mt-0.5 text-[16px] font-semibold text-foreground">
                {overview?.activeShareGrants ?? activeShares}
              </p>
            </div>
          </div>
        )}

        {showWorkspaceFlowTabs ? (
          <Tabs
            value={activeFlow}
            onValueChange={(value) =>
              setInternalFlow(value as WorkspaceAdminFlow)
            }
            className="w-full"
          >
            <div className="border-b border-border/70 px-4 py-3">
              <TabsList className="grid w-full max-w-[760px] grid-cols-2 bg-muted/30 p-1">
                <TabsTrigger value="directory" className="text-[12px]">
                  {t("shell.sections.workspaceAdminDirectory")}
                </TabsTrigger>
                <TabsTrigger value="permissions" className="text-[12px]">
                  {t("shell.sections.workspaceAdminPermissions")}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4">
              <TabsContent value="directory" className="mt-0">
                {renderWorkspaceDirectoryFlow()}
              </TabsContent>
              <TabsContent value="permissions" className="mt-0">
                {renderUserPermissionFlow()}
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="p-4">
            {showGovernanceFlows
              ? renderFlowContent(activeFlow)
              : renderWorkspaceDirectoryFlow()}
          </div>
        )}
      </section>

      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {t("adminWorkspace.roles.owner")}: {ownerCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {t("adminWorkspace.metrics.members")}: {memberships.length}
          </span>
          <span>
            {t("adminWorkspace.metrics.invites")}: {activeInvites}
          </span>
          <span>
            {t("adminWorkspace.share.title")}: {activeShares}
          </span>
        </div>
      </div>
    </div>
  );
}
