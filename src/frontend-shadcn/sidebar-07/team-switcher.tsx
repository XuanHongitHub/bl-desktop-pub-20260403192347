"use client";

import Link from "next/link";
import { Logo } from "@/components/icons/logo";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/frontend-shadcn/ui/sidebar";

export function Sidebar07TeamSwitcher() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          size="lg"
          className="h-10 justify-start rounded-md px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Link href="/account" aria-label="BugLogin">
            <Logo
              variant="full"
              alt="BugLogin"
              className="h-7 w-auto max-w-[148px] group-data-[collapsible=icon]:hidden"
            />
            <Logo
              variant="icon"
              alt="BugLogin"
              className="hidden h-7 w-7 rounded-md group-data-[collapsible=icon]:block"
            />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
