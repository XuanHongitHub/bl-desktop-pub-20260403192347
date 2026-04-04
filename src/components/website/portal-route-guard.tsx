"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePortalSessionStore } from "@/hooks/use-portal-session-store";
import {
  resolvePortalPostAuthPath,
} from "@/lib/portal-session";

function buildNextPath(pathname: string): string {
  const query =
    typeof window !== "undefined" ? window.location.search.slice(1) : "";
  return query ? `${pathname}?${query}` : pathname;
}

export function PortalRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = usePortalSessionStore();
  const isAdminRoute = pathname.startsWith("/admin");

  useEffect(() => {
    if (!session) {
      const next = buildNextPath(pathname);
      const params = new URLSearchParams();
      params.set("next", next);
      router.replace(`/signin?${params.toString()}`);
      return;
    }

    const platformRole =
      session.user.platformRole ?? session.connection.platformRole ?? null;

    if (isAdminRoute && platformRole !== "platform_admin") {
      router.replace(resolvePortalPostAuthPath({ platformRole }));
    }
  }, [isAdminRoute, pathname, router, session]);

  if (!session) {
    return null;
  }

  const platformRole =
    session.user.platformRole ?? session.connection.platformRole ?? null;
  if (isAdminRoute && platformRole !== "platform_admin") {
    return null;
  }

  return <>{children}</>;
}
