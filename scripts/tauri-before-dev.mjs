#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const sidecarTargetDir = resolve(rootDir, ".sidecar-target");
const isWindows = process.platform === "win32";
const envFiles = [resolve(rootDir, ".env"), resolve(rootDir, ".env.local")];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  const content = readFileSync(filePath, "utf8");
  const result = {};
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      continue;
    }
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadForwardedRuntimeEnv() {
  const merged = {};
  for (const filePath of envFiles) {
    Object.assign(merged, parseEnvFile(filePath));
  }
  return Object.fromEntries(
    Object.entries(merged).filter(([key]) => key.startsWith("BUGLOGIN_")),
  );
}

const forwardedRuntimeEnv = loadForwardedRuntimeEnv();

function spawnPnpm(args, extraEnv = {}) {
  return spawn("pnpm", args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: isWindows,
    env: {
      ...process.env,
      ...forwardedRuntimeEnv,
      ...extraEnv,
    },
  });
}

const devProc = spawnPnpm(["dev"]);
const copyProc = spawnPnpm(["copy-proxy-binary"], {
  SIDECAR_CARGO_TARGET_DIR: sidecarTargetDir,
});

let copyDone = false;

copyProc.on("exit", (code, signal) => {
  copyDone = true;
  if (code === 0) {
    return;
  }
  if (!devProc.killed) {
    devProc.kill("SIGTERM");
  }
  const reason = signal ? `signal ${signal}` : `code ${code}`;
  console.error(`copy-proxy-binary failed (${reason})`);
  process.exit(typeof code === "number" ? code : 1);
});

devProc.on("exit", (code, signal) => {
  if (!copyDone && !copyProc.killed) {
    copyProc.kill("SIGTERM");
  }
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  if (!devProc.killed) devProc.kill("SIGINT");
  if (!copyProc.killed) copyProc.kill("SIGINT");
});

process.on("SIGTERM", () => {
  if (!devProc.killed) devProc.kill("SIGTERM");
  if (!copyProc.killed) copyProc.kill("SIGTERM");
});
