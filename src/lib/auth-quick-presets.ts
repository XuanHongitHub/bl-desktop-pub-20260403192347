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

export const AUTH_QUICK_PRESETS: readonly AuthQuickPreset[] = [];
