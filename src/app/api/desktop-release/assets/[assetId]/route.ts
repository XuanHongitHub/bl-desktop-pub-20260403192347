import { NextResponse } from "next/server";

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

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const params = await context.params;
  const repo = resolveRepo();
  const token = resolveToken();
  if (!token) {
    return NextResponse.json(
      { message: "desktop_release_token_missing" },
      { status: 500 },
    );
  }

  const assetId = Number(params.assetId);
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
    new URL(request.url).searchParams.get("name")?.trim() ||
    "buglogin-installer.bin";
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
