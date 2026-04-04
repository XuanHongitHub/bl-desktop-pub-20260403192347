export type ProxyCheckFailureCategory =
  | "auth"
  | "network"
  | "timeout"
  | "blocked"
  | "invalid"
  | "unknown";

export interface ProxyCheckFailureMeta {
  category: ProxyCheckFailureCategory;
  message: string;
  retryable: boolean;
}

export function classifyProxyCheckError(error: unknown): ProxyCheckFailureMeta {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("auth") ||
    normalized.includes("401") ||
    normalized.includes("407") ||
    normalized.includes("forbidden") ||
    normalized.includes("unauthorized") ||
    normalized.includes("password") ||
    normalized.includes("username")
  ) {
    return { category: "auth", message, retryable: true };
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("deadline exceeded") ||
    normalized.includes("failed to start in time")
  ) {
    return { category: "timeout", message, retryable: true };
  }

  if (
    normalized.includes("network") ||
    normalized.includes("dns") ||
    normalized.includes("connection refused") ||
    normalized.includes("unreachable") ||
    normalized.includes("failed to connect")
  ) {
    return { category: "network", message, retryable: true };
  }

  if (
    normalized.includes("blocked") ||
    normalized.includes("captcha") ||
    normalized.includes("denied")
  ) {
    return { category: "blocked", message, retryable: true };
  }

  if (
    normalized.includes("invalid") ||
    normalized.includes("bad request") ||
    normalized.includes("malformed")
  ) {
    return { category: "invalid", message, retryable: false };
  }

  return { category: "unknown", message, retryable: true };
}
