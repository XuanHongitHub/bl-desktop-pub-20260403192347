import { NextResponse } from "next/server";

const isStaticExportBuild = process.env.NEXT_STATIC_EXPORT === "1";

// Required by Next.js when output=export is enabled.
export const revalidate = 3600;

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

export async function GET(request: Request) {
  if (isStaticExportBuild) {
    return NextResponse.json(
      { message: "desktop_release_asset_api_unavailable_in_static_export" },
      { status: 501 },
    );
  }

  const repo = resolveRepo();
  const token = resolveToken();
  if (!token) {
    return NextResponse.json(
      { message: "desktop_release_token_missing" },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const assetId = Number(url.searchParams.get("id"));
  if (!Number.isFinite(assetId) || assetId <= 0) {
    return NextResponse.json({ message: "invalid_asset_id" }, { status: 400 });
  }

  const upstream = await fetch(
    `https://api.github.com/repos/${repo}/releases/assets/${assetId}`,
    {
      headers: {
        Accept: "application/octet-stream",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
      redirect: "follow",
    },
  );

  if (!upstream.ok || !upstream.body) {
    const details = await upstream.text();
    return NextResponse.json(
      {
        message: "desktop_release_asset_fetch_failed",
        details: details.slice(0, 200),
      },
      { status: upstream.status || 502 },
    );
  }

  const fallbackName =
    url.searchParams.get("name")?.trim() || "buglogin-installer.bin";
  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";
  const contentDisposition =
    upstream.headers.get("content-disposition") ??
    `attachment; filename="${fallbackName.replaceAll('"', "")}"`;
  const contentLength = upstream.headers.get("content-length");

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": contentDisposition,
    "Cache-Control": "private, no-store",
  });
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
