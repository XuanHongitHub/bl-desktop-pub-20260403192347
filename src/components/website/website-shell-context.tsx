"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

export type WebsiteShellVariant = "marketing" | "portal";

const WebsiteShellContext = createContext<WebsiteShellVariant>("marketing");

export function WebsiteShellVariantProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: WebsiteShellVariant;
}) {
  return (
    <WebsiteShellContext.Provider value={value}>
      {children}
    </WebsiteShellContext.Provider>
  );
}

export function useWebsiteShellVariant() {
  return useContext(WebsiteShellContext);
}
