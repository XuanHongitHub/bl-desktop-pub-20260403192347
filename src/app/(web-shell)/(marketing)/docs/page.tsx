"use client";

import { BookOpen, LifeBuoy, ShieldCheck } from "lucide-react";
import { MarketingInfoPage } from "@/components/portal/marketing/marketing-info-page";

const DOCS_CARDS = [
  { key: "quickstart", icon: BookOpen },
  { key: "security", icon: ShieldCheck },
  { key: "runbook", icon: LifeBuoy },
] as const;

export default function DocsPage() {
  return (
    <MarketingInfoPage
      baseKey="portalSite.docsPage"
      cards={DOCS_CARDS}
      primaryCta={{ href: "/signin", key: "portalSite.nav.signIn" }}
      secondaryCta={{ href: "/help", key: "portalSite.nav.help" }}
    />
  );
}
