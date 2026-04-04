"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaApple, FaLinux, FaWindows } from "react-icons/fa";
import { LoadingButton } from "@/components/loading-button";
import { SharedCamoufoxConfigForm } from "@/components/shared-camoufox-config-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WayfernConfigForm } from "@/components/wayfern-config-form";
import { useBrowserDownload } from "@/hooks/use-browser-download";
import { getBrowserIcon } from "@/lib/browser-utils";
import {
  classifyProxyCheckError,
  type ProxyCheckFailureMeta,
} from "@/lib/proxy-check-error";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import {
  DATA_SCOPE_CHANGED_EVENT,
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import type {
  BrowserReleaseTypes,
  CamoufoxConfig,
  CamoufoxOS,
  ProxyCheckResult,
  ProxyParseResult,
  ProxyProtocolBenchmark,
  StoredProxy,
  WayfernConfig,
  WayfernOS,
} from "@/types";

const getCurrentOS = (): CamoufoxOS => {
  if (typeof navigator === "undefined") return "linux";
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) return "windows";
  if (platform.includes("mac")) return "macos";
  return "linux";
};

const getDefaultCamoufoxScreenConfig = () => {
  // Usability-first: don't force screen constraints by default.
  return {};
};

const createDefaultCamoufoxConfig = (): CamoufoxConfig => ({
  geoip: true,
  os: getCurrentOS(),
  ...getDefaultCamoufoxScreenConfig(),
});

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

import { RippleButton } from "./ui/ripple";

type BrowserTypeString =
  | "firefox"
  | "firefox-developer"
  | "chromium"
  | "brave"
  | "zen"
  | "camoufox"
  | "wayfern";

interface CreateProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "dialog" | "page";
  onCreateProfile: (profileData: {
    name: string;
    browserStr: BrowserTypeString;
    version: string;
    releaseType: string;
    proxyId?: string;
    vpnId?: string;
    camoufoxConfig?: CamoufoxConfig;
    wayfernConfig?: WayfernConfig;
    groupId?: string;
    extensionGroupId?: string;
    ephemeral?: boolean;
    launchAfterCreate?: boolean;
  }) => Promise<void>;
  selectedGroupId?: string;
  crossOsUnlocked?: boolean;
}

interface BrowserOption {
  value: BrowserTypeString;
  label: string;
}

interface ProxyFormState {
  quickInput: string;
  proxy_type: "http" | "https" | "socks4" | "socks5";
  host: string;
  port: string;
  username: string;
  password: string;
}

interface DraftProxySettings {
  proxy_type: "http" | "https" | "socks4" | "socks5";
  host: string;
  port: number;
  username?: string;
  password?: string;
}

const browserOptions: BrowserOption[] = [
  {
    value: "firefox",
    label: "Firefox",
  },
  {
    value: "firefox-developer",
    label: "Firefox Developer Edition",
  },
  {
    value: "chromium",
    label: "Chromium",
  },
  {
    value: "brave",
    label: "Brave",
  },
  {
    value: "zen",
    label: "Zen Browser",
  },
];

export function CreateProfileDialog({
  isOpen,
  onClose,
  mode = "dialog",
  onCreateProfile,
  selectedGroupId,
  crossOsUnlocked = false,
}: CreateProfileDialogProps) {
  const { t } = useTranslation();
  const [profileName, setProfileName] = useState("");
  const [currentStep, setCurrentStep] = useState<
    "browser-selection" | "browser-config"
  >("browser-config");
  const [activeTab, setActiveTab] = useState("anti-detect");
  const [configSection, setConfigSection] = useState<
    "basic" | "proxy" | "advanced"
  >("basic");

  // Browser selection states
  const [selectedBrowser, setSelectedBrowser] =
    useState<BrowserTypeString | null>("camoufox");
  const [proxyForm, setProxyForm] = useState<ProxyFormState>({
    quickInput: "",
    proxy_type: "http",
    host: "",
    port: "",
    username: "",
    password: "",
  });
  const [isProxyParsing, setIsProxyParsing] = useState(false);
  const [isProxyChecking, setIsProxyChecking] = useState(false);
  const [proxyCheckResult, setProxyCheckResult] =
    useState<ProxyCheckResult | null>(null);
  const [proxyCheckFailure, setProxyCheckFailure] =
    useState<ProxyCheckFailureMeta | null>(null);
  const [storedProxies, setStoredProxies] = useState<StoredProxy[]>([]);
  const [proxyInUseBySyncedProfile, setProxyInUseBySyncedProfile] = useState<
    Record<string, boolean>
  >({});
  const [proxyInputMode, setProxyInputMode] = useState<"quick" | "existing">(
    "quick",
  );
  const [proxySearchQuery, setProxySearchQuery] = useState("");
  const [proxyUsageFilter, setProxyUsageFilter] = useState<
    "all" | "used" | "unused"
  >("all");
  const [selectedExistingProxyId, setSelectedExistingProxyId] =
    useState("none");

  // Camoufox anti-detect states
  const [camoufoxConfig, setCamoufoxConfig] = useState<CamoufoxConfig>(
    createDefaultCamoufoxConfig,
  );

  // Wayfern anti-detect states
  const [wayfernConfig, setWayfernConfig] = useState<WayfernConfig>(() => ({
    os: getCurrentOS() as WayfernOS, // Default to current OS
  }));

  const handleBrowserSelect = (browser: BrowserTypeString) => {
    setSelectedBrowser(browser);
    setConfigSection("basic");
    setCurrentStep("browser-config");
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setCurrentStep("browser-config");
    setSelectedBrowser("camoufox");
    setProfileName("");
    setProxyForm({
      quickInput: "",
      proxy_type: "http",
      host: "",
      port: "",
      username: "",
      password: "",
    });
    setProxyInputMode("quick");
    setProxySearchQuery("");
    setProxyUsageFilter("all");
    setSelectedExistingProxyId("none");
    setProxyCheckResult(null);
    setProxyCheckFailure(null);
    setConfigSection("basic");
  };

  const [supportedBrowsers, setSupportedBrowsers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [launchAfterCreate, setLaunchAfterCreate] = useState(false);
  const [selectedExtensionGroupId, setSelectedExtensionGroupId] =
    useState<string>();
  const [extensionGroups, setExtensionGroups] = useState<
    { id: string; name: string; extension_ids: string[] }[]
  >([]);
  const loadScopedProxiesAndUsage = useCallback(async () => {
    try {
      const proxies = await invoke<StoredProxy[]>("get_stored_proxies");
      const scope = getCurrentDataScope();
      const scopedProxies = scopeEntitiesForContext(
        "proxies",
        proxies,
        (proxy) => proxy.id,
        scope,
      );
      const sortedProxies = [...scopedProxies].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      setStoredProxies(sortedProxies);

      const proxyIds = sortedProxies.map((proxy) => proxy.id);
      if (proxyIds.length === 0) {
        setProxyInUseBySyncedProfile({});
        return;
      }

      const usageRows = await invoke<Record<string, boolean>>(
        "get_proxies_in_use_by_synced_profiles",
        { proxyIds },
      );
      const usageByProxyId = Object.fromEntries(
        proxyIds.map((proxyId) => [proxyId, Boolean(usageRows?.[proxyId])]),
      ) as Record<string, boolean>;
      setProxyInUseBySyncedProfile(usageByProxyId);
    } catch {
      setStoredProxies([]);
      setProxyInUseBySyncedProfile({});
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      invoke<{ id: string; name: string; extension_ids: string[] }[]>(
        "list_extension_groups",
      )
        .then(setExtensionGroups)
        .catch(() => setExtensionGroups([]));
      void loadScopedProxiesAndUsage();
    }
  }, [isOpen, loadScopedProxiesAndUsage]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleScopeChanged = () => {
      void loadScopedProxiesAndUsage();
    };

    window.addEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    return () => {
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    };
  }, [isOpen, loadScopedProxiesAndUsage]);
  const [releaseTypes, setReleaseTypes] = useState<BrowserReleaseTypes>();
  const [isLoadingReleaseTypes, setIsLoadingReleaseTypes] = useState(false);
  const [releaseTypesError, setReleaseTypesError] = useState<string | null>(
    null,
  );
  const loadingBrowserRef = useRef<string | null>(null);

  // Use the browser download hook
  const {
    isBrowserDownloading,
    downloadBrowser,
    loadDownloadedVersions,
    isVersionDownloaded,
    downloadedVersionsMap,
  } = useBrowserDownload();

  const loadSupportedBrowsers = useCallback(async () => {
    try {
      const browsers = await invoke<string[]>("get_supported_browsers");
      setSupportedBrowsers(browsers);
    } catch (error) {
      console.error("Failed to load supported browsers:", error);
    }
  }, []);

  const checkAndDownloadGeoIPDatabase = useCallback(async () => {
    try {
      const isAvailable = await invoke<boolean>("is_geoip_database_available");
      if (!isAvailable) {
        console.log("GeoIP database not available, downloading...");
        await invoke("download_geoip_database");
        console.log("GeoIP database downloaded successfully");
      }
    } catch (error) {
      console.error("Failed to check/download GeoIP database:", error);
      // Don't show error to user as this is not critical for profile creation
    }
  }, []);

  const loadReleaseTypes = useCallback(
    async (browser: string) => {
      // Set loading state
      loadingBrowserRef.current = browser;
      setIsLoadingReleaseTypes(true);
      setReleaseTypesError(null);

      try {
        const rawReleaseTypes = await invoke<BrowserReleaseTypes>(
          "get_browser_release_types",
          { browserStr: browser },
        );

        await loadDownloadedVersions(browser);

        // Only update state if this browser is still the one we're loading
        if (loadingBrowserRef.current === browser) {
          // Filter to enforce stable-only creation, except Firefox Developer (nightly-only)
          if (browser === "camoufox" || browser === "wayfern") {
            const filtered: BrowserReleaseTypes = {};
            if (rawReleaseTypes.stable)
              filtered.stable = rawReleaseTypes.stable;
            setReleaseTypes(filtered);
          } else if (browser === "firefox-developer") {
            const filtered: BrowserReleaseTypes = {};
            if (rawReleaseTypes.nightly)
              filtered.nightly = rawReleaseTypes.nightly;
            setReleaseTypes(filtered);
          } else {
            const filtered: BrowserReleaseTypes = {};
            if (rawReleaseTypes.stable)
              filtered.stable = rawReleaseTypes.stable;
            setReleaseTypes(filtered);
          }
          setReleaseTypesError(null);
        }
      } catch (error) {
        console.error(`Failed to load release types for ${browser}:`, error);

        // Fallback: still load downloaded versions and derive release type from them if possible
        try {
          const downloaded = await loadDownloadedVersions(browser);
          if (loadingBrowserRef.current === browser && downloaded.length > 0) {
            const latest = downloaded[0];
            const fallback: BrowserReleaseTypes = {};
            if (browser === "firefox-developer") {
              fallback.nightly = latest;
            } else {
              fallback.stable = latest;
            }
            setReleaseTypes(fallback);
            setReleaseTypesError(null);
          } else if (loadingBrowserRef.current === browser) {
            // No downloaded versions and API failed - show error
            setReleaseTypesError(
              "Failed to fetch browser versions. Please check your internet connection and try again.",
            );
          }
        } catch (e) {
          console.error(
            `Failed to load downloaded versions for ${browser}:`,
            e,
          );
          if (loadingBrowserRef.current === browser) {
            setReleaseTypesError(
              "Failed to fetch browser versions. Please check your internet connection and try again.",
            );
          }
        }
      } finally {
        // Clear loading state only if we're still loading this browser
        if (loadingBrowserRef.current === browser) {
          loadingBrowserRef.current = null;
          setIsLoadingReleaseTypes(false);
        }
      }
    },
    [loadDownloadedVersions],
  );

  // Load data when dialog opens
  useEffect(() => {
    if (isOpen) {
      void loadSupportedBrowsers();
      // Load release types when a browser is selected
      if (selectedBrowser) {
        void loadReleaseTypes(selectedBrowser);
      }
      // Check and download GeoIP database if needed for Camoufox or Wayfern
      if (selectedBrowser === "camoufox" || selectedBrowser === "wayfern") {
        void checkAndDownloadGeoIPDatabase();
      }
    }
  }, [
    isOpen,
    loadSupportedBrowsers,
    loadReleaseTypes,
    checkAndDownloadGeoIPDatabase,
    selectedBrowser,
  ]);

  // Load release types when browser selection changes
  useEffect(() => {
    if (selectedBrowser) {
      // Cancel any previous loading
      loadingBrowserRef.current = null;
      // Clear previous release types immediately to prevent showing stale data
      setReleaseTypes({});
      void loadReleaseTypes(selectedBrowser);
    }
  }, [selectedBrowser, loadReleaseTypes]);

  // Helper function to get the best available version respecting rules
  const getBestAvailableVersion = useCallback(
    (browserType?: string) => {
      if (!releaseTypes) return null;

      // Firefox Developer Edition: nightly-only
      if (browserType === "firefox-developer" && releaseTypes.nightly) {
        return {
          version: releaseTypes.nightly,
          releaseType: "nightly" as const,
        };
      }
      // All others: stable-only
      if (releaseTypes.stable) {
        return { version: releaseTypes.stable, releaseType: "stable" as const };
      }
      return null;
    },
    [releaseTypes],
  );

  const getCreatableVersion = useCallback(
    (browserType?: string) => {
      const bestVersion = getBestAvailableVersion(browserType);
      if (bestVersion && isVersionDownloaded(bestVersion.version)) {
        return bestVersion;
      }
      const browserDownloaded = downloadedVersionsMap[browserType ?? ""] ?? [];
      if (browserDownloaded.length > 0) {
        const fallbackVersion = browserDownloaded[0];
        const releaseType =
          browserType === "firefox-developer" ? "nightly" : "stable";
        return {
          version: fallbackVersion,
          releaseType: releaseType as "stable" | "nightly",
        };
      }
      return null;
    },
    [getBestAvailableVersion, isVersionDownloaded, downloadedVersionsMap],
  );

  const handleDownload = async (browserStr: string) => {
    const bestVersion = getBestAvailableVersion(browserStr);

    if (!bestVersion) {
      console.error("No version available for download");
      return;
    }

    try {
      await downloadBrowser(browserStr, bestVersion.version);
    } catch (error) {
      console.error("Failed to download browser:", error);
    }
  };

  const isProxyConfigured = useMemo(() => {
    return proxyForm.host.trim().length > 0 || proxyForm.port.trim().length > 0;
  }, [proxyForm.host, proxyForm.port]);

  const parsedProxyPort = useMemo(() => {
    return Number.parseInt(proxyForm.port, 10);
  }, [proxyForm.port]);

  const isProxyManualValid = useMemo(() => {
    return (
      proxyForm.host.trim().length > 0 &&
      Number.isFinite(parsedProxyPort) &&
      parsedProxyPort > 0 &&
      parsedProxyPort <= 65535
    );
  }, [parsedProxyPort, proxyForm.host]);

  const buildProxySettings = useCallback((): DraftProxySettings | null => {
    if (!isProxyManualValid) {
      return null;
    }

    return {
      proxy_type: proxyForm.proxy_type,
      host: proxyForm.host.trim(),
      port: parsedProxyPort,
      username: proxyForm.username.trim() || undefined,
      password: proxyForm.password.trim() || undefined,
    };
  }, [
    isProxyManualValid,
    parsedProxyPort,
    proxyForm.host,
    proxyForm.password,
    proxyForm.proxy_type,
    proxyForm.username,
  ]);

  const runProxyCheck = useCallback(
    async (
      proxyId: string,
      proxySettings: DraftProxySettings,
      options?: {
        silent?: boolean;
        maxAttempts?: number;
      },
    ): Promise<ProxyCheckResult | null> => {
      setIsProxyChecking(true);
      const silent = options?.silent ?? false;
      const maxAttempts = Math.max(1, options?.maxAttempts ?? 2);
      let lastFailure: ProxyCheckFailureMeta | null = null;

      try {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          try {
            const result = await invoke<ProxyCheckResult>(
              "check_proxy_validity",
              {
                proxyId,
                proxySettings,
              },
            );
            setProxyCheckResult(result);
            setProxyCheckFailure(null);
            if (!silent) {
              showSuccessToast(
                t("proxies.check.messages.location", {
                  location:
                    [result.city, result.country].filter(Boolean).join(", ") ||
                    t("proxies.check.unknownLocation"),
                }),
              );
            }
            return result;
          } catch (error) {
            const failure = classifyProxyCheckError(error);
            lastFailure = failure;
            const normalizedMessage = failure.message.toLowerCase();
            const shouldRetry =
              attempt < maxAttempts - 1 &&
              failure.retryable &&
              (failure.category === "timeout" ||
                normalizedMessage.includes(
                  "proxy worker failed to start in time",
                ));

            if (shouldRetry) {
              await sleep(350);
            }
          }
        }

        const failedResult: ProxyCheckResult = {
          ip: "",
          city: undefined,
          country: undefined,
          country_code: undefined,
          timestamp: Math.floor(Date.now() / 1000),
          is_valid: false,
        };
        setProxyCheckResult(failedResult);
        setProxyCheckFailure(lastFailure);
        if (!silent) {
          showErrorToast(t("proxies.check.messages.failed"), {
            description: t(
              `proxies.check.failures.${lastFailure?.category ?? "unknown"}`,
            ),
          });
        }
        return null;
      } finally {
        setIsProxyChecking(false);
      }
    },
    [t],
  );

  const resolveBestQuickProtocol = useCallback(
    async (
      fallbackProtocol: ProxyFormState["proxy_type"],
      host: string,
      port: number,
      username?: string,
      password?: string,
    ): Promise<ProxyFormState["proxy_type"]> => {
      try {
        const benchmark = await Promise.race([
          invoke<ProxyProtocolBenchmark>("benchmark_proxy_protocols", {
            host,
            port,
            username: username ?? null,
            password: password ?? null,
          }),
          sleep(1200).then(() => null),
        ]);
        if (!benchmark) {
          return fallbackProtocol;
        }
        const protocol = benchmark.best_protocol as
          | ProxyFormState["proxy_type"]
          | undefined;
        if (protocol) {
          return protocol;
        }
      } catch {
        // Keep fallback protocol when benchmark is unavailable.
      }
      return fallbackProtocol;
    },
    [],
  );

  const handleProxyQuickParse = useCallback(async () => {
    const content = proxyForm.quickInput.trim();
    if (!content) {
      showErrorToast(t("proxies.form.quickAdd.validation.empty"));
      return;
    }

    setIsProxyParsing(true);
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

      const parsedType =
        (parsed.proxy_type as ProxyFormState["proxy_type"]) || "http";

      setProxyForm((prev) => ({
        ...prev,
        proxy_type: parsedType,
        host: parsed.host,
        port: String(parsed.port),
        username: parsed.username ?? "",
        password: parsed.password ?? "",
      }));
      setSelectedExistingProxyId("none");
      setProxyCheckResult(null);
      setProxyCheckFailure(null);
      showSuccessToast(t("proxies.form.quickAdd.parseSuccess"));

      void (async () => {
        const bestProtocol = await resolveBestQuickProtocol(
          parsedType,
          parsed.host,
          parsed.port,
          parsed.username ?? undefined,
          parsed.password ?? undefined,
        );
        setProxyForm((prev) => ({
          ...prev,
          proxy_type: bestProtocol,
        }));
        await runProxyCheck(
          `draft-${bestProtocol}-${Date.now()}`,
          {
            proxy_type: bestProtocol,
            host: parsed.host,
            port: parsed.port,
            username: parsed.username ?? undefined,
            password: parsed.password ?? undefined,
          },
          {
            silent: true,
            maxAttempts: 1,
          },
        );
      })();
    } catch {
      showErrorToast(t("proxies.form.quickAdd.parseFailed"));
    } finally {
      setIsProxyParsing(false);
    }
  }, [proxyForm.quickInput, resolveBestQuickProtocol, runProxyCheck, t]);

  useEffect(() => {
    if (
      !isOpen ||
      proxyInputMode !== "existing" ||
      selectedExistingProxyId === "none"
    ) {
      return;
    }

    const selectedProxy = storedProxies.find(
      (proxy) => proxy.id === selectedExistingProxyId,
    );
    if (!selectedProxy) {
      return;
    }

    const proxySettings = selectedProxy.proxy_settings;
    const draftSettings: DraftProxySettings = {
      proxy_type: proxySettings.proxy_type as ProxyFormState["proxy_type"],
      host: proxySettings.host,
      port: proxySettings.port,
      username: proxySettings.username ?? undefined,
      password: proxySettings.password ?? undefined,
    };

    setProxyCheckResult(null);
    setProxyCheckFailure(null);
    void runProxyCheck(`stored-${selectedProxy.id}`, draftSettings, {
      silent: true,
    });
  }, [
    isOpen,
    proxyInputMode,
    selectedExistingProxyId,
    storedProxies,
    runProxyCheck,
  ]);

  const handleProxyCheck = useCallback(async () => {
    setSelectedExistingProxyId("none");
    const proxySettings = buildProxySettings();
    if (!proxySettings) {
      showErrorToast(t("proxies.form.validation.hostPortRequired"));
      return;
    }

    await runProxyCheck(`draft-${Date.now()}`, proxySettings);
  }, [buildProxySettings, runProxyCheck, t]);

  const createDraftProxyIfNeeded = useCallback(async (): Promise<
    string | undefined
  > => {
    if (proxyInputMode === "existing" && selectedExistingProxyId !== "none") {
      return selectedExistingProxyId;
    }

    if (!isProxyConfigured) {
      return undefined;
    }

    const proxySettings = buildProxySettings();
    if (!proxySettings) {
      throw new Error(t("proxies.form.validation.hostPortRequired"));
    }

    const baseName = `${profileName.trim()} Proxy`;
    const candidateNames = [
      baseName,
      `${baseName} 2`,
      `${baseName} 3`,
      `${baseName} ${Date.now()}`,
    ];

    for (const name of candidateNames) {
      try {
        const created = await invoke<StoredProxy>("create_stored_proxy", {
          name,
          proxySettings,
        });
        return created.id;
      } catch (error) {
        if (!String(error).includes("already exists")) {
          throw error;
        }
      }
    }

    throw new Error("Failed to generate unique proxy name");
  }, [
    buildProxySettings,
    isProxyConfigured,
    profileName,
    proxyInputMode,
    selectedExistingProxyId,
    t,
  ]);

  const handleCreate = async () => {
    if (!profileName.trim()) return;

    setIsCreating(true);
    try {
      const resolvedProxyId = await createDraftProxyIfNeeded();

      if (activeTab === "anti-detect") {
        // Anti-detect browser - check if Wayfern or Camoufox is selected
        if (selectedBrowser === "wayfern") {
          const bestWayfernVersion = getCreatableVersion("wayfern");
          if (!bestWayfernVersion) {
            showErrorToast(t("toasts.error.profileCreateFailed"));
            return;
          }

          // The fingerprint will be generated at launch time by the Rust backend
          const finalWayfernConfig = { ...wayfernConfig };

          await onCreateProfile({
            name: profileName.trim(),
            browserStr: "wayfern" as BrowserTypeString,
            version: bestWayfernVersion.version,
            releaseType: bestWayfernVersion.releaseType,
            proxyId: resolvedProxyId,
            wayfernConfig: finalWayfernConfig,
            groupId:
              selectedGroupId !== "all" && selectedGroupId !== "default"
                ? selectedGroupId
                : undefined,
            extensionGroupId: selectedExtensionGroupId,
            ephemeral,
            launchAfterCreate,
          });
        } else {
          // Default to Camoufox
          const bestCamoufoxVersion = getCreatableVersion("camoufox");
          if (!bestCamoufoxVersion) {
            showErrorToast(t("toasts.error.profileCreateFailed"));
            return;
          }

          // The fingerprint will be generated at launch time by the Rust backend
          // We don't need to generate it here during profile creation
          const finalCamoufoxConfig = { ...camoufoxConfig };

          await onCreateProfile({
            name: profileName.trim(),
            browserStr: "camoufox" as BrowserTypeString,
            version: bestCamoufoxVersion.version,
            releaseType: bestCamoufoxVersion.releaseType,
            proxyId: resolvedProxyId,
            camoufoxConfig: finalCamoufoxConfig,
            groupId:
              selectedGroupId !== "all" && selectedGroupId !== "default"
                ? selectedGroupId
                : undefined,
            extensionGroupId: selectedExtensionGroupId,
            ephemeral,
            launchAfterCreate,
          });
        }
      } else {
        // Regular browser
        if (!selectedBrowser) {
          showErrorToast(t("toasts.error.profileCreateFailed"));
          return;
        }

        // Use the best available version (stable preferred, nightly as fallback)
        const bestVersion = getCreatableVersion(selectedBrowser);
        if (!bestVersion) {
          showErrorToast(t("toasts.error.profileCreateFailed"));
          return;
        }

        await onCreateProfile({
          name: profileName.trim(),
          browserStr: selectedBrowser,
          version: bestVersion.version,
          releaseType: bestVersion.releaseType,
          proxyId: resolvedProxyId,
          groupId:
            selectedGroupId !== "all" && selectedGroupId !== "default"
              ? selectedGroupId
              : undefined,
          launchAfterCreate,
        });
      }

      handleClose();
    } catch {
      // Error toasts are handled by the parent onCreateProfile callback.
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    // Cancel any ongoing loading
    loadingBrowserRef.current = null;

    // Reset all states
    setProfileName("");
    setCurrentStep("browser-config");
    setActiveTab("anti-detect");
    setSelectedBrowser("camoufox");
    setProxyForm({
      quickInput: "",
      proxy_type: "http",
      host: "",
      port: "",
      username: "",
      password: "",
    });
    setProxyInputMode("quick");
    setProxySearchQuery("");
    setProxyUsageFilter("all");
    setSelectedExistingProxyId("none");
    setIsProxyParsing(false);
    setIsProxyChecking(false);
    setProxyCheckResult(null);
    setProxyCheckFailure(null);
    setReleaseTypes({});
    setIsLoadingReleaseTypes(false);
    setReleaseTypesError(null);
    setCamoufoxConfig(createDefaultCamoufoxConfig());
    setWayfernConfig({
      os: getCurrentOS() as WayfernOS, // Reset to current OS
    });
    setEphemeral(false);
    setLaunchAfterCreate(false);
    setConfigSection("basic");
    onClose();
  };

  const updateCamoufoxConfig = (key: keyof CamoufoxConfig, value: unknown) => {
    setCamoufoxConfig((prev) => ({ ...prev, [key]: value }));
  };

  const updateWayfernConfig = (key: keyof WayfernConfig, value: unknown) => {
    setWayfernConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Check if browser version is downloaded and available
  const isBrowserVersionAvailable = useCallback(
    (browserStr: string) => {
      const bestVersion = getBestAvailableVersion(browserStr);
      return bestVersion && isVersionDownloaded(bestVersion.version);
    },
    [isVersionDownloaded, getBestAvailableVersion],
  );

  // Check if browser is currently downloading
  const isBrowserCurrentlyDownloading = useCallback(
    (browserStr: string) => {
      return isBrowserDownloading(browserStr);
    },
    [isBrowserDownloading],
  );

  const isCreateDisabled = useMemo(() => {
    if (!profileName.trim()) return true;
    if (!selectedBrowser) return true;
    if (isBrowserCurrentlyDownloading(selectedBrowser)) return true;
    if (!getCreatableVersion(selectedBrowser)) return true;

    return false;
  }, [
    profileName,
    selectedBrowser,
    isBrowserCurrentlyDownloading,
    getCreatableVersion,
  ]);

  // Filter supported browsers for regular browsers
  const regularBrowsers = browserOptions.filter((browser) =>
    supportedBrowsers.includes(browser.value),
  );

  const basicOsOptions: CamoufoxOS[] = ["windows", "macos", "linux"];

  const selectedBasicOs = useMemo<CamoufoxOS>(() => {
    if (selectedBrowser === "wayfern") {
      const os = wayfernConfig.os;
      if (os === "windows" || os === "macos" || os === "linux") {
        return os;
      }
    }
    if (selectedBrowser === "camoufox") {
      const os = camoufoxConfig.os;
      if (os === "windows" || os === "macos" || os === "linux") {
        return os;
      }
    }
    return getCurrentOS();
  }, [camoufoxConfig.os, selectedBrowser, wayfernConfig.os]);

  const showAntiDetectBasicFields =
    activeTab === "anti-detect" &&
    (selectedBrowser === "camoufox" || selectedBrowser === "wayfern");

  const randomizeFingerprintOnLaunch =
    selectedBrowser === "wayfern"
      ? wayfernConfig.randomize_fingerprint_on_launch === true
      : camoufoxConfig.randomize_fingerprint_on_launch === true;

  const handleBasicOsChange = (os: CamoufoxOS) => {
    if (selectedBrowser === "wayfern") {
      updateWayfernConfig("os", os as WayfernOS);
      return;
    }
    updateCamoufoxConfig("os", os);
  };

  const handleRandomizeFingerprintChange = (checked: boolean) => {
    if (selectedBrowser === "wayfern") {
      updateWayfernConfig("randomize_fingerprint_on_launch", checked);
      return;
    }
    updateCamoufoxConfig("randomize_fingerprint_on_launch", checked);
  };

  const profileNameSection = (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>{t("createProfile.antiDetect.title")}</Label>
        <div className="max-w-[640px]">
          <Select
            value={selectedBrowser ?? "camoufox"}
            onValueChange={(value) =>
              setSelectedBrowser(value as "wayfern" | "camoufox")
            }
          >
            <SelectTrigger className="h-10 w-[260px]">
              <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
                {(() => {
                  const iconKey =
                    selectedBrowser === "camoufox" ? "camoufox" : "wayfern";
                  const IconComponent = getBrowserIcon(iconKey);
                  return IconComponent ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      <IconComponent className="h-4 w-4" />
                    </span>
                  ) : null;
                })()}
                <span className="truncate">
                  {selectedBrowser === "camoufox"
                    ? t("createProfile.antiDetect.firefox")
                    : t("createProfile.antiDetect.chromium")}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wayfern">
                <div className="flex items-center gap-2">
                  {(() => {
                    const IconComponent = getBrowserIcon("wayfern");
                    return IconComponent ? (
                      <IconComponent className="h-4 w-4" />
                    ) : null;
                  })()}
                  <span>{t("createProfile.antiDetect.chromium")}</span>
                </div>
              </SelectItem>
              <SelectItem value="camoufox">
                <div className="flex items-center gap-2">
                  {(() => {
                    const IconComponent = getBrowserIcon("camoufox");
                    return IconComponent ? (
                      <IconComponent className="h-4 w-4" />
                    ) : null;
                  })()}
                  <span>{t("createProfile.antiDetect.firefox")}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("createProfile.antiDetect.description")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-name">{t("createProfile.profileName")}</Label>
        <Input
          id="profile-name"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isCreateDisabled && !isCreating) {
              handleCreate();
            }
          }}
          placeholder={t("createProfile.profileNamePlaceholder")}
          className="max-w-[640px]"
        />
      </div>

      {showAntiDetectBasicFields && (
        <>
          <div className="space-y-2">
            <Label>{t("fingerprint.osLabel")}</Label>
            <div className="flex max-w-[640px] flex-wrap items-start gap-2">
              {basicOsOptions.map((os) => (
                <Button
                  key={os}
                  type="button"
                  size="sm"
                  variant={selectedBasicOs === os ? "default" : "outline"}
                  onClick={() => handleBasicOsChange(os)}
                  className="h-9 w-[128px] justify-start gap-2 px-3"
                >
                  {os === "windows" ? (
                    <FaWindows className="h-3.5 w-3.5 shrink-0" />
                  ) : os === "macos" ? (
                    <FaApple className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <FaLinux className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {t(`fingerprint.os.${os}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="max-w-[640px] space-y-3 border-t border-border/70 pt-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="randomize-fingerprint-basic"
                checked={randomizeFingerprintOnLaunch}
                onCheckedChange={(checked) =>
                  handleRandomizeFingerprintChange(checked === true)
                }
              />
              <Label
                htmlFor="randomize-fingerprint-basic"
                className="font-medium"
              >
                {t("fingerprint.generateRandomOnLaunch")}
              </Label>
            </div>
            <p className="ml-6 text-sm text-muted-foreground">
              {t("fingerprint.generateRandomDescription")}
            </p>
          </div>
        </>
      )}
    </div>
  );

  const ephemeralSection = (
    <div className="max-w-[640px] space-y-3 border-t border-border/70 pt-3">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="ephemeral"
          checked={ephemeral}
          onCheckedChange={(checked) => setEphemeral(checked === true)}
        />
        <Label htmlFor="ephemeral" className="font-medium">
          {t("profiles.ephemeral")}
        </Label>
        <span className="px-1 py-0.5 text-[10px] leading-tight rounded bg-muted text-muted-foreground font-medium">
          {t("profiles.ephemeralAlpha")}
        </span>
      </div>
      <p className="text-sm text-muted-foreground ml-6">
        {t("profiles.ephemeralDescription")}
      </p>
    </div>
  );

  const extensionGroupSection =
    extensionGroups.length > 0 ? (
      <div className="space-y-2">
        <Label>{t("extensions.extensionGroup")}</Label>
        <Select
          value={selectedExtensionGroupId || "none"}
          onValueChange={(val) =>
            setSelectedExtensionGroupId(val === "none" ? undefined : val)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t("profileInfo.values.none")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("profileInfo.values.none")}</SelectItem>
            {extensionGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name} ({g.extension_ids.length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : null;

  const filteredStoredProxies = useMemo(() => {
    const normalizedQuery = proxySearchQuery.trim().toLowerCase();

    return storedProxies.filter((proxy) => {
      const isUsed = proxyInUseBySyncedProfile[proxy.id] === true;
      if (proxyUsageFilter === "used" && !isUsed) return false;
      if (proxyUsageFilter === "unused" && isUsed) return false;

      if (!normalizedQuery) return true;
      const haystack = [
        proxy.name,
        proxy.proxy_settings.host,
        String(proxy.proxy_settings.port),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [
    proxyInUseBySyncedProfile,
    proxySearchQuery,
    proxyUsageFilter,
    storedProxies,
  ]);

  const shouldShowProxyCheckCard = isProxyChecking || proxyCheckResult !== null;

  const proxyComposerSection = (
    <div className="space-y-2">
      <Label>{t("createProfile.proxy.title")}</Label>

      <div className="space-y-2 rounded-md border bg-card p-2.5">
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/20 p-0.5">
            <Button
              type="button"
              size="sm"
              variant={proxyInputMode === "quick" ? "default" : "ghost"}
              className="h-8 text-xs"
              onClick={() => {
                setProxyInputMode("quick");
              }}
            >
              {t("createProfile.proxy.modeQuick")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={proxyInputMode === "existing" ? "default" : "ghost"}
              className="h-8 text-xs"
              onClick={() => {
                setProxyInputMode("existing");
              }}
            >
              {t("createProfile.sections.proxy")}
            </Button>
          </div>
          <p className="px-1 text-[11px] leading-tight text-muted-foreground">
            {proxyInputMode === "quick"
              ? t("createProfile.proxy.modeHint.quick")
              : t("createProfile.proxy.modeHint.existing")}
          </p>
        </div>

        {proxyInputMode === "existing" && (
          <div className="space-y-1.5">
            <Input
              className="h-8 text-xs"
              value={proxySearchQuery}
              onChange={(e) => setProxySearchQuery(e.target.value)}
              placeholder={t("createProfile.proxy.searchPlaceholder")}
            />

            <div className="grid grid-cols-3 gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                variant={proxyUsageFilter === "all" ? "default" : "outline"}
                onClick={() => setProxyUsageFilter("all")}
              >
                {t("createProfile.proxy.filterAll")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                variant={proxyUsageFilter === "used" ? "default" : "outline"}
                onClick={() => setProxyUsageFilter("used")}
              >
                {t("createProfile.proxy.filterUsed")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                variant={proxyUsageFilter === "unused" ? "default" : "outline"}
                onClick={() => setProxyUsageFilter("unused")}
              >
                {t("createProfile.proxy.filterUnused")}
              </Button>
            </div>

            <ScrollArea className="h-36 rounded-md border bg-muted/20">
              <div className="space-y-1 p-2">
                <Button
                  type="button"
                  variant={
                    selectedExistingProxyId === "none" ? "secondary" : "ghost"
                  }
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedExistingProxyId("none");
                    setProxyCheckResult(null);
                    setProxyCheckFailure(null);
                  }}
                >
                  {t("createProfile.proxy.noProxy")}
                </Button>

                {filteredStoredProxies.map((proxy) => {
                  const isUsed = proxyInUseBySyncedProfile[proxy.id] === true;
                  return (
                    <Button
                      key={proxy.id}
                      type="button"
                      variant={
                        selectedExistingProxyId === proxy.id
                          ? "secondary"
                          : "ghost"
                      }
                      className="h-auto w-full justify-between px-3 py-2"
                      onClick={() => {
                        setSelectedExistingProxyId(proxy.id);
                        setProxyForm((prev) => ({
                          ...prev,
                          proxy_type:
                            (proxy.proxy_settings
                              .proxy_type as ProxyFormState["proxy_type"]) ||
                            prev.proxy_type,
                          host: proxy.proxy_settings.host,
                          port: String(proxy.proxy_settings.port),
                          username: proxy.proxy_settings.username ?? "",
                          password: proxy.proxy_settings.password ?? "",
                        }));
                        setProxyCheckResult(null);
                        setProxyCheckFailure(null);
                      }}
                    >
                      <div className="text-left">
                        <p className="text-xs font-medium">{proxy.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {proxy.proxy_settings.host}:
                          {proxy.proxy_settings.port}
                        </p>
                      </div>
                      <span className="rounded-md border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                        {isUsed
                          ? t("createProfile.proxy.statusUsed")
                          : t("createProfile.proxy.statusUnused")}
                      </span>
                    </Button>
                  );
                })}

                {filteredStoredProxies.length === 0 && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    {t("createProfile.proxy.emptyFiltered")}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {proxyInputMode === "quick" && (
          <div className="space-y-1.5">
            <Label htmlFor="proxy-quick-input">
              {t("proxies.form.quickAdd.label")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 text-xs"
                id="proxy-quick-input"
                value={proxyForm.quickInput}
                onChange={(e) =>
                  setProxyForm((prev) => ({
                    ...prev,
                    quickInput: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && proxyForm.quickInput.trim()) {
                    e.preventDefault();
                    void handleProxyQuickParse();
                  }
                }}
                placeholder={t("proxies.form.quickAdd.singlePlaceholder")}
              />
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                isLoading={isProxyParsing}
                onClick={handleProxyQuickParse}
                disabled={!proxyForm.quickInput.trim()}
              >
                {t("proxies.form.quickAdd.parse")}
              </LoadingButton>
            </div>
          </div>
        )}

        {proxyInputMode === "quick" && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-2.5">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("proxies.form.type")}</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["http", "https", "socks5", "socks4"] as const).map(
                  (protocol) => (
                    <Button
                      key={protocol}
                      type="button"
                      variant={
                        proxyForm.proxy_type === protocol
                          ? "default"
                          : "outline"
                      }
                      className="h-8 w-full text-xs"
                      onClick={() => {
                        setSelectedExistingProxyId("none");
                        setProxyForm((prev) => ({
                          ...prev,
                          proxy_type: protocol,
                        }));
                      }}
                    >
                      {t(`proxies.types.${protocol}`)}
                    </Button>
                  ),
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs" htmlFor="proxy-host">
                  {t("proxies.form.host")}
                </Label>
                <Input
                  className="h-8 text-xs"
                  id="proxy-host"
                  value={proxyForm.host}
                  onChange={(e) => {
                    setSelectedExistingProxyId("none");
                    setProxyForm((prev) => ({ ...prev, host: e.target.value }));
                  }}
                  placeholder={t("proxies.form.hostPlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="proxy-port">
                  {t("proxies.form.port")}
                </Label>
                <Input
                  className="h-8 text-xs"
                  id="proxy-port"
                  inputMode="numeric"
                  value={proxyForm.port}
                  onChange={(e) => {
                    setSelectedExistingProxyId("none");
                    setProxyForm((prev) => ({ ...prev, port: e.target.value }));
                  }}
                  placeholder={t("proxies.form.portPlaceholder")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="proxy-username">
                  {t("proxies.form.username")}
                </Label>
                <Input
                  className="h-8 text-xs"
                  id="proxy-username"
                  value={proxyForm.username}
                  onChange={(e) => {
                    setSelectedExistingProxyId("none");
                    setProxyForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }));
                  }}
                  placeholder={t("proxies.form.usernamePlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="proxy-password">
                  {t("proxies.form.password")}
                </Label>
                <Input
                  className="h-8 text-xs"
                  id="proxy-password"
                  type="password"
                  value={proxyForm.password}
                  onChange={(e) => {
                    setSelectedExistingProxyId("none");
                    setProxyForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }));
                  }}
                  placeholder={t("proxies.form.passwordPlaceholder")}
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-[11px] leading-tight text-muted-foreground">
                {t("createProfile.proxy.autoSaveHint")}
              </p>
              <LoadingButton
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs"
                isLoading={isProxyChecking}
                disabled={!isProxyManualValid}
                onClick={handleProxyCheck}
              >
                {t("createProfile.proxy.check")}
              </LoadingButton>
            </div>
          </div>
        )}

        {shouldShowProxyCheckCard && (
          <div className="space-y-1.5 rounded-md border bg-muted/40 p-2.5 text-xs">
            {isProxyChecking && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                <p>{t("proxies.check.tooltips.checking")}</p>
              </div>
            )}

            {!isProxyChecking && proxyCheckResult?.is_valid && (
              <>
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {proxyCheckResult.ip}{" "}
                    <span className="text-muted-foreground">
                      {proxyCheckResult.country
                        ? `• ${proxyCheckResult.country}`
                        : ""}
                    </span>
                  </p>
                  {proxyCheckResult.mobile && (
                    <span className="rounded-md border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                      MOBILE
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                  <p>
                    {t("proxies.check.details.location")}:{" "}
                    {[proxyCheckResult.city, proxyCheckResult.country]
                      .filter(Boolean)
                      .join(", ") || t("proxies.check.unknownLocation")}
                  </p>
                  <p>
                    {t("proxies.check.details.timezone")}:{" "}
                    {proxyCheckResult.timezone || "-"}
                  </p>
                  <p>
                    {t("proxies.check.details.isp")}:{" "}
                    {proxyCheckResult.isp || "-"}
                  </p>
                  <p>
                    {t("proxies.check.details.asn")}:{" "}
                    {proxyCheckResult.asn || "-"}
                  </p>
                </div>
              </>
            )}

            {!isProxyChecking &&
              proxyCheckResult &&
              !proxyCheckResult.is_valid && (
                <div className="space-y-1 text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {t("proxies.check.messages.failed")}
                  </p>
                  <p>
                    {t(
                      `proxies.check.failures.${proxyCheckFailure?.category ?? "unknown"}`,
                    )}
                  </p>
                  <p>{t("proxies.check.tooltips.retryHint")}</p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );

  const shellContent = (
    <>
      <DialogHeader className="shrink-0 px-6 pt-6">
        <h1 className="text-lg font-semibold leading-tight text-foreground">
          {currentStep === "browser-selection"
            ? "Create New Profile"
            : "Configure Profile"}
        </h1>
      </DialogHeader>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex min-h-0 w-full flex-1 flex-col"
      >
        {/* Tab list hidden - only anti-detect browsers are supported */}

        <ScrollArea className="min-h-0 flex-1">
          <div
            className={cn(
              "mx-auto w-full px-6 py-4",
              mode === "page" && currentStep === "browser-config"
                ? "max-w-[1180px] lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-5"
                : "max-w-3xl",
            )}
          >
            <div
              className={cn(
                "min-w-0 space-y-6",
                mode === "page" && currentStep === "browser-config"
                  ? "lg:max-w-[700px]"
                  : "",
              )}
            >
              {currentStep === "browser-config" && (
                <div className="max-w-[640px] space-y-2">
                  <Tabs
                    value={configSection}
                    onValueChange={(value) =>
                      setConfigSection(value as "basic" | "proxy" | "advanced")
                    }
                    className="w-full max-w-[760px]"
                  >
                    <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-b bg-transparent p-0">
                      <TabsTrigger
                        value="basic"
                        className="rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      >
                        {t("createProfile.sections.basic")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="proxy"
                        className="rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      >
                        {t("createProfile.sections.proxy")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="advanced"
                        className="rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      >
                        {t("createProfile.sections.advanced")}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="px-1 text-xs text-muted-foreground">
                    {t(`createProfile.sections.${configSection}Hint`)}
                  </p>
                </div>
              )}
              {currentStep === "browser-selection" ? (
                <>
                  <TabsContent value="anti-detect" className="mt-0 space-y-6">
                    {/* Anti-Detect Browser Selection */}
                    <div className="space-y-6">
                      <div className="text-center">
                        <h3 className="text-lg font-medium">
                          Anti-Detect Browser
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Choose a browser with anti-detection capabilities
                        </p>
                      </div>

                      <div className="space-y-3">
                        {/* Wayfern (Chromium) - First */}
                        <Button
                          onClick={() => handleBrowserSelect("wayfern")}
                          className="flex gap-3 justify-start items-center p-4 w-full h-16 border-2 transition-colors hover:border-primary/50"
                          variant="outline"
                        >
                          <div className="flex justify-center items-center w-8 h-8">
                            {(() => {
                              const IconComponent = getBrowserIcon("wayfern");
                              return IconComponent ? (
                                <IconComponent className="w-6 h-6" />
                              ) : null;
                            })()}
                          </div>
                          <div className="text-left">
                            <div className="font-medium">
                              {t("createProfile.antiDetect.chromium")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Anti-Detect Browser
                            </div>
                          </div>
                        </Button>

                        {/* Camoufox (Firefox) - Second */}
                        <Button
                          onClick={() => handleBrowserSelect("camoufox")}
                          className="flex gap-3 justify-start items-center p-4 w-full h-16 border-2 transition-colors hover:border-primary/50"
                          variant="outline"
                        >
                          <div className="flex justify-center items-center w-8 h-8">
                            {(() => {
                              const IconComponent = getBrowserIcon("camoufox");
                              return IconComponent ? (
                                <IconComponent className="w-6 h-6" />
                              ) : null;
                            })()}
                          </div>
                          <div className="text-left">
                            <div className="font-medium">
                              {t("createProfile.antiDetect.firefox")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Anti-Detect Browser
                            </div>
                          </div>
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="regular" className="mt-0 space-y-6">
                    {/* Regular Browser Selection */}
                    <div className="space-y-6">
                      <div className="text-center">
                        <h3 className="text-lg font-medium">
                          Regular Browsers
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Choose from supported regular browsers
                        </p>
                      </div>

                      <div className="space-y-3">
                        {regularBrowsers.map((browser) => {
                          if (browser.value === "camoufox") return null; // Skip camoufox as it's handled in anti-detect tab
                          const IconComponent = getBrowserIcon(browser.value);
                          return (
                            <Button
                              key={browser.value}
                              onClick={() => handleBrowserSelect(browser.value)}
                              className="flex gap-3 justify-start items-center p-4 w-full h-16 border-2 transition-colors hover:border-primary/50"
                              variant="outline"
                            >
                              <div className="flex justify-center items-center w-8 h-8">
                                {IconComponent && (
                                  <IconComponent className="w-6 h-6" />
                                )}
                              </div>
                              <div className="text-left">
                                <div className="font-medium">
                                  {browser.label}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Regular Browser
                                </div>
                              </div>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>
                </>
              ) : (
                <>
                  <TabsContent value="anti-detect" className="mt-0">
                    {/* Anti-Detect Configuration */}
                    <div className="space-y-6">
                      {configSection === "basic" && profileNameSection}

                      {/* Ephemeral Option */}
                      {configSection === "advanced" && ephemeralSection}

                      {configSection === "advanced" &&
                        (selectedBrowser === "wayfern" ? (
                          // Wayfern Configuration
                          <div className="space-y-6">
                            {/* Wayfern Download Status */}
                            {isLoadingReleaseTypes && (
                              <div className="flex gap-3 items-center p-3 rounded-md border">
                                <div className="w-4 h-4 rounded-full border-2 animate-spin border-muted/40 border-t-primary" />
                                <p className="text-sm text-muted-foreground">
                                  Fetching available versions...
                                </p>
                              </div>
                            )}
                            {!isLoadingReleaseTypes && releaseTypesError && (
                              <div className="flex gap-3 items-center p-3 rounded-md border border-destructive/50 bg-destructive/10">
                                <p className="flex-1 text-sm text-destructive">
                                  {releaseTypesError}
                                </p>
                                <RippleButton
                                  onClick={() =>
                                    selectedBrowser &&
                                    loadReleaseTypes(selectedBrowser)
                                  }
                                  size="sm"
                                  variant="outline"
                                >
                                  Retry
                                </RippleButton>
                              </div>
                            )}
                            {!isLoadingReleaseTypes &&
                              !releaseTypesError &&
                              !getBestAvailableVersion("wayfern") && (
                                <div className="flex gap-3 items-center p-3 rounded-md border border-yellow-500/50 bg-yellow-500/10">
                                  <p className="text-sm text-yellow-500">
                                    Bugium is not available on your platform
                                    yet.
                                  </p>
                                </div>
                              )}
                            {!isLoadingReleaseTypes &&
                              !releaseTypesError &&
                              !isBrowserCurrentlyDownloading("wayfern") &&
                              !isBrowserVersionAvailable("wayfern") &&
                              getBestAvailableVersion("wayfern") && (
                                <div className="flex gap-3 items-center p-3 rounded-md border">
                                  <p className="text-sm text-muted-foreground">
                                    {(() => {
                                      const bestVersion =
                                        getBestAvailableVersion("wayfern");
                                      return `Bugium version (${bestVersion?.version}) needs to be downloaded`;
                                    })()}
                                  </p>
                                  <LoadingButton
                                    onClick={() => handleDownload("wayfern")}
                                    isLoading={isBrowserCurrentlyDownloading(
                                      "wayfern",
                                    )}
                                    size="sm"
                                    disabled={isBrowserCurrentlyDownloading(
                                      "wayfern",
                                    )}
                                  >
                                    {isBrowserCurrentlyDownloading("wayfern")
                                      ? "Downloading..."
                                      : "Download"}
                                  </LoadingButton>
                                </div>
                              )}
                            {!isLoadingReleaseTypes &&
                              !releaseTypesError &&
                              !isBrowserCurrentlyDownloading("wayfern") &&
                              isBrowserVersionAvailable("wayfern") && (
                                <div className="p-3 text-sm rounded-md border text-muted-foreground">
                                  {(() => {
                                    const bestVersion =
                                      getBestAvailableVersion("wayfern");
                                    return `✓ Bugium version (${bestVersion?.version}) is available`;
                                  })()}
                                </div>
                              )}
                            {isBrowserCurrentlyDownloading("wayfern") && (
                              <div className="p-3 text-sm rounded-md border text-muted-foreground">
                                {(() => {
                                  const bestVersion =
                                    getBestAvailableVersion("wayfern");
                                  return `Downloading Bugium version (${bestVersion?.version})...`;
                                })()}
                              </div>
                            )}

                            <WayfernConfigForm
                              config={wayfernConfig}
                              onConfigChange={updateWayfernConfig}
                              isCreating
                              crossOsUnlocked={crossOsUnlocked}
                              limitedMode={!crossOsUnlocked}
                            />
                          </div>
                        ) : selectedBrowser === "camoufox" ? (
                          // Camoufox Configuration
                          <div className="space-y-6">
                            {/* Camoufox Download Status */}
                            {isLoadingReleaseTypes && (
                              <div className="flex gap-3 items-center p-3 rounded-md border">
                                <div className="w-4 h-4 rounded-full border-2 animate-spin border-muted/40 border-t-primary" />
                                <p className="text-sm text-muted-foreground">
                                  Fetching available versions...
                                </p>
                              </div>
                            )}
                            {!isLoadingReleaseTypes && releaseTypesError && (
                              <div className="flex gap-3 items-center p-3 rounded-md border border-destructive/50 bg-destructive/10">
                                <p className="flex-1 text-sm text-destructive">
                                  {releaseTypesError}
                                </p>
                                <RippleButton
                                  onClick={() =>
                                    selectedBrowser &&
                                    loadReleaseTypes(selectedBrowser)
                                  }
                                  size="sm"
                                  variant="outline"
                                >
                                  Retry
                                </RippleButton>
                              </div>
                            )}
                            {!isLoadingReleaseTypes &&
                              !releaseTypesError &&
                              !getBestAvailableVersion("camoufox") && (
                                <div className="flex gap-3 items-center p-3 rounded-md border border-yellow-500/50 bg-yellow-500/10">
                                  <p className="text-sm text-yellow-500">
                                    Bugox is not available on your platform yet.
                                  </p>
                                </div>
                              )}
                            {!isLoadingReleaseTypes &&
                              !releaseTypesError &&
                              !isBrowserCurrentlyDownloading("camoufox") &&
                              !isBrowserVersionAvailable("camoufox") &&
                              getBestAvailableVersion("camoufox") && (
                                <div className="flex gap-3 items-center p-3 rounded-md border">
                                  <p className="text-sm text-muted-foreground">
                                    {(() => {
                                      const bestVersion =
                                        getBestAvailableVersion("camoufox");
                                      return `Bugox version (${bestVersion?.version}) needs to be downloaded`;
                                    })()}
                                  </p>
                                  <LoadingButton
                                    onClick={() => handleDownload("camoufox")}
                                    isLoading={isBrowserCurrentlyDownloading(
                                      "camoufox",
                                    )}
                                    size="sm"
                                    disabled={isBrowserCurrentlyDownloading(
                                      "camoufox",
                                    )}
                                  >
                                    {isBrowserCurrentlyDownloading("camoufox")
                                      ? "Downloading..."
                                      : "Download"}
                                  </LoadingButton>
                                </div>
                              )}
                            {!isLoadingReleaseTypes &&
                              !releaseTypesError &&
                              !isBrowserCurrentlyDownloading("camoufox") &&
                              isBrowserVersionAvailable("camoufox") && (
                                <div className="p-3 text-sm rounded-md border text-muted-foreground">
                                  {(() => {
                                    const bestVersion =
                                      getBestAvailableVersion("camoufox");
                                    return `✓ Bugox version (${bestVersion?.version}) is available`;
                                  })()}
                                </div>
                              )}
                            {isBrowserCurrentlyDownloading("camoufox") && (
                              <div className="p-3 text-sm rounded-md border text-muted-foreground">
                                {(() => {
                                  const bestVersion =
                                    getBestAvailableVersion("camoufox");
                                  return `Downloading Bugox version (${bestVersion?.version})...`;
                                })()}
                              </div>
                            )}

                            <SharedCamoufoxConfigForm
                              config={camoufoxConfig}
                              onConfigChange={updateCamoufoxConfig}
                              isCreating
                              browserType="camoufox"
                              crossOsUnlocked={crossOsUnlocked}
                              limitedMode={!crossOsUnlocked}
                            />
                          </div>
                        ) : (
                          // Regular Browser Configuration (should not happen in anti-detect tab)
                          <div className="space-y-4">
                            {selectedBrowser && (
                              <div className="space-y-3">
                                {isLoadingReleaseTypes && (
                                  <div className="flex gap-3 items-center">
                                    <div className="w-4 h-4 rounded-full border-2 animate-spin border-muted/40 border-t-primary" />
                                    <p className="text-sm text-muted-foreground">
                                      Fetching available versions...
                                    </p>
                                  </div>
                                )}
                                {!isLoadingReleaseTypes &&
                                  releaseTypesError && (
                                    <div className="flex gap-3 items-center p-3 rounded-md border border-destructive/50 bg-destructive/10">
                                      <p className="flex-1 text-sm text-destructive">
                                        {releaseTypesError}
                                      </p>
                                      <RippleButton
                                        onClick={() =>
                                          selectedBrowser &&
                                          loadReleaseTypes(selectedBrowser)
                                        }
                                        size="sm"
                                        variant="outline"
                                      >
                                        Retry
                                      </RippleButton>
                                    </div>
                                  )}
                                {!isLoadingReleaseTypes &&
                                  !releaseTypesError &&
                                  !isBrowserCurrentlyDownloading(
                                    selectedBrowser,
                                  ) &&
                                  !isBrowserVersionAvailable(selectedBrowser) &&
                                  getBestAvailableVersion(selectedBrowser) && (
                                    <div className="flex gap-3 items-center">
                                      <p className="text-sm text-muted-foreground">
                                        {(() => {
                                          const bestVersion =
                                            getBestAvailableVersion(
                                              selectedBrowser,
                                            );
                                          return `Latest version (${bestVersion?.version}) needs to be downloaded`;
                                        })()}
                                      </p>
                                      <LoadingButton
                                        onClick={() =>
                                          handleDownload(selectedBrowser)
                                        }
                                        isLoading={isBrowserCurrentlyDownloading(
                                          selectedBrowser,
                                        )}
                                        className="ml-auto"
                                        size="sm"
                                        disabled={isBrowserCurrentlyDownloading(
                                          selectedBrowser,
                                        )}
                                      >
                                        Download
                                      </LoadingButton>
                                    </div>
                                  )}
                                {!isLoadingReleaseTypes &&
                                  !releaseTypesError &&
                                  !isBrowserCurrentlyDownloading(
                                    selectedBrowser,
                                  ) &&
                                  isBrowserVersionAvailable(
                                    selectedBrowser,
                                  ) && (
                                    <div className="text-sm text-muted-foreground">
                                      {(() => {
                                        const bestVersion =
                                          getBestAvailableVersion(
                                            selectedBrowser,
                                          );
                                        return `✓ Latest version (${bestVersion?.version}) is available`;
                                      })()}
                                    </div>
                                  )}
                                {isBrowserCurrentlyDownloading(
                                  selectedBrowser,
                                ) && (
                                  <div className="text-sm text-muted-foreground">
                                    {(() => {
                                      const bestVersion =
                                        getBestAvailableVersion(
                                          selectedBrowser,
                                        );
                                      return `Downloading version (${bestVersion?.version})...`;
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                      {configSection === "proxy" && (
                        <div className="max-w-[640px]">
                          {proxyComposerSection}
                        </div>
                      )}

                      {configSection === "advanced" && (
                        <div className="max-w-[640px]">
                          {extensionGroupSection}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="regular" className="mt-0">
                    {/* Regular Browser Configuration */}
                    <div className="space-y-6">
                      {configSection === "basic" && profileNameSection}

                      {/* Regular Browser Configuration */}
                      {configSection === "basic" && (
                        <div className="space-y-4">
                          {selectedBrowser && (
                            <div className="space-y-3">
                              {isLoadingReleaseTypes && (
                                <div className="flex gap-3 items-center">
                                  <div className="w-4 h-4 rounded-full border-2 animate-spin border-muted/40 border-t-primary" />
                                  <p className="text-sm text-muted-foreground">
                                    Fetching available versions...
                                  </p>
                                </div>
                              )}
                              {!isLoadingReleaseTypes && releaseTypesError && (
                                <div className="flex gap-3 items-center p-3 rounded-md border border-destructive/50 bg-destructive/10">
                                  <p className="flex-1 text-sm text-destructive">
                                    {releaseTypesError}
                                  </p>
                                  <RippleButton
                                    onClick={() =>
                                      selectedBrowser &&
                                      loadReleaseTypes(selectedBrowser)
                                    }
                                    size="sm"
                                    variant="outline"
                                  >
                                    Retry
                                  </RippleButton>
                                </div>
                              )}
                              {!isLoadingReleaseTypes &&
                                !releaseTypesError &&
                                !isBrowserCurrentlyDownloading(
                                  selectedBrowser,
                                ) &&
                                !isBrowserVersionAvailable(selectedBrowser) &&
                                getBestAvailableVersion(selectedBrowser) && (
                                  <div className="flex gap-3 items-center">
                                    <p className="text-sm text-muted-foreground">
                                      {(() => {
                                        const bestVersion =
                                          getBestAvailableVersion(
                                            selectedBrowser,
                                          );
                                        return `Latest version (${bestVersion?.version}) needs to be downloaded`;
                                      })()}
                                    </p>
                                    <LoadingButton
                                      onClick={() =>
                                        handleDownload(selectedBrowser)
                                      }
                                      isLoading={isBrowserCurrentlyDownloading(
                                        selectedBrowser,
                                      )}
                                      className="ml-auto"
                                      size="sm"
                                      disabled={isBrowserCurrentlyDownloading(
                                        selectedBrowser,
                                      )}
                                    >
                                      Download
                                    </LoadingButton>
                                  </div>
                                )}
                              {!isLoadingReleaseTypes &&
                                !releaseTypesError &&
                                !isBrowserCurrentlyDownloading(
                                  selectedBrowser,
                                ) &&
                                isBrowserVersionAvailable(selectedBrowser) && (
                                  <div className="text-sm text-muted-foreground">
                                    {(() => {
                                      const bestVersion =
                                        getBestAvailableVersion(
                                          selectedBrowser,
                                        );
                                      return `✓ Latest version (${bestVersion?.version}) is available`;
                                    })()}
                                  </div>
                                )}
                              {isBrowserCurrentlyDownloading(
                                selectedBrowser,
                              ) && (
                                <div className="text-sm text-muted-foreground">
                                  {(() => {
                                    const bestVersion =
                                      getBestAvailableVersion(selectedBrowser);
                                    return `Downloading version (${bestVersion?.version})...`;
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {configSection === "proxy" && (
                        <div className="max-w-[640px]">
                          {proxyComposerSection}
                        </div>
                      )}
                      {configSection === "advanced" && ephemeralSection}
                      {configSection === "advanced" && (
                        <div className="max-w-[640px]">
                          {extensionGroupSection}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </>
              )}
            </div>
            {mode === "page" && currentStep === "browser-config" ? (
              <aside className="mt-6 h-fit border-l border-border/70 pl-4 lg:mt-0">
                <p className="text-sm font-semibold text-foreground">
                  {t("createProfile.workspace.previewTitle")}
                </p>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {t("createProfile.workspace.previewBrowser")}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {selectedBrowser ? selectedBrowser : "--"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {t("createProfile.workspace.previewName")}
                    </dt>
                    <dd className="max-w-[11rem] truncate font-medium text-foreground">
                      {profileName.trim() || "--"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {t("createProfile.workspace.previewProxy")}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {proxyInputMode === "existing"
                        ? selectedExistingProxyId !== "none"
                          ? t("createProfile.workspace.previewProxyExisting")
                          : t("createProfile.workspace.previewProxyNone")
                        : proxyForm.host.trim()
                          ? `${proxyForm.proxy_type}://${proxyForm.host}:${proxyForm.port}`
                          : t("createProfile.workspace.previewProxyNone")}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {t("createProfile.workspace.previewLaunch")}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {launchAfterCreate
                        ? t("createProfile.workspace.previewLaunchYes")
                        : t("createProfile.workspace.previewLaunchNo")}
                    </dd>
                  </div>
                </dl>
              </aside>
            ) : null}
          </div>
        </ScrollArea>
      </Tabs>

      <DialogFooter className="shrink-0 border-t px-6 py-4">
        {currentStep === "browser-config" ? (
          <>
            <div className="flex items-center gap-2 mr-auto">
              <Checkbox
                id="launch-after-create"
                checked={launchAfterCreate}
                onCheckedChange={(checked) =>
                  setLaunchAfterCreate(checked === true)
                }
              />
              <Label htmlFor="launch-after-create" className="text-sm">
                {t("createProfile.launchAfterCreate")}
              </Label>
            </div>
            <RippleButton variant="outline" onClick={handleClose}>
              {t("common.buttons.cancel")}
            </RippleButton>
            <LoadingButton
              onClick={handleCreate}
              isLoading={isCreating}
              disabled={isCreateDisabled}
            >
              {t("common.buttons.create")}
            </LoadingButton>
          </>
        ) : (
          <RippleButton variant="outline" onClick={handleClose}>
            {t("common.buttons.cancel")}
          </RippleButton>
        )}
      </DialogFooter>
    </>
  );

  if (mode === "page") {
    return (
      <section className="mx-auto h-full min-h-0 w-full max-w-[1220px] overflow-hidden bg-transparent">
        <div className="flex h-full min-h-0 flex-col">{shellContent}</div>
      </section>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "my-8 flex w-full max-w-3xl flex-col overflow-hidden p-0",
          mode === "dialog" ? "max-h-[90vh]" : "h-[calc(100vh-96px)]",
        )}
      >
        {shellContent}
      </DialogContent>
    </Dialog>
  );
}
