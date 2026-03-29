"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  MARKETING_CONTENT_WIDTH_CLASS,
  MARKETING_RAIL_WIDTH_CLASS,
  MARKETING_SHELL_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
import { cn } from "@/lib/utils";
import styles from "./framer-hero-section.module.css";

type HeroCard = {
  alt: string;
  aspectRatio: number;
  src: string;
};

const HERO_COLUMNS: HeroCard[][] = [
  [
    {
      alt: "Showcase editorial website",
      aspectRatio: 720 / 660,
      src: "https://framerusercontent.com/images/3Wul3zB87cbFlm05OhXiZaxxXg.jpg?width=720&height=660",
    },
    {
      alt: "Portrait portfolio website",
      aspectRatio: 720 / 800,
      src: "https://framerusercontent.com/images/OiLWEMPHjsMaE1LpfCX7OYHI.jpg?width=720&height=800",
    },
    {
      alt: "Editorial mobile experience",
      aspectRatio: 480 / 1040,
      src: "https://framerusercontent.com/images/8VfS5zuMmDchIpaCf767I8rX7Y.jpg?width=480&height=1040",
    },
  ],
  [
    {
      alt: "Rounded brand portfolio",
      aspectRatio: 720 / 720,
      src: "https://framerusercontent.com/images/3RGrfrckophlAobhfZlqf1MDPd0.jpg?width=720&height=720",
    },
    {
      alt: "Tall editorial website",
      aspectRatio: 720 / 1020,
      src: "https://framerusercontent.com/images/hZ3ztUHQQ9Tn50mg184gLvKcy4E.jpg?width=720&height=1020",
    },
    {
      alt: "Creative landing page",
      aspectRatio: 720 / 840,
      src: "https://framerusercontent.com/images/Tkq5qQlGiu0yhgjP3SrSQz7eog.jpg?width=720&height=840",
    },
  ],
  [
    {
      alt: "Photography campaign website",
      aspectRatio: 1068 / 1080,
      src: "https://framerusercontent.com/images/uS0nUv30GToaflDaraI9qVUIwU.png?width=1068&height=1080",
    },
    {
      alt: "Fashion highlight website",
      aspectRatio: 720 / 780,
      src: "https://framerusercontent.com/images/gmhdX4XPuJvQqId9jDmFHb7cFE.jpg?width=720&height=780",
    },
    {
      alt: "Visual storytelling website",
      aspectRatio: 720 / 840,
      src: "https://framerusercontent.com/images/4pTVxnxo0Bvii8xP7hCmmozqx7s.jpg?width=720&height=840",
    },
  ],
  [
    {
      alt: "Gradient landing page",
      aspectRatio: 720 / 600,
      src: "https://framerusercontent.com/images/HnQI4uTAjbgziEmMMInd3R6o9c.jpg?width=720&height=600",
    },
    {
      alt: "Magazine cover website",
      aspectRatio: 720 / 900,
      src: "https://framerusercontent.com/images/iR48olgey2UZQ9FFhsWFne27Ag.jpg?width=720&height=900",
    },
    {
      alt: "Wide campaign site",
      aspectRatio: 720 / 540,
      src: "https://framerusercontent.com/images/JUWRJbfPWXb05lTNw0q4p1jewc.jpg?width=720&height=540",
    },
  ],
  [
    {
      alt: "Portfolio poster website",
      aspectRatio: 720 / 852,
      src: "https://framerusercontent.com/images/0DoFvQInPiH34TWUk6DzVA9JQ.jpg?width=720&height=852",
    },
    {
      alt: "Campaign microsite",
      aspectRatio: 720 / 578,
      src: "https://framerusercontent.com/images/irsyTM7kM1DWjcg6fJkQQ1O04s.jpg?width=720&height=578",
    },
    {
      alt: "Poster gallery website",
      aspectRatio: 720 / 1290,
      src: "https://framerusercontent.com/images/0DqWFfs9zfVYPO7PZd8O8bsRtE.jpg?width=720&height=1290",
    },
  ],
];

export function FramerHeroSection() {
  const { t } = useTranslation();
  const columns = HERO_COLUMNS;

  return (
    <section
      className={cn(
        styles.section,
        "relative isolate bg-background text-foreground"
      )}
    >
      <div className={cn(styles.glowTop, "pointer-events-none absolute inset-x-0 top-0 h-80")} />
      <div className={cn(styles.glowBottom, "pointer-events-none absolute inset-x-0 bottom-0 h-64")} />

      <header className={cn("relative z-10 px-0 pb-8 pt-10 lg:pt-14", MARKETING_RAIL_WIDTH_CLASS)}>
        <div className={cn("mx-auto flex flex-col items-center text-center", MARKETING_CONTENT_WIDTH_CLASS)}>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/70"
          >
            <span suppressHydrationWarning>{t("portalSite.home.reportLabel")}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground" suppressHydrationWarning>
              {t("portalSite.home.reportCta")}
            </span>
          </Link>

          <div className="mt-10 space-y-5">
            <h1 className="text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.05em] text-foreground sm:text-6xl lg:text-[92px]">
              <span suppressHydrationWarning>{t("portalSite.home.linearTitleLine1")}</span>
              <br />
              <span suppressHydrationWarning>{t("portalSite.home.linearTitleLine2")}</span>
            </h1>
            <p className="mx-auto max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
              <span suppressHydrationWarning>{t("portalSite.home.linearSubtitle")}</span>
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              className="h-12 rounded-full px-6 text-[15px] font-semibold tracking-[-0.02em]"
            >
              <Link href="/signup">
                <span suppressHydrationWarning>{t("portalSite.home.primaryCta")}</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full border-border/70 bg-card/70 px-6 text-[15px] font-semibold tracking-[-0.02em] text-foreground hover:bg-muted/70 hover:text-foreground"
            >
              <Link href="/pricing">
                <span suppressHydrationWarning>{t("portalSite.home.secondaryCta")}</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className={cn("relative z-10 px-0 pb-6 pt-4", MARKETING_RAIL_WIDTH_CLASS)}>
        <div className={styles.galleryShell}>
          <div className={styles.galleryGrid}>
            {columns.map((column, columnIndex) => (
              <div
                key={`column-${columnIndex}`}
                className={cn(styles.column, columnIndex % 2 === 1 && styles.columnReverse)}
              >
                <div
                  className={styles.columnInner}
                  style={{
                    animationDelay: `${-(columnIndex + 1) * 5}s`,
                    animationDuration: `${24 + columnIndex * 4}s`,
                  }}
                >
                  {[...column, ...column].map((card, cardIndex) => (
                    <div key={`${card.src}-${cardIndex}`} className={styles.card}>
                      <div className={styles.cardVisual} style={{ aspectRatio: `${card.aspectRatio}` }}>
                        <img
                          alt={card.alt}
                          decoding="async"
                          fetchPriority="low"
                          loading="lazy"
                          src={card.src}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
