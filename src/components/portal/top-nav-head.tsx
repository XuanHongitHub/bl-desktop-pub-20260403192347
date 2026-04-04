"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TopNavHeadLanguage = {
  code: string;
  label: string;
  active: boolean;
  loading?: boolean;
  onSelect: () => void;
};

export type TopNavHeadThemeOption = {
  id: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  loading?: boolean;
  onSelect: () => void;
};

export function TopNavHead({
  languages,
  themeOptions,
  rightSlot,
  loading = false,
  className,
}: {
  languages: TopNavHeadLanguage[];
  themeOptions: TopNavHeadThemeOption[];
  rightSlot?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const activeLanguageIndex = Math.max(
    0,
    languages.findIndex((language) => language.active),
  );
  const activeLanguage = languages[activeLanguageIndex] ?? null;
  const nextLanguage =
    languages.length > 0
      ? languages[(activeLanguageIndex + 1) % languages.length]
      : null;
  const activeThemeIndex = Math.max(
    0,
    themeOptions.findIndex((option) => option.active),
  );
  const activeTheme = themeOptions[activeThemeIndex] ?? null;
  const nextTheme =
    themeOptions.length > 0
      ? themeOptions[(activeThemeIndex + 1) % themeOptions.length]
      : null;
  const ActiveThemeIcon = activeTheme?.icon;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-0",
        className,
      )}
    >
      {activeLanguage && nextLanguage ? (
        <button
          type="button"
          disabled={loading || activeLanguage.loading || nextLanguage.loading}
          onClick={nextLanguage.onSelect}
          aria-label={`${activeLanguage.label} -> ${nextLanguage.label}`}
          title={`${activeLanguage.code.toUpperCase()} -> ${nextLanguage.code.toUpperCase()}`}
          className="inline-flex h-8 min-w-9 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold uppercase tracking-[0.02em] text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span>{activeLanguage.code}</span>
        </button>
      ) : null}

      {activeLanguage && nextLanguage && activeTheme && nextTheme ? (
        <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-border" />
      ) : null}

      {activeTheme && nextTheme ? (
        <button
          type="button"
          disabled={loading || activeTheme.loading || nextTheme.loading}
          onClick={nextTheme.onSelect}
          aria-label={`${activeTheme.label} -> ${nextTheme.label}`}
          title={`${activeTheme.label} -> ${nextTheme.label}`}
          className="inline-flex h-8 min-w-9 items-center justify-center rounded-md px-1.5 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
        >
          {ActiveThemeIcon ? <ActiveThemeIcon className="h-3.5 w-3.5" /> : null}
        </button>
      ) : null}

      {rightSlot ? (
        <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-border" />
      ) : null}
      {rightSlot}
    </div>
  );
}
