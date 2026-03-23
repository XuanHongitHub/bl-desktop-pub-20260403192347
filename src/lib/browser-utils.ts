/**
 * Browser utility functions
 * Centralized helpers for browser name mapping, icons, etc.
 */

import { Flame } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import {
  BugBraveBrowserIcon,
  BugCamoufoxBrowserIcon,
  BugChromiumBrowserIcon,
  BugFirefoxBrowserIcon,
  BugFirefoxDeveloperBrowserIcon,
  BugUnknownBrowserIcon,
  BugWayfernBrowserIcon,
  BugZenBrowserIcon,
} from "@/components/icons/browser-brand-icons";

type BrowserIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const BROWSER_NAME_MAP: Record<string, string> = {
  firefox: "Firefox",
  "firefox-developer": "Firefox Developer Edition",
  zen: "Zen Browser",
  brave: "Brave",
  chromium: "Chromium",
  camoufox: "Camoufox",
  wayfern: "Wayfern",
};

const BROWSER_ALIAS_MAP: Record<string, string> = {
  chrome: "chromium",
  "google-chrome": "chromium",
  "chrome-stable": "chromium",
  "chrome-beta": "chromium",
  msedge: "chromium",
  edge: "chromium",
  "firefox-developer-edition": "firefox-developer",
  firefoxdeveloper: "firefox-developer",
  devedition: "firefox-developer",
};

const BROWSER_ICON_MAP: Record<string, BrowserIconComponent> = {
  firefox: BugFirefoxBrowserIcon,
  "firefox-developer": BugFirefoxDeveloperBrowserIcon,
  zen: BugZenBrowserIcon,
  brave: BugBraveBrowserIcon,
  chromium: BugChromiumBrowserIcon,
  camoufox: BugCamoufoxBrowserIcon,
  wayfern: BugWayfernBrowserIcon,
};

function formatUnknownBrowserName(browserType: string): string {
  return browserType
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function normalizeBrowserType(browserType: string): string {
  const normalized = browserType.trim().toLowerCase();
  return BROWSER_ALIAS_MAP[normalized] ?? normalized;
}

/**
 * Map internal browser names to display names
 */
export function getBrowserDisplayName(browserType: string): string {
  const normalized = normalizeBrowserType(browserType);
  return BROWSER_NAME_MAP[normalized] ?? formatUnknownBrowserName(browserType);
}

/**
 * Get BugMedia-owned browser icon component for a browser type.
 * Any alias values coming from API/download channels are normalized first.
 */
export function getBrowserIcon(browserType: string): BrowserIconComponent {
  const normalized = normalizeBrowserType(browserType);
  return BROWSER_ICON_MAP[normalized] ?? BugUnknownBrowserIcon;
}

export function getProfileIcon(profile: {
  browser: string;
  ephemeral?: boolean;
}) {
  if (profile.ephemeral) return Flame;
  return getBrowserIcon(profile.browser);
}

export const getCurrentOS = () => {
  if (typeof window !== "undefined") {
    const userAgent = window.navigator.userAgent;
    if (userAgent.includes("Win")) return "windows";
    if (userAgent.includes("Mac")) return "macos";
    if (userAgent.includes("Linux")) return "linux";
  }
  return "unknown";
};

export function isCrossOsProfile(profile: { host_os?: string }): boolean {
  if (!profile.host_os) return false;
  return profile.host_os !== getCurrentOS();
}

export function getOSDisplayName(os: string): string {
  switch (os) {
    case "macos":
      return "macOS";
    case "windows":
      return "Windows";
    case "linux":
      return "Linux";
    default:
      return os;
  }
}
