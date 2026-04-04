"use client";

import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/frontend-shadcn/ui/sidebar";

type NavMainLeaf = {
  title: string;
  url: string;
  icon?: LucideIcon;
};

type NavMainSection = {
  label: string;
  items: NavMainLeaf[];
};

function isPathActive(pathname: string, url: string): boolean {
  if (url === "/") {
    return pathname === "/";
  }
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function Sidebar07NavMain({ sections }: { sections: NavMainSection[] }) {
  const pathname = usePathname();

  return (
    <div className="space-y-3 px-2 py-2">
      {sections.map((section) => (
        <SidebarGroup key={section.label}>
          <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          <SidebarMenu>
            {section.items.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isPathActive(pathname, item.url)}
                  className="h-9 gap-2.5 rounded-lg px-2.5 text-xs font-semibold tracking-normal [&>svg]:h-4 [&>svg]:w-4"
                >
                  <Link href={item.url}>
                    {item.icon ? <item.icon /> : null}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </div>
  );
}
