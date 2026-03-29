import {
  BarChart3,
  Cookie,
  Crown,
  FileText,
  Globe,
  LayoutDashboard,
  Receipt,
  Settings2,
  Shield,
  ShieldCheck,
  SquareTerminal,
  Users,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

type IconComponent = ComponentType<{ className?: string }>;

export type AdminTabIconKey =
  | "overview"
  | "workspace"
  | "billing"
  | "cookies"
  | "audit"
  | "system"
  | "analytics";

const SECTION_ICON_MAP: Record<string, IconComponent> = {
  profiles: SquareTerminal,
  "bugidea-automation": Cookie,
  proxies: Globe,
  pricing: Crown,
  billing: Receipt,
  integrations: Shield,
  settings: Settings2,
  "workspace-owner-overview": Users,
  "workspace-owner-directory": Users,
  "workspace-owner-permissions": Shield,
  "super-admin-overview": LayoutDashboard,
  "super-admin-workspace": Users,
  "super-admin-billing": Receipt,
  "super-admin-cookies": Cookie,
  "super-admin-audit": FileText,
  "super-admin-system": Wrench,
  "super-admin-analytics": BarChart3,
  "workspace-admin-overview": Users,
  "workspace-admin-directory": Users,
  "workspace-admin-permissions": Shield,
  "workspace-admin-members": Users,
  "workspace-admin-access": Shield,
  "workspace-admin-workspace": Users,
  "workspace-admin-audit": FileText,
  "workspace-admin-system": Wrench,
  "workspace-admin-analytics": BarChart3,
  "workspace-governance": Users,
  "admin-overview": LayoutDashboard,
  "admin-workspace": Users,
  "admin-billing": Receipt,
  "admin-cookies": Cookie,
  "admin-audit": FileText,
  "admin-system": Wrench,
  "admin-analytics": BarChart3,
};

const ADMIN_TAB_ICON_MAP: Record<AdminTabIconKey, IconComponent> = {
  overview: BarChart3,
  workspace: Users,
  billing: Receipt,
  cookies: Cookie,
  audit: FileText,
  system: ShieldCheck,
  analytics: BarChart3,
};

export function getSectionIcon(section: string): IconComponent {
  return SECTION_ICON_MAP[section] ?? SquareTerminal;
}

export function getAdminTabIcon(tab: AdminTabIconKey): IconComponent {
  return ADMIN_TAB_ICON_MAP[tab];
}
