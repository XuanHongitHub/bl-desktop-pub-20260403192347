import { PortalRouteGuard } from "@/components/website/portal-route-guard";
import { WebRuntimeOnlyGuard } from "@/components/website/runtime-surface-guard";
import { PortalBillingDataProvider } from "@/hooks/use-portal-billing-data";

export default function PortalWebLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WebRuntimeOnlyGuard>
      <PortalRouteGuard>
        <PortalBillingDataProvider>{children}</PortalBillingDataProvider>
      </PortalRouteGuard>
    </WebRuntimeOnlyGuard>
  );
}
