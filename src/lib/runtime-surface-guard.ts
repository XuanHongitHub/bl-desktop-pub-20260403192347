export type RuntimeSurface = "unknown" | "desktop" | "web";

export function resolveRuntimeSurface(
  isDesktopRuntime: boolean,
): RuntimeSurface {
  return isDesktopRuntime ? "desktop" : "web";
}

export function shouldRedirectWebGuard(
  runtimeSurface: RuntimeSurface,
  pathname: string,
): boolean {
  if (runtimeSurface !== "desktop") {
    return false;
  }
  return !pathname.startsWith("/desktop");
}

export function shouldRedirectDesktopGuard(
  runtimeSurface: RuntimeSurface,
  pathname: string,
): boolean {
  if (runtimeSurface !== "web") {
    return false;
  }
  if (pathname === "/" || pathname.startsWith("/signin")) {
    return false;
  }
  return true;
}

export function shouldRenderWebGuardChildren(
  runtimeSurface: RuntimeSurface,
): boolean {
  return runtimeSurface !== "desktop";
}

export function shouldRenderDesktopGuardChildren(
  runtimeSurface: RuntimeSurface,
): boolean {
  return runtimeSurface === "desktop";
}
