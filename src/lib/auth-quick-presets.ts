import type { EntitlementState, TeamRole } from "@/types";

export type AuthLoginScope = "workspace_user" | "platform_admin";

export type PreviewWorkspaceSeed = {
  id: string;
  name: string;
  mode: "team" | "personal";
  role?: TeamRole;
  members: number;
  activeInvites: number;
  activeShareGrants: number;
  entitlementState: EntitlementState;
  profileLimit: number;
  profilesUsed: number;
  planLabel: string;
  expiresAt: string | null;
};

export type PreviewAccountSeed = {
  teamRole?: TeamRole;
  platformRole?: "platform_admin";
  teamId?: string;
  teamName?: string;
  plan: string;
  subscriptionStatus: string;
  profileLimit: number;
  cloudProfilesUsed: number;
  proxyBandwidthLimitMb: number;
  proxyBandwidthUsedMb: number;
  proxyBandwidthExtraMb: number;
  workspaceSeeds: PreviewWorkspaceSeed[];
};

export type AuthQuickPreset = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  email: string;
  scope: AuthLoginScope;
  role: TeamRole | "platform_admin";
};

export const AUTH_QUICK_PRESETS: readonly AuthQuickPreset[] = [
  {
    id: "platform_admin",
    labelKey: "authDialog.quickPresetPlatformAdmin",
    descriptionKey: "authDialog.quickPresetPlatformAdminDescription",
    email: "platform.admin@buglogin.local",
    scope: "platform_admin",
    role: "platform_admin",
  },
  {
    id: "owner",
    labelKey: "authDialog.quickPresetOwner",
    descriptionKey: "authDialog.quickPresetOwnerDescription",
    email: "owner.preview@buglogin.local",
    scope: "workspace_user",
    role: "owner",
  },
  {
    id: "admin",
    labelKey: "authDialog.quickPresetAdmin",
    descriptionKey: "authDialog.quickPresetAdminDescription",
    email: "admin.preview@buglogin.local",
    scope: "workspace_user",
    role: "admin",
  },
  {
    id: "member",
    labelKey: "authDialog.quickPresetMember",
    descriptionKey: "authDialog.quickPresetMemberDescription",
    email: "member.preview@buglogin.local",
    scope: "workspace_user",
    role: "member",
  },
  {
    id: "viewer",
    labelKey: "authDialog.quickPresetViewer",
    descriptionKey: "authDialog.quickPresetViewerDescription",
    email: "viewer.preview@buglogin.local",
    scope: "workspace_user",
    role: "viewer",
  },
];

const PREVIEW_ACCOUNT_SEEDS: Record<string, PreviewAccountSeed> = {
  "platform.admin@buglogin.local": {
    platformRole: "platform_admin",
    teamRole: "owner",
    teamId: "team-bugmedia",
    teamName: "Bug Media",
    plan: "enterprise",
    subscriptionStatus: "active",
    profileLimit: 1000,
    cloudProfilesUsed: 998,
    proxyBandwidthLimitMb: 102400,
    proxyBandwidthUsedMb: 31820,
    proxyBandwidthExtraMb: 0,
    workspaceSeeds: [
      {
        id: "team-bugmedia",
        name: "Bug Media",
        mode: "team",
        role: "owner",
        members: 18,
        activeInvites: 3,
        activeShareGrants: 12,
        entitlementState: "active",
        profileLimit: 1000,
        profilesUsed: 998,
        planLabel: "Enterprise",
        expiresAt: "2026-09-25T00:00:00.000Z",
      },
      {
        id: "team-shadcn-admin",
        name: "Bug Media Growth",
        mode: "team",
        role: "admin",
        members: 7,
        activeInvites: 1,
        activeShareGrants: 5,
        entitlementState: "active",
        profileLimit: 300,
        profilesUsed: 152,
        planLabel: "Growth",
        expiresAt: "2026-07-30T00:00:00.000Z",
      },
      {
        id: "team-acme-inc",
        name: "Acme Inc.",
        mode: "team",
        role: "member",
        members: 4,
        activeInvites: 0,
        activeShareGrants: 2,
        entitlementState: "grace_active",
        profileLimit: 120,
        profilesUsed: 114,
        planLabel: "Starter",
        expiresAt: "2026-05-15T00:00:00.000Z",
      },
      {
        id: "personal",
        name: "Personal Workspace",
        mode: "personal",
        role: "owner",
        members: 1,
        activeInvites: 0,
        activeShareGrants: 0,
        entitlementState: "active",
        profileLimit: 3,
        profilesUsed: 2,
        planLabel: "Free",
        expiresAt: null,
      },
    ],
  },
  "owner.preview@buglogin.local": {
    teamRole: "owner",
    teamId: "team-bugmedia",
    teamName: "Bug Media",
    plan: "growth",
    subscriptionStatus: "active",
    profileLimit: 300,
    cloudProfilesUsed: 186,
    proxyBandwidthLimitMb: 51200,
    proxyBandwidthUsedMb: 6720,
    proxyBandwidthExtraMb: 0,
    workspaceSeeds: [
      {
        id: "team-bugmedia",
        name: "Bug Media",
        mode: "team",
        role: "owner",
        members: 18,
        activeInvites: 3,
        activeShareGrants: 12,
        entitlementState: "active",
        profileLimit: 300,
        profilesUsed: 186,
        planLabel: "Growth",
        expiresAt: "2026-08-18T00:00:00.000Z",
      },
      {
        id: "personal",
        name: "Personal Workspace",
        mode: "personal",
        role: "owner",
        members: 1,
        activeInvites: 0,
        activeShareGrants: 0,
        entitlementState: "active",
        profileLimit: 3,
        profilesUsed: 2,
        planLabel: "Free",
        expiresAt: null,
      },
    ],
  },
  "admin.preview@buglogin.local": {
    teamRole: "admin",
    teamId: "team-bugmedia",
    teamName: "Bug Media",
    plan: "growth",
    subscriptionStatus: "active",
    profileLimit: 150,
    cloudProfilesUsed: 78,
    proxyBandwidthLimitMb: 20480,
    proxyBandwidthUsedMb: 3840,
    proxyBandwidthExtraMb: 0,
    workspaceSeeds: [
      {
        id: "team-bugmedia",
        name: "Bug Media",
        mode: "team",
        role: "admin",
        members: 18,
        activeInvites: 3,
        activeShareGrants: 12,
        entitlementState: "active",
        profileLimit: 150,
        profilesUsed: 78,
        planLabel: "Growth",
        expiresAt: "2026-08-18T00:00:00.000Z",
      },
      {
        id: "personal",
        name: "Personal Workspace",
        mode: "personal",
        role: "owner",
        members: 1,
        activeInvites: 0,
        activeShareGrants: 0,
        entitlementState: "active",
        profileLimit: 3,
        profilesUsed: 1,
        planLabel: "Free",
        expiresAt: null,
      },
    ],
  },
  "member.preview@buglogin.local": {
    teamRole: "member",
    teamId: "team-bugmedia",
    teamName: "Bug Media",
    plan: "starter",
    subscriptionStatus: "active",
    profileLimit: 40,
    cloudProfilesUsed: 19,
    proxyBandwidthLimitMb: 5120,
    proxyBandwidthUsedMb: 1560,
    proxyBandwidthExtraMb: 0,
    workspaceSeeds: [
      {
        id: "team-bugmedia",
        name: "Bug Media",
        mode: "team",
        role: "member",
        members: 18,
        activeInvites: 3,
        activeShareGrants: 12,
        entitlementState: "active",
        profileLimit: 40,
        profilesUsed: 19,
        planLabel: "Starter",
        expiresAt: "2026-06-30T00:00:00.000Z",
      },
      {
        id: "personal",
        name: "Personal Workspace",
        mode: "personal",
        role: "owner",
        members: 1,
        activeInvites: 0,
        activeShareGrants: 0,
        entitlementState: "active",
        profileLimit: 3,
        profilesUsed: 0,
        planLabel: "Free",
        expiresAt: null,
      },
    ],
  },
  "viewer.preview@buglogin.local": {
    teamRole: "viewer",
    teamId: "team-bugmedia",
    teamName: "Bug Media",
    plan: "free",
    subscriptionStatus: "active",
    profileLimit: 3,
    cloudProfilesUsed: 1,
    proxyBandwidthLimitMb: 1024,
    proxyBandwidthUsedMb: 120,
    proxyBandwidthExtraMb: 0,
    workspaceSeeds: [
      {
        id: "team-bugmedia",
        name: "Bug Media",
        mode: "team",
        role: "viewer",
        members: 18,
        activeInvites: 3,
        activeShareGrants: 12,
        entitlementState: "active",
        profileLimit: 3,
        profilesUsed: 1,
        planLabel: "Free",
        expiresAt: null,
      },
      {
        id: "personal",
        name: "Personal Workspace",
        mode: "personal",
        role: "owner",
        members: 1,
        activeInvites: 0,
        activeShareGrants: 0,
        entitlementState: "active",
        profileLimit: 3,
        profilesUsed: 1,
        planLabel: "Free",
        expiresAt: null,
      },
    ],
  },
};

export function getPreviewAccountSeedByEmail(
  email: string,
): PreviewAccountSeed | null {
  return PREVIEW_ACCOUNT_SEEDS[email.trim().toLowerCase()] ?? null;
}

export function getPreviewRoleByEmail(email: string): TeamRole | null {
  return getPreviewAccountSeedByEmail(email)?.teamRole ?? null;
}
