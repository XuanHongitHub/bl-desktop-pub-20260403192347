import type { TeamRole } from "@/types";

export type AuthLoginScope = "workspace_user" | "platform_admin";

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

export function getPreviewRoleByEmail(email: string): TeamRole | null {
  switch (email.trim().toLowerCase()) {
    case "owner.preview@buglogin.local":
      return "owner";
    case "admin.preview@buglogin.local":
      return "admin";
    case "member.preview@buglogin.local":
      return "member";
    case "viewer.preview@buglogin.local":
      return "viewer";
    default:
      return null;
  }
}
