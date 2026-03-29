type ControlApiBackend = "nest" | "laravel";

const DEFAULT_BACKEND: ControlApiBackend = "nest";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export function resolveControlApiBackend(): ControlApiBackend {
  const raw = process.env.NEXT_PUBLIC_CONTROL_API_BACKEND?.trim().toLowerCase();
  if (raw === "laravel") {
    return "laravel";
  }
  return DEFAULT_BACKEND;
}

function resolveControlApiPrefix(backend: ControlApiBackend): string {
  switch (backend) {
    case "laravel":
      // Keep current contract by default; update this prefix when Laravel routes differ.
      return "/v1/control";
    case "nest":
    default:
      return "/v1/control";
  }
}

type RouteBuilderInput = {
  workspaceId?: string;
  route?: "register" | "login" | "google";
  scope?: "member";
};

export function buildControlApiPath(
  routeKey:
    | "authMe"
    | "workspaces"
    | "publicAuth"
    | "workspaceBillingState"
    | "workspaceStripeCheckout"
    | "workspaceCancelSubscription"
    | "workspaceReactivateSubscription",
  input: RouteBuilderInput = {},
): string {
  const prefix = resolveControlApiPrefix(resolveControlApiBackend());

  switch (routeKey) {
    case "authMe":
      return `${prefix}/auth/me`;
    case "workspaces":
      return input.scope === "member"
        ? `${prefix}/workspaces?scope=member`
        : `${prefix}/workspaces`;
    case "publicAuth":
      return `${prefix}/public/auth/${input.route ?? "login"}`;
    case "workspaceBillingState":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/state`;
    case "workspaceStripeCheckout":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/stripe-checkout`;
    case "workspaceCancelSubscription":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/subscription/cancel`;
    case "workspaceReactivateSubscription":
      return `${prefix}/workspaces/${encodeURIComponent(input.workspaceId ?? "")}/billing/subscription/reactivate`;
    default:
      return `${prefix}/workspaces`;
  }
}

export function buildControlApiUrl(
  baseUrl: string,
  routeKey:
    | "authMe"
    | "workspaces"
    | "publicAuth"
    | "workspaceBillingState"
    | "workspaceStripeCheckout"
    | "workspaceCancelSubscription"
    | "workspaceReactivateSubscription",
  input: RouteBuilderInput = {},
): string {
  return `${normalizeBaseUrl(baseUrl)}${buildControlApiPath(routeKey, input)}`;
}
