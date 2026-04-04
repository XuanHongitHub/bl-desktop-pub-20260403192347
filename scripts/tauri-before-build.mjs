#!/usr/bin/env node

import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const distDir = resolve(rootDir, "dist");
const tempBuildRoot = resolve(rootDir, ".tmp", "tauri-static-export-pruned");
const isWindows = process.platform === "win32";

function runPnpm(args, extraEnv = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const proc = spawn("pnpm", args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: isWindows,
      env: {
        ...process.env,
        ...extraEnv,
      },
    });

    proc.on("error", rejectRun);
    proc.on("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      const reason = signal ? `signal ${signal}` : `code ${code}`;
      rejectRun(new Error(`pnpm ${args.join(" ")} failed (${reason})`));
    });
  });
}

function hasFrontendDist() {
  return (
    existsSync(resolve(distDir, "index.html")) &&
    existsSync(resolve(distDir, "_next"))
  );
}

function withPrunedRoutesForStaticBuild(run) {
  const pruneCandidates = [
    "src/app/(web-shell)",
    "src/app/(web-standalone)",
    "src/app/api",
    "src/app/v1",
  ];
  const moved = [];

  const moveToTemp = (relativePath) => {
    const source = resolve(rootDir, relativePath);
    if (!existsSync(source)) {
      return;
    }
    const target = resolve(tempBuildRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
    rmSync(source, { recursive: true, force: true });
    moved.push({ source, target, relativePath });
  };

  const restoreAll = () => {
    for (const item of moved.reverse()) {
      mkdirSync(dirname(item.source), { recursive: true });
      if (existsSync(item.target)) {
        cpSync(item.target, item.source, { recursive: true });
        rmSync(item.target, { recursive: true, force: true });
      }
    }
  };

  for (const candidate of pruneCandidates) {
    moveToTemp(candidate);
  }

  if (moved.length > 0) {
    console.log(
      `Pruned ${moved.length} non-desktop route groups for static desktop export.`,
    );
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      restoreAll();
      if (moved.length > 0) {
        console.log("Restored pruned route groups after static desktop export.");
      }
    });
}

async function main() {
  await runPnpm(["copy-proxy-binary"]);

  const runningInCi = Boolean(process.env.CI);
  const distReady = hasFrontendDist();

  if (runningInCi || !distReady) {
    console.log(
      runningInCi
        ? "CI detected. Building static frontend for release."
        : "Frontend dist missing/incomplete. Building static frontend.",
    );

    await withPrunedRoutesForStaticBuild(() =>
      runPnpm(["exec", "next", "build"], { NEXT_STATIC_EXPORT: "1" }),
    );
  } else {
    console.log("Frontend dist detected. Skipping frontend rebuild.");
  }

  if (!hasFrontendDist()) {
    throw new Error("Frontend dist is missing after build. Expected dist/_next and dist/index.html.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
