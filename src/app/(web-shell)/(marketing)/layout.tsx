import { WebRuntimeOnlyGuard } from "@/components/website/runtime-surface-guard";
import { WebsiteShell } from "@/components/website/website-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BugLogin Website",
  description:
    "Official BugLogin website for landing, pricing, sign in, and support.",
};

export default function MarketingWebLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WebRuntimeOnlyGuard>
      <WebsiteShell variant="marketing">{children}</WebsiteShell>
    </WebRuntimeOnlyGuard>
  );
}
