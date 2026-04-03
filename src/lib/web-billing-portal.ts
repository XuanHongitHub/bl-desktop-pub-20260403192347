export type WebBillingPortalRoute =
  | "landing"
  | "pricing"
  | "auth"
  | "checkout"
  | "help"
  | "plans"
  | "management"
  | "accountBilling"
  | "accountPlan"
  | "adminCommandCenter"
  | "adminWorkspaces"
  | "adminRevenue"
  | "adminAudit"
  | "adminSystem"
  | "adminCommercePlans"
  | "adminCommerceCampaigns"
  | "adminCommerceCoupons"
  | "adminCommerceLicenses"
  | "adminCommercePreview"
  | "adminCommerceAudit";

export interface WebBillingPortalContext {
  controlBaseUrl: string;
  controlToken: string;
  userId: string;
  userEmail: string;
  platformRole?: string | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
}

function normalizeSegment(input: string): string {
  return input.trim();
}

function normalizeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return null;
    }
    const path = parsed.pathname.endsWith("/")
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname;
    const normalizedPath = path === "/" ? "" : path;
    return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
  } catch {
    return null;
  }
}

function toBase64Url(input: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "utf8").toString("base64url");
  }

  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const utf8 = encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(Number.parseInt(p1, 16)),
    );
    return window
      .btoa(utf8)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  return "";
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(normalized, "base64").toString("utf8");
  }

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(normalized);
    const encoded = Array.from(binary)
      .map(
        (character) =>
          `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
      )
      .join("");
    return decodeURIComponent(encoded);
  }

  return "";
}

export function resolveWebBillingPortalBaseUrl(input: {
  billingPortalUrl?: unknown;
  legacyStripeBillingUrl?: unknown;
}): string | null {
  return (
    normalizeHttpUrl(input.billingPortalUrl) ??
    normalizeHttpUrl(input.legacyStripeBillingUrl)
  );
}

export function encodeWebBillingPortalContext(
  context: WebBillingPortalContext,
): string {
  return toBase64Url(JSON.stringify(context));
}

export function decodeWebBillingPortalContext(
  encoded: string,
): WebBillingPortalContext | null {
  if (!encoded.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      fromBase64Url(encoded),
    ) as WebBillingPortalContext;
    const controlBaseUrl = normalizeHttpUrl(parsed.controlBaseUrl);
    const controlToken = normalizeSegment(parsed.controlToken ?? "");
    const userId = normalizeSegment(parsed.userId ?? "");
    const userEmail = normalizeSegment(parsed.userEmail ?? "");

    if (!controlBaseUrl || !controlToken || !userId || !userEmail) {
      return null;
    }

    return {
      controlBaseUrl,
      controlToken,
      userId,
      userEmail,
      platformRole: parsed.platformRole?.trim() || null,
      workspaceId: parsed.workspaceId?.trim() || null,
      workspaceName: parsed.workspaceName?.trim() || null,
    };
  } catch {
    return null;
  }
}

function resolvePortalPath(route: WebBillingPortalRoute): string {
  switch (route) {
    case "landing":
      return "/";
    case "pricing":
      return "/pricing";
    case "auth":
      return "/signin";
    case "checkout":
      return "/checkout";
    case "help":
      return "/help";
    case "plans":
      return "/pricing";
    case "management":
    case "accountBilling":
      return "/account/billing";
    case "accountPlan":
      return "/account/plan";
    case "adminCommandCenter":
      return "/admin/dashboard";
    case "adminWorkspaces":
      return "/admin/workspaces";
    case "adminRevenue":
      return "/admin/revenue";
    case "adminAudit":
      return "/admin/audit";
    case "adminSystem":
      return "/admin/system";
    case "adminCommercePlans":
      return "/admin/commerce/plans";
    case "adminCommerceCampaigns":
      return "/admin/commerce/campaigns";
    case "adminCommerceCoupons":
      return "/admin/commerce/coupons";
    case "adminCommerceLicenses":
      return "/admin/commerce/licenses";
    case "adminCommercePreview":
      return "/admin/commerce/preview";
    case "adminCommerceAudit":
      return "/admin/commerce/audit";
    default:
      return "/";
  }
}

export function buildWebBillingPortalUrl(input: {
  baseUrl: string;
  route: WebBillingPortalRoute;
  query?: Record<string, string | number | boolean | null | undefined>;
  context?: WebBillingPortalContext | null;
}): string {
  const url = new URL(resolvePortalPath(input.route), input.baseUrl);
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value === null || value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  if (input.context) {
    const encoded = encodeWebBillingPortalContext(input.context);
    if (encoded) {
      url.hash = `ctx=${encoded}`;
    }
  }

  return url.toString();
}

export function readWebBillingPortalContextFromHash(
  hash: string,
): WebBillingPortalContext | null {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalized.trim()) {
    return null;
  }
  const params = new URLSearchParams(normalized);
  const encoded = params.get("ctx") ?? "";
  return decodeWebBillingPortalContext(encoded);
}
