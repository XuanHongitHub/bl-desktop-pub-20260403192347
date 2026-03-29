import { Suspense } from "react";
import { WebsiteShell } from "@/components/website/website-shell";
import { PortalRouteGuard } from "@/components/website/portal-route-guard";

export default function PortalWebLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WebsiteShell variant="portal">
      <Suspense fallback={null}>
        <PortalRouteGuard>{children}</PortalRouteGuard>
      </Suspense>
    </WebsiteShell>
  );
}
