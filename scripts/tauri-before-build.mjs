#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const distDir = resolve(rootDir, "dist");
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

    await runPnpm(["exec", "next", "build"], { NEXT_STATIC_EXPORT: "1" });
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
