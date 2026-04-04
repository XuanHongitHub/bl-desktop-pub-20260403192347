import { NextResponse } from "next/server";

type GitHubReleaseAsset = {
  id: number;
  name: string;
  size: number;
  updated_at: string;
};

type GitHubRelease = {
  tag_name: string;
  published_at: string | null;
  assets: GitHubReleaseAsset[];
};

type PlatformHint =
  | "windows-x64"
  | "windows-arm64"
  | "macos-x64"
  | "macos-arm64"
  | "linux-x64"
  | "unknown";

export const dynamic = "force-dynamic";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function resolveRepo(): string {
  return readEnv("BUGLOGIN_DESKTOP_RELEASE_REPO") ?? "keyduc91/Malvanut-Login";
}

function resolveToken(): string | null {
  return (
    readEnv("BUGLOGIN_DESKTOP_RELEASE_TOKEN") ??
    readEnv("BUGLOGIN_GITHUB_TOKEN") ??
    readEnv("GH_TOKEN")
  );
}

function inferPlatformHint(name: string): PlatformHint {
  const normalized = name.toLowerCase();
  if (normalized.endsWith(".exe") || normalized.endsWith(".msi")) {
    if (normalized.includes("arm64") || normalized.includes("aarch64")) {
      return "windows-arm64";
    }
    return "windows-x64";
  }
  if (normalized.endsWith(".dmg") || normalized.endsWith(".pkg")) {
    if (normalized.includes("arm64") || normalized.includes("aarch64")) {
      return "macos-arm64";
    }
    return "macos-x64";
  }
  if (
    normalized.endsWith(".appimage") ||
    normalized.endsWith(".deb") ||
    normalized.endsWith(".rpm") ||
    normalized.includes("linux")
  ) {
    return "linux-x64";
  }
  return "unknown";
}

export async function GET() {
  const repo = resolveRepo();
  const token = resolveToken();
  if (!token) {
    return NextResponse.json(
      { message: "desktop_release_token_missing" },
      { status: 500 },
    );
  }

  const response = await fetch(
    `https://api.github.com/repos/${repo}/releases/latest`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      {
        message: "desktop_release_fetch_failed",
        details: message.slice(0, 200),
      },
      { status: response.status },
    );
  }

  const release = (await response.json()) as GitHubRelease;
  const assets = release.assets
    .filter((asset) =>
      /\.(exe|msi|dmg|pkg|appimage|deb|rpm)$/i.test(asset.name),
    )
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      size: asset.size,
      updatedAt: asset.updated_at,
      platformHint: inferPlatformHint(asset.name),
      downloadUrl: `/api/desktop-release/assets/${asset.id}?name=${encodeURIComponent(asset.name)}`,
    }));

  return NextResponse.json(
    {
      repo,
      tagName: release.tag_name,
      publishedAt: release.published_at,
      assets,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
