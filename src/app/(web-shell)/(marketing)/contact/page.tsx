"use client";

import { Headset, MessageSquareText, ShieldAlert, Wallet } from "lucide-react";
import { MarketingInfoPage } from "@/components/portal/marketing/marketing-info-page";

const CONTACT_CARDS = [
  { key: "sales", icon: Wallet },
  { key: "support", icon: Headset },
  { key: "security", icon: ShieldAlert },
  { key: "partnership", icon: MessageSquareText },
] as const;

export default function ContactPage() {
  return (
    <MarketingInfoPage
      baseKey="portalSite.contactPage"
      cards={CONTACT_CARDS}
      primaryCta={{ href: "/signup", key: "portalSite.nav.signUp" }}
      secondaryCta={{ href: "/help", key: "portalSite.nav.help" }}
    />
  );
}
