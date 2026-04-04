import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBrowserDisplayName,
  getOSDisplayName,
  isCrossOsProfile,
} from "@/lib/browser-utils";
import type { BrowserProfile } from "@/types";

/**
 * Hook for managing browser state.
 *
 * All callbacks use refs internally so they stay referentially stable even when
 * `profiles` / `runningProfiles` / `launchingProfiles` / `stoppingProfiles` change.
 * This prevents cascading re-creation of every callback on every profile-list update.
 */
export function useBrowserState(
  profiles: BrowserProfile[],
  runningProfiles: Set<string>,
  _isUpdating: (browser: string) => boolean,
  launchingProfiles: Set<string>,
  stoppingProfiles: Set<string>,
) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Stable refs for volatile inputs — all callbacks read from these.
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const runningRef = useRef(runningProfiles);
  runningRef.current = runningProfiles;
  const launchingRef = useRef(launchingProfiles);
  launchingRef.current = launchingProfiles;
  const stoppingRef = useRef(stoppingProfiles);
  stoppingRef.current = stoppingProfiles;
  const isClientRef = useRef(isClient);
  isClientRef.current = isClient;

  const isSingleInstanceBrowser = useCallback(
    (_browserType: string): boolean => {
      return false;
    },
    [],
  );

  const isAnyInstanceRunning = useCallback((browserType: string): boolean => {
    if (!isClientRef.current) return false;
    return profilesRef.current.some(
      (p) =>
        p.browser === browserType &&
        (runningRef.current.has(p.id) || p.runtime_state === "Running"),
    );
  }, []);

  const canLaunchProfile = useCallback(
    (profile: BrowserProfile): boolean => {
      if (!isClientRef.current) return false;
      if (isCrossOsProfile(profile)) return false;

      const isRunning =
        runningRef.current.has(profile.id) ||
        profile.runtime_state === "Running";
      const isLaunching = launchingRef.current.has(profile.id);
      const isStopping = stoppingRef.current.has(profile.id);

      if (isLaunching || isStopping) return false;
      if (isRunning) return true;

      if (isSingleInstanceBrowser(profile.browser)) {
        return !isAnyInstanceRunning(profile.browser);
      }
      return true;
    },
    [isSingleInstanceBrowser, isAnyInstanceRunning],
  );

  const canUseProfileForLinks = useCallback(
    (profile: BrowserProfile): boolean => {
      if (!isClientRef.current) return false;

      const isLaunching = launchingRef.current.has(profile.id);
      const isStopping = stoppingRef.current.has(profile.id);
      if (isLaunching || isStopping) return false;

      if (isSingleInstanceBrowser(profile.browser)) {
        const isRunning =
          runningRef.current.has(profile.id) ||
          profile.runtime_state === "Running";
        const runningInstancesOfType = profilesRef.current.filter(
          (p) =>
            p.browser === profile.browser &&
            (runningRef.current.has(p.id) || p.runtime_state === "Running"),
        );
        if (runningInstancesOfType.length === 0) return true;
        return isRunning;
      }
      return true;
    },
    [isSingleInstanceBrowser],
  );

  const canSelectProfile = useCallback((profile: BrowserProfile): boolean => {
    if (!isClientRef.current) return false;

    const isRunning =
      runningRef.current.has(profile.id) || profile.runtime_state === "Running";
    const isParked = profile.runtime_state === "Parked";
    const isLaunching = launchingRef.current.has(profile.id);
    const isStopping = stoppingRef.current.has(profile.id);

    if (isRunning || isParked || isLaunching || isStopping) return false;
    return true;
  }, []);

  const getLaunchTooltipContent = useCallback(
    (profile: BrowserProfile): string => {
      if (!isClientRef.current) return "Loading...";

      if (isCrossOsProfile(profile) && profile.host_os) {
        const osName = getOSDisplayName(profile.host_os);
        return `This profile was created on ${osName} and is not supported on this system`;
      }

      const isRunning =
        runningRef.current.has(profile.id) ||
        profile.runtime_state === "Running";
      const isLaunching = launchingRef.current.has(profile.id);
      const isStopping = stoppingRef.current.has(profile.id);

      if (isLaunching) return "Launching browser...";
      if (isStopping) return "Stopping browser...";
      if (isRunning) return "";

      if (
        isSingleInstanceBrowser(profile.browser) &&
        !canLaunchProfile(profile)
      ) {
        return `Only one instance of this browser can run at a time. Stop the running browser first.`;
      }
      return "";
    },
    [isSingleInstanceBrowser, canLaunchProfile],
  );

  const getProfileTooltipContent = useCallback(
    (profile: BrowserProfile): string | null => {
      if (!isClientRef.current) return null;

      const canUseForLinks = canUseProfileForLinks(profile);
      if (canUseForLinks) return null;

      const isLaunching = launchingRef.current.has(profile.id);
      const isStopping = stoppingRef.current.has(profile.id);

      if (isLaunching) return "Profile is currently launching. Please wait.";
      if (isStopping) return "Profile is currently stopping. Please wait.";

      if (isSingleInstanceBrowser(profile.browser)) {
        const runningInstancesOfType = profilesRef.current.filter(
          (p) =>
            p.browser === profile.browser &&
            (runningRef.current.has(p.id) || p.runtime_state === "Running"),
        );
        if (runningInstancesOfType.length > 0) {
          const runningProfileNames = runningInstancesOfType
            .map((p) => p.name)
            .join(", ");
          return `${getBrowserDisplayName(profile.browser)} browser is already running (${runningProfileNames}). Only one instance can run at a time.`;
        }
      }
      return "This profile cannot be used for opening links right now.";
    },
    [canUseProfileForLinks, isSingleInstanceBrowser],
  );

  return {
    isClient,
    isSingleInstanceBrowser,
    isAnyInstanceRunning,
    canLaunchProfile,
    canUseProfileForLinks,
    canSelectProfile,
    getLaunchTooltipContent,
    getProfileTooltipContent,
  };
}
