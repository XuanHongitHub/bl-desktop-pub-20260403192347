import { type NextRequest, NextResponse } from "next/server";

type BrowserSlug = "bugium" | "bugox";

type UpdatePolicy = {
  mode?: string;
  required?: boolean;
  min_supported_version?: string;
  message?: string;
};

type BrowserMetadataResponse = {
  version: string;
  downloads: Record<string, string | null>;
  update_policy?: UpdatePolicy;
};

const SUPPORTED_PLATFORMS = [
  "windows-x64",
  "windows-arm64",
  "linux-x64",
  "linux-arm64",
  "macos-x64",
  "macos-arm64",
] as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ slug: ["bugium.json"] }, { slug: ["bugox.json"] }];
}

function isBrowserSlug(input: string): input is BrowserSlug {
  return input === "bugium" || input === "bugox";
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readBoolEnv(name: string): boolean | undefined {
  const raw = readEnv(name);
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return undefined;
}

function slugEnvPrefix(slug: BrowserSlug): string {
  return slug === "bugium" ? "BUGLOGIN_BUGIUM" : "BUGLOGIN_BUGOX";
}

function buildMetadata(slug: BrowserSlug): BrowserMetadataResponse {
  const prefix = slugEnvPrefix(slug);
  const version = readEnv(`${prefix}_VERSION`) ?? "0.0.0";

  const downloads: Record<string, string | null> = {};
  for (const platform of SUPPORTED_PLATFORMS) {
    const envKey = `${prefix}_DOWNLOAD_${platform.toUpperCase().replace("-", "_")}`;
    downloads[platform] = readEnv(envKey) ?? null;
  }

  const mode = readEnv(`${prefix}_UPDATE_MODE`);
  const required = readBoolEnv(`${prefix}_REQUIRED`);
  const minSupportedVersion = readEnv(`${prefix}_MIN_SUPPORTED_VERSION`);
  const message = readEnv(`${prefix}_UPDATE_MESSAGE`);

  const hasPolicy =
    Boolean(mode) ||
    typeof required === "boolean" ||
    Boolean(minSupportedVersion) ||
    Boolean(message);

  if (!hasPolicy) {
    return { version, downloads };
  }

  return {
    version,
    downloads,
    update_policy: {
      mode,
      required,
      min_supported_version: minSupportedVersion,
      message,
    },
  };
}

function extractBrowserSlug(pathParts: string[]): BrowserSlug | null {
  if (pathParts.length !== 1) return null;
  const segment = pathParts[0];
  if (!segment.endsWith(".json")) return null;
  const slug = segment.slice(0, -".json".length).toLowerCase();
  return isBrowserSlug(slug) ? slug : null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  const params = await context.params;
  const browserSlug = extractBrowserSlug(params.slug);
  if (!browserSlug) {
    return NextResponse.json({ message: "Browser slug not found" }, { status: 404 });
  }

  const payload = buildMetadata(browserSlug);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
