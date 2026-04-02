import {
  BadgePercent,
  BarChart3,
  Calculator,
  Cookie,
  Crown,
  FileText,
  Globe,
  KeyRound,
  LayoutDashboard,
  Megaphone,
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
  groups: Users,
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
  "super-admin-incident-board": LayoutDashboard,
  "super-admin-workspace": Users,
  "super-admin-memberships": Users,
  "super-admin-abuse-trust": Shield,
  "super-admin-users": Users,
  "super-admin-billing": Receipt,
  "super-admin-subscriptions": Receipt,
  "super-admin-invoices": Receipt,
  "super-admin-cookies": Cookie,
  "super-admin-policy-center": ShieldCheck,
  "super-admin-data-governance": ShieldCheck,
  "super-admin-jobs-queues": Wrench,
  "super-admin-feature-flags": BarChart3,
  "super-admin-support-console": FileText,
  "super-admin-impersonation-center": Users,
  "super-admin-browser-update": Wrench,
  "super-admin-audit": FileText,
  "super-admin-system": Wrench,
  "super-admin-commerce-plans": Crown,
  "super-admin-commerce-campaigns": Megaphone,
  "super-admin-commerce-coupons": BadgePercent,
  "super-admin-commerce-licenses": KeyRound,
  "super-admin-commerce-preview": Calculator,
  "super-admin-commerce-audit": FileText,
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
