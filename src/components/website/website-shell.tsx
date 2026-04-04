"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { PortalFooter } from "@/components/portal/portal-footer";
import {
  MARKETING_SHELL_WIDTH_CLASS,
  PORTAL_RAIL_WIDTH_CLASS,
  PORTAL_SHELL_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalLayout } from "@/components/portal/portal-layout";
import {
  type WebsiteShellVariant,
  WebsiteShellVariantProvider,
} from "@/components/website/website-shell-context";

const WebsiteShellContext = createContext(false);

export function WebsiteShell({
  children,
  variant = "marketing",
}: {
  children: ReactNode;
  variant?: WebsiteShellVariant;
}) {
  const isNestedShell = useContext(WebsiteShellContext);
  const pathname = usePathname();

  if (isNestedShell) {
    return <>{children}</>;
  }

  const isAuthLikeRoute =
    pathname === "/auth" || pathname === "/signin" || pathname === "/signup";

  const shellWidthClass =
    variant === "marketing"
      ? MARKETING_SHELL_WIDTH_CLASS
      : PORTAL_SHELL_WIDTH_CLASS;
  const railWidthClass = variant === "marketing" ? "" : PORTAL_RAIL_WIDTH_CLASS;
  const showShellChrome = variant === "marketing" && !isAuthLikeRoute;

  return (
    <WebsiteShellContext.Provider value={true}>
      <WebsiteShellVariantProvider value={variant}>
        <PortalLayout>
          <div data-website-shell={variant} className="contents">
            {showShellChrome ? <PortalHeader /> : null}
            <main
              className={[
                "relative flex w-full flex-1",
                showShellChrome ? "pb-20 pt-0" : "pb-0 pt-0",
                shellWidthClass,
              ].join(" ")}
            >
              <div className={railWidthClass || "w-full"}>{children}</div>
            </main>
            {showShellChrome ? <PortalFooter /> : null}
          </div>
        </PortalLayout>
      </WebsiteShellVariantProvider>
    </WebsiteShellContext.Provider>
  );
}
