import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));
const isStaticExportBuild = process.env.NEXT_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // Disable React StrictMode in this desktop app shell to avoid development-time
  // double-mount/effect replay that amplifies IPC traffic and perceived lag.
  reactStrictMode: false,
  ...(isStaticExportBuild
    ? { output: "export" as const, distDir: "dist" }
    : {}),
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  allowedDevOrigins: [
    "bugdev.site",
    "*.bugdev.site",
    "localhost",
    "127.0.0.1",
    "::1",
  ],
};

export default nextConfig;
