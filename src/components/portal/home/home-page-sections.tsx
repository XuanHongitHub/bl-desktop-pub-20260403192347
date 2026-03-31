"use client";

import { ArrowRight, Boxes, CreditCard, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FramerHeroSection } from "@/components/portal/home/framer-hero-section";
import { MARKETING_RAIL_WIDTH_CLASS } from "@/components/portal/portal-geometry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURE_ITEMS = [
  { key: "stealth", icon: ShieldCheck },
  { key: "workspace", icon: Boxes },
  { key: "billing", icon: CreditCard },
] as const;

const STEP_ITEMS = ["signin", "checkout", "operate"] as const;
const FAQ_ITEMS = ["security", "billing", "desktop"] as const;

export function HomePageSections() {
  const { t } = useTranslation();

  return (
    <div className="space-y-0 pb-10">
      <FramerHeroSection />

      <section className="border-t border-border/70 py-8 sm:py-10">
        <div
          className={cn(
            "grid gap-6 lg:grid-cols-[1.15fr_1fr]",
            MARKETING_RAIL_WIDTH_CLASS,
          )}
        >
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-card/80 via-muted/40 to-card/70 p-6 sm:p-8">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("portalSite.home.demoWorkspace.eyebrow")}
            </h3>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("portalSite.home.demoWorkspace.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              {t("portalSite.home.demoWorkspace.description")}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xl font-semibold text-foreground sm:text-2xl">
                  {t("portalSite.home.metrics.profiles.value")}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {t("portalSite.home.metrics.profiles.label")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xl font-semibold text-foreground sm:text-2xl">
                  {t("portalSite.home.metrics.teams.value")}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {t("portalSite.home.metrics.teams.label")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xl font-semibold text-foreground sm:text-2xl">
                  {t("portalSite.home.metrics.ops.value")}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {t("portalSite.home.metrics.ops.label")}
                </p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70">
            <Image
              src="/auth/buglogin-auth-ops.jpg"
              alt={t("portalSite.home.features.workspace.title")}
              width={1600}
              height={1068}
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/65 via-transparent to-transparent" />
          </div>
        </div>
      </section>

      <section
        id="product-capabilities"
        className="scroll-mt-24 border-t border-border/70 py-16 sm:py-20"
      >
        <div className={cn("space-y-8", MARKETING_RAIL_WIDTH_CLASS)}>
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">
              {t("portalSite.home.capabilitiesEyebrow")}
            </Badge>
            <h2 className="max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("portalSite.home.capabilitiesTitle")}
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
              {t("portalSite.home.capabilitiesDescription")}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70">
              <Image
                src="/auth/buglogin-auth-security.jpg"
                alt={t("portalSite.home.features.stealth.title")}
                width={1800}
                height={1200}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-background/70 via-transparent to-background/20" />
            </div>
            <div className="space-y-5 rounded-2xl border border-border/70 bg-card/50 p-5 sm:p-6">
              {FEATURE_ITEMS.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.key}
                    className="rounded-xl border border-border/70 bg-background/70 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold text-foreground">
                          {t(`portalSite.home.features.${feature.key}.title`)}
                        </h3>
                        <p className="text-sm leading-7 text-muted-foreground">
                          {t(
                            `portalSite.home.features.${feature.key}.description`,
                          )}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="scroll-mt-24 border-t border-border/70 py-16 sm:py-20"
      >
        <div className={cn("space-y-8", MARKETING_RAIL_WIDTH_CLASS)}>
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit">
              {t("portalSite.home.splitEyebrow")}
            </Badge>
            <h2 className="max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("portalSite.home.splitTitle")}
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
              {t("portalSite.home.splitDescription")}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <ol className="space-y-4">
              {STEP_ITEMS.map((step, index) => (
                <li
                  key={step}
                  className="rounded-xl border border-border/70 bg-card/60 p-4 sm:p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    0{index + 1}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-foreground">
                    {t(`portalSite.home.steps.${step}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    {t(`portalSite.home.steps.${step}.description`)}
                  </p>
                </li>
              ))}
            </ol>
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70">
              <Image
                src="/auth/buglogin-auth-network.jpg"
                alt={t("portalSite.home.steps.checkout.title")}
                width={1600}
                height={1065}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/75" />
            </div>
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-24 border-y border-border/70 py-16 sm:py-20"
      >
        <div className={cn("space-y-6", MARKETING_RAIL_WIDTH_CLASS)}>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("portalSite.home.faqTitle")}
          </h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((faq) => (
              <details
                key={faq}
                className="group rounded-xl border border-border/70 bg-card/60 p-4 sm:p-5"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-foreground">
                  {t(`portalSite.home.faq.${faq}.q`)}
                </summary>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {t(`portalSite.home.faq.${faq}.a`)}
                </p>
              </details>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link href="/signin">
                {t("portalSite.nav.signIn")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/signup">{t("authLanding.signUpCta")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
