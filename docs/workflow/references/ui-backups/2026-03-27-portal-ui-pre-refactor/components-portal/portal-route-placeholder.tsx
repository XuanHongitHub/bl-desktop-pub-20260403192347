"use client";

import { useTranslation } from "react-i18next";

interface PortalRoutePlaceholderProps {
  titleKey: string;
  descriptionKey?: string;
}

export function PortalRoutePlaceholder({
  titleKey,
  descriptionKey,
}: PortalRoutePlaceholderProps) {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-background px-4 py-16 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-lg border border-border bg-card p-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t(titleKey)}</h1>
        {descriptionKey ? (
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{t(descriptionKey)}</p>
        ) : null}
      </div>
    </main>
  );
}
