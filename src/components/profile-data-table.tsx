"use client";

import dynamic from "next/dynamic";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import type { Dispatch, SetStateAction } from "react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { FaApple, FaLinux, FaWindows } from "react-icons/fa";
import { FiWifi } from "react-icons/fi";
import {
  LuArchive,
  LuCheck,
  LuCircleStop,
  LuChevronDown,
  LuChevronUp,
  LuClock3,
  LuCookie,
  LuEllipsisVertical,
  LuGlobe,
  LuInfo,
  LuLock,
  LuPause,
  LuPencil,
  LuPin,
  LuPinOff,
  LuPlay,
  LuPlus,
  LuPuzzle,
  LuSettings2,
  LuShieldAlert,
  LuTrash2,
  LuUsers,
} from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePaginationControls } from "@/components/ui/table-pagination-controls";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBrowserState } from "@/hooks/use-browser-state";
import { useTableSorting } from "@/hooks/use-table-sorting";
import { useTeamLocks } from "@/hooks/use-team-locks";
import {
  getBrowserIcon,
  getBrowserDisplayName,
  getOSDisplayName,
  getProfileIcon,
  isCrossOsProfile,
} from "@/lib/browser-utils";
import { extractRootError } from "@/lib/error-utils";
import { formatRelativeTime } from "@/lib/flag-utils";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { trimName } from "@/lib/name-utils";
import {
  canPerformTeamAction,
} from "@/lib/team-permissions";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import {
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import type {
  BrowserProfile,
  LocationItem,
  ProxyCheckResult,
  StoredProxy,
  TeamRole,
  TrafficSnapshot,
  VpnConfig,
} from "@/types";
import { BandwidthMiniChart } from "./bandwidth-mini-chart";
import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from "./data-table-action-bar";
import MultipleSelector, { type Option } from "./multiple-selector";
import { ProxyCheckButton } from "./proxy-check-button";
import { Input } from "./ui/input";
import { RippleButton } from "./ui/ripple";

const TrafficDetailsDialog = dynamic(
  () =>
    import("./traffic-details-dialog").then((mod) => mod.TrafficDetailsDialog),
  { ssr: false },
);

const DeleteConfirmationDialog = dynamic(
  () =>
    import("@/components/delete-confirmation-dialog").then(
      (mod) => mod.DeleteConfirmationDialog,
    ),
  { ssr: false },
);

const ProfileInfoDialog = dynamic(
  () =>
    import("@/components/profile-info-dialog").then(
      (mod) => mod.ProfileInfoDialog,
    ),
  { ssr: false },
);

const ProfileBypassRulesDialog = dynamic(
  () =>
    import("@/components/profile-info-dialog").then(
      (mod) => mod.ProfileBypassRulesDialog,
    ),
  { ssr: false },
);

const PROFILE_TRANSITION_RECONCILE_INTERVAL_MS = 4_000;
const PROFILE_LAUNCH_TRANSITION_TIMEOUT_MS = 25_000;
const PROFILE_STOP_TRANSITION_TIMEOUT_MS = 15_000;
const PROXY_PRELAUNCH_CHECK_TTL_SECONDS = 300;

function syncPendingTransitionTimestamps(
  activeIds: Set<string>,
  startedAtMap: Map<string, number>,
) {
  const now = Date.now();
  activeIds.forEach((id) => {
    if (!startedAtMap.has(id)) {
      startedAtMap.set(id, now);
    }
  });
  Array.from(startedAtMap.keys()).forEach((id) => {
    if (!activeIds.has(id)) {
      startedAtMap.delete(id);
    }
  });
}

// Shared off-screen canvas context for text measurement (TagsCell).
// Avoids creating a new canvas element per row per render.
let _sharedCanvasCtx: CanvasRenderingContext2D | null = null;
function getSharedCanvasCtx(): CanvasRenderingContext2D | null {
  if (!_sharedCanvasCtx) {
    _sharedCanvasCtx =
      document.createElement("canvas").getContext("2d") ?? null;
  }
  return _sharedCanvasCtx;
}

// Stable table meta type to pass volatile state/handlers into TanStack Table without
// causing column definitions to be recreated on every render.
type TableMeta = {
  t: (key: string, options?: Record<string, unknown>) => string;
  selectedProfiles: string[];
  selectableCount: number;
  showCheckboxes: boolean;
  isClient: boolean;
  runningProfiles: Set<string>;
  launchingProfiles: Set<string>;
  stoppingProfiles: Set<string>;
  checkingProfiles: Set<string>;
  isUpdating: (browser: string) => boolean;
  browserState: ReturnType<typeof useBrowserState>;

  // Tags editor state
  tagsOverrides: Record<string, string[]>;
  allTags: string[];
  openTagsEditorFor: string | null;
  setAllTags: React.Dispatch<React.SetStateAction<string[]>>;
  setOpenTagsEditorFor: React.Dispatch<React.SetStateAction<string | null>>;
  setTagsOverrides: React.Dispatch<
    React.SetStateAction<Record<string, string[]>>
  >;

  // Note editor state
  noteOverrides: Record<string, string | null>;
  openNoteEditorFor: string | null;
  setOpenNoteEditorFor: React.Dispatch<React.SetStateAction<string | null>>;
  setNoteOverrides: React.Dispatch<
    React.SetStateAction<Record<string, string | null>>
  >;

  // Proxy selector state
  openProxySelectorFor: string | null;
  setOpenProxySelectorFor: React.Dispatch<React.SetStateAction<string | null>>;
  proxyOverrides: Record<string, string | null>;
  storedProxies: StoredProxy[];
  onOpenProxyCenter?: () => void;
  handleProxySelection: (
    profileId: string,
    proxyId: string | null,
  ) => void | Promise<void>;
  checkingProfileId: string | null;
  proxyCheckResults: Record<string, ProxyCheckResult>;

  // VPN selector state
  vpnConfigs: VpnConfig[];
  vpnOverrides: Record<string, string | null>;
  handleVpnSelection: (
    profileId: string,
    vpnId: string | null,
  ) => void | Promise<void>;

  // Selection helpers
  isProfileSelected: (id: string) => boolean;
  handleToggleAll: (checked: boolean) => void;
  handleCheckboxChange: (id: string, checked: boolean) => void;
  handleIconClick: (id: string) => void;

  // Rename helpers
  handleRename: () => void | Promise<void>;
  setProfileToRename: React.Dispatch<
    React.SetStateAction<BrowserProfile | null>
  >;
  setNewProfileName: React.Dispatch<React.SetStateAction<string>>;
  setRenameError: React.Dispatch<React.SetStateAction<string | null>>;
  profileToRename: BrowserProfile | null;
  newProfileName: string;
  isRenamingSaving: boolean;
  renameError: string | null;

  // Launch/stop helpers
  setLaunchingProfiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  setStoppingProfiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCheckingProfiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  onKillProfile: (profile: BrowserProfile) => void | Promise<void>;
  onLaunchProfile: (profile: BrowserProfile) => void | Promise<void>;

  // Overflow actions
  onAssignProfilesToGroup?: (profileIds: string[]) => void;
  onConfigureCamoufox?: (profile: BrowserProfile) => void;
  onCloneProfile?: (profile: BrowserProfile) => void;
  onCopyCookiesToProfile?: (profile: BrowserProfile) => void;
  onOpenCookieManagement?: (profile: BrowserProfile) => void;
  onPinProfile?: (profile: BrowserProfile) => void;
  onUnpinProfile?: (profile: BrowserProfile) => void;
  isProfilePinned: (profileId: string) => boolean;

  // Traffic snapshots (lightweight real-time data)
  trafficSnapshots: Record<string, TrafficSnapshot>;
  onOpenTrafficDialog?: (profileId: string) => void;

  // Sync
  syncStatuses: Record<string, { status: string; error?: string }>;
  onOpenProfileSyncDialog?: (profile: BrowserProfile) => void;
  onToggleProfileSync?: (profile: BrowserProfile) => void;
  crossOsUnlocked?: boolean;
  extensionManagementUnlocked?: boolean;
  cookieManagementUnlocked?: boolean;
  syncUnlocked?: boolean;

  // Country proxy creation (inline in proxy dropdown)
  countries: LocationItem[];
  canCreateLocationProxy: boolean;
  loadCountries: () => Promise<void>;
  handleCreateCountryProxy: (
    profileId: string,
    country: LocationItem,
  ) => Promise<void>;

  // Team locks
  isProfileLockedByAnother: (profileId: string) => boolean;
  getProfileLockEmail: (profileId: string) => string | undefined;
  isReadOnlyRole: boolean;
};

type SyncStatusDot = {
  color: string;
  tooltip: string;
  animate: boolean;
  encrypted: boolean;
};

function getProfileSyncStatusDot(
  t: (key: string, options?: Record<string, unknown>) => string,
  profile: BrowserProfile,
  liveStatus:
    | "syncing"
    | "waiting"
    | "synced"
    | "error"
    | "disabled"
    | undefined,
  errorMessage?: string,
): SyncStatusDot | null {
  const encrypted = profile.sync_mode === "Encrypted";
  const status =
    liveStatus ??
    (profile.sync_mode && profile.sync_mode !== "Disabled"
      ? "synced"
      : "disabled");

  switch (status) {
    case "syncing":
      return {
        color: "bg-yellow-500",
        tooltip: t("profiles.table.syncing"),
        animate: true,
        encrypted,
      };
    case "waiting":
      return {
        color: "bg-yellow-500",
        tooltip: t("profiles.table.waitingToSync"),
        animate: false,
        encrypted,
      };
    case "synced":
      return {
        color: "bg-green-500",
        tooltip: profile.last_sync
          ? t("profiles.table.syncedAt", {
              time: formatLocaleDateTime(profile.last_sync * 1000),
            })
          : t("common.status.synced"),
        animate: false,
        encrypted,
      };
    case "error":
      return {
        color: "bg-red-500",
        tooltip: errorMessage
          ? t("profiles.table.syncErrorWithMessage", { message: errorMessage })
          : t("profiles.table.syncError"),
        animate: false,
        encrypted,
      };
    case "disabled":
      if (profile.last_sync) {
        return {
          color: "bg-gray-400",
          tooltip: t("profiles.table.syncDisabledLastSync", {
            time: formatRelativeTime(profile.last_sync),
          }),
          animate: false,
          encrypted: false,
        };
      }
      return null;
    default:
      return null;
  }
}

function extractOsVersionFromProfile(profile: BrowserProfile): string | null {
  try {
    if (profile.wayfern_config?.fingerprint) {
      const wayfernFingerprint = JSON.parse(
        profile.wayfern_config.fingerprint,
      ) as { platformVersion?: unknown };
      if (typeof wayfernFingerprint.platformVersion === "string") {
        const value = wayfernFingerprint.platformVersion.trim();
        if (value) {
          return value;
        }
      }
    }
  } catch {
    // Ignore malformed fingerprint payloads.
  }

  const camoufoxFingerprintRaw = profile.camoufox_config?.fingerprint;
  if (!camoufoxFingerprintRaw) {
    return null;
  }

  try {
    const camoufoxFingerprint = JSON.parse(camoufoxFingerprintRaw) as {
      "navigator.userAgent"?: unknown;
    };
    const userAgent =
      typeof camoufoxFingerprint["navigator.userAgent"] === "string"
        ? camoufoxFingerprint["navigator.userAgent"]
        : "";
    if (!userAgent) {
      return null;
    }

    const windowsMatch = userAgent.match(/Windows NT ([0-9.]+)/i);
    if (windowsMatch?.[1]) {
      return windowsMatch[1];
    }

    const macMatch = userAgent.match(/Mac OS X ([0-9_]+)/i);
    if (macMatch?.[1]) {
      return macMatch[1].replaceAll("_", ".");
    }

    const linuxMatch = userAgent.match(/Linux ([a-zA-Z0-9._-]+)/i);
    if (linuxMatch?.[1]) {
      return linuxMatch[1];
    }
  } catch {
    // Ignore malformed fingerprint payloads.
  }

  return null;
}

const TagsCell = React.memo<{
  profile: BrowserProfile;
  t: (key: string, options?: Record<string, unknown>) => string;
  isDisabled: boolean;
  tagsOverrides: Record<string, string[]>;
  allTags: string[];
  setAllTags: React.Dispatch<React.SetStateAction<string[]>>;
  openTagsEditorFor: string | null;
  setOpenTagsEditorFor: React.Dispatch<React.SetStateAction<string | null>>;
  setTagsOverrides: React.Dispatch<
    React.SetStateAction<Record<string, string[]>>
  >;
}>(
  ({
    profile,
    t,
    isDisabled,
    tagsOverrides,
    allTags,
    setAllTags,
    openTagsEditorFor,
    setOpenTagsEditorFor,
    setTagsOverrides,
  }) => {
    const effectiveTags: string[] = Object.hasOwn(tagsOverrides, profile.id)
      ? tagsOverrides[profile.id]
      : (profile.tags ?? []);

    const valueOptions: Option[] = React.useMemo(
      () => effectiveTags.map((t) => ({ value: t, label: t })),
      [effectiveTags],
    );
    const allOptions: Option[] = React.useMemo(
      () => allTags.map((t) => ({ value: t, label: t })),
      [allTags],
    );

    const onTagsChange = React.useCallback(
      async (newTagsRaw: string[]) => {
        // Dedupe tags
        const seen = new Set<string>();
        const newTags: string[] = [];
        for (const t of newTagsRaw) {
          if (!seen.has(t)) {
            seen.add(t);
            newTags.push(t);
          }
        }
        setTagsOverrides((prev) => ({ ...prev, [profile.id]: newTags }));
        try {
          await invoke<BrowserProfile>("update_profile_tags", {
            profileId: profile.id,
            tags: newTags,
          });
          setAllTags((prev) => {
            const next = new Set(prev);
            for (const t of newTags) next.add(t);
            return Array.from(next).sort();
          });
        } catch (error) {
          console.error("Failed to update tags:", error);
        }
      },
      [profile.id, setTagsOverrides, setAllTags],
    );

    const handleChange = React.useCallback(
      async (opts: Option[]) => {
        const newTagsRaw = opts.map((o) => o.value);
        await onTagsChange(newTagsRaw);
      },
      [onTagsChange],
    );

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const editorRef = React.useRef<HTMLDivElement | null>(null);
    const [visibleCount, setVisibleCount] = React.useState<number>(
      effectiveTags.length,
    );
    const [isFocused, setIsFocused] = React.useState(false);

    React.useLayoutEffect(() => {
      // Only measure when not editing this profile's tags
      if (openTagsEditorFor === profile.id) return;
      const container = containerRef.current;
      if (!container) return;

      let timeoutId: number | undefined;
      const compute = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          const available = container.clientWidth;
          if (available <= 0) return;
          const ctx = getSharedCanvasCtx();
          if (!ctx) return;
          const style = window.getComputedStyle(container);
          const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          ctx.font = font;
          const padding = 16;
          const gap = 4;
          let used = 0;
          let count = 0;
          for (let i = 0; i < effectiveTags.length; i++) {
            const text = effectiveTags[i];
            const width = Math.ceil(ctx.measureText(text).width) + padding;
            const remaining = effectiveTags.length - (i + 1);
            let extra = 0;
            if (remaining > 0) {
              const plusText = `+${remaining}`;
              extra = Math.ceil(ctx.measureText(plusText).width) + padding;
            }
            const nextUsed =
              used +
              (used > 0 ? gap : 0) +
              width +
              (remaining > 0 ? gap + extra : 0);
            if (nextUsed <= available) {
              used += (used > 0 ? gap : 0) + width;
              count = i + 1;
            } else {
              break;
            }
          }
          setVisibleCount(count);
        }, 16); // Debounce with RAF timing
      };
      compute();
      const ro = new ResizeObserver(compute);
      ro.observe(container);
      return () => {
        ro.disconnect();
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, [effectiveTags, openTagsEditorFor, profile.id]);

    React.useEffect(() => {
      if (openTagsEditorFor !== profile.id) return;
      const handleClick = (e: MouseEvent) => {
        const target = e.target as Node | null;
        if (
          editorRef.current &&
          target &&
          !editorRef.current.contains(target)
        ) {
          setOpenTagsEditorFor(null);
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [openTagsEditorFor, profile.id, setOpenTagsEditorFor]);

    React.useEffect(() => {
      if (openTagsEditorFor === profile.id && editorRef.current) {
        // Focus the inner input of MultipleSelector on open
        const inputEl = editorRef.current.querySelector("input");
        if (inputEl) {
          (inputEl as HTMLInputElement).focus();
        }
      }
    }, [openTagsEditorFor, profile.id]);

    if (openTagsEditorFor !== profile.id) {
      const hiddenCount = Math.max(0, effectiveTags.length - visibleCount);
      const ButtonContent = (
        <button
          type="button"
          ref={containerRef as unknown as React.RefObject<HTMLButtonElement>}
          className={cn(
            "flex overflow-hidden gap-1 items-center px-2 py-1 h-6 w-full bg-transparent rounded border-none cursor-pointer",
            isDisabled
              ? "opacity-60 cursor-not-allowed"
              : "cursor-pointer hover:bg-accent/50",
          )}
          onClick={() => {
            if (!isDisabled) setOpenTagsEditorFor(profile.id);
          }}
        >
          {effectiveTags.slice(0, visibleCount).map((t) => (
            <Badge key={t} variant="secondary" className="px-2 py-0 text-xs">
              {t}
            </Badge>
          ))}
          {effectiveTags.length === 0 && (
            <span className="text-muted-foreground">
              {t("profiles.table.noTags")}
            </span>
          )}
          {hiddenCount > 0 && (
            <Badge variant="outline" className="px-2 py-0 text-xs">
              +{hiddenCount}
            </Badge>
          )}
        </button>
      );

      return (
        <div className="w-40 h-6 cursor-pointer">
          <Tooltip>
            <TooltipTrigger asChild>{ButtonContent}</TooltipTrigger>
            {hiddenCount > 0 && (
              <TooltipContent className="max-w-[320px]">
                <div className="flex flex-wrap gap-1">
                  {effectiveTags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="px-2 py-0 text-xs"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "w-40 h-6 relative",
          isDisabled && "opacity-60 pointer-events-none",
        )}
      >
        <div
          ref={editorRef}
          className="absolute top-0 left-0 z-50 w-40 min-h-6 bg-popover rounded-md shadow-md"
        >
          <MultipleSelector
            value={valueOptions}
            options={allOptions}
            onChange={(opts) => void handleChange(opts)}
            creatable
            selectFirstItem={false}
            placeholder={
              effectiveTags.length === 0 ? t("profiles.table.addTags") : ""
            }
            className={cn(
              "bg-transparent border-0! focus-within:ring-0!",
              "[&_div:first-child]:border-0! [&_div:first-child]:ring-0! [&_div:first-child]:focus-within:ring-0!",
              "[&_div:first-child]:min-h-6! [&_div:first-child]:px-2! [&_div:first-child]:py-1!",
              "[&_div:first-child>div]:items-center [&_div:first-child>div]:h-6!",
              "[&_input]:ml-0! [&_input]:mt-0! [&_input]:px-0!",
              !isFocused && "[&_div:first-child>div]:justify-center",
            )}
            badgeClassName="shrink-0"
            inputProps={{
              className: "!py-0 text-sm caret-current !ml-0 !mt-0 !px-0",
              onKeyDown: (e) => {
                if (e.key === "Escape") setOpenTagsEditorFor(null);
              },
              onFocus: () => setIsFocused(true),
              onBlur: () => setIsFocused(false),
            }}
          />
        </div>
      </div>
    );
  },
);

TagsCell.displayName = "TagsCell";

const NonHoverableTooltip = React.memo<{
  children: React.ReactNode;
  content: React.ReactNode;
  sideOffset?: number;
  alignOffset?: number;
  horizontalOffset?: number;
}>(
  ({
    children,
    content,
    sideOffset = 4,
    alignOffset = 0,
    horizontalOffset = 0,
  }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger
          asChild
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          arrowOffset={horizontalOffset}
          onPointerEnter={(e) => e.preventDefault()}
          onPointerLeave={() => setIsOpen(false)}
          className="pointer-events-none"
          style={
            horizontalOffset !== 0
              ? { transform: `translateX(${horizontalOffset}px)` }
              : undefined
          }
        >
          {content}
        </TooltipContent>
      </Tooltip>
    );
  },
);

NonHoverableTooltip.displayName = "NonHoverableTooltip";

const NoteCell = React.memo<{
  profile: BrowserProfile;
  t: (key: string, options?: Record<string, unknown>) => string;
  isDisabled: boolean;
  noteOverrides: Record<string, string | null>;
  openNoteEditorFor: string | null;
  setOpenNoteEditorFor: React.Dispatch<React.SetStateAction<string | null>>;
  setNoteOverrides: React.Dispatch<
    React.SetStateAction<Record<string, string | null>>
  >;
}>(
  ({
    profile,
    t,
    isDisabled,
    noteOverrides,
    openNoteEditorFor,
    setOpenNoteEditorFor,
    setNoteOverrides,
  }) => {
    const effectiveNote: string | null = Object.hasOwn(
      noteOverrides,
      profile.id,
    )
      ? noteOverrides[profile.id]
      : (profile.note ?? null);

    const onNoteChange = React.useCallback(
      async (newNote: string | null) => {
        const trimmedNote = newNote?.trim() || null;
        setNoteOverrides((prev) => ({ ...prev, [profile.id]: trimmedNote }));
        try {
          await invoke<BrowserProfile>("update_profile_note", {
            profileId: profile.id,
            note: trimmedNote,
          });
        } catch (error) {
          console.error("Failed to update note:", error);
        }
      },
      [profile.id, setNoteOverrides],
    );

    const editorRef = React.useRef<HTMLDivElement | null>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const [noteValue, setNoteValue] = React.useState(effectiveNote || "");

    // Update local state when effective note changes (from outside)
    React.useEffect(() => {
      if (openNoteEditorFor !== profile.id) {
        setNoteValue(effectiveNote || "");
      }
    }, [effectiveNote, openNoteEditorFor, profile.id]);

    // Auto-resize textarea on open
    React.useEffect(() => {
      if (openNoteEditorFor === profile.id && textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      }
    }, [openNoteEditorFor, profile.id]);

    const handleTextareaChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setNoteValue(newValue);
        // Auto-resize
        const textarea = e.target;
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      },
      [],
    );

    React.useEffect(() => {
      if (openNoteEditorFor !== profile.id) return;
      const handleClick = (e: MouseEvent) => {
        const target = e.target as Node | null;
        if (
          editorRef.current &&
          target &&
          !editorRef.current.contains(target)
        ) {
          const currentValue = textareaRef.current?.value || "";
          void onNoteChange(currentValue);
          setOpenNoteEditorFor(null);
        }
      };
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [openNoteEditorFor, profile.id, setOpenNoteEditorFor, onNoteChange]);

    React.useEffect(() => {
      if (openNoteEditorFor === profile.id && textareaRef.current) {
        textareaRef.current.focus();
        // Move cursor to end
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }, [openNoteEditorFor, profile.id]);

    const displayNote = effectiveNote || "";
    const trimmedNote =
      displayNote.length > 12 ? `${displayNote.slice(0, 12)}...` : displayNote;
    const showTooltip = displayNote.length > 12 || displayNote.length > 0;

    if (openNoteEditorFor !== profile.id) {
      return (
        <div className="w-24 min-h-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-start px-2 py-1 min-h-6 w-full bg-transparent rounded border-none text-left",
                  isDisabled
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer hover:bg-accent/50",
                )}
                onClick={() => {
                  if (!isDisabled) {
                    setNoteValue(effectiveNote || "");
                    setOpenNoteEditorFor(profile.id);
                  }
                }}
              >
                <span
                  className={cn(
                    "text-sm wrap-break-word",
                    !effectiveNote && "text-muted-foreground",
                  )}
                >
                  {effectiveNote ? trimmedNote : t("profiles.table.noNote")}
                </span>
              </button>
            </TooltipTrigger>
            {showTooltip && (
              <TooltipContent className="max-w-[320px]">
                <p className="whitespace-pre-wrap wrap-break-word">
                  {effectiveNote || t("profiles.table.noNote")}
                </p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "w-24 relative",
          isDisabled && "opacity-60 pointer-events-none",
        )}
      >
        <div
          ref={editorRef}
          className="absolute -top-[15px] -left-px z-50 w-60 min-h-6 bg-popover rounded-md shadow-md border"
        >
          <textarea
            ref={textareaRef}
            value={noteValue}
            onChange={handleTextareaChange}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setNoteValue(effectiveNote || "");
                setOpenNoteEditorFor(null);
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                void onNoteChange(noteValue);
                setOpenNoteEditorFor(null);
              }
            }}
            onBlur={() => {
              void onNoteChange(noteValue);
              setOpenNoteEditorFor(null);
            }}
            placeholder={t("profiles.table.notePlaceholder")}
            className="w-full min-h-6 max-h-[200px] px-2 py-1 text-sm bg-transparent border-0 resize-none focus:outline-none focus:ring-0"
            style={{
              overflow: "auto",
            }}
            rows={1}
          />
        </div>
      </div>
    );
  },
);

NoteCell.displayName = "NoteCell";

interface ProfilesDataTableProps {
  profiles: BrowserProfile[];
  onLaunchProfile: (profile: BrowserProfile) => void | Promise<void>;
  onKillProfile: (profile: BrowserProfile) => void | Promise<void>;
  onCloneProfile: (profile: BrowserProfile) => void | Promise<void>;
  onDeleteProfile: (profile: BrowserProfile) => void | Promise<void>;
  onRenameProfile: (profileId: string, newName: string) => Promise<void>;
  onConfigureCamoufox: (profile: BrowserProfile) => void;
  onCopyCookiesToProfile?: (profile: BrowserProfile) => void;
  onOpenCookieManagement?: (profile: BrowserProfile) => void;
  runningProfiles: Set<string>;
  isUpdating: (browser: string) => boolean;
  onDeleteSelectedProfiles: (profileIds: string[]) => Promise<void>;
  onAssignProfilesToGroup: (profileIds: string[]) => void;
  selectedGroupId: string | null;
  selectedProfiles: string[];
  onSelectedProfilesChange: Dispatch<SetStateAction<string[]>>;
  onBulkDelete?: () => void;
  onBulkGroupAssignment?: () => void;
  onBulkProxyAssignment?: () => void;
  onBulkCopyCookies?: () => void;
  onBulkArchive?: () => void;
  onBulkExtensionGroupAssignment?: () => void;
  onAssignExtensionGroup?: (profileIds: string[]) => void;
  onOpenProxyCenter?: () => void;
  onOpenProfileSyncDialog?: (profile: BrowserProfile) => void;
  onToggleProfileSync?: (profile: BrowserProfile) => void;
  onArchiveProfile?: (profile: BrowserProfile) => void;
  onRestoreProfile?: (profile: BrowserProfile) => void;
  isProfileArchived?: (profileId: string) => boolean;
  onPinProfile?: (profile: BrowserProfile) => void;
  onUnpinProfile?: (profile: BrowserProfile) => void;
  isProfilePinned?: (profileId: string) => boolean;
  workspaceRole?: TeamRole | null;
  fallbackTeamRole?: TeamRole | null;
  currentUserId?: string | null;
  isEntitlementReadOnly?: boolean;
  crossOsUnlocked?: boolean;
  extensionManagementUnlocked?: boolean;
  cookieManagementUnlocked?: boolean;
  syncUnlocked?: boolean;
  storedProxies: StoredProxy[];
  vpnConfigs: VpnConfig[];
  isLoading?: boolean;
}

export function ProfilesDataTable({
  profiles,
  onLaunchProfile,
  onKillProfile,
  onCloneProfile,
  onDeleteProfile,
  onRenameProfile,
  onConfigureCamoufox,
  onCopyCookiesToProfile,
  onOpenCookieManagement,
  runningProfiles,
  isUpdating,
  onAssignProfilesToGroup,
  selectedProfiles,
  onSelectedProfilesChange,
  onBulkDelete,
  onBulkGroupAssignment,
  onBulkProxyAssignment,
  onBulkCopyCookies,
  onBulkArchive,
  onBulkExtensionGroupAssignment,
  onAssignExtensionGroup,
  onOpenProxyCenter,
  onOpenProfileSyncDialog,
  onToggleProfileSync,
  onArchiveProfile,
  onRestoreProfile,
  isProfileArchived,
  onPinProfile,
  onUnpinProfile,
  isProfilePinned,
  workspaceRole = null,
  fallbackTeamRole = null,
  currentUserId = null,
  isEntitlementReadOnly = false,
  crossOsUnlocked = false,
  extensionManagementUnlocked = false,
  cookieManagementUnlocked = false,
  syncUnlocked = false,
  storedProxies,
  vpnConfigs,
  isLoading = false,
}: ProfilesDataTableProps) {
  const { t } = useTranslation();
  const { getTableSorting, updateSorting, isLoaded } = useTableSorting();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  // Sync external selectedProfiles with table's row selection state
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const prevSelectedProfilesRef = React.useRef<string[]>(selectedProfiles);

  // Update row selection when external selectedProfiles changes
  React.useEffect(() => {
    // Only update if selectedProfiles actually changed
    if (
      prevSelectedProfilesRef.current.length !== selectedProfiles.length ||
      !prevSelectedProfilesRef.current.every((id) =>
        selectedProfiles.includes(id),
      )
    ) {
      const newSelection: RowSelectionState = {};
      for (const profileId of selectedProfiles) {
        newSelection[profileId] = true;
      }
      setRowSelection(newSelection);
      prevSelectedProfilesRef.current = selectedProfiles;
    }
  }, [selectedProfiles]);

  // Update external selectedProfiles when table selection changes
  const handleRowSelectionChange = React.useCallback(
    (updater: React.SetStateAction<RowSelectionState>) => {
      setRowSelection((prevSelection) => {
        const newSelection =
          typeof updater === "function" ? updater(prevSelection) : updater;

        const selectedIds = Object.keys(newSelection).filter(
          (id) => newSelection[id],
        );

        // Only update external state if selection actually changed
        const prevIds = Object.keys(prevSelection).filter(
          (id) => prevSelection[id],
        );

        if (
          selectedIds.length !== prevIds.length ||
          !selectedIds.every((id) => prevIds.includes(id))
        ) {
          onSelectedProfilesChange(selectedIds);
        }

        return newSelection;
      });
    },
    [onSelectedProfilesChange],
  );
  const [profileToRename, setProfileToRename] =
    React.useState<BrowserProfile | null>(null);
  const [newProfileName, setNewProfileName] = React.useState("");
  const [renameError, setRenameError] = React.useState<string | null>(null);
  const [isRenamingSaving, setIsRenamingSaving] = React.useState(false);
  const renameContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [profileToDelete, setProfileToDelete] =
    React.useState<BrowserProfile | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [profileForInfoDialog, setProfileForInfoDialog] =
    React.useState<BrowserProfile | null>(null);
  const [bypassRulesProfile, setBypassRulesProfile] =
    React.useState<BrowserProfile | null>(null);
  const [launchingProfiles, setLaunchingProfiles] = React.useState<Set<string>>(
    new Set(),
  );
  const [stoppingProfiles, setStoppingProfiles] = React.useState<Set<string>>(
    new Set(),
  );
  const launchingStartedAtRef = React.useRef<Map<string, number>>(new Map());
  const stoppingStartedAtRef = React.useRef<Map<string, number>>(new Map());
  const [checkingProfiles, setCheckingProfiles] = React.useState<Set<string>>(
    new Set(),
  );

  const effectiveTeamRole = workspaceRole ?? fallbackTeamRole;
  const isReadOnlyRole =
    isEntitlementReadOnly ||
    !canPerformTeamAction(effectiveTeamRole, "update_profile_note");
  const { isProfileLocked, getLockInfo } = useTeamLocks(
    currentUserId ?? undefined,
  );

  const [proxyOverrides, setProxyOverrides] = React.useState<
    Record<string, string | null>
  >({});
  const [vpnOverrides, setVpnOverrides] = React.useState<
    Record<string, string | null>
  >({});
  const [showCheckboxes, setShowCheckboxes] = React.useState(false);
  const [tagsOverrides, setTagsOverrides] = React.useState<
    Record<string, string[]>
  >({});
  const [allTags, setAllTags] = React.useState<string[]>([]);
  const [openTagsEditorFor, setOpenTagsEditorFor] = React.useState<
    string | null
  >(null);
  const [openProxySelectorFor, setOpenProxySelectorFor] = React.useState<
    string | null
  >(null);
  const [checkingProfileId, setCheckingProfileId] = React.useState<
    string | null
  >(null);
  const [proxyCheckResults, setProxyCheckResults] = React.useState<
    Record<string, ProxyCheckResult>
  >({});
  const [noteOverrides, setNoteOverrides] = React.useState<
    Record<string, string | null>
  >({});
  const [openNoteEditorFor, setOpenNoteEditorFor] = React.useState<
    string | null
  >(null);
  const [trafficSnapshots, setTrafficSnapshots] = React.useState<
    Record<string, TrafficSnapshot>
  >({});
  const [trafficDialogProfile, setTrafficDialogProfile] = React.useState<{
    id: string;
    name?: string;
  } | null>(null);
  const [syncStatuses, setSyncStatuses] = React.useState<
    Record<string, { status: string; error?: string }>
  >({});

  // Stable refs for volatile state — keeps tableMeta stable when these values
  // change (traffic polls, sync events, proxy checks, user edits). Column cells
  // read the latest value from the ref during render instead of depending on
  // the state directly in tableMeta's useMemo dependency array.
  const trafficSnapshotsRef = React.useRef(trafficSnapshots);
  trafficSnapshotsRef.current = trafficSnapshots;
  const syncStatusesRef = React.useRef(syncStatuses);
  syncStatusesRef.current = syncStatuses;
  const proxyCheckResultsRef = React.useRef(proxyCheckResults);
  proxyCheckResultsRef.current = proxyCheckResults;
  const proxyOverridesRef = React.useRef(proxyOverrides);
  proxyOverridesRef.current = proxyOverrides;
  const vpnOverridesRef = React.useRef(vpnOverrides);
  vpnOverridesRef.current = vpnOverrides;

  // Country proxy creation state (for inline proxy creation in dropdown)
  const [countries, setCountries] = React.useState<LocationItem[]>([]);
  const [countriesLoaded, setCountriesLoaded] = React.useState(false);
  const hasCloudProxy = storedProxies.some((p) => p.is_cloud_managed);
  const canCreateLocationProxy = hasCloudProxy || crossOsUnlocked;

  const loadCountries = React.useCallback(async () => {
    if (countriesLoaded || !canCreateLocationProxy || !currentUserId) return;
    try {
      const data = await invoke<LocationItem[]>("cloud_get_countries");
      setCountries(data);
      setCountriesLoaded(true);
    } catch (_e) {
      // Keep this silent to avoid noisy console errors in non-cloud states.
    }
  }, [countriesLoaded, canCreateLocationProxy, currentUserId]);

  const loadAllTags = React.useCallback(async () => {
    try {
      const tags = await invoke<string[]>("get_all_tags");
      setAllTags(tags);
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  }, []);

  const handleProxySelection = React.useCallback(
    async (profileId: string, proxyId: string | null) => {
      if (isEntitlementReadOnly) {
        showErrorToast(t("entitlement.readOnlyDenied"), {
          description: t("entitlement.readOnlyDescription"),
        });
        return;
      }

      if (!canPerformTeamAction(effectiveTeamRole, "assign_proxy")) {
        showErrorToast(t("sync.team.permissionDenied"), {
          description: "permission_denied",
        });
        return;
      }

      try {
        await invoke("update_profile_proxy", {
          profileId,
          proxyId,
        });
        setProxyOverrides((prev) => ({ ...prev, [profileId]: proxyId }));
        setVpnOverrides((prev) => ({ ...prev, [profileId]: null }));
        await emit("profile-updated");
        showSuccessToast(t("toasts.success.profileUpdated"));
      } catch (error) {
        showErrorToast(t("toasts.error.profileUpdateFailed"), {
          description: extractRootError(error),
        });
      } finally {
        setOpenProxySelectorFor(null);
      }
    },
    [effectiveTeamRole, isEntitlementReadOnly, t],
  );

  const handleVpnSelection = React.useCallback(
    async (profileId: string, vpnId: string | null) => {
      if (isEntitlementReadOnly) {
        showErrorToast(t("entitlement.readOnlyDenied"), {
          description: t("entitlement.readOnlyDescription"),
        });
        return;
      }

      if (!canPerformTeamAction(effectiveTeamRole, "update_profile_vpn")) {
        showErrorToast(t("sync.team.permissionDenied"), {
          description: "permission_denied",
        });
        return;
      }

      try {
        await invoke("update_profile_vpn", {
          profileId,
          vpnId,
        });
        setVpnOverrides((prev) => ({ ...prev, [profileId]: vpnId }));
        setProxyOverrides((prev) => ({ ...prev, [profileId]: null }));
        await emit("profile-updated");
        showSuccessToast(t("toasts.success.profileUpdated"));
      } catch (error) {
        showErrorToast(t("toasts.error.profileUpdateFailed"), {
          description: extractRootError(error),
        });
      } finally {
        setOpenProxySelectorFor(null);
      }
    },
    [effectiveTeamRole, isEntitlementReadOnly, t],
  );

  const handleCreateCountryProxy = React.useCallback(
    async (profileId: string, country: LocationItem) => {
      if (isEntitlementReadOnly) {
        showErrorToast(t("entitlement.readOnlyDenied"), {
          description: t("entitlement.readOnlyDescription"),
        });
        return;
      }

      if (!canPerformTeamAction(effectiveTeamRole, "assign_proxy")) {
        showErrorToast(t("sync.team.permissionDenied"), {
          description: "permission_denied",
        });
        return;
      }

      try {
        await invoke("create_cloud_location_proxy", {
          name: country.name,
          country: country.code,
          state: null,
          city: null,
        });
        await emit("stored-proxies-changed");
        // Wait briefly for proxy list to update, then find and assign the new proxy
        await new Promise((r) => setTimeout(r, 200));
        const updatedProxies =
          await invoke<StoredProxy[]>("get_stored_proxies");
        const scope = getCurrentDataScope();
        const scopedProxies = scopeEntitiesForContext(
          "proxies",
          updatedProxies,
          (proxy) => proxy.id,
          scope,
        );
        const newProxy = scopedProxies.find(
          (p: StoredProxy) =>
            p.is_cloud_derived && p.geo_country === country.code,
        );
        if (newProxy) {
          await handleProxySelection(profileId, newProxy.id);
        }
        setOpenProxySelectorFor(null);
      } catch (error) {
        showErrorToast(t("toasts.error.proxyCreateFailed"), {
          description: extractRootError(error),
        });
      }
    },
    [effectiveTeamRole, handleProxySelection, isEntitlementReadOnly, t],
  );

  // Use shared browser state hook
  const browserState = useBrowserState(
    profiles,
    runningProfiles,
    isUpdating,
    launchingProfiles,
    stoppingProfiles,
  );

  React.useEffect(() => {
    syncPendingTransitionTimestamps(
      launchingProfiles,
      launchingStartedAtRef.current,
    );
  }, [launchingProfiles]);

  React.useEffect(() => {
    syncPendingTransitionTimestamps(
      stoppingProfiles,
      stoppingStartedAtRef.current,
    );
  }, [stoppingProfiles]);

  // Reconcile pending launch/stop transitions against backend state so the UI
  // self-heals if a transition event is delayed or missed.
  React.useEffect(() => {
    if (!browserState.isClient) {
      return;
    }
    if (launchingProfiles.size === 0 && stoppingProfiles.size === 0) {
      return;
    }

    let isCancelled = false;
    let inFlight = false;

    const reconcilePendingTransitions = async () => {
      if (document.visibilityState !== "visible" || inFlight) {
        return;
      }

      const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
      const candidateIds = Array.from(
        new Set([...launchingProfiles, ...stoppingProfiles]),
      ).filter((id) => profilesById.has(id));

      if (candidateIds.length === 0) {
        setLaunchingProfiles((prev) => {
          if (prev.size === 0) {
            return prev;
          }
          return new Set(Array.from(prev).filter((id) => profilesById.has(id)));
        });
        setStoppingProfiles((prev) => {
          if (prev.size === 0) {
            return prev;
          }
          return new Set(Array.from(prev).filter((id) => profilesById.has(id)));
        });
        return;
      }

      inFlight = true;
      try {
        const statusMap = await invoke<Record<string, boolean>>(
          "check_browser_statuses_batch",
          {
            profileIds: candidateIds,
          },
        );

        if (isCancelled) {
          return;
        }

        const now = Date.now();
        setLaunchingProfiles((prev) => {
          let changed = false;
          const next = new Set(prev);
          prev.forEach((id) => {
            const profile = profilesById.get(id);
            const isRunning =
              runningProfiles.has(id) ||
              (statusMap[id] ?? false) ||
              profile?.runtime_state === "Running" ||
              Boolean(profile?.process_id);
            const startedAt = launchingStartedAtRef.current.get(id) ?? now;
            const timedOut =
              now - startedAt >= PROFILE_LAUNCH_TRANSITION_TIMEOUT_MS;
            if (!profile || isRunning || timedOut) {
              next.delete(id);
              changed = true;
            }
          });
          return changed ? next : prev;
        });

        setStoppingProfiles((prev) => {
          let changed = false;
          const next = new Set(prev);
          prev.forEach((id) => {
            const profile = profilesById.get(id);
            const isStillRunning =
              runningProfiles.has(id) ||
              (statusMap[id] ?? false) ||
              profile?.runtime_state === "Running" ||
              profile?.runtime_state === "Terminating";
            const startedAt = stoppingStartedAtRef.current.get(id) ?? now;
            const timedOut =
              now - startedAt >= PROFILE_STOP_TRANSITION_TIMEOUT_MS;
            if (!profile || !isStillRunning || timedOut) {
              next.delete(id);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      } catch {
        // Best-effort reconciliation only.
      } finally {
        inFlight = false;
      }
    };

    void reconcilePendingTransitions();
    const interval = window.setInterval(() => {
      void reconcilePendingTransitions();
    }, PROFILE_TRANSITION_RECONCILE_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [browserState.isClient, launchingProfiles, profiles, runningProfiles, stoppingProfiles]);

  // Listen for sync status events
  React.useEffect(() => {
    if (!browserState.isClient) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        unlisten = await listen<{
          profile_id: string;
          status: string;
          error?: string;
        }>("profile-sync-status", (event) => {
          const { profile_id, status, error } = event.payload;
          setSyncStatuses((prev) => ({
            ...prev,
            [profile_id]: { status, error },
          }));
        });
      } catch (error) {
        console.error("Failed to listen for sync status events:", error);
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, [browserState.isClient]);

  // Clear launching/stopping spinners when backend reports running status changes.
  // NOTE: The `profile-running-changed` event is already listened to by
  // `useProfileEvents` which updates `runningProfiles`. We only need to clear
  // the local launching/stopping spinners here via a derived effect.
  React.useEffect(() => {
    // When runningProfiles changes, clear any stale launching/stopping flags
    setLaunchingProfiles((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (runningProfiles.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setStoppingProfiles((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!runningProfiles.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [runningProfiles]);

  // Automatically deselect profiles that become running, updating, launching, or stopping
  React.useEffect(() => {
    const newSet = new Set(selectedProfiles);
    let hasChanges = false;

    for (const profileId of selectedProfiles) {
      const profile = profiles.find((p) => p.id === profileId);
      if (profile) {
        const isRunning =
          (browserState.isClient && runningProfiles.has(profile.id)) ||
          profile.runtime_state === "Running";
        const isParked = profile.runtime_state === "Parked";
        const isLaunching = launchingProfiles.has(profile.id);
        const isStopping = stoppingProfiles.has(profile.id);
        const isChecking = checkingProfiles.has(profile.id);

        if (isRunning || isParked || isLaunching || isStopping || isChecking) {
          newSet.delete(profileId);
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      onSelectedProfilesChange(Array.from(newSet));
    }
  }, [
    profiles,
    runningProfiles,
    launchingProfiles,
    stoppingProfiles,
    checkingProfiles,
    browserState.isClient,
    onSelectedProfilesChange,
    selectedProfiles,
  ]);

  // Update local sorting state when settings are loaded
  React.useEffect(() => {
    if (isLoaded && browserState.isClient) {
      setSorting(getTableSorting());
    }
  }, [isLoaded, getTableSorting, browserState.isClient]);

  // Handle sorting changes
  const handleSortingChange = React.useCallback(
    (updater: React.SetStateAction<SortingState>) => {
      if (!browserState.isClient) return;
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);
      updateSorting(newSorting);
    },
    [browserState.isClient, sorting, updateSorting],
  );

  const handleRename = React.useCallback(async () => {
    if (!profileToRename || !newProfileName.trim()) return;

    try {
      setIsRenamingSaving(true);
      await onRenameProfile(profileToRename.id, newProfileName.trim());
      setProfileToRename(null);
      setNewProfileName("");
      setRenameError(null);
    } catch (error) {
      setRenameError(
        error instanceof Error ? error.message : "Failed to rename profile",
      );
    } finally {
      setIsRenamingSaving(false);
    }
  }, [profileToRename, newProfileName, onRenameProfile]);

  // Cancel inline rename on outside click
  React.useEffect(() => {
    if (!profileToRename) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        renameContainerRef.current &&
        !renameContainerRef.current.contains(target)
      ) {
        setProfileToRename(null);
        setNewProfileName("");
        setRenameError(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileToRename]);

  const handleDelete = async () => {
    if (!profileToDelete) return;

    setIsDeleting(true);
    // Minimum loading time for visual feedback
    const minLoadingTime = new Promise((r) => setTimeout(r, 300));
    try {
      await Promise.all([onDeleteProfile(profileToDelete), minLoadingTime]);
      setProfileToDelete(null);
    } catch (error) {
      console.error("Failed to delete profile:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle icon/checkbox click
  const handleIconClick = React.useCallback(
    (profileId: string) => {
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) return;

      // Prevent selection of profiles whose browsers are updating
      if (!browserState.canSelectProfile(profile)) {
        return;
      }

      setShowCheckboxes(true);
      const newSet = new Set(selectedProfiles);
      if (newSet.has(profileId)) {
        newSet.delete(profileId);
      } else {
        newSet.add(profileId);
      }

      // Hide checkboxes if no profiles are selected
      if (newSet.size === 0) {
        setShowCheckboxes(false);
      }

      onSelectedProfilesChange(Array.from(newSet));
    },
    [profiles, browserState, onSelectedProfilesChange, selectedProfiles],
  );

  React.useEffect(() => {
    if (browserState.isClient && openTagsEditorFor && allTags.length === 0) {
      void loadAllTags();
    }
  }, [allTags.length, browserState.isClient, loadAllTags, openTagsEditorFor]);

  // Handle checkbox change
  const handleCheckboxChange = React.useCallback(
    (profileId: string, checked: boolean) => {
      const newSet = new Set(selectedProfiles);
      if (checked) {
        newSet.add(profileId);
      } else {
        newSet.delete(profileId);
      }

      // Hide checkboxes if no profiles are selected
      if (newSet.size === 0) {
        setShowCheckboxes(false);
      }

      onSelectedProfilesChange(Array.from(newSet));
    },
    [onSelectedProfilesChange, selectedProfiles],
  );

  // Handle select all checkbox
  const handleToggleAll = React.useCallback(
    (checked: boolean) => {
      const newSet = checked
        ? new Set(
            profiles
              .filter((profile) => {
                const isRunning =
                  (browserState.isClient && runningProfiles.has(profile.id)) ||
                  profile.runtime_state === "Running";
                const isParked = profile.runtime_state === "Parked";
                const isLaunching = launchingProfiles.has(profile.id);
                const isStopping = stoppingProfiles.has(profile.id);
                const isChecking = checkingProfiles.has(profile.id);
                return (
                  !isRunning &&
                  !isParked &&
                  !isLaunching &&
                  !isStopping &&
                  !isChecking
                );
              })
              .map((profile) => profile.id),
          )
        : new Set<string>();

      setShowCheckboxes(checked);
      onSelectedProfilesChange(Array.from(newSet));
    },
    [
      profiles,
      onSelectedProfilesChange,
      browserState.isClient,
      runningProfiles,
      launchingProfiles,
      stoppingProfiles,
      checkingProfiles,
    ],
  );

  // O(1) Set-based lookup for selected profiles
  const selectedProfilesSet = React.useMemo(
    () => new Set(selectedProfiles),
    [selectedProfiles],
  );

  // Memoize selectableProfiles calculation
  const selectableProfiles = React.useMemo(() => {
    return profiles.filter((profile) => {
      const isRunning =
        (browserState.isClient && runningProfiles.has(profile.id)) ||
        profile.runtime_state === "Running";
      const isParked = profile.runtime_state === "Parked";
      const isLaunching = launchingProfiles.has(profile.id);
      const isStopping = stoppingProfiles.has(profile.id);
      const isChecking = checkingProfiles.has(profile.id);
      return (
        !isRunning && !isParked && !isLaunching && !isStopping && !isChecking
      );
    });
  }, [
    profiles,
    browserState.isClient,
    runningProfiles,
    launchingProfiles,
    stoppingProfiles,
    checkingProfiles,
  ]);

  const getRuntimeBadgeClassName = React.useCallback(
    ({
      isRunning,
      isParked,
      isLaunching,
      isStopping,
      isChecking,
    }: {
      isRunning: boolean;
      isParked: boolean;
      isLaunching: boolean;
      isStopping: boolean;
      isChecking: boolean;
    }) => {
      if (isStopping) {
        return "gap-1 border-destructive/20 bg-destructive/10 text-destructive";
      }
      if (isRunning || isLaunching || isChecking) {
        return "gap-1 border-primary/20 bg-primary/10 text-primary";
      }
      if (isParked) {
        return "gap-1 border-border/60 bg-secondary text-secondary-foreground";
      }
      return "gap-1 border-border/60 bg-muted text-muted-foreground";
    },
    [],
  );

  const getActionButtonClassName = React.useCallback(
    () =>
      "min-w-[84px] h-7 rounded-md px-2 text-[11px] font-medium shadow-none",
    [],
  );

  // Build table meta from volatile state so columns can stay stable
  const tableMeta = React.useMemo<TableMeta>(
    () => ({
      t,
      selectedProfiles,
      selectedProfilesSet,
      selectableCount: selectableProfiles.length,
      showCheckboxes,
      isClient: browserState.isClient,
      runningProfiles,
      launchingProfiles,
      stoppingProfiles,
      checkingProfiles,
      isUpdating,
      browserState,

      // Tags editor state
      tagsOverrides,
      allTags,
      openTagsEditorFor,
      setAllTags,
      setOpenTagsEditorFor,
      setTagsOverrides,

      // Note editor state
      noteOverrides,
      openNoteEditorFor,
      setOpenNoteEditorFor,
      setNoteOverrides,

      // Proxy selector state (overrides via ref to keep tableMeta stable)
      openProxySelectorFor,
      setOpenProxySelectorFor,
      proxyOverrides: proxyOverridesRef.current,
      storedProxies,
      onOpenProxyCenter,
      handleProxySelection,
      checkingProfileId,
      proxyCheckResults: proxyCheckResultsRef.current,

      // VPN selector state (overrides via ref to keep tableMeta stable)
      vpnConfigs,
      vpnOverrides: vpnOverridesRef.current,
      handleVpnSelection,

      // Selection helpers
      isProfileSelected: (id: string) => selectedProfilesSet.has(id),
      handleToggleAll,
      handleCheckboxChange,
      handleIconClick,

      // Rename helpers
      handleRename,
      setProfileToRename,
      setNewProfileName,
      setRenameError,
      profileToRename,
      newProfileName,
      isRenamingSaving,
      renameError,

      // Launch/stop helpers
      setLaunchingProfiles,
      setStoppingProfiles,
      setCheckingProfiles,
      onKillProfile,
      onLaunchProfile,

      // Overflow actions
      onAssignProfilesToGroup,
      onCloneProfile,
      onConfigureCamoufox,
      onCopyCookiesToProfile,
      onOpenCookieManagement,
      onPinProfile,
      onUnpinProfile,
      isProfilePinned: (profileId: string) =>
        isProfilePinned?.(profileId) ?? false,

      // Traffic snapshots (lightweight real-time data — accessed via ref to keep tableMeta stable)
      trafficSnapshots: trafficSnapshotsRef.current,
      onOpenTrafficDialog: (profileId: string) => {
        const profile = profiles.find((p) => p.id === profileId);
        setTrafficDialogProfile({ id: profileId, name: profile?.name });
      },

      // Sync (accessed via ref to keep tableMeta stable)
      syncStatuses: syncStatusesRef.current,
      onOpenProfileSyncDialog,
      onToggleProfileSync,
      crossOsUnlocked,
      extensionManagementUnlocked,
      cookieManagementUnlocked,
      syncUnlocked,

      // Country proxy creation
      countries,
      canCreateLocationProxy,
      loadCountries,
      handleCreateCountryProxy,

      // Team locks
      isProfileLockedByAnother: isProfileLocked,
      getProfileLockEmail: (profileId: string) =>
        getLockInfo(profileId)?.lockedByEmail,
      isReadOnlyRole,
    }),
    [
      t,
      selectedProfiles,
      selectedProfilesSet,
      selectableProfiles.length,
      showCheckboxes,
      browserState.isClient,
      runningProfiles,
      launchingProfiles,
      stoppingProfiles,
      checkingProfiles,
      isUpdating,
      browserState,
      tagsOverrides,
      allTags,
      openTagsEditorFor,
      noteOverrides,
      openNoteEditorFor,
      openProxySelectorFor,
      // NOTE: proxyOverrides, vpnOverrides, proxyCheckResults, trafficSnapshots,
      // syncStatuses are accessed via stable refs (see *Ref variables above)
      // and intentionally excluded from deps to keep tableMeta stable.
      storedProxies,
      onOpenProxyCenter,
      handleProxySelection,
      checkingProfileId,
      vpnConfigs,
      handleVpnSelection,
      handleToggleAll,
      handleCheckboxChange,
      handleIconClick,
      handleRename,
      profileToRename,
      newProfileName,
      isRenamingSaving,
      profiles,
      renameError,
      onKillProfile,
      onLaunchProfile,
      onAssignProfilesToGroup,
      onCloneProfile,
      onConfigureCamoufox,
      onCopyCookiesToProfile,
      onOpenCookieManagement,
      onPinProfile,
      onUnpinProfile,
      isProfilePinned,
      onOpenProfileSyncDialog,
      onToggleProfileSync,
      crossOsUnlocked,
      extensionManagementUnlocked,
      cookieManagementUnlocked,
      syncUnlocked,
      countries,
      canCreateLocationProxy,
      loadCountries,
      handleCreateCountryProxy,
      isProfileLocked,
      getLockInfo,
      isReadOnlyRole,
    ],
  );

  const columns: ColumnDef<BrowserProfile>[] = React.useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const meta = table.options.meta as TableMeta;
          return (
            <span>
              <Checkbox
                checked={
                  meta.selectedProfiles.length === meta.selectableCount &&
                  meta.selectableCount !== 0
                }
                onCheckedChange={(value) => meta.handleToggleAll(!!value)}
                aria-label={t("profiles.table.selectAll")}
                className="cursor-pointer"
              />
            </span>
          );
        },
        cell: ({ row, table }) => {
          const meta = table.options.meta as TableMeta;
          const profile = row.original;
          const browser = profile.browser;
          const IconComponent = getProfileIcon(profile);
          const isCrossOs = isCrossOsProfile(profile);

          const isSelected = meta.isProfileSelected(profile.id);
          const isRunning =
            (meta.isClient && meta.runningProfiles.has(profile.id)) ||
            profile.runtime_state === "Running";
          const isParked = profile.runtime_state === "Parked";
          const isLaunching = meta.launchingProfiles.has(profile.id);
          const isStopping = meta.stoppingProfiles.has(profile.id);
          const isDisabled = isRunning || isParked || isLaunching || isStopping;

          // Cross-OS profiles: show OS icon when checkboxes aren't visible, show checkbox when they are
          if (isCrossOs && !meta.showCheckboxes && !isSelected) {
            const osName = profile.host_os
              ? getOSDisplayName(profile.host_os)
              : "another OS";
            const crossOsTooltip = t("crossOs.viewOnly", { os: osName });
            const OsIcon =
              profile.host_os === "macos"
                ? FaApple
                : profile.host_os === "windows"
                  ? FaWindows
                  : FaLinux;
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex justify-center items-center w-4 h-4">
                    <button
                      type="button"
                      className="flex justify-center items-center p-0 border-none cursor-pointer"
                      onClick={() => meta.handleIconClick(profile.id)}
                      aria-label={t("profiles.table.selectProfile")}
                    >
                      <span className="w-4 h-4 group">
                        <OsIcon className="w-4 h-4 text-muted-foreground group-hover:hidden" />
                        <span className="peer border-input dark:bg-input/30 dark:data-[state=checked]:bg-primary size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none w-4 h-4 hidden group-hover:block pointer-events-none items-center justify-center duration-200" />
                      </span>
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{crossOsTooltip}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          // Cross-OS profiles with checkboxes visible: show checkbox (selectable for bulk delete)
          if (isCrossOs && (meta.showCheckboxes || isSelected)) {
            const osName = profile.host_os
              ? getOSDisplayName(profile.host_os)
              : "another OS";
            const crossOsTooltip = t("crossOs.viewOnly", { os: osName });
            return (
              <NonHoverableTooltip
                content={<p>{crossOsTooltip}</p>}
                sideOffset={4}
                horizontalOffset={8}
              >
                <span className="flex justify-center items-center w-4 h-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(value) =>
                      meta.handleCheckboxChange(profile.id, !!value)
                    }
                    aria-label={t("profiles.table.selectRow")}
                    className="w-4 h-4"
                  />
                </span>
              </NonHoverableTooltip>
            );
          }

          if (isDisabled) {
            const tooltipMessage = isRunning
              ? t("profiles.table.cannotModifyRunning")
              : isParked
                ? t("profiles.table.cannotModifyRunning")
                : isLaunching
                  ? t("profiles.table.cannotModifyLaunching")
                  : isStopping
                    ? t("profiles.table.cannotModifyStopping")
                    : t("profiles.table.cannotModifyUpdating");

            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex justify-center items-center w-4 h-4 cursor-not-allowed">
                    {IconComponent && (
                      <IconComponent className="w-4 h-4 opacity-50" />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltipMessage}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          const browserName = getBrowserDisplayName(browser);

          if (meta.showCheckboxes || isSelected) {
            return (
              <NonHoverableTooltip
                content={<p>{browserName}</p>}
                sideOffset={4}
                horizontalOffset={8}
              >
                <span className="flex justify-center items-center w-4 h-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(value) =>
                      meta.handleCheckboxChange(profile.id, !!value)
                    }
                    aria-label={t("profiles.table.selectRow")}
                    className="w-4 h-4"
                  />
                </span>
              </NonHoverableTooltip>
            );
          }

          return (
            <NonHoverableTooltip
              content={<p>{browserName}</p>}
              sideOffset={4}
              horizontalOffset={8}
            >
              <span className="flex relative justify-center items-center w-4 h-4">
                <button
                  type="button"
                  className="flex justify-center items-center p-0 border-none cursor-pointer"
                  onClick={() => meta.handleIconClick(profile.id)}
                  aria-label={t("profiles.table.selectProfile")}
                >
                  <span className="w-4 h-4 group">
                    {IconComponent && (
                      <IconComponent className="w-4 h-4 group-hover:hidden" />
                    )}
                    <span className="peer border-input dark:bg-input/30 dark:data-[state=checked]:bg-primary size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none w-4 h-4 hidden group-hover:block pointer-events-none items-center justify-center duration-200" />
                  </span>
                </button>
              </span>
            </NonHoverableTooltip>
          );
        },
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        id: "actions",
        header: t("profiles.table.actions"),
        cell: ({ row, table }) => {
          const meta = table.options.meta as TableMeta;
          const profile = row.original;
          const BrowserIcon = getBrowserIcon(profile.browser);
          const isRunning =
            (meta.isClient && meta.runningProfiles.has(profile.id)) ||
            profile.runtime_state === "Running";
          const isParked = profile.runtime_state === "Parked";
          const isLaunching = meta.launchingProfiles.has(profile.id);
          const isStopping = meta.stoppingProfiles.has(profile.id);
          const isChecking = meta.checkingProfiles.has(profile.id);
          const isLockedByAnother = meta.isProfileLockedByAnother(profile.id);
          const canLaunch =
            meta.browserState.canLaunchProfile(profile) && !isLockedByAnother;
          const lockEmail = meta.getProfileLockEmail(profile.id);
          const tooltipContent = isLockedByAnother
            ? meta.t("sync.team.cannotLaunchLocked", { email: lockEmail })
            : meta.browserState.getLaunchTooltipContent(profile);

          const handleProfileStop = async (profile: BrowserProfile) => {
            meta.setStoppingProfiles((prev: Set<string>) =>
              new Set(prev).add(profile.id),
            );
            try {
              await meta.onKillProfile(profile);
            } catch (error) {
              meta.setStoppingProfiles((prev: Set<string>) => {
                const next = new Set(prev);
                next.delete(profile.id);
                return next;
              });
              throw error;
            }
          };

          const handleProfileLaunch = async (profile: BrowserProfile) => {
            const hasProxyOverride = Object.hasOwn(
              meta.proxyOverrides,
              profile.id,
            );
            const effectiveProxyId = hasProxyOverride
              ? meta.proxyOverrides[profile.id]
              : (profile.proxy_id ?? null);
            const effectiveProxy = effectiveProxyId
              ? (meta.storedProxies.find((p) => p.id === effectiveProxyId) ??
                null)
              : null;
            const hasVpnOverride = Object.hasOwn(meta.vpnOverrides, profile.id);
            const effectiveVpnId = hasVpnOverride
              ? meta.vpnOverrides[profile.id]
              : (profile.vpn_id ?? null);
            const effectiveVpn = effectiveVpnId
              ? (meta.vpnConfigs.find((v) => v.id === effectiveVpnId) ?? null)
              : null;

            if (effectiveProxy && !effectiveVpn) {
              const cached = meta.proxyCheckResults[effectiveProxy.id];
              const nowSeconds = Math.floor(Date.now() / 1000);
              const hasFreshProxyCheck =
                Boolean(cached) &&
                nowSeconds - (cached?.timestamp ?? 0) <=
                  PROXY_PRELAUNCH_CHECK_TTL_SECONDS;

              if (!hasFreshProxyCheck) {
                meta.setCheckingProfiles((prev: Set<string>) =>
                  new Set(prev).add(profile.id),
                );
                // Keep launch responsive: proxy precheck runs in background.
                void invoke<ProxyCheckResult>("check_proxy_validity", {
                  proxyId: effectiveProxy.id,
                  proxySettings: effectiveProxy.proxy_settings,
                })
                  .then((result) => {
                    setProxyCheckResults((prev) => ({
                      ...prev,
                      [effectiveProxy.id]: result,
                    }));
                  })
                  .catch((error) => {
                    showErrorToast(meta.t("toasts.error.profileLaunchFailed"), {
                      description: extractRootError(error),
                    });
                  })
                  .finally(() => {
                    meta.setCheckingProfiles((prev: Set<string>) => {
                      const next = new Set(prev);
                      next.delete(profile.id);
                      return next;
                    });
                  });
              }
            }

            meta.setLaunchingProfiles((prev: Set<string>) =>
              new Set(prev).add(profile.id),
            );
            try {
              await meta.onLaunchProfile(profile);
            } catch (error) {
              meta.setLaunchingProfiles((prev: Set<string>) => {
                const next = new Set(prev);
                next.delete(profile.id);
                return next;
              });
              throw error;
            }
          };

          return (
            <div className="flex gap-2 items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <RippleButton
                      variant={isRunning ? "outline" : "default"}
                      size="sm"
                      disabled={
                        !canLaunch || isLaunching || isStopping || isChecking
                      }
                      className={cn(
                        getActionButtonClassName(),
                        isRunning &&
                          "border-destructive/35 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
                        !canLaunch && "opacity-50 cursor-not-allowed",
                        canLaunch && "cursor-pointer",
                      )}
                      onClick={() =>
                        isRunning
                          ? handleProfileStop(profile)
                          : handleProfileLaunch(profile)
                      }
                    >
                      {isChecking || isLaunching || isStopping ? (
                        <div className="flex items-center justify-center">
                          <Spinner size="sm" className="text-current" />
                        </div>
                      ) : isRunning ? (
                        <div className="flex gap-1.5 items-center">
                          <LuCircleStop className="w-3.5 h-3.5 shrink-0" />
                          <span>{meta.t("profiles.actions.stop")}</span>
                        </div>
                      ) : isParked ? (
                        <div className="flex gap-1.5 items-center">
                          <BrowserIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{meta.t("profiles.actions.resume")}</span>
                        </div>
                      ) : (
                        <div className="flex gap-1.5 items-center">
                          <BrowserIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{meta.t("profiles.actions.launch")}</span>
                        </div>
                      )}
                    </RippleButton>
                  </span>
                </TooltipTrigger>
                {tooltipContent && (
                  <TooltipContent>{tooltipContent}</TooltipContent>
                )}
              </Tooltip>
            </div>
          );
        },
      },
      {
        id: "runtime",
        header: t("profiles.table.status"),
        size: 160,
        cell: ({ row, table }) => {
          const meta = table.options.meta as TableMeta;
          const profile = row.original;
          const isRunning =
            (meta.isClient && meta.runningProfiles.has(profile.id)) ||
            profile.runtime_state === "Running";
          const isParked = profile.runtime_state === "Parked";
          const isLaunching = meta.launchingProfiles.has(profile.id);
          const isStopping = meta.stoppingProfiles.has(profile.id);
          const isChecking = meta.checkingProfiles.has(profile.id);
          const hasProxyOverride = Object.hasOwn(
            meta.proxyOverrides,
            profile.id,
          );
          const effectiveProxyId = hasProxyOverride
            ? meta.proxyOverrides[profile.id]
            : (profile.proxy_id ?? null);
          const hasVpnOverride = Object.hasOwn(meta.vpnOverrides, profile.id);
          const effectiveVpnId = hasVpnOverride
            ? meta.vpnOverrides[profile.id]
            : (profile.vpn_id ?? null);
          const proxyCheckResult = effectiveProxyId
            ? (meta.proxyCheckResults[effectiveProxyId] ?? null)
            : null;

          return (
            <div className="flex gap-2 items-center">
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 px-2 py-0 shadow-none",
                  getRuntimeBadgeClassName({
                    isRunning,
                    isParked,
                    isLaunching,
                    isStopping,
                    isChecking,
                  }),
                )}
              >
                {isChecking ? (
                  <>
                    <Spinner size="sm" className="text-current" />
                    <span>{meta.t("proxies.check.tooltips.checking")}</span>
                  </>
                ) : isLaunching ? (
                  <>
                    <LuPlay className="w-3 h-3" />
                    <span>{meta.t("profiles.actions.launch")}</span>
                  </>
                ) : isStopping ? (
                  <>
                    <LuCircleStop className="w-3 h-3" />
                    <span>{meta.t("profiles.actions.stop")}</span>
                  </>
                ) : isRunning ? (
                  <>
                    <LuPlay className="w-3 h-3" />
                    <span>{meta.t("common.status.running")}</span>
                  </>
                ) : isParked ? (
                  <>
                    <LuPause className="w-3 h-3" />
                    <span>{meta.t("profiles.actions.resume")}</span>
                  </>
                ) : (
                  <>
                    <LuClock3 className="w-3 h-3" />
                    <span>{meta.t("common.status.stopped")}</span>
                  </>
                )}
              </Badge>
              {effectiveProxyId && !effectiveVpnId && proxyCheckResult && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center">
                      {proxyCheckResult.is_valid ? (
                        <LuGlobe className="w-3.5 h-3.5 text-chart-2" />
                      ) : (
                        <LuShieldAlert className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {proxyCheckResult.is_valid
                      ? `${proxyCheckResult.ip || "-"} ${proxyCheckResult.country || ""}`.trim()
                      : meta.t("common.status.error")}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "name",
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="type-ui justify-start p-0 h-auto text-left cursor-pointer"
            >
              {t("profiles.table.name")}
              {column.getIsSorted() === "asc" ? (
                <LuChevronUp className="ml-2 w-4 h-4" />
              ) : column.getIsSorted() === "desc" ? (
                <LuChevronDown className="ml-2 w-4 h-4" />
              ) : null}
            </Button>
          );
        },
        enableSorting: true,
        sortingFn: "alphanumeric",
        cell: ({ row, table }) => {
          const meta = table.options.meta as TableMeta;
          const profile = row.original as BrowserProfile;
          const name = profile.name;
          const isEditing = meta.profileToRename?.id === profile.id;

          if (isEditing) {
            return (
              <div
                ref={renameContainerRef}
                className="overflow-visible relative"
              >
                <Input
                  autoFocus
                  value={meta.newProfileName}
                  onChange={(e) => {
                    meta.setNewProfileName(e.target.value);
                    if (meta.renameError) meta.setRenameError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !(e.metaKey || e.ctrlKey)) {
                      void meta.handleRename();
                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      void meta.handleRename();
                    } else if (e.key === "Escape") {
                      meta.setProfileToRename(null);
                      meta.setNewProfileName("");
                      meta.setRenameError(null);
                    }
                  }}
                  onBlur={() => {
                    if (
                      meta.newProfileName.trim().length > 0 &&
                      meta.newProfileName.trim() !== profile.name
                    ) {
                      void meta.handleRename();
                    } else {
                      meta.setProfileToRename(null);
                      meta.setNewProfileName("");
                      meta.setRenameError(null);
                    }
                  }}
                  className="type-ui w-48 h-6 px-2 py-1 border-0 shadow-none focus-visible:ring-0"
                />
              </div>
            );
          }

          const NAME_TRIM_LENGTH = 24;
          const display =
            name.length <= NAME_TRIM_LENGTH ? (
              <div className="type-ui text-left truncate">
                {name}
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="leading-tight">
                    {trimName(name, NAME_TRIM_LENGTH)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{name}</TooltipContent>
              </Tooltip>
            );

          const isCrossOs = isCrossOsProfile(profile);
          const isRunning =
            (meta.isClient && meta.runningProfiles.has(profile.id)) ||
            profile.runtime_state === "Running";
          const isParked = profile.runtime_state === "Parked";
          const isLaunching = meta.launchingProfiles.has(profile.id);
          const isStopping = meta.stoppingProfiles.has(profile.id);
          const isDisabled =
            isRunning ||
            isParked ||
            isLaunching ||
            isStopping ||
            isCrossOs ||
            meta.isReadOnlyRole;
          const lockedEmail = meta.getProfileLockEmail(profile.id);
          const isLocked = meta.isProfileLockedByAnother(profile.id);
          const isPinned = meta.isProfilePinned(profile.id);
          const osName = profile.host_os
            ? getOSDisplayName(profile.host_os)
            : null;
          const osVersion = extractOsVersionFromProfile(profile);
          const OsIcon =
            profile.host_os === "macos"
              ? FaApple
              : profile.host_os === "windows"
                ? FaWindows
                : profile.host_os === "linux"
                  ? FaLinux
                  : null;

          return (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={cn(
                  "px-2 py-1 mr-auto text-left bg-transparent rounded border-none w-48 h-6",
                  isDisabled
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer hover:bg-accent/50",
                )}
                onClick={() => {
                  if (isDisabled) return;
                  meta.setProfileToRename(profile);
                  meta.setNewProfileName(profile.name);
                  meta.setRenameError(null);
                }}
                onKeyDown={(e) => {
                  if (isDisabled) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    meta.setProfileToRename(profile);
                    meta.setNewProfileName(profile.name);
                    meta.setRenameError(null);
                  }
                }}
              >
                {display}
              </button>
              {isPinned && (
                <Badge
                  variant="outline"
                  className="h-5 gap-1 border-primary/40 bg-primary/10 px-1.5 text-[10px] font-medium text-primary"
                >
                  <LuPin className="h-3 w-3 rotate-45" />
                  {meta.t("profiles.actions.pinned")}
                </Badge>
              )}
              {osName && OsIcon && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded border border-border/60 bg-muted/20 text-muted-foreground">
                      <OsIcon className="w-3 h-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p>{`${meta.t("profileInfo.fields.hostOs")}: ${osName}`}</p>
                      {osVersion && (
                        <p>{`${meta.t("fingerprint.platformVersion")}: ${osVersion}`}</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              {isLocked && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <LuLock className="w-3 h-3 text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {meta.t("sync.team.profileLocked", { email: lockedEmail })}
                  </TooltipContent>
                </Tooltip>
              )}
              {!meta.isReadOnlyRole && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={isPinned ? "secondary" : "ghost"}
                      size="icon"
                      className={cn(
                        "h-6 w-6",
                        isPinned
                          ? "bg-primary/15 text-primary hover:bg-primary/25"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => {
                        if (isPinned) {
                          meta.onUnpinProfile?.(profile);
                          return;
                        }
                        meta.onPinProfile?.(profile);
                      }}
                    >
                      {isPinned ? (
                        <LuPinOff className="h-3.5 w-3.5" />
                      ) : (
                        <LuPin className="h-3.5 w-3.5 rotate-45" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPinned
                      ? meta.t("profiles.actions.unpin")
                      : meta.t("profiles.actions.pin")}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
      {
        id: "lastLaunch",
        header: t("profiles.table.lastLaunch"),
        size: 120,
        cell: ({ row }) => {
          const profile = row.original;
          if (!profile.last_launch) {
            return (
              <span className="text-xs text-muted-foreground">
                {t("common.labels.none")}
              </span>
            );
          }
          return (
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(profile.last_launch)}
            </span>
          );
        },
      },
      {
        id: "tags",
        header: t("profiles.table.tags"),
        cell: ({ row, table }) => {
          const meta = table.options.meta as TableMeta;
          const profile = row.original;
          const isCrossOs = isCrossOsProfile(profile);
          const isRunning =
            (meta.isClient && meta.runningProfiles.has(profile.id)) ||
            profile.runtime_state === "Running";
          const isParked = profile.runtime_state === "Parked";
          const isLaunching = meta.launchingProfiles.has(profile.id);
          const isStopping = meta.stoppingProfiles.has(profile.id);
          const isDisabled =
            isRunning ||
            isParked ||
            isLaunching ||
            isStopping ||
            isCrossOs ||
            meta.isReadOnlyRole;

          return (
            <TagsCell
              profile={profile}
              t={meta.t}
              isDisabled={isDisabled}
              tagsOverrides={meta.tagsOverrides || {}}
              allTags={meta.allTags || []}
              setAllTags={meta.setAllTags}
              openTagsEditorFor={meta.openTagsEditorFor || null}
              setOpenTagsEditorFor={meta.setOpenTagsEditorFor}
              setTagsOverrides={meta.setTagsOverrides}
            />
          );
        },
      },
      {
        id: "note",
        header: t("profiles.table.note"),
        cell: ({ row, table }) => {
          const meta = table.options.meta as TableMeta;
          const profile = row.original;
          const isCrossOs = isCrossOsProfile(profile);
          const isRunning =
            (meta.isClient && meta.runningProfiles.has(profile.id)) ||
            profile.runtime_state === "Running";
          const isParked = profile.runtime_state === "Parked";
          const isLaunching = meta.launchingProfiles.has(profile.id);
          const isStopping = meta.stoppingProfiles.has(profile.id);
          const isDisabled =
            isRunning ||
            isParked ||
            isLaunching ||
            isStopping ||
            isCrossOs ||
            meta.isReadOnlyRole;

          return (
            <NoteCell
              profile={profile}
              t={meta.t}
              isDisabled={isDisabled}
              noteOverrides={meta.noteOverrides || {}}
              openNoteEditorFor={meta.openNoteEditorFor || null}
              setOpenNoteEditorFor={meta.setOpenNoteEditorFor}
              setNoteOverrides={meta.setNoteOverrides}
            />
          );
        },
      },
      {
        id: "proxy",
        header: t("profiles.table.proxy"),
        cell: ({ row, table }) => {
          const meta = table.options.meta as TableMeta;
          const profile = row.original;
          const isCrossOs = isCrossOsProfile(profile);
          const isRunning =
            (meta.isClient && meta.runningProfiles.has(profile.id)) ||
            profile.runtime_state === "Running";
          const isParked = profile.runtime_state === "Parked";
          const isLaunching = meta.launchingProfiles.has(profile.id);
          const isStopping = meta.stoppingProfiles.has(profile.id);
          const isDisabled =
            isRunning ||
            isParked ||
            isLaunching ||
            isStopping ||
            isCrossOs ||
            meta.isReadOnlyRole;

          const hasProxyOverride = Object.hasOwn(
            meta.proxyOverrides,
            profile.id,
          );
          const effectiveProxyId = hasProxyOverride
            ? meta.proxyOverrides[profile.id]
            : (profile.proxy_id ?? null);
          const effectiveProxy = effectiveProxyId
            ? (meta.storedProxies.find((p) => p.id === effectiveProxyId) ??
              null)
            : null;

          const hasVpnOverride = Object.hasOwn(meta.vpnOverrides, profile.id);
          const effectiveVpnId = hasVpnOverride
            ? meta.vpnOverrides[profile.id]
            : (profile.vpn_id ?? null);
          const effectiveVpn = effectiveVpnId
            ? (meta.vpnConfigs.find((v) => v.id === effectiveVpnId) ?? null)
            : null;

          const hasAssignment = Boolean(effectiveProxy || effectiveVpn);
          const displayName = effectiveVpn
            ? effectiveVpn.name
            : effectiveProxy
              ? effectiveProxy.name
              : "Not Selected";
          const vpnBadge = effectiveVpn
            ? effectiveVpn.vpn_type === "WireGuard"
              ? "WG"
              : "OVPN"
            : null;
          const tooltipText = hasAssignment ? displayName : null;
          const isSelectorOpen = meta.openProxySelectorFor === profile.id;
          const selectedId = effectiveVpnId ?? effectiveProxyId ?? null;

          // When profile is running, show bandwidth chart instead of proxy selector
          if (isRunning && meta.trafficSnapshots) {
            const snapshot = meta.trafficSnapshots[profile.id];
            const bandwidthData = snapshot?.recent_bandwidth
              ? [...snapshot.recent_bandwidth]
              : [];
            const currentBandwidth =
              (snapshot?.current_bytes_sent || 0) +
              (snapshot?.current_bytes_received || 0);

            return (
              <BandwidthMiniChart
                key={`${profile.id}-${snapshot?.last_update || 0}-${bandwidthData.length}`}
                data={bandwidthData}
                currentBandwidth={currentBandwidth}
                onClick={() => meta.onOpenTrafficDialog?.(profile.id)}
              />
            );
          }

          return (
            <div className="flex gap-2 items-center">
              <Popover
                open={isSelectorOpen}
                onOpenChange={(open) =>
                  meta.setOpenProxySelectorFor(open ? profile.id : null)
                }
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <span
                        className={cn(
                          "flex gap-2 items-center px-2 py-1 rounded",
                          isDisabled
                            ? "opacity-60 cursor-not-allowed pointer-events-none"
                            : "cursor-pointer hover:bg-accent/50",
                        )}
                      >
                        {vpnBadge && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 leading-tight"
                          >
                            {vpnBadge}
                          </Badge>
                        )}
                        <span
                          className={cn(
                            "text-sm",
                            !hasAssignment && "text-muted-foreground",
                          )}
                        >
                          {hasAssignment
                            ? trimName(displayName, 10)
                            : displayName}
                        </span>
                      </span>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  {tooltipText && (
                    <TooltipContent>{tooltipText}</TooltipContent>
                  )}
                </Tooltip>

                {!isDisabled && (
                  <PopoverContent
                    className="w-[240px] p-0"
                    align="end"
                    sideOffset={8}
                  >
                    <Command>
                      <CommandInput
                        placeholder={
                          meta.canCreateLocationProxy
                            ? meta.t("profiles.table.proxySearchWithCountries")
                            : meta.t("profiles.table.proxySearch")
                        }
                        onFocus={() => {
                          if (meta.canCreateLocationProxy)
                            void meta.loadCountries();
                        }}
                      />
                      <CommandList>
                        {meta.onOpenProxyCenter && (
                          <CommandGroup
                            heading={meta.t("profiles.table.proxyQuickActions")}
                          >
                            <CommandItem
                              value="__open_proxy_center__"
                              onSelect={() => {
                                meta.setOpenProxySelectorFor(null);
                                meta.onOpenProxyCenter?.();
                              }}
                            >
                              <LuSettings2 className="mr-2 h-4 w-4" />
                              {meta.t("profiles.table.openProxyCenter")}
                            </CommandItem>
                            <CommandItem
                              value="__quick_add_proxy__"
                              onSelect={() => {
                                meta.setOpenProxySelectorFor(null);
                                meta.onOpenProxyCenter?.();
                              }}
                            >
                              <LuPlus className="mr-2 h-4 w-4" />
                              {meta.t("profiles.table.quickAddProxy")}
                            </CommandItem>
                          </CommandGroup>
                        )}
                        <CommandEmpty>
                          {meta.t("profiles.table.proxyEmpty")}
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() =>
                              void meta.handleProxySelection(profile.id, null)
                            }
                          >
                            <LuCheck
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedId === null
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {meta.t("profiles.table.none")}
                          </CommandItem>
                          {meta.storedProxies.map((proxy) => (
                            <CommandItem
                              key={proxy.id}
                              value={proxy.name}
                              onSelect={() =>
                                void meta.handleProxySelection(
                                  profile.id,
                                  proxy.id,
                                )
                              }
                            >
                              <LuCheck
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  effectiveProxyId === proxy.id && !effectiveVpn
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {proxy.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        {meta.vpnConfigs.length > 0 && (
                          <CommandGroup heading={meta.t("profiles.table.vpns")}>
                            {meta.vpnConfigs.map((vpn) => (
                              <CommandItem
                                key={vpn.id}
                                value={`vpn-${vpn.name}`}
                                onSelect={() =>
                                  void meta.handleVpnSelection(
                                    profile.id,
                                    vpn.id,
                                  )
                                }
                              >
                                <LuCheck
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    effectiveVpnId === vpn.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 leading-tight mr-1"
                                >
                                  {vpn.vpn_type === "WireGuard" ? "WG" : "OVPN"}
                                </Badge>
                                {vpn.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        {meta.canCreateLocationProxy &&
                          meta.countries.length > 0 && (
                            <CommandGroup
                              heading={meta.t("profiles.table.createByCountry")}
                            >
                              {meta.countries
                                .filter(
                                  (c) =>
                                    !meta.storedProxies.some(
                                      (p) =>
                                        p.is_cloud_derived &&
                                        p.geo_country === c.code,
                                    ),
                                )
                                .map((country) => (
                                  <CommandItem
                                    key={`country-${country.code}`}
                                    value={`create-${country.name}`}
                                    onSelect={() =>
                                      void meta.handleCreateCountryProxy(
                                        profile.id,
                                        country,
                                      )
                                    }
                                  >
                                    <span className="mr-2 h-4 w-4" />+{" "}
                                    {country.name}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                )}
              </Popover>
              {effectiveProxy && !effectiveVpn && !isDisabled && (
                <ProxyCheckButton
                  proxy={effectiveProxy}
                  profileId={profile.id}
                  checkingProfileId={meta.checkingProfileId}
                  cachedResult={meta.proxyCheckResults[effectiveProxy.id]}
                  setCheckingProfileId={setCheckingProfileId}
                  onCheckComplete={(result) => {
                    setProxyCheckResults((prev) => ({
                      ...prev,
                      [effectiveProxy.id]: result,
                    }));
                  }}
                  onCheckFailed={(result) => {
                    setProxyCheckResults((prev) => ({
                      ...prev,
                      [effectiveProxy.id]: result,
                    }));
                  }}
                />
              )}
            </div>
          );
        },
      },
      {
        id: "sync",
        header: "",
        size: 24,
        cell: ({ row, table }) => {
          const profile = row.original;
          const meta = table.options.meta as TableMeta;
          const syncEntry = meta.syncStatuses[profile.id];
          const liveStatus = syncEntry?.status as
            | "syncing"
            | "waiting"
            | "synced"
            | "error"
            | "disabled"
            | undefined;

          const dot = getProfileSyncStatusDot(
            meta.t,
            profile,
            liveStatus,
            syncEntry?.error,
          );
          if (!dot) return null;

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex justify-center items-center w-3 h-3">
                  {dot.encrypted ? (
                    <LuLock
                      className={`w-3 h-3 ${dot.color.replace("bg-", "text-")}${dot.animate ? " animate-pulse" : ""}`}
                    />
                  ) : (
                    <span
                      className={`w-2 h-2 rounded-full ${dot.color}${dot.animate ? " animate-pulse" : ""}`}
                    />
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>{dot.tooltip}</TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: "settings",
        size: 40,
        cell: ({ row, table }) => {
          const meta = table.options.meta as TableMeta;
          const profile = row.original;
          const isCrossOs = isCrossOsProfile(profile);
          const isRunning =
            (meta.isClient && meta.runningProfiles.has(profile.id)) ||
            profile.runtime_state === "Running";
          const isParked = profile.runtime_state === "Parked";
          const isLaunching = meta.launchingProfiles.has(profile.id);
          const isStopping = meta.stoppingProfiles.has(profile.id);
          const isChecking = meta.checkingProfiles.has(profile.id);
          const isBusy =
            isRunning || isParked || isLaunching || isStopping || isChecking;
          const renameBlocked = isCrossOs || isBusy || meta.isReadOnlyRole;
          const isArchived = isProfileArchived?.(profile.id) ?? false;
          const canManageCookies =
            meta.cookieManagementUnlocked && Boolean(meta.onOpenCookieManagement);
          const canCopyCookies =
            meta.cookieManagementUnlocked && Boolean(meta.onCopyCookiesToProfile);

          return (
            <div className="flex justify-end items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="p-0 w-8 h-8"
                    disabled={!meta.isClient}
                  >
                    <span className="sr-only">
                      {t("common.labels.actions")}
                    </span>
                    <LuEllipsisVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setProfileForInfoDialog(profile)}>
                    <LuInfo className="h-4 w-4" />
                    {t("profiles.table.profileInfo")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={renameBlocked}
                    onClick={() => {
                      meta.setProfileToRename(profile);
                      meta.setNewProfileName(profile.name);
                      meta.setRenameError(null);
                    }}
                  >
                    <LuPencil className="h-4 w-4" />
                    {t("profiles.actions.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isBusy || meta.isReadOnlyRole}
                    onClick={() => {
                      meta.onAssignProfilesToGroup?.([profile.id]);
                    }}
                  >
                    <LuUsers className="h-4 w-4" />
                    {t("profiles.actions.assignToGroup")}
                  </DropdownMenuItem>
                  {canCopyCookies && (
                    <DropdownMenuItem
                      disabled={isBusy}
                      onClick={() => {
                        meta.onCopyCookiesToProfile?.(profile);
                      }}
                    >
                      <LuCookie className="h-4 w-4" />
                      {t("profiles.actions.copyCookiesToProfile")}
                    </DropdownMenuItem>
                  )}
                  {canManageCookies && (
                    <DropdownMenuItem
                      disabled={isBusy}
                      onClick={() => {
                        meta.onOpenCookieManagement?.(profile);
                      }}
                    >
                      <LuCookie className="h-4 w-4" />
                      {t("profileInfo.actions.manageCookies")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    disabled={isBusy || meta.isReadOnlyRole}
                    onClick={() => {
                      void meta.onCloneProfile?.(profile);
                    }}
                  >
                    <LuPlus className="h-4 w-4" />
                    {t("profiles.actions.clone")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={meta.isReadOnlyRole}
                    onClick={() => {
                      if (isArchived) {
                        onRestoreProfile?.(profile);
                        return;
                      }
                      onArchiveProfile?.(profile);
                    }}
                  >
                    <LuArchive className="h-4 w-4" />
                    {isArchived
                      ? t("profiles.actions.restore")
                      : t("profiles.actions.archive")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={meta.isReadOnlyRole}
                    onClick={() => {
                      if (meta.isProfilePinned(profile.id)) {
                        meta.onUnpinProfile?.(profile);
                        return;
                      }
                      meta.onPinProfile?.(profile);
                    }}
                  >
                    <LuPin className="h-4 w-4" />
                    {meta.isProfilePinned(profile.id)
                      ? t("profiles.actions.unpin")
                      : t("profiles.actions.pin")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isBusy || meta.isReadOnlyRole}
                    onClick={() => setProfileToDelete(profile)}
                  >
                    <LuTrash2 className="h-4 w-4" />
                    {t("profiles.actions.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      t,
      getRuntimeBadgeClassName,
      getActionButtonClassName,
      isProfileArchived,
      onArchiveProfile,
      onRestoreProfile,
    ],
  );

  const table = useReactTable({
    data: profiles,
    columns,
    state: {
      sorting,
      rowSelection,
      pagination,
    },
    onSortingChange: handleSortingChange,
    onRowSelectionChange: handleRowSelectionChange,
    onPaginationChange: setPagination,
    enableRowSelection: (row) => {
      const profile = row.original;
      const isRunning =
        (browserState.isClient && runningProfiles.has(profile.id)) ||
        profile.runtime_state === "Running";
      const isParked = profile.runtime_state === "Parked";
      const isLaunching = launchingProfiles.has(profile.id);
      const isStopping = stoppingProfiles.has(profile.id);
      const isChecking = checkingProfiles.has(profile.id);
      return (
        !isRunning && !isParked && !isLaunching && !isStopping && !isChecking
      );
    },
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    meta: tableMeta,
  });

  React.useEffect(() => {
    const pageCount = table.getPageCount();
    if (pageCount === 0) {
      if (table.getState().pagination.pageIndex !== 0) {
        table.setPageIndex(0);
      }
      return;
    }
    if (table.getState().pagination.pageIndex > pageCount - 1) {
      table.setPageIndex(pageCount - 1);
    }
  }, [table]);

  const compactHiddenColumnIds = new Set(["tags", "note", "sync"]);
  const shouldRenderColumn = (columnId: string) =>
    !compactHiddenColumnIds.has(columnId);
  const visibleColumnCount = table
    .getAllLeafColumns()
    .filter((column) => shouldRenderColumn(column.id)).length;

  const pageRows = table.getRowModel().rows;
  const activeTrafficProfileIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const row of pageRows) {
      const profile = row.original;
      if (
        (browserState.isClient && runningProfiles.has(profile.id)) ||
        profile.runtime_state === "Running"
      ) {
        ids.add(profile.id);
      }
    }
    return Array.from(ids).sort();
  }, [browserState.isClient, pageRows, runningProfiles]);
  const activeTrafficCount = activeTrafficProfileIds.length;
  const tableScrollParentRef = React.useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: pageRows.length,
    getScrollElement: () => tableScrollParentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualPaddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const virtualPaddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();
  const pageStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = totalRows === 0 ? 0 : pageIndex * pageSize + pageRows.length;
  const paginationSummaryLabel = isLoading
    ? "—"
    : t("profiles.table.paginationSummary", {
        from: pageStart,
        to: pageEnd,
        total: totalRows,
      });

  React.useEffect(() => {
    if (!browserState.isClient) return;

    if (activeTrafficCount === 0) {
      setTrafficSnapshots({});
      return;
    }

    const activeProfileIdSet = new Set(activeTrafficProfileIds);
    const fetchTrafficSnapshots = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      try {
        const scopedSnapshots = await invoke<TrafficSnapshot[]>(
          "get_traffic_snapshots_for_profiles",
          {
            profileIds: activeTrafficProfileIds,
          },
        );
        const newSnapshots: Record<string, TrafficSnapshot> = {};
        for (const snapshot of scopedSnapshots) {
          if (!snapshot.profile_id || !activeProfileIdSet.has(snapshot.profile_id)) {
            continue;
          }
          const existing = newSnapshots[snapshot.profile_id];
          if (!existing || snapshot.last_update > existing.last_update) {
            newSnapshots[snapshot.profile_id] = snapshot;
          }
        }
        setTrafficSnapshots(newSnapshots);
      } catch (error) {
        console.error("Failed to fetch traffic snapshots:", error);
      }
    };

    void fetchTrafficSnapshots();
    const interval = setInterval(fetchTrafficSnapshots, 5000);
    return () => clearInterval(interval);
  }, [activeTrafficCount, activeTrafficProfileIds, browserState.isClient]);

  React.useEffect(() => {
    if (!browserState.isClient) return;

    setTrafficSnapshots((prev) => {
      const cleaned: Record<string, TrafficSnapshot> = {};
      for (const [profileId, snapshot] of Object.entries(prev)) {
        if (activeTrafficProfileIds.includes(profileId)) {
          cleaned[profileId] = snapshot;
        }
      }
      if (Object.keys(cleaned).length !== Object.keys(prev).length) {
        return cleaned;
      }
      return prev;
    });
  }, [activeTrafficProfileIds, browserState.isClient]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <ScrollArea
          ref={tableScrollParentRef}
          className="min-h-0 flex-1 rounded-md border"
        >
          <Table className="overflow-visible">
            <TableHeader className="overflow-visible">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="overflow-visible">
                  {headerGroup.headers
                    .filter((header) => shouldRenderColumn(header.column.id))
                    .map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          style={{
                            width: header.column.columnDef.size
                              ? `${header.column.getSize()}px`
                              : undefined,
                          }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="overflow-visible">
              {pageRows.length ? (
                <>
                  {virtualPaddingTop > 0 && (
                    <TableRow aria-hidden="true">
                      <TableCell
                        colSpan={visibleColumnCount}
                        className="h-0 border-0 p-0"
                        style={{ height: `${virtualPaddingTop}px` }}
                      />
                    </TableRow>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = pageRows[virtualRow.index];
                    if (!row) {
                      return null;
                    }
                    const rowIsCrossOs = isCrossOsProfile(row.original);
                    const rowIsPinned = isProfilePinned?.(row.original.id) ?? false;
                    const crossOsTitle = rowIsCrossOs
                      ? t("crossOs.viewOnly", {
                          os: getOSDisplayName(row.original.host_os ?? ""),
                        })
                      : undefined;
                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        title={crossOsTitle}
                        className={cn(
                          "overflow-visible hover:bg-accent/50",
                          rowIsPinned && "bg-primary/5 hover:bg-primary/10",
                          rowIsCrossOs && "opacity-60",
                        )}
                      >
                        {row
                          .getVisibleCells()
                          .filter((cell) => shouldRenderColumn(cell.column.id))
                          .map((cell) => (
                            <TableCell
                              key={cell.id}
                              className="overflow-visible"
                              style={{
                                width: cell.column.columnDef.size
                                  ? `${cell.column.getSize()}px`
                                  : undefined,
                              }}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ))}
                      </TableRow>
                    );
                  })}
                  {virtualPaddingBottom > 0 && (
                    <TableRow aria-hidden="true">
                      <TableCell
                        colSpan={visibleColumnCount}
                        className="h-0 border-0 p-0"
                        style={{ height: `${virtualPaddingBottom}px` }}
                      />
                    </TableRow>
                  )}
                </>
              ) : isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumnCount}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <div className="inline-flex items-center">
                      <Spinner size="md" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumnCount}
                    className="h-24 text-center"
                  >
                    {t("profiles.noResults")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <TablePaginationControls
          totalRows={totalRows}
          pageIndex={pageIndex}
          pageCount={pageCount}
          pageSize={pageSize}
          pageSizeOptions={[25, 50, 100, 200]}
          canPreviousPage={table.getCanPreviousPage()}
          canNextPage={table.getCanNextPage()}
          onPreviousPage={() => table.previousPage()}
          onNextPage={() => table.nextPage()}
          onPageSizeChange={(nextPageSize) => {
            table.setPageSize(nextPageSize);
            table.setPageIndex(0);
          }}
          summaryLabel={paginationSummaryLabel}
          pageLabel={t("common.pagination.page")}
          rowsPerPageLabel={t("common.pagination.rowsPerPage")}
          previousLabel={t("common.pagination.previous")}
          nextLabel={t("common.pagination.next")}
        />
      </div>
      <DeleteConfirmationDialog
        isOpen={profileToDelete !== null}
        onClose={() => setProfileToDelete(null)}
        onConfirm={handleDelete}
        title={t("profiles.table.deleteProfileTitle")}
        description={t("profiles.table.deleteProfileDescription", {
          name: profileToDelete?.name ?? "",
        })}
        confirmButtonText={t("profiles.actions.delete")}
        isLoading={isDeleting}
      />
      {profileForInfoDialog &&
        (() => {
          const infoProfile = profileForInfoDialog;
          const infoIsRunning =
            (browserState.isClient && runningProfiles.has(infoProfile.id)) ||
            infoProfile.runtime_state === "Running";
          const infoIsParked = infoProfile.runtime_state === "Parked";
          const infoIsLaunching = launchingProfiles.has(infoProfile.id);
          const infoIsStopping = stoppingProfiles.has(infoProfile.id);
          const infoIsCrossOs = isCrossOsProfile(infoProfile);
          const infoIsDisabled =
            infoIsRunning ||
            infoIsParked ||
            infoIsLaunching ||
            infoIsStopping ||
            infoIsCrossOs;
          return (
            <ProfileInfoDialog
              isOpen={profileForInfoDialog !== null}
              onClose={() => setProfileForInfoDialog(null)}
              profile={infoProfile}
              storedProxies={storedProxies}
              vpnConfigs={vpnConfigs}
              onOpenTrafficDialog={(profileId) => {
                const profile = profiles.find((p) => p.id === profileId);
                setTrafficDialogProfile({ id: profileId, name: profile?.name });
              }}
              onOpenProfileSyncDialog={onOpenProfileSyncDialog}
              onAssignProfilesToGroup={onAssignProfilesToGroup}
              onConfigureCamoufox={onConfigureCamoufox}
              onCopyCookiesToProfile={onCopyCookiesToProfile}
              onOpenCookieManagement={onOpenCookieManagement}
              onAssignExtensionGroup={onAssignExtensionGroup}
              onOpenBypassRules={(profile) => setBypassRulesProfile(profile)}
              onCloneProfile={onCloneProfile}
              onDeleteProfile={(profile) => {
                setProfileForInfoDialog(null);
                setProfileToDelete(profile);
              }}
              onArchiveProfile={onArchiveProfile}
              onRestoreProfile={onRestoreProfile}
              isArchived={isProfileArchived?.(infoProfile.id) ?? false}
              onPinProfile={onPinProfile}
              onUnpinProfile={onUnpinProfile}
              isPinned={isProfilePinned?.(infoProfile.id) ?? false}
              extensionManagementUnlocked={extensionManagementUnlocked}
              cookieManagementUnlocked={cookieManagementUnlocked}
              isRunning={infoIsRunning || infoIsParked}
              isDisabled={infoIsDisabled}
              isCrossOs={infoIsCrossOs}
              syncStatuses={syncStatuses}
            />
          );
        })()}
      <DataTableActionBar table={table}>
        <DataTableActionBarSelection table={table} />
        {onBulkGroupAssignment && (
          <DataTableActionBarAction
            tooltip={t("profiles.actions.assignToGroup")}
            onClick={onBulkGroupAssignment}
            size="icon"
            disabled={isReadOnlyRole}
          >
            <LuUsers />
          </DataTableActionBarAction>
        )}
        {onBulkProxyAssignment && (
          <DataTableActionBarAction
            tooltip={t("profiles.table.assignProxy")}
            onClick={onBulkProxyAssignment}
            size="icon"
            disabled={isReadOnlyRole}
          >
            <FiWifi />
          </DataTableActionBarAction>
        )}
        {onBulkExtensionGroupAssignment && (
          <DataTableActionBarAction
            tooltip={
              extensionManagementUnlocked
                ? t("profiles.table.assignExtensionGroup")
                : t("profiles.table.assignExtensionGroupPro")
            }
            onClick={onBulkExtensionGroupAssignment}
            size="icon"
            disabled={!extensionManagementUnlocked || isReadOnlyRole}
          >
            <span className="relative">
              <LuPuzzle />
              {!extensionManagementUnlocked && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[6px] font-bold leading-tight bg-primary text-primary-foreground px-0.5 rounded-sm">
                  PRO
                </span>
              )}
            </span>
          </DataTableActionBarAction>
        )}
        {onBulkCopyCookies && (
          <DataTableActionBarAction
            tooltip={
              cookieManagementUnlocked
                ? t("profiles.actions.copyCookies")
                : `${t("profiles.actions.copyCookies")} (Pro)`
            }
            onClick={onBulkCopyCookies}
            size="icon"
            disabled={!cookieManagementUnlocked || isReadOnlyRole}
          >
            <span className="relative">
              <LuCookie />
              {!cookieManagementUnlocked && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[6px] font-bold leading-tight bg-primary text-primary-foreground px-0.5 rounded-sm">
                  PRO
                </span>
              )}
            </span>
          </DataTableActionBarAction>
        )}
        {onBulkDelete && (
          <DataTableActionBarAction
            tooltip={t("common.buttons.delete")}
            onClick={onBulkDelete}
            size="icon"
            variant="destructive"
            className="border-destructive bg-destructive/50 hover:bg-destructive/70"
            disabled={isReadOnlyRole}
          >
            <LuTrash2 />
          </DataTableActionBarAction>
        )}
        {onBulkArchive && (
          <DataTableActionBarAction
            tooltip={t("profiles.actions.archive")}
            onClick={onBulkArchive}
            size="icon"
            disabled={isReadOnlyRole}
          >
            <LuArchive />
          </DataTableActionBarAction>
        )}
      </DataTableActionBar>
      {trafficDialogProfile && (
        <TrafficDetailsDialog
          isOpen={trafficDialogProfile !== null}
          onClose={() => setTrafficDialogProfile(null)}
          profileId={trafficDialogProfile.id}
          profileName={trafficDialogProfile.name}
        />
      )}
      <ProfileBypassRulesDialog
        isOpen={bypassRulesProfile !== null}
        onClose={() => setBypassRulesProfile(null)}
        profileId={bypassRulesProfile?.id ?? null}
        initialRules={bypassRulesProfile?.proxy_bypass_rules ?? []}
      />
    </>
  );
}
