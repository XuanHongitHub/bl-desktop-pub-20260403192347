import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const DEV_SERVER_URL = "http://127.0.0.1:12341";
const OUTPUT_DIR = path.resolve(
  "docs",
  "workflow",
  "references",
  "frontend-phase-a",
);

function startDevServer() {
  const child = spawn("pnpm", ["dev"], {
    cwd: process.cwd(),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logs = [];
  const onData = (chunk) => {
    const text = chunk.toString();
    logs.push(text);
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  return {
    child,
    getLogs: () => logs.join(""),
  };
}

async function waitForServerReady(checkUrl, getLogs) {
  const timeoutAt = Date.now() + 180_000;
  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(checkUrl);
      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await delay(800);
  }
  throw new Error(`Dev server not ready. Logs:\n${getLogs()}`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const server = startDevServer();
  let browser;
  try {
    await waitForServerReady(`${DEV_SERVER_URL}/app-baseline`, server.getLogs);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

    await page.goto(`${DEV_SERVER_URL}/app-baseline`, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "phase-a-app-baseline.png"),
      fullPage: true,
    });

    await page.goto(`${DEV_SERVER_URL}/web-baseline`, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "phase-a-web-baseline.png"),
      fullPage: true,
    });

    await page.goto(`${DEV_SERVER_URL}/app-baseline-benchmark`, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(
      () => typeof window.__BUGLOGIN_PHASE_A_RUN_BENCHMARK__ === "function",
      { timeout: 120_000 },
    );
    const results = await page.evaluate(async () => {
      return window.__BUGLOGIN_PHASE_A_RUN_BENCHMARK__();
    });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "phase-a-benchmark-results.png"),
      fullPage: true,
    });

    await writeFile(
      path.join(OUTPUT_DIR, "phase-a-benchmark-results.json"),
      `${JSON.stringify(results, null, 2)}\n`,
      "utf8",
    );
  } finally {
    if (browser) {
      await browser.close();
    }
    server.child.kill("SIGTERM");
    await delay(800);
    if (!server.child.killed) {
      server.child.kill("SIGKILL");
    }
  }
}

main().catch((error) => {
  console.error("[phase-a-benchmark] failed:", error);
  process.exitCode = 1;
});
