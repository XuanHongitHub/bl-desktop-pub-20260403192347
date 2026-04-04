#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const VALID_OS = ["windows", "macos", "linux"];
const VALID_OS_SET = new Set(VALID_OS);
const VALID_RESULTS = ["pass", "fail", "blocked"];
const VALID_RESULTS_SET = new Set(VALID_RESULTS);
const REQUIRED_SCENARIOS = [
  "create-run-stop-relaunch",
  "create-proxy-validate-run",
  "invalid-proxy-recovery",
  "clone-config-integrity",
  "bulk-assign-reflect",
  "viewer-role-deny",
];

const args = process.argv.slice(2);
const command = args[0];

const artifactsDir = resolve("docs/workflow/references/topic2/gates");
const logsPath = resolve(artifactsDir, "gate-log.json");

function parseFlags(rawArgs) {
  const parsed = {};
  for (let i = 0; i < rawArgs.length; i++) {
    const token = rawArgs[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = rawArgs[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    i += 1;
  }
  return parsed;
}

function nowIso() {
  return new Date().toISOString();
}

function ensureStore() {
  if (!existsSync(artifactsDir)) {
    mkdirSync(artifactsDir, { recursive: true });
  }
  if (!existsSync(logsPath)) {
    writeFileSync(
      logsPath,
      JSON.stringify(
        {
          entries: [],
          loops: [],
          meta: { currentLoopId: null },
        },
        null,
        2,
      ),
    );
  }
}

function normalizeStore(data) {
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const loops = Array.isArray(data.loops) ? data.loops : [];
  const meta =
    data.meta && typeof data.meta === "object"
      ? {
          currentLoopId:
            typeof data.meta.currentLoopId === "string"
              ? data.meta.currentLoopId
              : null,
        }
      : { currentLoopId: null };

  return { entries, loops, meta };
}

function readStore() {
  ensureStore();
  const content = readFileSync(logsPath, "utf8");
  const data = JSON.parse(content);
  return normalizeStore(data);
}

function saveStore(store) {
  writeFileSync(logsPath, JSON.stringify(store, null, 2));
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getLoopStatus(entries, loopId) {
  const scoped = entries.filter((entry) => entry.loopId === loopId);

  const byOsScenario = new Map();
  for (const entry of scoped) {
    if (!VALID_OS_SET.has(entry.os)) continue;
    const key = `${entry.os}::${entry.scenario}`;
    byOsScenario.set(key, entry.result);
  }

  const missing = [];
  const nonPass = [];
  for (const os of VALID_OS) {
    for (const scenario of REQUIRED_SCENARIOS) {
      const key = `${os}::${scenario}`;
      const result = byOsScenario.get(key);
      if (!result) {
        missing.push({ os, scenario });
        continue;
      }
      if (result !== "pass") {
        nonPass.push({ os, scenario, result });
      }
    }
  }

  return {
    scopedCount: scoped.length,
    missing,
    nonPass,
    isPass: missing.length === 0 && nonPass.length === 0,
  };
}

function computeConsecutivePasses(loops) {
  let count = 0;
  for (let i = loops.length - 1; i >= 0; i -= 1) {
    if (loops[i].status === "pass") {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

function printHelp() {
  console.log("Topic 2 release gate helper");
  console.log("");
  console.log("Commands:");
  console.log("  loop-start --build <candidate-build> [--notes <text>]");
  console.log(
    "  record --os <windows|macos|linux> --scenario <name> --result <pass|fail|blocked> [--loop <loop-id>] [--notes <text>]",
  );
  console.log("  loop-close [--loop <loop-id>] [--notes <text>]");
  console.log("  status");
  console.log("  summary");
  console.log("");
  console.log("Recommended scenario names:");
  for (const scenario of REQUIRED_SCENARIOS) {
    console.log(`  - ${scenario}`);
  }
}

function runLoopStart(flags) {
  const build = String(flags.build ?? "").trim();
  const notes = String(flags.notes ?? "").trim();
  if (!build) {
    throw new Error("Missing --build.");
  }

  const store = readStore();

  if (store.meta.currentLoopId) {
    throw new Error(
      `A loop is already active (${store.meta.currentLoopId}). Close it first.`,
    );
  }

  const loopId = randomId("loop");
  const loop = {
    id: loopId,
    build,
    status: "open",
    startedAt: nowIso(),
    endedAt: null,
    notes: notes || undefined,
  };

  store.loops.push(loop);
  store.meta.currentLoopId = loopId;
  saveStore(store);

  console.log(`Started loop: ${loopId}`);
  console.log(`Build: ${build}`);
}

function runRecord(flags) {
  const os = String(flags.os ?? "").toLowerCase();
  const scenario = String(flags.scenario ?? "").trim();
  const result = String(flags.result ?? "").toLowerCase();
  const notes = String(flags.notes ?? "").trim();

  if (!VALID_OS_SET.has(os)) {
    throw new Error("Invalid --os. Use windows, macos, or linux.");
  }
  if (!scenario) {
    throw new Error("Missing --scenario.");
  }
  if (!VALID_RESULTS_SET.has(result)) {
    throw new Error("Invalid --result. Use pass, fail, or blocked.");
  }

  const store = readStore();
  const loopId = String(flags.loop ?? store.meta.currentLoopId ?? "").trim();
  if (!loopId) {
    throw new Error("No active loop. Use loop-start first or pass --loop.");
  }

  const loop = store.loops.find((item) => item.id === loopId);
  if (!loop) {
    throw new Error(`Loop not found: ${loopId}`);
  }
  if (loop.status !== "open") {
    throw new Error(`Loop ${loopId} is already closed.`);
  }

  store.entries.push({
    id: randomId("entry"),
    timestamp: nowIso(),
    loopId,
    os,
    scenario,
    result,
    notes: notes || undefined,
  });
  saveStore(store);

  console.log(
    `Recorded: loop=${loopId}, os=${os}, scenario="${scenario}", result=${result}${notes ? `, notes="${notes}"` : ""}`,
  );
}

function runLoopClose(flags) {
  const notes = String(flags.notes ?? "").trim();
  const store = readStore();
  const loopId = String(flags.loop ?? store.meta.currentLoopId ?? "").trim();

  if (!loopId) {
    throw new Error("No active loop to close. Use --loop or start a loop.");
  }

  const loop = store.loops.find((item) => item.id === loopId);
  if (!loop) {
    throw new Error(`Loop not found: ${loopId}`);
  }
  if (loop.status !== "open") {
    throw new Error(`Loop ${loopId} is already closed.`);
  }

  const status = getLoopStatus(store.entries, loopId);
  loop.status = status.isPass ? "pass" : "fail";
  loop.endedAt = nowIso();
  if (notes) {
    loop.notes = loop.notes ? `${loop.notes} | ${notes}` : notes;
  }

  if (store.meta.currentLoopId === loopId) {
    store.meta.currentLoopId = null;
  }

  saveStore(store);

  console.log(`Closed loop: ${loopId}`);
  console.log(`Result: ${loop.status.toUpperCase()}`);
  if (status.missing.length > 0) {
    console.log(`Missing checks: ${status.missing.length}`);
  }
  if (status.nonPass.length > 0) {
    console.log(`Non-pass checks: ${status.nonPass.length}`);
  }
}

function runStatus() {
  const store = readStore();
  const consecutivePasses = computeConsecutivePasses(store.loops);

  console.log(`Log file: ${logsPath}`);
  console.log(`Active loop: ${store.meta.currentLoopId ?? "none"}`);
  console.log(`Total loops: ${store.loops.length}`);
  console.log(`Consecutive passing loops: ${consecutivePasses}`);

  const latestLoop = store.loops.at(-1);
  if (latestLoop) {
    console.log("");
    console.log("Latest loop:");
    console.log(`- id: ${latestLoop.id}`);
    console.log(`- build: ${latestLoop.build}`);
    console.log(`- status: ${latestLoop.status}`);
    if (latestLoop.startedAt) console.log(`- startedAt: ${latestLoop.startedAt}`);
    if (latestLoop.endedAt) console.log(`- endedAt: ${latestLoop.endedAt}`);

    const loopStatus = getLoopStatus(store.entries, latestLoop.id);
    console.log(`- evidence entries: ${loopStatus.scopedCount}`);
    console.log(`- missing checks: ${loopStatus.missing.length}`);
    console.log(`- non-pass checks: ${loopStatus.nonPass.length}`);
  }
}

function runSummary() {
  const store = readStore();
  const entries = store.entries;

  const byOs = {
    windows: { pass: 0, fail: 0, blocked: 0 },
    macos: { pass: 0, fail: 0, blocked: 0 },
    linux: { pass: 0, fail: 0, blocked: 0 },
  };

  for (const entry of entries) {
    if (!VALID_OS_SET.has(entry.os) || !VALID_RESULTS_SET.has(entry.result)) {
      continue;
    }
    byOs[entry.os][entry.result] += 1;
  }

  console.log(`Log file: ${logsPath}`);
  console.log(`Total entries: ${entries.length}`);
  for (const os of VALID_OS) {
    const stat = byOs[os];
    console.log(`${os}: pass=${stat.pass}, fail=${stat.fail}, blocked=${stat.blocked}`);
  }

  console.log("");
  console.log(`Total loops: ${store.loops.length}`);
  const consecutivePasses = computeConsecutivePasses(store.loops);
  console.log(`Consecutive passing loops: ${consecutivePasses}`);

  const latestEntries = entries.slice(-8);
  if (latestEntries.length > 0) {
    console.log("");
    console.log("Latest entries:");
    for (const item of latestEntries) {
      console.log(
        `- ${item.timestamp} | loop=${item.loopId} | ${item.os} | ${item.scenario} | ${item.result}${item.notes ? ` | ${item.notes}` : ""}`,
      );
    }
  }
}

try {
  if (!command || command === "help" || command === "--help") {
    printHelp();
    process.exit(0);
  }

  const flags = parseFlags(args.slice(1));
  if (command === "loop-start") {
    runLoopStart(flags);
    process.exit(0);
  }
  if (command === "record") {
    runRecord(flags);
    process.exit(0);
  }
  if (command === "loop-close") {
    runLoopClose(flags);
    process.exit(0);
  }
  if (command === "status") {
    runStatus();
    process.exit(0);
  }
  if (command === "summary") {
    runSummary();
    process.exit(0);
  }

  throw new Error(`Unsupported command: ${command}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}
