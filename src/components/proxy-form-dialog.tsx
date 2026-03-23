"use client";

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type {
  ProxyCheckResult,
  ProxyParseResult,
  ProxyProtocolBenchmark,
  StoredProxy,
} from "@/types";
import { RippleButton } from "./ui/ripple";

interface ProxyFormData {
  name: string;
  quickInput: string;
  proxy_type: "http" | "https" | "socks4" | "socks5";
  host: string;
  port: string;
  username: string;
  password: string;
}

interface ProxyFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingProxy?: StoredProxy | null;
}

export function ProxyFormDialog({
  isOpen,
  onClose,
  editingProxy,
}: ProxyFormDialogProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [checkResult, setCheckResult] = useState<ProxyCheckResult | null>(null);

  const [formData, setFormData] = useState<ProxyFormData>({
    name: "",
    quickInput: "",
    proxy_type: "socks5",
    host: "",
    port: "8080",
    username: "",
    password: "",
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      quickInput: "",
      proxy_type: "socks5",
      host: "",
      port: "8080",
      username: "",
      password: "",
    });
    setCheckResult(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (editingProxy) {
      setFormData({
        name: editingProxy.name,
        quickInput: "",
        proxy_type:
          (editingProxy.proxy_settings
            .proxy_type as ProxyFormData["proxy_type"]) || "http",
        host: editingProxy.proxy_settings.host,
        port: String(editingProxy.proxy_settings.port),
        username: editingProxy.proxy_settings.username || "",
        password: editingProxy.proxy_settings.password || "",
      });
      setCheckResult(null);
      return;
    }

    resetForm();
  }, [editingProxy, isOpen, resetForm]);

  const parsedPort = useMemo(
    () => Number.parseInt(formData.port, 10),
    [formData.port],
  );

  const isFormValid =
    formData.name.trim().length > 0 &&
    formData.host.trim().length > 0 &&
    Number.isFinite(parsedPort) &&
    parsedPort > 0 &&
    parsedPort <= 65535;

  const proxySettings = useMemo(() => {
    if (!isFormValid) {
      return null;
    }

    return {
      proxy_type: formData.proxy_type,
      host: formData.host.trim(),
      port: parsedPort,
      username: formData.username.trim() || undefined,
      password: formData.password.trim() || undefined,
    };
  }, [
    formData.host,
    formData.password,
    formData.proxy_type,
    formData.username,
    isFormValid,
    parsedPort,
  ]);

  const handleQuickParse = useCallback(async () => {
    const content = formData.quickInput.trim();
    if (!content) {
      showErrorToast(t("proxies.form.quickAdd.validation.empty"));
      return;
    }

    setIsParsing(true);
    try {
      const results = await invoke<ProxyParseResult[]>("parse_txt_proxies", {
        content,
      });
      const parsed = results.find(
        (result): result is Extract<ProxyParseResult, { status: "parsed" }> =>
          result.status === "parsed",
      );

      if (!parsed) {
        showErrorToast(
          t("proxies.form.quickAdd.validation.noValid", { count: 1 }),
        );
        return;
      }

      setFormData((prev) => ({
        ...prev,
        proxy_type:
          (parsed.proxy_type as ProxyFormData["proxy_type"]) || "http",
        host: parsed.host,
        port: String(parsed.port),
        username: parsed.username ?? "",
        password: parsed.password ?? "",
      }));
      setCheckResult(null);
      showSuccessToast(t("proxies.form.quickAdd.parseSuccess"));

      try {
        setIsBenchmarking(true);
        const benchmark = await invoke<ProxyProtocolBenchmark>(
          "benchmark_proxy_protocols",
          {
            host: parsed.host,
            port: parsed.port,
            username: parsed.username ?? null,
            password: parsed.password ?? null,
          },
        );
        if (benchmark.best_protocol) {
          setFormData((prev) => ({
            ...prev,
            proxy_type: benchmark.best_protocol as ProxyFormData["proxy_type"],
          }));
          showSuccessToast(
            t("proxies.form.autoType.applied", {
              protocol: benchmark.best_protocol.toUpperCase(),
            }),
          );
        }
      } catch {
        // Keep parsed type when benchmark fails.
      } finally {
        setIsBenchmarking(false);
      }
    } catch (error) {
      showErrorToast(t("proxies.form.quickAdd.parseFailed"));
      console.error("Failed to parse proxy quick input:", error);
    } finally {
      setIsParsing(false);
    }
  }, [formData.quickInput, t]);

  const handleAutoSelectProxyType = useCallback(async () => {
    if (!proxySettings) {
      showErrorToast(t("proxies.form.validation.hostPortRequired"));
      return;
    }

    setIsBenchmarking(true);
    try {
      const benchmark = await invoke<ProxyProtocolBenchmark>(
        "benchmark_proxy_protocols",
        {
          host: formData.host.trim(),
          port: parsedPort,
          username: formData.username.trim() || null,
          password: formData.password.trim() || null,
        },
      );
      if (benchmark.best_protocol) {
        setFormData((prev) => ({
          ...prev,
          proxy_type: benchmark.best_protocol as ProxyFormData["proxy_type"],
        }));
        showSuccessToast(
          t("proxies.form.autoType.applied", {
            protocol: benchmark.best_protocol.toUpperCase(),
          }),
        );
      } else {
        showErrorToast(t("proxies.form.autoType.unavailable"));
      }
    } catch {
      showErrorToast(t("proxies.form.autoType.failed"));
    } finally {
      setIsBenchmarking(false);
    }
  }, [
    formData.host,
    formData.password,
    formData.username,
    parsedPort,
    proxySettings,
    t,
  ]);

  const handleCheckProxy = useCallback(async () => {
    if (!proxySettings) {
      showErrorToast(t("proxies.form.validation.hostPortRequired"));
      return;
    }

    setIsChecking(true);
    try {
      const result = await invoke<ProxyCheckResult>("check_proxy_validity", {
        proxyId: editingProxy?.id ?? `draft-${Date.now()}`,
        proxySettings,
      });
      setCheckResult(result);
      showSuccessToast(
        t("proxies.check.messages.location", {
          location:
            [result.city, result.country].filter(Boolean).join(", ") ||
            t("proxies.check.unknownLocation"),
        }),
      );
    } catch (error) {
      setCheckResult(null);
      showErrorToast(t("proxies.check.messages.failed"));
      console.error("Failed to check proxy:", error);
    } finally {
      setIsChecking(false);
    }
  }, [editingProxy?.id, proxySettings, t]);

  const handleSubmit = useCallback(async () => {
    if (!proxySettings || !formData.name.trim()) {
      showErrorToast(t("proxies.form.validation.hostPortRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProxy) {
        await invoke("update_stored_proxy", {
          proxyId: editingProxy.id,
          name: formData.name.trim(),
          proxySettings,
        });
        showSuccessToast(t("proxies.form.messages.updated"));
      } else {
        await invoke("create_stored_proxy", {
          name: formData.name.trim(),
          proxySettings,
        });
        showSuccessToast(t("proxies.form.messages.created"));
      }

      await emit("stored-proxies-changed");
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showErrorToast(
        t("proxies.form.messages.saveFailed", { error: errorMessage }),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [editingProxy, formData.name, onClose, proxySettings, t]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingProxy ? t("proxies.edit") : t("proxies.add")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proxy-name">{t("proxies.form.name")}</Label>
            <Input
              id="proxy-name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder={t("proxies.form.namePlaceholder")}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proxy-quick-add">
              {t("proxies.form.quickAdd.label")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="proxy-quick-add"
                value={formData.quickInput}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    quickInput: e.target.value,
                  }))
                }
                placeholder={t("proxies.form.quickAdd.singlePlaceholder")}
                disabled={isSubmitting}
              />
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                isLoading={isParsing}
                onClick={handleQuickParse}
                disabled={isSubmitting || !formData.quickInput.trim()}
              >
                {t("proxies.form.quickAdd.parse")}
              </LoadingButton>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>{t("proxies.form.type")}</Label>
              <LoadingButton
                type="button"
                size="sm"
                variant="outline"
                isLoading={isBenchmarking}
                onClick={handleAutoSelectProxyType}
                disabled={isSubmitting || !proxySettings}
              >
                {t("proxies.form.autoType.button")}
              </LoadingButton>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(["http", "https", "socks5", "socks4"] as const).map(
                (protocol) => (
                  <Button
                    key={protocol}
                    type="button"
                    variant={
                      formData.proxy_type === protocol ? "default" : "outline"
                    }
                    className="w-full"
                    disabled={isSubmitting}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, proxy_type: protocol }))
                    }
                  >
                    {t(`proxies.types.${protocol}`)}
                  </Button>
                ),
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="proxy-host">{t("proxies.form.host")}</Label>
              <Input
                id="proxy-host"
                value={formData.host}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, host: e.target.value }))
                }
                placeholder={t("proxies.form.hostPlaceholder")}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-port">{t("proxies.form.port")}</Label>
              <Input
                id="proxy-port"
                inputMode="numeric"
                value={formData.port}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, port: e.target.value }))
                }
                placeholder={t("proxies.form.portPlaceholder")}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="proxy-username">
                {t("proxies.form.username")}
              </Label>
              <Input
                id="proxy-username"
                value={formData.username}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder={t("proxies.form.usernamePlaceholder")}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy-password">
                {t("proxies.form.password")}
              </Label>
              <Input
                id="proxy-password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder={t("proxies.form.passwordPlaceholder")}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <LoadingButton
              type="button"
              size="sm"
              variant="outline"
              isLoading={isChecking}
              onClick={handleCheckProxy}
              disabled={isSubmitting || !proxySettings}
            >
              {t("proxies.form.check")}
            </LoadingButton>
          </div>

          {checkResult?.is_valid && (
            <div className="p-3 space-y-2 rounded-md border bg-muted/40 text-sm">
              <div className="flex justify-between items-center">
                <p className="font-medium">
                  {checkResult.ip}
                  {checkResult.country ? ` • ${checkResult.country}` : ""}
                </p>
                {checkResult.mobile && (
                  <span className="px-2 py-0.5 text-xs rounded-md border bg-card text-muted-foreground">
                    MOBILE
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                <p>
                  {t("proxies.check.details.location")}:{" "}
                  {[checkResult.city, checkResult.country]
                    .filter(Boolean)
                    .join(", ") || t("proxies.check.unknownLocation")}
                </p>
                <p>
                  {t("proxies.check.details.zip")}: {checkResult.zip || "-"}
                </p>
                <p>
                  {t("proxies.check.details.timezone")}:{" "}
                  {checkResult.timezone || "-"}
                </p>
                <p>
                  {t("proxies.check.details.coords")}:{" "}
                  {checkResult.latitude != null && checkResult.longitude != null
                    ? `${checkResult.latitude.toFixed(4)}, ${checkResult.longitude.toFixed(4)}`
                    : "-"}
                </p>
                <p>
                  {t("proxies.check.details.isp")}: {checkResult.isp || "-"}
                </p>
                <p>
                  {t("proxies.check.details.org")}: {checkResult.org || "-"}
                </p>
                <p className="col-span-2">
                  {t("proxies.check.details.asn")}: {checkResult.asn || "-"}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <RippleButton
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {t("common.buttons.cancel")}
          </RippleButton>
          <LoadingButton
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={!isFormValid}
          >
            {editingProxy
              ? t("common.buttons.save")
              : t("common.buttons.create")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
