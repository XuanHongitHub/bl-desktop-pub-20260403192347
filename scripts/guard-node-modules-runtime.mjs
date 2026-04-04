#!/usr/bin/env node

import { readdirSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const cwd = process.cwd();
const nodeModulesPath = path.join(cwd, "node_modules");
const pnpmStorePath = path.join(nodeModulesPath, ".pnpm");
const tauriBinCmdPath = path.join(nodeModulesPath, ".bin", "tauri.CMD");
const tauriBinShPath = path.join(nodeModulesPath, ".bin", "tauri");

const isWindows = process.platform === "win32";
const isWsl =
  Boolean(process.env.WSL_DISTRO_NAME) ||
  /microsoft/i.test(os.release()) ||
  /microsoft/i.test(os.version?.() ?? "");

function fail(message, fixCommands) {
  const lines = [
    "",
    "[runtime-guard] " + message,
    "",
    "Run these commands in the current runtime before `pnpm tauri dev`:",
    ...fixCommands.map((command) => `  ${command}`),
    "",
  ];
  console.error(lines.join("\n"));
  process.exit(1);
}

if (!existsSync(nodeModulesPath) || !existsSync(pnpmStorePath)) {
  fail("`node_modules` is missing for this runtime.", [
    isWindows ? "pnpm install" : "pnpm install",
  ]);
}

const pnpmEntries = readdirSync(pnpmStorePath);
const hasLinuxArtifacts = pnpmEntries.some(
  (entry) =>
    entry.includes("@tauri-apps+cli-linux") ||
    entry.includes("@biomejs+cli-linux"),
);
const hasWindowsArtifacts = pnpmEntries.some(
  (entry) =>
    entry.includes("@tauri-apps+cli-win32") ||
    entry.includes("@biomejs+cli-win32"),
);

if (isWindows) {
  const hasTauriCmd = existsSync(tauriBinCmdPath);
  const hasUnixTauriOnly = existsSync(tauriBinShPath) && !hasTauriCmd;

  if (!hasTauriCmd || hasUnixTauriOnly || (hasLinuxArtifacts && !hasWindowsArtifacts)) {
    fail(
      "Detected non-Windows `node_modules` artifacts (likely installed from WSL/Linux).",
      [
        "Remove-Item -Recurse -Force node_modules",
        "pnpm config set shell-emulator true",
        "pnpm install",
        "pnpm exec tauri --version",
      ],
    );
  }
}

if (isWsl) {
  const hasWindowsTauriOnly = existsSync(tauriBinCmdPath) && !existsSync(tauriBinShPath);
  if (hasWindowsTauriOnly || (hasWindowsArtifacts && !hasLinuxArtifacts)) {
    fail("Detected Windows `node_modules` artifacts while running in WSL/Linux.", [
      "rm -rf node_modules",
      "pnpm install",
      "pnpm exec tauri --version",
    ]);
  }
}
