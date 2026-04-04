import { invoke } from "@tauri-apps/api/core";

interface SyncSettings {
  sync_server_url?: string;
  sync_token?: string;
}

interface AcceptControlInviteInput {
  token?: string | null;
  userId: string;
  email: string;
  platformRole?: string;
}

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  const trimmed = url.trim().replace(/\/$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

export async function acceptControlInviteIfProvided(
  input: AcceptControlInviteInput,
): Promise<"accepted" | "skipped"> {
  const token = input.token?.trim();
  if (!token) {
    return "skipped";
  }

  const settings = await invoke<SyncSettings>("get_sync_settings");
  const baseUrl = normalizeBaseUrl(settings.sync_server_url);
  if (!baseUrl) {
    throw new Error("invite_server_missing");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-user-id": input.userId,
    "x-user-email": input.email,
  };

  if (input.platformRole) {
    headers["x-platform-role"] = input.platformRole;
  }
  if (settings.sync_token?.trim()) {
    headers.Authorization = `Bearer ${settings.sync_token.trim()}`;
  }

  const response = await fetch(`${baseUrl}/v1/control/auth/invite/accept`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`invite_accept_${response.status}:${body}`);
  }

  return "accepted";
}
