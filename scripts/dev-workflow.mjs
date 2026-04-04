#!/usr/bin/env node

import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const isWindows = process.platform === "win32";

const WINDOWS_PROCESSES = [
  "cargo.exe",
  "rustc.exe",
  "clippy-driver.exe",
  "buglogin.exe",
  "buglogin-proxy.exe",
  "buglogin-daemon.exe",
  "buglogin-sync.exe",
  "buglogin-sync.exe",
  "minio.exe",
];

const UNIX_PATTERNS = [
  "cargo",
  "rustc",
  "clippy-driver",
  "buglogin",
  "buglogin-proxy",
  "buglogin-daemon",
  "buglogin-sync",
  "buglogin-sync",
  "minio",
];

const STALE_BINARIES = [
  path.join(rootDir, "src-tauri", "target", "debug", "buglogin-proxy.exe"),
  path.join(rootDir, "src-tauri", "target", "debug", "buglogin-daemon.exe"),
  path.join(rootDir, "src-tauri", "target", "debug", "buglogin-proxy"),
  path.join(rootDir, "src-tauri", "target", "debug", "buglogin-daemon"),
];

function run(command, args, options = {}) {
  const spawnOptions = {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
    ...options,
  };
  const result = isWindows
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", command, ...args], spawnOptions)
    : spawnSync(command, args, spawnOptions);

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function killBuildProcesses() {
  console.log("[dev-workflow] Cleaning stale build processes...");

  if (isWindows) {
    const result = spawnSync(
      "taskkill.exe",
      ["/F", ...WINDOWS_PROCESSES.flatMap((name) => ["/IM", name])],
      {
        cwd: rootDir,
        encoding: "utf8",
      },
    );

    if (result.stdout?.trim()) {
      process.stdout.write(result.stdout);
    }
    const filteredStderr = result.stderr
      ?.split(/\r?\n/)
      .filter(
        (line) =>
          line.trim().length > 0 &&
          !line.includes('ERROR: The process "') &&
          !line.includes("not found."),
      )
      .join("\n");

    if (filteredStderr?.trim()) {
      process.stderr.write(`${filteredStderr}\n`);
    }
  } else {
    for (const pattern of UNIX_PATTERNS) {
      spawnSync("pkill", ["-f", pattern], {
        cwd: rootDir,
        stdio: "ignore",
      });
    }
  }
}

function removeStaleBinaries() {
  console.log("[dev-workflow] Removing stale debug sidecars...");

  for (const targetPath of STALE_BINARIES) {
    if (existsSync(targetPath)) {
      try {
        unlinkSync(targetPath);
        console.log(`[dev-workflow] Removed ${path.relative(rootDir, targetPath)}`);
      } catch (error) {
        console.warn(
          `[dev-workflow] Could not remove ${path.relative(rootDir, targetPath)}: ${String(error)}`,
        );
      }
    }
  }
}

function clean() {
  killBuildProcesses();
  removeStaleBinaries();
}

function verifyClean() {
  clean();

  if (isWindows) {
    run("cmd.exe", ["/c", ".\\scripts\\windows-verify.cmd"]);
    return;
  }

  run("pnpm", ["format"]);
  run("pnpm", ["lint"]);
  run("pnpm", ["test"]);
}

function devFast() {
  run("pnpm", ["tauri", "dev"]);
}

function printUsage() {
  console.log("Usage: node scripts/dev-workflow.mjs <clean|verify-clean|dev-fast>");
}

const command = process.argv[2];

switch (command) {
  case "clean":
    clean();
    break;
  case "verify-clean":
    verifyClean();
    break;
  case "dev-fast":
    devFast();
    break;
  default:
    printUsage();
    process.exit(1);
}
