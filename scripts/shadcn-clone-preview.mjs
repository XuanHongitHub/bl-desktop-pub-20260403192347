import { spawn } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { chromium } from "playwright"

const DEV_SERVER_URL = "http://127.0.0.1:12341"
const OUTPUT_DIR = path.resolve(
  "docs",
  "workflow",
  "references",
  "frontend-shadcn-clone"
)
const ROUTE_TARGETS = [
  {
    route: "/shadcn-clone",
    output: "shadcn-clone-web.png",
    surface: "web",
    viewport: { width: 1680, height: 1100 },
  },
  {
    route: "/app-shadcn-clone",
    output: "shadcn-clone-desktop.png",
    surface: "desktop",
    viewport: { width: 1680, height: 1100 },
  },
]

const WEB_VARIANTS = [
  { id: "dashboard", output: "shadcn-clone-web-dashboard.png", mainNav: "Blocks", tab: "Dashboard" },
  { id: "tasks", output: "shadcn-clone-web-tasks.png", mainNav: "Blocks", tab: "Tasks" },
  { id: "playground", output: "shadcn-clone-web-playground.png", mainNav: "Blocks", tab: "Playground" },
  { id: "authentication", output: "shadcn-clone-web-authentication.png", mainNav: "Blocks", tab: "Authentication" },
  { id: "rtl", output: "shadcn-clone-web-rtl.png", mainNav: "Blocks", tab: "RTL" },
  { id: "components", output: "shadcn-clone-web-components.png", mainNav: "Components" },
  { id: "charts", output: "shadcn-clone-web-charts.png", mainNav: "Charts" },
  { id: "directory", output: "shadcn-clone-web-directory.png", mainNav: "Directory" },
  { id: "create", output: "shadcn-clone-web-create.png", mainNav: "Create" },
  { id: "docs", output: "shadcn-clone-web-docs.png", mainNav: "Docs" },
]

function startDevServer() {
  const child = spawn("pnpm", ["dev"], {
    cwd: process.cwd(),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  })

  const logs = []
  const onData = (chunk) => {
    logs.push(chunk.toString())
  }
  child.stdout.on("data", onData)
  child.stderr.on("data", onData)

  return {
    child,
    getLogs: () => logs.join(""),
  }
}

async function waitForServerReady(checkUrl, getLogs) {
  const timeoutAt = Date.now() + 180_000
  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(checkUrl)
      if (response.ok || response.status === 404) {
        return
      }
    } catch {
      // Retry until timeout.
    }
    await delay(800)
  }
  throw new Error(`Dev server not ready. Logs:\n${getLogs()}`)
}

async function activateVariant(page, variant) {
  await page.getByRole("button", { name: variant.mainNav, exact: true }).first().click()
  if (variant.tab) {
    await page.getByRole("tab", { name: variant.tab, exact: true }).first().click()
  }
  await page.waitForTimeout(300)
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })
  const server = startDevServer()
  let browser
  try {
    await waitForServerReady(`${DEV_SERVER_URL}${ROUTE_TARGETS[0].route}`, server.getLogs)

    browser = await chromium.launch({ headless: true })
    const previewArtifacts = []

    for (const target of ROUTE_TARGETS) {
      const page = await browser.newPage({ viewport: target.viewport })
      await page.goto(`${DEV_SERVER_URL}${target.route}`, { waitUntil: "networkidle" })

      if (target.surface === "web") {
        for (const variant of WEB_VARIANTS) {
          await activateVariant(page, variant)
          const outputFile = path.join(OUTPUT_DIR, variant.output)
          await page.screenshot({
            path: outputFile,
            fullPage: true,
          })
          previewArtifacts.push({
            surface: target.surface,
            route: target.route,
            state: variant.id,
            output: `docs/workflow/references/frontend-shadcn-clone/${variant.output}`,
          })
        }
      } else {
        const outputFile = path.join(OUTPUT_DIR, target.output)
        await page.screenshot({
          path: outputFile,
          fullPage: true,
        })
        previewArtifacts.push({
          surface: target.surface,
          route: target.route,
          state: "dashboard",
          output: `docs/workflow/references/frontend-shadcn-clone/${target.output}`,
        })
      }
      await page.close()
    }

    await writeFile(
      path.join(OUTPUT_DIR, "shadcn-clone-meta.json"),
      `${JSON.stringify(
        {
          previews: previewArtifacts,
          timestamp: new Date().toISOString(),
          sourceRepo: "https://github.com/shadcn-ui/ui",
          shellSourceRepo: "https://github.com/JCodesMore/ai-website-cloner-template",
          registryCoverage: "full",
          clonedComponentCount: 57,
        },
        null,
        2
      )}\n`,
      "utf8"
    )
  } finally {
    if (browser) {
      await browser.close()
    }
    server.child.kill("SIGTERM")
    await delay(800)
    if (!server.child.killed) {
      server.child.kill("SIGKILL")
    }
  }
}

main().catch((error) => {
  console.error("[shadcn-clone-preview] failed:", error)
  process.exitCode = 1
})
