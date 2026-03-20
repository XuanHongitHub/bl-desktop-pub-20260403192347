"use client";

import {
  ChevronRight,
  Globe,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Shield,
  SquareTerminal,
  UserRound,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { AppSection } from "@/types";
import { Logo } from "./icons/logo";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type NavItem = {
  id: AppSection;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "profiles",
    labelKey: "shell.sections.profiles",
    icon: SquareTerminal,
  },
  {
    id: "proxies",
    labelKey: "shell.sections.proxies",
    icon: Globe,
  },
  {
    id: "integrations",
    labelKey: "shell.sections.integrations",
    icon: Shield,
  },
  {
    id: "settings",
    labelKey: "shell.sections.settings",
    icon: Settings2,
  },
];

const ADMIN_NAV_ITEM: NavItem = {
  id: "admin",
  labelKey: "shell.sections.admin",
  icon: LayoutDashboard,
};

type Props = {
  activeSection: AppSection;
  collapsed: boolean;
  onSectionChange: (section: AppSection) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  showAdminSection?: boolean;
};

export function AppSidebar({
  activeSection,
  collapsed,
  onSectionChange,
  onCollapsedChange,
  showAdminSection = false,
}: Props) {
  const { t } = useTranslation();
  const navItems = showAdminSection ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activeSection === item.id;

    const button = (
      <button
        type="button"
        onClick={() => onSectionChange(item.id)}
        className={cn(
          "group flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-semibold leading-[1.25] transition-colors",
          isActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isActive
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        {!collapsed && (
          <>
            <span className="min-w-0">{t(item.labelKey)}</span>
            {isActive && (
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </>
        )}
      </button>
    );

    if (!collapsed) {
      return button;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      className={cn(
        "app-shell-sidebar app-sidebar-font relative flex h-screen flex-col border-r border-border bg-background text-foreground tracking-normal transition-all duration-200",
        collapsed ? "w-[80px]" : "w-[258px]",
      )}
    >
      {/* ── Brand header — fixed height aligned with main content header ──
          Toggle button always lives here (collapsed or expanded) so the
          user always looks in the same spot. */}
      <div
        className={cn(
          "flex h-11 shrink-0 items-center border-b border-border",
          collapsed ? "gap-1 px-2" : "gap-1 px-3",
        )}
      >
        {collapsed ? (
          <>
            {/* Logo home button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSectionChange("profiles")}
                  className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted/60"
                >
                  <Logo variant="icon" className="h-8 w-8 rounded-md" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">BugLogin</TooltipContent>
            </Tooltip>

            {/* Expand toggle — same header zone as the collapse toggle */}
            {onCollapsedChange && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onCollapsedChange(false)}
                    aria-label={t("shell.expandSidebar")}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t("shell.expandSidebar")}
                </TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSectionChange("profiles")}
              className="flex min-w-0 flex-1 items-center rounded-md px-1 py-1.5 text-left transition-colors hover:bg-muted/50"
            >
              <Logo variant="full" className="h-7 max-w-[148px]" />
            </button>
            {onCollapsedChange && (
              <button
                type="button"
                onClick={() => onCollapsedChange(true)}
                aria-label={t("shell.collapseSidebar")}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Navigation ── */}
      <ScrollArea className="flex-1 px-2 pb-3 pt-1">
        <div className="space-y-0.5 pb-2">
          {navItems.map((item) => (
            <div key={item.id}>{renderNavItem(item)}</div>
          ))}
        </div>
      </ScrollArea>

      {/* ── Footer ── */}
      <div className="border-t border-border p-2">
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5",
            collapsed && "justify-center px-0",
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <UserRound className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-foreground">
                {t("shell.workspaceMode")}
              </p>
              <p className="text-[11px] font-medium leading-[1.35] text-muted-foreground">
                {t("shell.workspaceHint")}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
