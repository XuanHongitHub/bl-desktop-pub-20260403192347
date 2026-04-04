import { execSync, execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_DIR = dirname(fileURLToPath(import.meta.url));

function getHostTarget() {
  try {
    const output = execSync("rustc -vV", { encoding: "utf-8" });
    const match = output.match(/host:\s*(.+)/);
    if (match) return match[1].trim();
  } catch {}
  return "unknown";
}

const TARGET = process.env.TARGET || "unknown";
const HOST_TARGET = getHostTarget();
const EFFECTIVE_TARGET =
  TARGET !== "unknown" ? TARGET : HOST_TARGET !== "unknown" ? HOST_TARGET : "unknown";
const isWindows = EFFECTIVE_TARGET.includes("windows");
const PROFILE = process.env.PROFILE || (isWindows ? "release" : "debug");
const VCVARS64_PATH =
  "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat";

// Keep sidecar artifacts outside src-tauri so tauri-dev watcher doesn't rebuild app repeatedly.
function normalizeForPrefix(value) {
  return value.replaceAll("\\", "/").toLowerCase().replace(/\/+$/, "");
}

const CARGO_TARGET_DIR = (() => {
  const fallback = resolve(MANIFEST_DIR, "..", ".sidecar-target");
  const raw = process.env.SIDECAR_CARGO_TARGET_DIR;
  if (!raw) return fallback;
  const candidate = isAbsolute(raw) ? raw : join(MANIFEST_DIR, raw);
  const normCandidate = normalizeForPrefix(resolve(candidate));
  const normManifest = normalizeForPrefix(resolve(MANIFEST_DIR));
  if (normCandidate === normManifest || normCandidate.startsWith(`${normManifest}/`)) {
    console.warn(
      `SIDECAR_CARGO_TARGET_DIR points inside src-tauri (${candidate}), using ${fallback} instead.`,
    );
    return fallback;
  }
  return candidate;
})();

const LOCK_PATH = join(CARGO_TARGET_DIR, ".copy-proxy-binary.lock");
const LOCK_WAIT_MS = 10 * 60 * 1000;

const srcDir =
  EFFECTIVE_TARGET === "unknown"
    ? join(CARGO_TARGET_DIR, PROFILE === "release" ? "release" : "debug")
    : join(CARGO_TARGET_DIR, EFFECTIVE_TARGET, PROFILE === "release" ? "release" : "debug");

const destDir = join(MANIFEST_DIR, "binaries");
mkdirSync(destDir, { recursive: true });
mkdirSync(CARGO_TARGET_DIR, { recursive: true });

const SOURCE_DEPENDENCIES = {
  "buglogin-proxy": [
    "src/bin/proxy_server.rs",
    "src/proxy_server.rs",
    "src/proxy_runner.rs",
    "src/proxy_storage.rs",
    "src/browser_window.rs",
  ],
  "buglogin-daemon": ["src/bin/buglogin_daemon.rs"],
};

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (isWindows) {
    try {
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `if (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }`,
        ],
        { stdio: "ignore" },
      );
      return true;
    } catch {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  const deadline = Date.now() + LOCK_WAIT_MS;

  while (true) {
    try {
      writeFileSync(LOCK_PATH, String(process.pid), { encoding: "utf8", flag: "wx" });
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;

      let holderPid = Number.NaN;
      try {
        holderPid = Number.parseInt(readFileSync(LOCK_PATH, "utf8").trim(), 10);
      } catch {}

      if (!isPidAlive(holderPid)) {
        try {
          unlinkSync(LOCK_PATH);
        } catch {}
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out waiting for sidecar build lock (${LOCK_PATH}) held by PID ${holderPid}`,
        );
      }

      sleepMs(500);
    }
  }
}

function releaseLock() {
  try {
    unlinkSync(LOCK_PATH);
  } catch {}
}

function shouldRebuildBinary(baseName, sourceBinPath) {
  if (!existsSync(sourceBinPath)) return true;

  const sourceMtime = statSync(sourceBinPath).mtimeMs;
  const deps = SOURCE_DEPENDENCIES[baseName] || [];

  for (const rel of deps) {
    const abs = join(MANIFEST_DIR, rel);
    if (!existsSync(abs)) continue;
    if (statSync(abs).mtimeMs > sourceMtime) return true;
  }

  return false;
}

function buildBinary(baseName) {
  const buildArgs = ["build", "--no-default-features", "--bin", baseName];
  if (PROFILE === "release") buildArgs.push("--release");
  if (EFFECTIVE_TARGET !== "unknown") buildArgs.push("--target", EFFECTIVE_TARGET);

  const buildEnv = {
    ...process.env,
    CARGO_TARGET_DIR,
    BUGLOGIN_SIDECAR_BUILD: "1",
  };

  if (isWindows && existsSync(VCVARS64_PATH)) {
    const cargoCommand = ["cargo", ...buildArgs].join(" ");
    execSync(`call "${VCVARS64_PATH}" && ${cargoCommand}`, {
      cwd: MANIFEST_DIR,
      stdio: "inherit",
      shell: "cmd.exe",
      env: buildEnv,
    });
    return;
  }

  execFileSync("cargo", buildArgs, {
    cwd: MANIFEST_DIR,
    stdio: "inherit",
    env: buildEnv,
  });
}

function copyBinary(baseName) {
  const binName = isWindows ? `${baseName}.exe` : baseName;
  const source = join(srcDir, binName);

  let destName = `${baseName}-${EFFECTIVE_TARGET}`;
  if (isWindows) destName += ".exe";
  const dest = join(destDir, destName);

  const mustBuild = shouldRebuildBinary(baseName, source);

  if (!existsSync(source) || mustBuild) {
    console.log(`${destName} is stale or missing source binary, rebuilding ${baseName}...`);
    buildBinary(baseName);
    if (!existsSync(source)) {
      throw new Error(`Failed to build ${baseName}: expected binary missing at ${source}`);
    }
  }

  if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(source).mtimeMs) {
    console.log(`Using cached ${destName}`);
    return;
  }

  copyFileSync(source, dest);
  console.log(`Copied ${binName} to ${dest}`);
}

acquireLock();
try {
  copyBinary("buglogin-proxy");
  copyBinary("buglogin-daemon");
} finally {
  releaseLock();
}
