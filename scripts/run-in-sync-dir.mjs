#!/usr/bin/env node
import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const bugloginSyncDir = path.join(rootDir, "buglogin-sync");
const legacySyncDir = path.join(rootDir, "buglogin-sync");
const syncDir = existsSync(bugloginSyncDir) ? bugloginSyncDir : legacySyncDir;

const command = process.argv.slice(2).join(" ").trim();
if (!command) {
  console.error("Usage: node scripts/run-in-sync-dir.mjs \"<command>\"");
  process.exit(1);
}

const child = spawn(command, {
  cwd: syncDir,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
