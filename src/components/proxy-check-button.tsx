"use client";

import { invoke } from "@tauri-apps/api/core";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { FiCheck } from "react-icons/fi";
import { FlagIcon } from "@/components/flag-icon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRelativeTime } from "@/lib/flag-utils";
import {
  classifyProxyCheckError,
  type ProxyCheckFailureMeta,
} from "@/lib/proxy-check-error";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { ProxyCheckResult, StoredProxy } from "@/types";

interface ProxyCheckButtonProps {
  proxy: StoredProxy;
  profileId: string;
  checkingProfileId: string | null;
  cachedResult?: ProxyCheckResult;
  onCheckComplete?: (result: ProxyCheckResult) => void;
  onCheckFailed?: (
    result: ProxyCheckResult,
    failure: ProxyCheckFailureMeta,
  ) => void;
  disabled?: boolean;
  setCheckingProfileId?: (id: string | null) => void;
}

export function ProxyCheckButton({
  proxy,
  profileId,
  checkingProfileId,
  cachedResult,
  onCheckComplete,
  onCheckFailed,
  disabled = false,
  setCheckingProfileId,
}: ProxyCheckButtonProps) {
  const { t } = useTranslation();
  const [localResult, setLocalResult] = React.useState<
    ProxyCheckResult | undefined
  >(cachedResult);
  const [lastFailure, setLastFailure] = React.useState<ProxyCheckFailureMeta>();

  React.useEffect(() => {
    setLocalResult(cachedResult);
  }, [cachedResult]);

  const handleCheck = React.useCallback(async () => {
    if (checkingProfileId === profileId) return;

    setCheckingProfileId?.(profileId);
    try {
      const result = await invoke<ProxyCheckResult>("check_proxy_validity", {
        proxyId: proxy.id,
        proxySettings: proxy.proxy_settings,
      });
      setLocalResult(result);
      setLastFailure(undefined);
      onCheckComplete?.(result);

      // Show toast with location
      const locationParts: string[] = [];
      if (result.city) locationParts.push(result.city);
      if (result.country) locationParts.push(result.country);
      const location =
        locationParts.length > 0
          ? locationParts.join(", ")
          : t("proxies.check.unknownLocation");

      showSuccessToast(
        t("proxies.check.messages.location", {
          location,
        }),
      );
    } catch (error) {
      const failure = classifyProxyCheckError(error);
      setLastFailure(failure);
      showErrorToast(t("proxies.check.messages.failed"), {
        description: t(`proxies.check.failures.${failure.category}`),
      });

      // Save failed check result
      const failedResult: ProxyCheckResult = {
        ip: "",
        city: undefined,
        country: undefined,
        country_code: undefined,
        timestamp: Math.floor(Date.now() / 1000),
        is_valid: false,
      };
      setLocalResult(failedResult);
      onCheckFailed?.(failedResult, failure);
    } finally {
      setCheckingProfileId?.(null);
    }
  }, [
    proxy,
    profileId,
    checkingProfileId,
    onCheckComplete,
    onCheckFailed,
    setCheckingProfileId,
    t,
  ]);

  const isCurrentlyChecking = checkingProfileId === profileId;
  const result = localResult;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleCheck}
          disabled={isCurrentlyChecking || disabled}
        >
          {isCurrentlyChecking ? (
            <div className="w-3 h-3 rounded-full border border-current animate-spin border-t-transparent" />
          ) : result?.is_valid && result.country_code ? (
            <span className="relative inline-flex items-center justify-center">
              <FlagIcon countryCode={result.country_code} className="h-2.5" />
              <FiCheck className="absolute bottom-[-6px] right-[-4px]" />
            </span>
          ) : result && !result.is_valid ? (
            <span className="text-destructive text-sm">✕</span>
          ) : (
            <FiCheck className="w-3 h-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isCurrentlyChecking ? (
          <p>{t("proxies.check.tooltips.checking")}</p>
        ) : result?.is_valid ? (
          <div className="space-y-1">
            <p className="flex items-center gap-1">
              {result.country_code && (
                <FlagIcon countryCode={result.country_code} />
              )}
              {[result.city, result.country].filter(Boolean).join(", ") ||
                t("proxies.check.unknownLocation")}
            </p>
            <p className="text-xs text-primary-foreground/70">
              IP: {result.ip}
            </p>
            <p className="text-xs text-primary-foreground/70">
              Checked {formatRelativeTime(result.timestamp)}
            </p>
          </div>
        ) : result && !result.is_valid ? (
          <div>
            <p>{t("proxies.check.messages.failed")}</p>
            <p className="text-xs text-primary-foreground/70">
              {t(
                `proxies.check.failures.${lastFailure?.category ?? "unknown"}`,
              )}
            </p>
            <p className="text-xs text-primary-foreground/70">
              {t("proxies.check.tooltips.retryHint")}
            </p>
            <p className="text-xs text-primary-foreground/70">
              {t("proxies.check.tooltips.failedAt", {
                time: formatRelativeTime(result.timestamp),
              })}
            </p>
          </div>
        ) : (
          <p>{t("proxies.check.tooltips.default")}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
