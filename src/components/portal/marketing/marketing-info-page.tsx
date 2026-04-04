"use client";

import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MARKETING_CONTENT_WIDTH_CLASS,
  MARKETING_RAIL_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import en from "@/i18n/locales/en.json";
import { cn } from "@/lib/utils";

interface MarketingInfoCard {
  key: string;
  icon: LucideIcon;
}

interface MarketingInfoPageProps {
  baseKey: string;
  cards: readonly MarketingInfoCard[];
  primaryCta: { href: string; key: string };
  secondaryCta?: { href: string; key: string };
  presentation?: "default" | "split";
  children?: React.ReactNode;
}

const PAGE_VISUAL_BY_BASE_KEY: Record<string, string> = {
  "portalSite.docsPage": "/images/landing/fingerprint-security.png",
  "portalSite.downloadPage": "/images/landing/ops-management.png",
  "portalSite.statusPage": "/images/landing/network-proxy.png",
  "portalSite.contactPage": "/images/landing/hero-main.png",
};

export function MarketingInfoPage({
  baseKey,
  cards,
  primaryCta,
  secondaryCta,
  presentation = "default",
  children,
}: MarketingInfoPageProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fallbackTranslate = (key: string): string => {
    const value = key.split(".").reduce<unknown>((acc, segment) => {
      if (acc && typeof acc === "object" && segment in acc) {
        return (acc as Record<string, unknown>)[segment];
      }
      return null;
    }, en);
    return typeof value === "string" ? value : key;
  };

  const translate = (key: string): string =>
    mounted ? t(key) : fallbackTranslate(key);
  const visualSrc =
    PAGE_VISUAL_BY_BASE_KEY[baseKey] ?? "/auth/buglogin-auth-security.jpg";

  if (presentation === "split") {
    return (
      <section
        className={cn(
          "space-y-10 py-10 sm:py-14",
          MARKETING_RAIL_WIDTH_CLASS,
          MARKETING_CONTENT_WIDTH_CLASS,
        )}
      >
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-foreground text-background">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-8">
            <div className="space-y-5">
              <Badge
                variant="secondary"
                className="w-fit border-background/20 bg-background/15 text-background"
              >
                {translate(`${baseKey}.badge`)}
              </Badge>
              <h1 className="text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
                {translate(`${baseKey}.title`)}
              </h1>
              <p className="max-w-xl text-base leading-7 text-background/75">
                {translate(`${baseKey}.description`)}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  asChild
                  className="h-11 rounded-full bg-background px-5 text-sm font-semibold text-foreground hover:bg-background/90"
                >
                  <Link href={primaryCta.href}>
                    {translate(primaryCta.key)}
                  </Link>
                </Button>
                {secondaryCta ? (
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 rounded-full border-background/30 bg-transparent px-5 text-sm font-semibold text-background hover:bg-background/10 hover:text-background"
                  >
                    <Link href={secondaryCta.href}>
                      {translate(secondaryCta.key)}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-background/20 bg-background/5">
              <Image
                src={visualSrc}
                alt={translate(`${baseKey}.title`)}
                width={1800}
                height={1200}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/65 via-transparent to-transparent" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <article
                key={card.key}
                className="rounded-2xl border border-border/70 bg-card/45 p-5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    0{index + 1}
                  </p>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {translate(`${baseKey}.cards.${card.key}.title`)}
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {translate(`${baseKey}.cards.${card.key}.description`)}
                </p>
              </article>
            );
          })}
        </div>

        {children}
      </section>
    );
  }

  return (
    <section
      className={cn(
        "space-y-10 py-16 sm:py-20",
        MARKETING_RAIL_WIDTH_CLASS,
        MARKETING_CONTENT_WIDTH_CLASS,
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-card/80 via-muted/30 to-card/70 p-6 sm:p-8">
          <Badge variant="secondary" className="w-fit">
            {translate(`${baseKey}.badge`)}
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {translate(`${baseKey}.title`)}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            {translate(`${baseKey}.description`)}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={primaryCta.href}>{translate(primaryCta.key)}</Link>
            </Button>
            {secondaryCta ? (
              <Button asChild size="sm" variant="outline">
                <Link href={secondaryCta.href}>
                  {translate(secondaryCta.key)}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70">
          <Image
            src={visualSrc}
            alt={translate(`${baseKey}.title`)}
            width={1800}
            height={1200}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-background/10" />
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-6">
        <ol className="space-y-3">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <li
                key={card.key}
                className="rounded-xl border border-border/70 bg-background/70 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      0{index + 1}
                    </p>
                    <h2 className="text-base font-semibold text-foreground">
                      {translate(`${baseKey}.cards.${card.key}.title`)}
                    </h2>
                    <p className="text-sm leading-7 text-muted-foreground">
                      {translate(`${baseKey}.cards.${card.key}.description`)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {children}
    </section>
  );
}
