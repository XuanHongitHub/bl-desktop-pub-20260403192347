"use client";

import { ArrowDownToLine, Boxes, Laptop, RefreshCcw } from "lucide-react";
import { DownloadInstallersPanel } from "@/components/portal/marketing/download-installers-panel";
import { MarketingInfoPage } from "@/components/portal/marketing/marketing-info-page";

const DOWNLOAD_CARDS = [
  { key: "windows", icon: Laptop },
  { key: "channels", icon: Boxes },
  { key: "integrity", icon: ArrowDownToLine },
  { key: "release", icon: RefreshCcw },
] as const;

export default function DownloadPage() {
  return (
    <MarketingInfoPage
      baseKey="portalSite.downloadPage"
      cards={DOWNLOAD_CARDS}
      primaryCta={{ href: "/signin", key: "portalSite.nav.signIn" }}
      secondaryCta={{ href: "/pricing", key: "portalSite.nav.pricing" }}
    >
      <DownloadInstallersPanel />
    </MarketingInfoPage>
  );
}
