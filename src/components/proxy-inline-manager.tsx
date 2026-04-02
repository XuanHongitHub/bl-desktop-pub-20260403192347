"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { StoredProxy } from "@/types";
import { ProxyFormDialog } from "./proxy-form-dialog";
import { Button } from "./ui/button";

export function ProxyInlineManager({
  selectedProxy,
  onCreated,
  disabled = false,
}: {
  selectedProxy?: StoredProxy | null;
  onCreated?: (proxy: StoredProxy) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<StoredProxy | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setEditingProxy(null);
            setIsOpen(true);
          }}
        >
          {t("proxies.add")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !selectedProxy}
          onClick={() => {
            if (!selectedProxy) {
              return;
            }
            setEditingProxy(selectedProxy);
            setIsOpen(true);
          }}
        >
          {t("proxies.edit")}
        </Button>
      </div>

      <ProxyFormDialog
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setEditingProxy(null);
        }}
        editingProxy={editingProxy}
        onSaved={(proxy, mode) => {
          if (mode === "create") {
            onCreated?.(proxy);
          }
        }}
      />
    </>
  );
}
