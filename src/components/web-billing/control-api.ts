import type {
  ControlStripeCheckoutCreateResponse,
  ControlStripeCheckoutConfirmResponse,
  ControlWorkspaceBillingState,
} from "@/types";
import type { BillingCycle } from "@/lib/billing-plans";
import { buildControlApiUrl } from "@/lib/control-api-routes";

export interface WebBillingConnection {
  controlBaseUrl: string;
  controlToken: string;
  userId: string;
  userEmail: string;
  platformRole?: string | null;
}

export interface WebBillingWorkspaceListItem {
  id: string;
  name: string;
  mode: "personal" | "team";
  createdAt: string;
  createdBy: string;
  planLabel: string;
  profileLimit: number;
  billingCycle: BillingCycle | null;
  subscriptionStatus: "active" | "past_due" | "canceled";
  subscriptionSource: "internal" | "license" | "stripe";
  expiresAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
}

export interface CreateCheckoutInput {
  planId: "starter" | "growth" | "scale" | "custom";
  billingCycle: BillingCycle;
  couponCode?: string | null;
  successUrl: string;
  cancelUrl: string;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Ignore JSON parsing failures.
  }
  return response.statusText || `${response.status}`;
}

function buildHeaders(connection: WebBillingConnection): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${connection.controlToken}`,
    "x-user-id": connection.userId,
    "x-user-email": connection.userEmail,
  };
  if (connection.platformRole?.trim()) {
    headers["x-platform-role"] = connection.platformRole.trim();
  }
  return headers;
}

async function requestControl<T>(
  connection: WebBillingConnection,
  routeKey:
    | "workspaces"
    | "workspaceBillingState"
    | "workspaceStripeCheckout"
    | "workspaceStripeCheckoutConfirm"
    | "workspaceCancelSubscription"
    | "workspaceReactivateSubscription",
  routeInput: {
    workspaceId?: string;
    scope?: "member";
    checkoutSessionId?: string;
  },
  init: RequestInit,
): Promise<T> {
  const response = await fetch(buildControlApiUrl(connection.controlBaseUrl, routeKey, routeInput), {
    ...init,
    headers: {
      ...buildHeaders(connection),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function listWorkspaces(
  connection: WebBillingConnection,
): Promise<WebBillingWorkspaceListItem[]> {
  return requestControl<WebBillingWorkspaceListItem[]>(
    connection,
    "workspaces",
    {},
    {
      method: "GET",
    },
  );
}

export async function getWorkspaceBillingState(
  connection: WebBillingConnection,
  workspaceId: string,
): Promise<ControlWorkspaceBillingState> {
  return requestControl<ControlWorkspaceBillingState>(
    connection,
    "workspaceBillingState",
    { workspaceId },
    {
      method: "GET",
    },
  );
}

export async function createWorkspaceStripeCheckout(
  connection: WebBillingConnection,
  workspaceId: string,
  input: CreateCheckoutInput,
): Promise<ControlStripeCheckoutCreateResponse> {
  return requestControl<ControlStripeCheckoutCreateResponse>(
    connection,
    "workspaceStripeCheckout",
    { workspaceId },
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function confirmWorkspaceStripeCheckout(
  connection: WebBillingConnection,
  workspaceId: string,
  checkoutSessionId: string,
): Promise<ControlStripeCheckoutConfirmResponse> {
  return requestControl<ControlStripeCheckoutConfirmResponse>(
    connection,
    "workspaceStripeCheckoutConfirm",
    { workspaceId, checkoutSessionId },
    {
      method: "POST",
    },
  );
}

export async function cancelWorkspaceSubscription(
  connection: WebBillingConnection,
  workspaceId: string,
  mode: "period_end" | "immediate",
): Promise<ControlWorkspaceBillingState> {
  return requestControl<ControlWorkspaceBillingState>(
    connection,
    "workspaceCancelSubscription",
    { workspaceId },
    {
      method: "POST",
      body: JSON.stringify({ mode }),
    },
  );
}

export async function reactivateWorkspaceSubscription(
  connection: WebBillingConnection,
  workspaceId: string,
): Promise<ControlWorkspaceBillingState> {
  return requestControl<ControlWorkspaceBillingState>(
    connection,
    "workspaceReactivateSubscription",
    { workspaceId },
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}
