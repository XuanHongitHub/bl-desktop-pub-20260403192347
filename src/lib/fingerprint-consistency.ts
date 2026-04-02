import type {
  CamoufoxFingerprintConfig,
  WayfernFingerprintConfig,
} from "@/types";

export type FingerprintIssueCode =
  | "ua_version_mismatch"
  | "screen_window_mismatch";

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function hasFirefoxUaVersionMismatch(userAgent: unknown): boolean {
  if (typeof userAgent !== "string") {
    return false;
  }
  const ua = userAgent.trim();
  if (ua.length === 0) {
    return false;
  }
  const rvMatch = ua.match(/rv:(\d+)(?:\.\d+)?/i);
  const geckoVersionMatch = ua.match(/Gecko\/\d+\s+(\d+)(?:\.\d+)?/i);
  if (!rvMatch || !geckoVersionMatch) {
    return false;
  }
  return rvMatch[1] !== geckoVersionMatch[1];
}

function hasScreenWindowMismatch(values: {
  screenWidth: unknown;
  screenHeight: unknown;
  windowOuterWidth: unknown;
  windowOuterHeight: unknown;
  windowInnerWidth: unknown;
  windowInnerHeight: unknown;
}): boolean {
  const screenWidth = parsePositiveNumber(values.screenWidth);
  const screenHeight = parsePositiveNumber(values.screenHeight);
  const outerWidth = parsePositiveNumber(values.windowOuterWidth);
  const outerHeight = parsePositiveNumber(values.windowOuterHeight);
  const innerWidth = parsePositiveNumber(values.windowInnerWidth);
  const innerHeight = parsePositiveNumber(values.windowInnerHeight);

  if (screenWidth && outerWidth && outerWidth > screenWidth) {
    return true;
  }
  if (screenHeight && outerHeight && outerHeight > screenHeight) {
    return true;
  }
  if (screenWidth && innerWidth && innerWidth > screenWidth) {
    return true;
  }
  if (screenHeight && innerHeight && innerHeight > screenHeight) {
    return true;
  }
  return false;
}

export function validateCamoufoxFingerprintConsistency(
  fingerprint: CamoufoxFingerprintConfig,
): FingerprintIssueCode[] {
  const issues: FingerprintIssueCode[] = [];
  if (hasFirefoxUaVersionMismatch(fingerprint["navigator.userAgent"])) {
    issues.push("ua_version_mismatch");
  }
  if (
    hasScreenWindowMismatch({
      screenWidth: fingerprint["screen.width"],
      screenHeight: fingerprint["screen.height"],
      windowOuterWidth: fingerprint["window.outerWidth"],
      windowOuterHeight: fingerprint["window.outerHeight"],
      windowInnerWidth: fingerprint["window.innerWidth"],
      windowInnerHeight: fingerprint["window.innerHeight"],
    })
  ) {
    issues.push("screen_window_mismatch");
  }
  return issues;
}

export function validateWayfernFingerprintConsistency(
  fingerprint: WayfernFingerprintConfig,
): FingerprintIssueCode[] {
  const issues: FingerprintIssueCode[] = [];
  if (hasFirefoxUaVersionMismatch(fingerprint.userAgent)) {
    issues.push("ua_version_mismatch");
  }
  if (
    hasScreenWindowMismatch({
      screenWidth: fingerprint.screenWidth,
      screenHeight: fingerprint.screenHeight,
      windowOuterWidth: fingerprint.windowOuterWidth,
      windowOuterHeight: fingerprint.windowOuterHeight,
      windowInnerWidth: fingerprint.windowInnerWidth,
      windowInnerHeight: fingerprint.windowInnerHeight,
    })
  ) {
    issues.push("screen_window_mismatch");
  }
  return issues;
}
