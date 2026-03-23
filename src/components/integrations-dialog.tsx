"use client";

import { invoke } from "@tauri-apps/api/core";
import { Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWayfernTerms } from "@/hooks/use-wayfern-terms";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { CopyToClipboard } from "./ui/copy-to-clipboard";
import { WorkspacePageShell } from "./workspace-page-shell";

interface AppSettings {
  api_enabled: boolean;
  api_port: number;
  api_token?: string;
  mcp_enabled: boolean;
  mcp_port?: number;
  mcp_token?: string;
}

interface McpConfig {
  port: number;
  token: string;
  config_json: string;
}

interface IntegrationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "dialog" | "page";
}

export function IntegrationsDialog({
  isOpen,
  onClose,
  mode = "dialog",
}: IntegrationsDialogProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>({
    api_enabled: false,
    api_port: 10108,
    api_token: undefined,
    mcp_enabled: false,
    mcp_port: undefined,
    mcp_token: undefined,
  });
  const [apiServerPort, setApiServerPort] = useState<number | null>(null);
  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [_mcpRunning, setMcpRunning] = useState(false);
  const [showApiToken, setShowApiToken] = useState(false);
  const [showMcpToken, setShowMcpToken] = useState(false);
  const [isApiStarting, setIsApiStarting] = useState(false);
  const [isMcpStarting, setIsMcpStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"api" | "mcp">("api");
  const isVisible = mode === "page" || isOpen;

  const { termsAccepted, isLoading: isTermsLoading } = useWayfernTerms();

  const loadSettings = useCallback(async () => {
    try {
      const loaded = await invoke<AppSettings>("get_app_settings");
      setSettings(loaded);
    } catch {
      setSettings((current) => current);
    }
  }, []);

  const loadMcpConfig = useCallback(async () => {
    try {
      const config = await invoke<McpConfig | null>("get_mcp_config");
      setMcpConfig(config);
    } catch {
      setMcpConfig(null);
    }
  }, []);

  const loadMcpServerStatus = useCallback(async () => {
    try {
      const isRunning = await invoke<boolean>("get_mcp_server_status");
      setMcpRunning(isRunning);
    } catch {
      setMcpRunning(false);
    }
  }, []);

  const loadApiServerStatus = useCallback(async () => {
    try {
      const port = await invoke<number | null>("get_api_server_status");
      setApiServerPort(port);
    } catch {
      setApiServerPort(null);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadSettings(),
        loadApiServerStatus(),
        loadMcpConfig(),
        loadMcpServerStatus(),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [loadApiServerStatus, loadMcpConfig, loadMcpServerStatus, loadSettings]);

  useEffect(() => {
    if (isVisible) {
      void loadAll();
    }
  }, [isVisible, loadAll]);

  const handleApiToggle = async (enabled: boolean) => {
    setIsApiStarting(true);
    try {
      if (enabled) {
        const port = await invoke<number>("start_api_server", {
          port: settings.api_port,
        });
        setApiServerPort(port);
        const next = await invoke<AppSettings>("save_app_settings", {
          settings: { ...settings, api_enabled: true },
        });
        setSettings(next);
        showSuccessToast(t("integrationsDialog.toasts.apiStarted", { port }));
      } else {
        await invoke("stop_api_server");
        setApiServerPort(null);
        const next = await invoke<AppSettings>("save_app_settings", {
          settings: { ...settings, api_enabled: false, api_token: null },
        });
        setSettings(next);
        showSuccessToast(t("integrationsDialog.toasts.apiStopped"));
      }
    } catch (error) {
      showErrorToast(t("integrationsDialog.toasts.apiToggleFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("integrationsDialog.toasts.unknownError"),
      });
    } finally {
      setIsApiStarting(false);
    }
  };

  const handleMcpToggle = async (enabled: boolean) => {
    setIsMcpStarting(true);
    try {
      if (enabled) {
        const port = await invoke<number>("start_mcp_server");
        const next = await invoke<AppSettings>("save_app_settings", {
          settings: { ...settings, mcp_enabled: true, mcp_port: port },
        });
        setSettings(next);
        loadMcpConfig();
        showSuccessToast(t("integrationsDialog.toasts.mcpStarted", { port }));
      } else {
        await invoke("stop_mcp_server");
        const next = await invoke<AppSettings>("save_app_settings", {
          settings: { ...settings, mcp_enabled: false },
        });
        setSettings(next);
        setMcpConfig(null);
        showSuccessToast(t("integrationsDialog.toasts.mcpStopped"));
      }
    } catch (error) {
      showErrorToast(t("integrationsDialog.toasts.mcpToggleFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("integrationsDialog.toasts.unknownError"),
      });
    } finally {
      setIsMcpStarting(false);
    }
  };

  const obfuscateToken = (token: string) =>
    "•".repeat(Math.min(token.length, 32));

  const getFormattedMcpConfig = () => {
    if (!mcpConfig) return "";
    return JSON.stringify(
      {
        mcpServers: {
          "buglogin-browser": {
            url: `http://127.0.0.1:${mcpConfig.port}/mcp`,
            headers: {
              Authorization: `Bearer ${mcpConfig.token}`,
            },
          },
        },
      },
      null,
      2,
    );
  };

  const getObfuscatedMcpConfig = () => {
    if (!mcpConfig) return "";
    return JSON.stringify(
      {
        mcpServers: {
          "buglogin-browser": {
            url: `http://127.0.0.1:${mcpConfig.port}/mcp`,
            headers: {
              Authorization: `Bearer ${obfuscateToken(mcpConfig.token)}`,
            },
          },
        },
      },
      null,
      2,
    );
  };

  const sectionClass =
    mode === "page"
      ? "space-y-4 border-b border-border/70 pb-6 last:border-b-0"
      : "space-y-4 border-b pb-6 last:border-b-0";

  const apiPanel = (
    <div className="space-y-4 border-b pb-6 last:border-b-0">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="api-enabled"
          checked={apiServerPort !== null}
          disabled={isApiStarting}
          onCheckedChange={handleApiToggle}
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor="api-enabled"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {t("integrationsDialog.api.enableTitle")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("integrationsDialog.api.enableDescription")}
          </p>
        </div>
      </div>

      {settings.api_enabled && (
        <div className="space-y-4 rounded-xl border bg-card/60 p-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("integrationsDialog.labels.port")}
            </Label>
            <div className="flex items-center space-x-2">
              <Input
                value={apiServerPort ?? settings.api_port}
                readOnly
                className="w-24 font-mono"
              />
              <span className="text-xs text-muted-foreground">
                {t("integrationsDialog.api.serverRunning")}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("integrationsDialog.labels.authToken")}
            </Label>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Input
                  type={showApiToken ? "text" : "password"}
                  value={settings.api_token ?? ""}
                  readOnly
                  className="font-mono pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowApiToken(!showApiToken)}
                >
                  {showApiToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <CopyToClipboard
                text={settings.api_token ?? ""}
                successMessage={t("integrationsDialog.toasts.tokenCopied")}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("integrationsDialog.api.authHeader")}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const mcpPanel = (
    <div className="space-y-4 border-b pb-6 last:border-b-0">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="mcp-enabled"
          checked={settings.mcp_enabled && mcpConfig !== null}
          disabled={!termsAccepted || isMcpStarting}
          onCheckedChange={handleMcpToggle}
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor="mcp-enabled"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {t("integrationsDialog.mcp.enableTitle")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("integrationsDialog.mcp.enableDescription")}
            {!termsAccepted && (
              <span className="ml-1 text-muted-foreground">
                {t("integrationsDialog.mcp.acceptTermsHint")}
              </span>
            )}
          </p>
        </div>
      </div>

      {mcpConfig && (
        <div className="space-y-4 rounded-xl border bg-card/60 p-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("integrationsDialog.mcp.claudeConfigTitle")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("integrationsDialog.mcp.claudeConfigDescription")}{" "}
              <code className="bg-muted px-1 rounded">
                ~/.config/claude/claude_desktop_config.json
              </code>
            </p>
          </div>

          <div className="relative">
            <pre className="p-3 text-xs font-mono rounded-md bg-background border overflow-x-auto whitespace-pre">
              {showMcpToken
                ? getFormattedMcpConfig()
                : getObfuscatedMcpConfig()}
            </pre>
            <div className="absolute top-2 right-2 flex items-center space-x-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowMcpToken(!showMcpToken)}
              >
                {showMcpToken ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
              <CopyToClipboard
                text={getFormattedMcpConfig()}
                successMessage={t("integrationsDialog.toasts.configCopied")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("integrationsDialog.mcp.availableTools")}
            </Label>
            <ul className="list-disc ml-5 space-y-0.5 text-xs text-muted-foreground">
              <li>{t("integrationsDialog.mcp.tools.listProfiles")}</li>
              <li>{t("integrationsDialog.mcp.tools.runProfile")}</li>
              <li>{t("integrationsDialog.mcp.tools.killProfile")}</li>
              <li>{t("integrationsDialog.mcp.tools.getProfileStatus")}</li>
              <li>{t("integrationsDialog.mcp.tools.manageGroups")}</li>
              <li>{t("integrationsDialog.mcp.tools.manageProxies")}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );

  const loadingContent = (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, index) => (
        <section key={`integrations-loading-${index}`} className={sectionClass}>
          <div className="h-5 w-40 rounded-md bg-card" />
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="space-y-3">
              <div className="h-4 w-56 rounded-md bg-muted" />
              <div className="h-3 w-80 max-w-full rounded-md bg-muted" />
              <div className="h-9 w-40 rounded-md bg-muted" />
            </div>
          </div>
        </section>
      ))}
    </div>
  );

  const pageContent = activeTab === "api" ? apiPanel : mcpPanel;

  const pageTabs = (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as "api" | "mcp")}
      className="min-h-0 min-w-0"
    >
      {mode === "page" ? null : (
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="api">
            {t("integrationsDialog.tabs.localApi")}
          </TabsTrigger>
          <TabsTrigger value="mcp">
            {t("integrationsDialog.tabs.mcpAssistants")}
          </TabsTrigger>
        </TabsList>
      )}

      <TabsContent value="api" className="mt-0 min-h-0 flex-1">
        {apiPanel}
      </TabsContent>

      <TabsContent value="mcp" className="mt-0 min-h-0 flex-1">
        {mcpPanel}
      </TabsContent>
    </Tabs>
  );

  const dialogContent = (
    <>
      <div className="app-shell-safe-header shrink-0 border-b px-5 py-4">
        <DialogHeader>
          <DialogTitle>{t("integrationsDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("integrationsDialog.description")}
          </DialogDescription>
        </DialogHeader>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-5 py-4">
          {isLoading || isTermsLoading ? loadingContent : pageTabs}
        </div>
      </ScrollArea>
    </>
  );

  if (mode === "page") {
    return (
      <WorkspacePageShell
        title={t("integrationsDialog.title")}
        description={t("integrationsDialog.description")}
        toolbar={
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "api" | "mcp")}
          >
            <TabsList className="grid w-[240px] grid-cols-2">
              <TabsTrigger value="api">
                {t("integrationsDialog.tabs.localApi")}
              </TabsTrigger>
              <TabsTrigger value="mcp">
                {t("integrationsDialog.tabs.mcp")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
        contentClassName="max-w-none"
      >
        {isLoading || isTermsLoading ? loadingContent : pageContent}
      </WorkspacePageShell>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="my-8 flex max-h-[80vh] max-w-xl flex-col p-0">
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}
