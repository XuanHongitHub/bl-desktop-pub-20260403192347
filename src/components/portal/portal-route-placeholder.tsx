"use client";

import { useTranslation } from "react-i18next";
import { PortalPageFrame } from "@/components/portal/portal-page-frame";
import { PortalShell } from "@/components/portal/portal-shell";

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
    <PortalShell>
      <PortalPageFrame
        title={t(titleKey)}
        description={descriptionKey ? t(descriptionKey) : ""}
      />
    </PortalShell>
  );
}
