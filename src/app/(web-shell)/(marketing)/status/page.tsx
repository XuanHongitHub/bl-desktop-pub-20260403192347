"use client";

import { Activity, CreditCard, KeyRound, RefreshCcwDot } from "lucide-react";
import { MarketingInfoPage } from "@/components/portal/marketing/marketing-info-page";

const STATUS_CARDS = [
  { key: "auth", icon: KeyRound },
  { key: "billing", icon: CreditCard },
  { key: "sync", icon: RefreshCcwDot },
  { key: "uptime", icon: Activity },
] as const;

export default function StatusPage() {
  return (
    <MarketingInfoPage
      baseKey="portalSite.statusPage"
      cards={STATUS_CARDS}
      primaryCta={{ href: "/help", key: "portalSite.nav.help" }}
      secondaryCta={{ href: "/contact", key: "portalSite.nav.contact" }}
    />
  );
}
