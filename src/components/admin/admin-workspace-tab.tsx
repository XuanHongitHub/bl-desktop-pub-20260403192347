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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePaginationControls } from "@/components/ui/table-pagination-controls";
import { formatLocaleDate } from "@/lib/locale-format";
import { getUnifiedPlanLabel } from "@/lib/plan-display";
import { cn } from "@/lib/utils";
import { CustomRolesManager, type CustomRoleDefinition } from "./custom-roles-manager";
import { MemberPermissionsMatrix } from "./member-permissions-matrix";
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
  workspaceRole?: TeamRole | null;
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
  workspacePlanId: "free" | "starter" | "team" | "scale" | "enterprise";
  setWorkspacePlanId: (
    planId: "free" | "starter" | "team" | "scale" | "enterprise",
  ) => void;
  workspaceBillingCycle: "monthly" | "yearly";
  setWorkspaceBillingCycle: (cycle: "monthly" | "yearly") => void;
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
  currentUserEmail?: string | null;
  currentUserId?: string | null;
  workspaceScopedOnly?: boolean;
  forcedFlow?: WorkspaceAdminFlow;
  showFlowTabs?: boolean;
}

export type WorkspaceAdminFlow =
  | "overview"
  | "directory"
  | "roles"
  | "permissions"
  | "plan";

type WorkspaceRoleOption = TeamRole;
type InviteFilterStatus = "all" | "pending" | "used";
type ShareFilterStatus = "all" | "active" | "revoked";

const ROLE_OPTION_TO_TEAM_ROLE: Record<WorkspaceRoleOption, TeamRole> = {
  owner: "owner",
  admin: "admin",
  member: "member",
  viewer: "viewer",
};

const TEAM_ROLE_TO_OPTION: Record<TeamRole, WorkspaceRoleOption> = {
  owner: "owner",
  admin: "admin",
  member: "member",
  viewer: "viewer",
};

const MEMBER_ROLE_OPTIONS: WorkspaceRoleOption[] = [
  "owner",
  "admin",
  "member",
  "viewer",
];

const INVITE_ROLE_OPTIONS: WorkspaceRoleOption[] = ["member", "viewer"];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatLocaleDate(date);
}

function resolveMembershipIdentity(membership: ControlMembership): string {
  const normalizedEmail = membership.email.trim().toLowerCase();
  if (!normalizedEmail) {
    return membership.userId;
  }
  if (normalizedEmail.endsWith("@local")) {
    return membership.userId;
  }
  if (normalizedEmail.includes("@")) {
    return membership.email;
  }
  return membership.userId;
}

export function AdminWorkspaceTab(props: AdminWorkspaceTabProps) {
  const { t } = useTranslation();

  const [internalFlow, setInternalFlow] = useState<WorkspaceAdminFlow>(
    props.forcedFlow ?? "directory",
  );

  const [inviteRoleOption, setInviteRoleOption] =
    useState<WorkspaceRoleOption>(TEAM_ROLE_TO_OPTION[props.inviteRole]);
  const [membershipRoleOptionDrafts, setMembershipRoleOptionDrafts] =
    useState<Record<string, WorkspaceRoleOption>>({});
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const [memberQuery, setMemberQuery] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState<"all" | TeamRole>(
    "all",
  );
  const [memberPageIndex, setMemberPageIndex] = useState(0);
  const [memberPageSize, setMemberPageSize] = useState(100);

  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteStatusFilter, setInviteStatusFilter] =
    useState<InviteFilterStatus>("all");
  const [invitePageIndex, setInvitePageIndex] = useState(0);
  const [invitePageSize, setInvitePageSize] = useState(100);

  const [shareQuery, setShareQuery] = useState("");
  const [shareStatusFilter, setShareStatusFilter] =
    useState<ShareFilterStatus>("all");
  const [sharePageIndex, setSharePageIndex] = useState(0);
  const [sharePageSize, setSharePageSize] = useState(100);

  const activeFlow = props.forcedFlow ?? internalFlow;
  const workspaceScopedOnly = props.workspaceScopedOnly ?? false;
  const showGovernanceFlows = workspaceScopedOnly;
  const showWorkspaceFlowTabs =
    showGovernanceFlows &&
    (props.showFlowTabs ?? true) &&
    props.forcedFlow == null;
  const normalizedCurrentUserEmail = props.currentUserEmail?.trim().toLowerCase() ?? "";
  const normalizedCurrentUserId = props.currentUserId?.trim() ?? "";

  const isLocalMode = !props.runtimeBaseUrl;
  const canManageWorkspace = props.isPlatformAdmin || props.isTeamOperator;
  const isWorkspaceOwner = props.workspaceRole === "owner";
  const isWorkspaceAdmin = props.workspaceRole === "admin";
  const canManageMembers =
    props.isPlatformAdmin || isWorkspaceOwner || isWorkspaceAdmin;
  const canManageUserPermissions =
    props.isPlatformAdmin || isWorkspaceOwner || isWorkspaceAdmin;
  const canManagePlan = props.isPlatformAdmin || isWorkspaceOwner;
  const isMemberActionDisabled = props.isBusy || !canManageMembers;
  const isPermissionActionDisabled = props.isBusy || !canManageUserPermissions;
  const isActionDisabled = props.isBusy || !canManageWorkspace;
  const canSwitchWorkspaceContext = props.isPlatformAdmin && !workspaceScopedOnly;
  const canProvisionWorkspace = canManageWorkspace && !workspaceScopedOnly;

  useEffect(() => {
    if (!props.forcedFlow) {
      return;
    }
    setInternalFlow(props.forcedFlow);
  }, [props.forcedFlow]);

  useEffect(() => {
    setInviteRoleOption(TEAM_ROLE_TO_OPTION[props.inviteRole]);
  }, [props.inviteRole]);

  const activeInvites = useMemo(
    () => props.invites.filter((invite) => !invite.consumedAt).length,
    [props.invites],
  );

  const activeShares = useMemo(
    () => props.shareGrants.filter((shareGrant) => !shareGrant.revokedAt).length,
    [props.shareGrants],
  );

  const ownerCount = useMemo(
    () => props.memberships.filter((membership) => membership.role === "owner").length,
    [props.memberships],
  );

  const entitlementLabel = useMemo(() => {
    if (!props.overview) {
      return t("adminWorkspace.status.unknown");
    }
    if (props.overview.entitlementState === "read_only") {
      return t("adminWorkspace.status.entitlementReadOnly");
    }
    if (props.overview.entitlementState === "grace_active") {
      return t("adminWorkspace.status.entitlementGrace");
    }
    return t("adminWorkspace.status.entitlementActive");
  }, [props.overview, t]);

  const scopeLabel = props.isPlatformAdmin
    ? t("adminWorkspace.ui.scopePlatform")
    : props.isTeamOperator
      ? t("adminWorkspace.ui.scopeTeam")
      : t("adminWorkspace.ui.scopeReadOnly");

  const workspaceOpsTitle = workspaceScopedOnly
    ? t("adminWorkspace.ui.workspaceOpsTitle")
    : t("adminWorkspace.ui.workspaceDirectoryTitle");

  const workspaceOpsDescription = workspaceScopedOnly
    ? t("adminWorkspace.ui.workspaceOpsDescription")
    : t("adminWorkspace.ui.workspaceDirectoryOpsDescription");

  const selectedWorkspacePlanLabel =
    props.selectedWorkspace?.planLabel &&
    props.selectedWorkspace.planLabel.trim().length > 0
      ? props.selectedWorkspace.planLabel
      : t("adminWorkspace.ui.noPlanLabel");

  const sortedMemberships = useMemo(() => {
    const roleRank: Record<TeamRole, number> = {
      owner: 0,
      admin: 1,
      member: 2,
      viewer: 3,
    };
    return [...props.memberships].sort((left, right) => {
      if (roleRank[left.role] !== roleRank[right.role]) {
        return roleRank[left.role] - roleRank[right.role];
      }
      return resolveMembershipIdentity(left).localeCompare(
        resolveMembershipIdentity(right),
      );
    });
  }, [props.memberships]);

  const filteredMemberships = useMemo(() => {
    const keyword = memberQuery.trim().toLowerCase();
    return sortedMemberships.filter((membership) => {
      const matchesRole =
        memberRoleFilter === "all" || membership.role === memberRoleFilter;
      if (!matchesRole) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const identity = resolveMembershipIdentity(membership).toLowerCase();
      return identity.includes(keyword) || membership.userId.toLowerCase().includes(keyword);
    });
  }, [memberQuery, memberRoleFilter, sortedMemberships]);

  const sortedInvites = useMemo(
    () =>
      [...props.invites].sort((left, right) => {
        const leftPending = left.consumedAt ? 1 : 0;
        const rightPending = right.consumedAt ? 1 : 0;
        if (leftPending !== rightPending) {
          return leftPending - rightPending;
        }
        return right.createdAt.localeCompare(left.createdAt);
      }),
    [props.invites],
  );

  const filteredInvites = useMemo(() => {
    const keyword = inviteQuery.trim().toLowerCase();
    return sortedInvites.filter((invite) => {
      const status = invite.consumedAt === null ? "pending" : "used";
      const matchesStatus = inviteStatusFilter === "all" || inviteStatusFilter === status;
      if (!matchesStatus) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return invite.email.toLowerCase().includes(keyword);
    });
  }, [inviteQuery, inviteStatusFilter, sortedInvites]);

  const sortedShareGrants = useMemo(
    () =>
      [...props.shareGrants].sort((left, right) => {
        const leftRevoked = left.revokedAt ? 1 : 0;
        const rightRevoked = right.revokedAt ? 1 : 0;
        if (leftRevoked !== rightRevoked) {
          return leftRevoked - rightRevoked;
        }
        return right.createdAt.localeCompare(left.createdAt);
      }),
    [props.shareGrants],
  );

  const filteredShareGrants = useMemo(() => {
    const keyword = shareQuery.trim().toLowerCase();
    return sortedShareGrants.filter((shareGrant) => {
      const status = shareGrant.revokedAt ? "revoked" : "active";
      const matchesStatus = shareStatusFilter === "all" || shareStatusFilter === status;
      if (!matchesStatus) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return (
        shareGrant.resourceId.toLowerCase().includes(keyword) ||
        shareGrant.recipientEmail.toLowerCase().includes(keyword)
      );
    });
  }, [shareQuery, shareStatusFilter, sortedShareGrants]);

  useEffect(() => {
    setMemberPageIndex(0);
  }, [memberQuery, memberRoleFilter]);

  useEffect(() => {
    setInvitePageIndex(0);
  }, [inviteQuery, inviteStatusFilter]);

  useEffect(() => {
    setSharePageIndex(0);
  }, [shareQuery, shareStatusFilter]);

  const memberPageCount = Math.max(
    1,
    Math.ceil(filteredMemberships.length / memberPageSize),
  );
  const safeMemberPageIndex = Math.min(memberPageIndex, memberPageCount - 1);
  const paginatedMemberships = filteredMemberships.slice(
    safeMemberPageIndex * memberPageSize,
    safeMemberPageIndex * memberPageSize + memberPageSize,
  );

  const invitePageCount = Math.max(1, Math.ceil(filteredInvites.length / invitePageSize));
  const safeInvitePageIndex = Math.min(invitePageIndex, invitePageCount - 1);
  const paginatedInvites = filteredInvites.slice(
    safeInvitePageIndex * invitePageSize,
    safeInvitePageIndex * invitePageSize + invitePageSize,
  );

  const sharePageCount = Math.max(1, Math.ceil(filteredShareGrants.length / sharePageSize));
  const safeSharePageIndex = Math.min(sharePageIndex, sharePageCount - 1);
  const paginatedShareGrants = filteredShareGrants.slice(
    safeSharePageIndex * sharePageSize,
    safeSharePageIndex * sharePageSize + sharePageSize,
  );

  const renderWorkspaceSnapshot = () => (
    <div className="rounded-lg border border-border/70 bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            {t("adminWorkspace.ui.selectedWorkspaceTitle")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("adminWorkspace.ui.selectedWorkspaceDescription")}
          </p>
        </div>
        <Badge variant="outline" className="h-5 px-2 text-[10px]">
          {props.selectedWorkspace
            ? t(
                props.selectedWorkspace.mode === "team"
                  ? "adminWorkspace.controlPlane.modeTeam"
                  : "adminWorkspace.controlPlane.modePersonal",
              )
            : t("adminWorkspace.ui.notSelected")}
        </Badge>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {t("adminWorkspace.ui.currentWorkspace")}
          </p>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-foreground">
            {props.selectedWorkspace?.name ??
              t("adminWorkspace.controlPlane.noWorkspaceSelected")}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {t("adminWorkspace.ui.createdAt")}
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-foreground">
            {props.selectedWorkspace ? formatDate(props.selectedWorkspace.createdAt) : "-"}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {t("adminWorkspace.ui.createdBy")}
          </p>
          <p className="mt-0.5 truncate font-mono text-[12px] text-foreground">
            {props.selectedWorkspace?.createdBy ?? "-"}
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

      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {!workspaceScopedOnly && (
          <div className="rounded-md border border-border/60 bg-background px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.metrics.workspaces")}
            </p>
            <p className="mt-0.5 text-[16px] font-semibold text-foreground">
              {props.workspaces.length}
            </p>
          </div>
        )}
        <div className="rounded-md border border-border/60 bg-background px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {t("adminWorkspace.metrics.members")}
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-foreground">
            {props.overview?.members ?? props.memberships.length}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-background px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {t("adminWorkspace.metrics.invites")}
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-foreground">
            {props.overview?.activeInvites ?? activeInvites}
          </p>
        </div>
        <div className="rounded-md border border-border/60 bg-background px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            {t("adminWorkspace.share.title")}
          </p>
          <p className="mt-0.5 text-[16px] font-semibold text-foreground">
            {props.overview?.activeShareGrants ?? activeShares}
          </p>
        </div>
      </div>
    </div>
  );

  const renderWorkspaceSelector = () => {
    if (workspaceScopedOnly) {
      return null;
    }

    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
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

          <ScrollArea className="h-[220px] pr-2">
            <div className="space-y-2">
              {props.workspaces.map((workspace) => {
                const isSelected = workspace.id === props.selectedWorkspaceId;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => props.setSelectedWorkspaceId(workspace.id)}
                    disabled={!canSwitchWorkspaceContext}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      isSelected
                        ? "border-primary/30 bg-primary/5"
                        : "border-border/70 bg-background hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {workspace.name}
                      </p>
                      <Badge variant="outline" className="h-5 px-2 text-[10px]">
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
            placeholder={t("adminWorkspace.controlPlane.workspaceNamePlaceholder")}
            disabled={isActionDisabled || !canProvisionWorkspace}
            className="h-9 bg-background"
          />
          <div className="grid grid-cols-[1fr_130px_120px_140px] gap-2">
            <Select
              value={props.workspaceMode}
              onValueChange={(value) =>
                props.setWorkspaceMode(value as "personal" | "team")
              }
              disabled={isActionDisabled || !canProvisionWorkspace}
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
            <Select
              value={props.workspacePlanId}
              onValueChange={(value) =>
                props.setWorkspacePlanId(
                  value as "free" | "starter" | "team" | "scale" | "enterprise",
                )
              }
              disabled={isActionDisabled || !canProvisionWorkspace}
            >
              <SelectTrigger className="h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">
                  {getUnifiedPlanLabel({ planId: "free" })}
                </SelectItem>
                <SelectItem value="starter">
                  {getUnifiedPlanLabel({ planId: "starter" })}
                </SelectItem>
                <SelectItem value="team">
                  {getUnifiedPlanLabel({ planId: "team" })}
                </SelectItem>
                <SelectItem value="scale">
                  {getUnifiedPlanLabel({ planId: "scale" })}
                </SelectItem>
                <SelectItem value="enterprise">
                  {getUnifiedPlanLabel({ planId: "enterprise" })}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={props.workspaceBillingCycle}
              onValueChange={(value) =>
                props.setWorkspaceBillingCycle(value as "monthly" | "yearly")
              }
              disabled={
                isActionDisabled ||
                !canProvisionWorkspace ||
                props.workspacePlanId === "free"
              }
            >
              <SelectTrigger className="h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{t("authLanding.monthly")}</SelectItem>
                <SelectItem value="yearly">{t("authLanding.yearly")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={props.handleCreateWorkspace}
              disabled={
                isActionDisabled ||
                !canProvisionWorkspace ||
                !props.workspaceName.trim()
              }
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
          {canManageWorkspace && !canProvisionWorkspace && (
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.workspaceScopedModeHint")}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderMembersCard = () => (
    <div className="rounded-lg border border-border/70 overflow-hidden bg-background">
      <div className="space-y-3 border-b border-border/70 bg-muted/20 px-3 py-3">
        <p className="text-[11px] font-medium text-muted-foreground">
          {t("adminWorkspace.ui.memberList")}
        </p>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px]">
          <Input
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder={t("adminWorkspace.ui.searchMembersPlaceholder")}
            className="h-8 bg-background"
          />
          <Select
            value={memberRoleFilter}
            onValueChange={(value) => setMemberRoleFilter(value as "all" | TeamRole)}
          >
            <SelectTrigger className="h-8 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminWorkspace.ui.filterAllRoles")}</SelectItem>
              <SelectItem value="owner">{t("adminWorkspace.roles.owner")}</SelectItem>
              <SelectItem value="admin">{t("adminWorkspace.roles.admin")}</SelectItem>
              <SelectItem value="member">{t("adminWorkspace.roles.member")}</SelectItem>
              <SelectItem value="viewer">{t("adminWorkspace.roles.viewer")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="h-[260px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("adminWorkspace.columns.email")}</TableHead>
              <TableHead>{t("adminWorkspace.columns.role")}</TableHead>
              <TableHead>{t("adminWorkspace.columns.status")}</TableHead>
              <TableHead className="text-right">{t("adminWorkspace.columns.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedMemberships.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  {filteredMemberships.length === 0
                    ? t("adminWorkspace.controlPlane.noMembers")
                    : t("adminWorkspace.ui.noRowsInPage")}
                </TableCell>
              </TableRow>
            ) : (
              paginatedMemberships.map((membership) => (
                <TableRow key={membership.userId}>
                  <TableCell className="font-medium">{resolveMembershipIdentity(membership)}</TableCell>
                  <TableCell>
                    {(() => {
                      const membershipEmail = membership.email.trim().toLowerCase();
                      const isSelfMembership =
                        (normalizedCurrentUserEmail.length > 0 &&
                          membershipEmail === normalizedCurrentUserEmail) ||
                        (normalizedCurrentUserId.length > 0 &&
                          membership.userId === normalizedCurrentUserId);
                      const rowActionDisabled = isMemberActionDisabled || isSelfMembership;
                      return (
                    <Select
                      value={
                        membershipRoleOptionDrafts[membership.userId] ??
                        TEAM_ROLE_TO_OPTION[
                          props.membershipRoleDrafts[membership.userId] ?? membership.role
                        ]
                      }
                      onValueChange={(value) => {
                        const nextRoleOption = value as WorkspaceRoleOption;
                        setMembershipRoleOptionDrafts((prev) => ({
                          ...prev,
                          [membership.userId]: nextRoleOption,
                        }));
                        props.setMembershipRoleDrafts((prev) => ({
                          ...prev,
                          [membership.userId]: ROLE_OPTION_TO_TEAM_ROLE[nextRoleOption],
                        }));
                      }}
                      disabled={rowActionDisabled}
                    >
                      <SelectTrigger className="h-8 w-[132px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMBER_ROLE_OPTIONS.map((roleOption) => (
                          <SelectItem key={roleOption} value={roleOption}>
                            {t(`adminWorkspace.roles.${roleOption}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[11px]">
                      {t("adminWorkspace.ui.memberActive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const membershipEmail = membership.email.trim().toLowerCase();
                      const isSelfMembership =
                        (normalizedCurrentUserEmail.length > 0 &&
                          membershipEmail === normalizedCurrentUserEmail) ||
                        (normalizedCurrentUserId.length > 0 &&
                          membership.userId === normalizedCurrentUserId);
                      const rowActionDisabled = isMemberActionDisabled || isSelfMembership;
                      return (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => props.handleUpdateRole(membership.userId)}
                        disabled={
                          rowActionDisabled ||
                          props.membershipRoleDrafts[membership.userId] === membership.role ||
                          !props.membershipRoleDrafts[membership.userId]
                        }
                      >
                        <UserRoundCog className="h-3.5 w-3.5" />
                        {t("common.buttons.edit")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => props.handleRemoveMember(membership.userId)}
                        disabled={rowActionDisabled}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="p-3">
        <TablePaginationControls
          totalRows={filteredMemberships.length}
          pageIndex={safeMemberPageIndex}
          pageCount={memberPageCount}
          pageSize={memberPageSize}
          canPreviousPage={safeMemberPageIndex > 0}
          canNextPage={safeMemberPageIndex < memberPageCount - 1}
          onPreviousPage={() =>
            setMemberPageIndex((current) => Math.max(0, current - 1))
          }
          onNextPage={() =>
            setMemberPageIndex((current) => Math.min(memberPageCount - 1, current + 1))
          }
          onPageSizeChange={(next) => {
            setMemberPageSize(next);
            setMemberPageIndex(0);
          }}
          summaryLabel={t("adminWorkspace.ui.rowSummary", {
            shown: filteredMemberships.length,
            total: props.memberships.length,
          })}
          pageLabel={t("common.pagination.page")}
          rowsPerPageLabel={t("common.pagination.rowsPerPage")}
          previousLabel={t("common.pagination.previous")}
          nextLabel={t("common.pagination.next")}
          className="border-border/70 px-2 py-2"
        />
      </div>
    </div>
  );

  const renderInvitesCard = () => (
    <div className="rounded-lg border border-border/70 overflow-hidden bg-background">
      <div className="space-y-3 border-b border-border/70 bg-muted/20 px-3 py-3">
        <p className="text-[11px] font-medium text-muted-foreground">
          {t("adminWorkspace.ui.inviteList")}
        </p>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px]">
          <Input
            value={inviteQuery}
            onChange={(event) => setInviteQuery(event.target.value)}
            placeholder={t("adminWorkspace.ui.searchInvitesPlaceholder")}
            className="h-8 bg-background"
          />
          <Select
            value={inviteStatusFilter}
            onValueChange={(value) => setInviteStatusFilter(value as InviteFilterStatus)}
          >
            <SelectTrigger className="h-8 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminWorkspace.ui.filterAllStatuses")}</SelectItem>
              <SelectItem value="pending">{t("adminWorkspace.ui.filterPending")}</SelectItem>
              <SelectItem value="used">{t("adminWorkspace.ui.filterUsed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="h-[260px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("adminWorkspace.columns.email")}</TableHead>
              <TableHead>{t("adminWorkspace.columns.role")}</TableHead>
              <TableHead>{t("adminWorkspace.columns.time")}</TableHead>
              <TableHead>{t("adminWorkspace.columns.status")}</TableHead>
              <TableHead className="text-right">{t("adminWorkspace.columns.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedInvites.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  {filteredInvites.length === 0
                    ? t("adminWorkspace.controlPlane.noInvites")
                    : t("adminWorkspace.ui.noRowsInPage")}
                </TableCell>
              </TableRow>
            ) : (
              paginatedInvites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>{t(`adminWorkspace.roles.${invite.role}`)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span className="text-[12px]">{formatDate(invite.expiresAt)}</span>
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
                        disabled={isMemberActionDisabled}
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
      </ScrollArea>

      <div className="p-3">
        <TablePaginationControls
          totalRows={filteredInvites.length}
          pageIndex={safeInvitePageIndex}
          pageCount={invitePageCount}
          pageSize={invitePageSize}
          canPreviousPage={safeInvitePageIndex > 0}
          canNextPage={safeInvitePageIndex < invitePageCount - 1}
          onPreviousPage={() => setInvitePageIndex((current) => Math.max(0, current - 1))}
          onNextPage={() =>
            setInvitePageIndex((current) => Math.min(invitePageCount - 1, current + 1))
          }
          onPageSizeChange={(next) => {
            setInvitePageSize(next);
            setInvitePageIndex(0);
          }}
          summaryLabel={t("adminWorkspace.ui.rowSummary", {
            shown: filteredInvites.length,
            total: props.invites.length,
          })}
          pageLabel={t("common.pagination.page")}
          rowsPerPageLabel={t("common.pagination.rowsPerPage")}
          previousLabel={t("common.pagination.previous")}
          nextLabel={t("common.pagination.next")}
          className="border-border/70 px-2 py-2"
        />
      </div>
    </div>
  );

  const renderInviteComposer = () => (
    <>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_140px]">
        <Input
          value={props.inviteEmail}
          onChange={(event) => props.setInviteEmail(event.target.value)}
          placeholder={t("adminWorkspace.members.inviteEmailPlaceholder")}
          disabled={isMemberActionDisabled}
          className="h-9"
        />
        <Select
          value={inviteRoleOption}
          onValueChange={(value) => {
            const nextRoleOption = value as WorkspaceRoleOption;
            setInviteRoleOption(nextRoleOption);
            props.setInviteRole(ROLE_OPTION_TO_TEAM_ROLE[nextRoleOption]);
          }}
          disabled={isMemberActionDisabled}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITE_ROLE_OPTIONS.map((roleOption) => (
              <SelectItem key={roleOption} value={roleOption}>
                {t(`adminWorkspace.roles.${roleOption}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={props.handleCreateInvite}
          disabled={isMemberActionDisabled || !props.inviteEmail.trim()}
          className="h-9"
        >
          {t("adminWorkspace.ui.sendInvite")}
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {t("adminWorkspace.members.inviteRoleRestrictedHint")}
      </p>
    </>
  );

  const renderMembersInvitesTabsCard = () => (
    <div className="rounded-lg border border-border/70 bg-background">
      <Tabs defaultValue="members" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-3">
          <TabsList className="grid h-8 w-full max-w-[320px] grid-cols-2 bg-muted/40 p-1">
            <TabsTrigger value="members" className="text-[12px]">
              {t("adminWorkspace.ui.memberList")}
            </TabsTrigger>
            <TabsTrigger value="invites" className="text-[12px]">
              {t("adminWorkspace.ui.inviteList")}
            </TabsTrigger>
          </TabsList>
          <Button
            size="sm"
            onClick={() => setIsInviteDialogOpen(true)}
            disabled={isMemberActionDisabled}
            className="h-8"
          >
            <PlusCircle className="mr-1 h-3.5 w-3.5" />
            {t("adminWorkspace.ui.sendInvite")}
          </Button>
        </div>
        <div className="p-3">
          <TabsContent value="members" className="mt-0">
            {renderMembersCard()}
          </TabsContent>
          <TabsContent value="invites" className="mt-0">
            {renderInvitesCard()}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );

  const renderInviteDialog = () => (
    <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
      <DialogContent className="max-h-[88vh] w-[94vw] max-w-[1120px] overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 px-6 pb-4 pt-6">
          <DialogTitle>{t("adminWorkspace.ui.memberAccessTitle")}</DialogTitle>
          <DialogDescription>
            {t("adminWorkspace.ui.memberAccessDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-auto px-6 pb-6 pt-4">
          {renderInviteComposer()}
          {renderInvitesCard()}
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderShareCard = () => (
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
          {t("adminWorkspace.controlPlane.shareCount", { count: activeShares })}
        </Badge>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-2 md:grid-cols-[132px_minmax(0,1fr)_minmax(0,1fr)_140px]">
          <Select
            value={props.shareResourceType}
            onValueChange={(value) => props.setShareResourceType(value as "profile" | "group")}
            disabled={isPermissionActionDisabled}
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
            disabled={isPermissionActionDisabled}
            className="h-9"
          />
          <Input
            value={props.shareRecipientEmail}
            onChange={(event) => props.setShareRecipientEmail(event.target.value)}
            placeholder={t("adminWorkspace.share.recipientPlaceholder")}
            disabled={isPermissionActionDisabled}
            className="h-9"
          />
          <Button
            onClick={props.handleCreateShare}
            disabled={
              isPermissionActionDisabled ||
              !props.shareResourceId.trim() ||
              !props.shareRecipientEmail.trim()
            }
            className="h-9"
          >
            <Link className="mr-1 h-4 w-4" />
            {t("adminWorkspace.ui.createShare")}
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-border/70 overflow-hidden">
          <div className="grid gap-2 bg-muted/20 px-3 py-3 md:grid-cols-[minmax(0,1fr)_140px]">
            <Input
              value={shareQuery}
              onChange={(event) => setShareQuery(event.target.value)}
              placeholder={t("adminWorkspace.ui.searchSharesPlaceholder")}
              className="h-8 bg-background"
            />
            <Select
              value={shareStatusFilter}
              onValueChange={(value) => setShareStatusFilter(value as ShareFilterStatus)}
            >
              <SelectTrigger className="h-8 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("adminWorkspace.ui.filterAllStatuses")}</SelectItem>
                <SelectItem value="active">{t("adminWorkspace.ui.filterActive")}</SelectItem>
                <SelectItem value="revoked">{t("adminWorkspace.ui.filterRevoked")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[280px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminWorkspace.columns.resource")}</TableHead>
                  <TableHead>{t("adminWorkspace.columns.recipient")}</TableHead>
                  <TableHead>{t("adminWorkspace.columns.access")}</TableHead>
                  <TableHead>{t("adminWorkspace.columns.status")}</TableHead>
                  <TableHead className="text-right">{t("adminWorkspace.columns.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedShareGrants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      {filteredShareGrants.length === 0
                        ? t("adminWorkspace.share.none")
                        : t("adminWorkspace.ui.noRowsInPage")}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedShareGrants.map((shareGrant) => (
                    <TableRow key={shareGrant.id}>
                      <TableCell className="font-medium">
                        <Badge variant="outline" className="mr-2 text-[10px]">
                          {shareGrant.resourceType}
                        </Badge>
                        {shareGrant.resourceId}
                      </TableCell>
                      <TableCell>{shareGrant.recipientEmail}</TableCell>
                      <TableCell>
                        {t(`adminWorkspace.share.accessMode.${shareGrant.accessMode}`)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={shareGrant.revokedAt ? "outline" : "secondary"}
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
                            onClick={() => props.handleRevokeShare(shareGrant.id)}
                            disabled={isPermissionActionDisabled}
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
          </ScrollArea>

          <div className="p-3">
            <TablePaginationControls
              totalRows={filteredShareGrants.length}
              pageIndex={safeSharePageIndex}
              pageCount={sharePageCount}
              pageSize={sharePageSize}
              canPreviousPage={safeSharePageIndex > 0}
              canNextPage={safeSharePageIndex < sharePageCount - 1}
              onPreviousPage={() => setSharePageIndex((current) => Math.max(0, current - 1))}
              onNextPage={() =>
                setSharePageIndex((current) => Math.min(sharePageCount - 1, current + 1))
              }
              onPageSizeChange={(next) => {
                setSharePageSize(next);
                setSharePageIndex(0);
              }}
              summaryLabel={t("adminWorkspace.ui.rowSummary", {
                shown: filteredShareGrants.length,
                total: props.shareGrants.length,
              })}
              pageLabel={t("common.pagination.page")}
              rowsPerPageLabel={t("common.pagination.rowsPerPage")}
              previousLabel={t("common.pagination.previous")}
              nextLabel={t("common.pagination.next")}
              className="border-border/70 px-2 py-2"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderDirectoryFlow = () => (
    <div className="space-y-4">
      {renderWorkspaceSelector()}
      {renderWorkspaceSnapshot()}
      {renderMembersInvitesTabsCard()}
    </div>
  );

  const renderRolesFlow = () => {
    // MOCK DATA for Phase 1 testing
    const mockRoles: CustomRoleDefinition[] = [
      { id: "owner", name: "Owner", isSystem: true, capabilities: [] },
      { id: "admin", name: "Admin", isSystem: true, capabilities: [] },
      { id: "member", name: "Member", isSystem: true, capabilities: [] },
      { id: "r_1", name: "Marketing Team", capabilities: ["create_profile", "edit_profile"] }
    ];

    return (
      <div className="space-y-4">
        {!canManageUserPermissions && (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
            {t("adminWorkspace.ui.readOnlyHint")}
          </div>
        )}
        <CustomRolesManager
          roles={mockRoles}
          onAddRole={() => {}}
          onUpdateRole={() => {}}
          onDeleteRole={() => {}}
          isPlatformAdmin={props.isPlatformAdmin}
        />
      </div>
    );
  };

  const renderPermissionsFlow = () => {
    // MOCK Resource Data for Phase 1 testing
    const availableResources = [
      { id: "g1", name: "Facebook Ads Group", type: "group" as const },
      { id: "g2", name: "TikTok Agency", type: "group" as const },
      { id: "p1", name: "Profile Via 1", type: "profile" as const },
    ];

    return (
      <div className="space-y-4">
        {!canManageUserPermissions && (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
            {t("adminWorkspace.ui.readOnlyHint")}
          </div>
        )}
        <MemberPermissionsMatrix
          memberships={props.memberships}
          shareGrants={props.shareGrants}
          availableResources={availableResources}
          onToggleGrant={(u, r, t, s) => { console.log(u, r, t, s); }}
          isPlatformAdmin={props.isPlatformAdmin}
        />
      </div>
    );
  };

  const renderPlanFlow = () => (
    <div className="space-y-4">
      {!canManagePlan && (
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
          {t("billingPage.memberReadonlyHint")}
        </div>
      )}
      {renderWorkspaceSnapshot()}
      <div className="rounded-lg border border-border/70 bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              {t("shell.sections.workspaceOwnerPlanManagement")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("adminWorkspace.panelTree.owner.pages.billing.description")}
            </p>
          </div>
          <Badge variant="outline" className="h-5 px-2 text-[10px]">
            {selectedWorkspacePlanLabel}
          </Badge>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.planLabel")}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-foreground">
              {selectedWorkspacePlanLabel}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("adminWorkspace.ui.snapshotEntitlement")}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-foreground">
              {entitlementLabel}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("pricingPage.heroStatProfiles")}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-foreground">
              {props.selectedWorkspace?.profileLimit ?? "-"}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {t("webBilling.fieldCycle")}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-foreground">
              {props.selectedWorkspace?.billingCycle ?? "-"}
            </p>
          </div>
        </div>
        {!canManagePlan && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            {t("billingPage.ownerOnlyUpgradeCta")}
          </p>
        )}
      </div>
    </div>
  );

  const renderFlowContent = () => {
    if (!showGovernanceFlows) {
      return renderDirectoryFlow();
    }
    if (activeFlow === "overview") {
      return renderDirectoryFlow();
    }
    if (activeFlow === "permissions") {
      return renderPermissionsFlow();
    }
    if (activeFlow === "roles") {
      return renderRolesFlow();
    }
    if (activeFlow === "plan") {
      return renderPlanFlow();
    }
    return renderDirectoryFlow();
  };

  return (
    <div className="space-y-4">
      {isLocalMode && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
          {t("adminWorkspace.ui.localModeEnabled")}
        </div>
      )}

      {workspaceScopedOnly ? (
        <div className="space-y-4">
          {renderFlowContent()}
          {renderInviteDialog()}
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border/70 bg-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">{workspaceOpsTitle}</h3>
                <p className="mt-1 text-[12px] text-muted-foreground">{workspaceOpsDescription}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {t("adminWorkspace.ui.currentWorkspace")}: {" "}
                  <span className="font-medium text-foreground">
                    {props.selectedWorkspace?.name ??
                      t("adminWorkspace.controlPlane.noWorkspaceSelected")}
                  </span>
                </p>
              </div>
              <Badge variant="secondary" className="h-6 px-2.5 text-[11px] font-medium">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                {scopeLabel}
              </Badge>
            </div>

            {showWorkspaceFlowTabs ? (
              <Tabs
                value={activeFlow}
                onValueChange={(value) => setInternalFlow(value as WorkspaceAdminFlow)}
                className="w-full"
              >
                <div className="border-b border-border/70 px-4 py-3">
                  <TabsList className="grid w-full max-w-[720px] grid-cols-4 bg-muted/30 p-1">
                    <TabsTrigger value="directory" className="text-[12px]">
                      {t("shell.sections.workspaceAdminMembers")}
                    </TabsTrigger>
                    <TabsTrigger value="roles" className="text-[12px]">
                      Vai trò
                    </TabsTrigger>
                    <TabsTrigger value="permissions" className="text-[12px]">
                      Phân quyền Group/Profile
                    </TabsTrigger>
                    <TabsTrigger value="plan" className="text-[12px]">
                      {t("shell.sections.workspaceOwnerPlanManagement")}
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="p-4">
                  <TabsContent value="directory" className="mt-0">
                    {renderDirectoryFlow()}
                  </TabsContent>
                  <TabsContent value="roles" className="mt-0">
                    {renderRolesFlow()}
                  </TabsContent>
                  <TabsContent value="permissions" className="mt-0">
                    {renderPermissionsFlow()}
                  </TabsContent>
                  <TabsContent value="plan" className="mt-0">
                    {renderPlanFlow()}
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              <div className="p-4">{renderFlowContent()}</div>
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
                {t("adminWorkspace.metrics.members")}: {props.memberships.length}
              </span>
              <span>{t("adminWorkspace.metrics.invites")}: {activeInvites}</span>
              <span>{t("adminWorkspace.share.title")}: {activeShares}</span>
            </div>
          </div>
          {renderInviteDialog()}
        </>
      )}
    </div>
  );
}
