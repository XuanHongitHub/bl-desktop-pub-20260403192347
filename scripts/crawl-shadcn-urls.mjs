import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright"

const BASE_URL = "https://ui.shadcn.com"
const START_URLS = [
  `${BASE_URL}/docs`,
  `${BASE_URL}/docs/components`,
  `${BASE_URL}/docs/installation`,
  `${BASE_URL}/examples/dashboard`,
]
const MAX_PAGES = 180
const PAGE_TIMEOUT_MS = 30_000

const OUTPUT_DIR = path.resolve(
  "docs",
  "workflow",
  "references",
  "frontend-shadcn-clone"
)
const OUTPUT_SRC_DIR = path.resolve(
  "src",
  "frontend-shadcn",
  "data"
)

function normalizeUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl, BASE_URL)
    if (parsed.origin !== BASE_URL) {
      return null
    }
    parsed.hash = ""
    parsed.search = ""
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/"
    if (
      !pathname.startsWith("/docs") &&
      !pathname.startsWith("/examples") &&
      !pathname.startsWith("/blocks") &&
      !pathname.startsWith("/charts") &&
      !pathname.startsWith("/themes")
    ) {
      return null
    }
    return `${BASE_URL}${pathname}`
  } catch {
    return null
  }
}

function classify(url) {
  const pathname = new URL(url).pathname
  if (pathname.startsWith("/docs/components/")) return "components"
  if (pathname.startsWith("/docs")) return "docs"
  if (pathname.startsWith("/examples")) return "examples"
  if (pathname.startsWith("/blocks")) return "blocks"
  if (pathname.startsWith("/charts")) return "charts"
  if (pathname.startsWith("/themes")) return "themes"
  return "other"
}

async function crawlAllUrls() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const queue = [...new Set(START_URLS.map((item) => normalizeUrl(item)).filter(Boolean))]
  const visited = new Set()
  const discovered = new Set(queue)

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const current = queue.shift()
    if (!current || visited.has(current)) {
      continue
    }
    visited.add(current)
    try {
      await page.goto(current, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS })
      await page.waitForTimeout(300)
      const hrefs = await page.$$eval("a[href]", (links) =>
        links.map((link) => link.getAttribute("href")).filter(Boolean)
      )

      for (const href of hrefs) {
        const normalized = normalizeUrl(href)
        if (normalized && !discovered.has(normalized)) {
          discovered.add(normalized)
          queue.push(normalized)
        }
      }
    } catch {
      // Keep crawling remaining pages even if one URL fails.
    }
  }

  await browser.close()
  return Array.from(discovered).sort()
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })
  await mkdir(OUTPUT_SRC_DIR, { recursive: true })
  const urls = await crawlAllUrls()
  const grouped = urls.reduce((acc, url) => {
    const key = classify(url)
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(url)
    return acc
  }, {})

  const manifest = {
    source: BASE_URL,
    crawledAt: new Date().toISOString(),
    total: urls.length,
    grouped,
    urls,
  }

  await writeFile(
    path.join(OUTPUT_DIR, "shadcn-url-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  )
  await writeFile(
    path.join(OUTPUT_SRC_DIR, "shadcn-url-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  )
}

main().catch((error) => {
  console.error("[crawl-shadcn-urls] failed:", error)
  process.exitCode = 1
})
