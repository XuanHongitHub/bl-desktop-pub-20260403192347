#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://linear.app/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const FIXTURE_DIR = path.join(
  process.cwd(),
  "src/features/web/portal-home/fixtures"
);
const PUBLIC_CSS_DIR = path.join(process.cwd(), "public/css");

function extractInlineStyles(html) {
  const styleMatches = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)];
  if (styleMatches.length === 0) {
    throw new Error("Cannot find inline style tags");
  }
  return styleMatches.map((m) => m[0]).join("\n");
}

function extractStylesheetUrls(html) {
  const links = [
    ...html.matchAll(
      /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g
    ),
  ].map((match) => match[1]);

  if (links.length === 0) {
    throw new Error("Cannot find stylesheet links");
  }

  const absoluteLinks = links.map((href) =>
    href.startsWith("http") ? href : new URL(href, SOURCE_URL).toString()
  );

  return [...new Set(absoluteLinks)];
}

function extractBalancedDivByClassPair(html, classA, classB) {
  const classPattern = new RegExp(
    `<div class="[^"]*${classA}[^"]*${classB}[^"]*"[^>]*>`,
    "i"
  );
  const startMatch = classPattern.exec(html);
  if (!startMatch || typeof startMatch.index !== "number") {
    throw new Error(`Cannot find root content div for ${classA} ${classB}`);
  }

  const tokenRe = /<\/?div\b[^>]*>/gi;
  tokenRe.lastIndex = startMatch.index;
  let depth = 0;
  let endIndex = -1;

  while (true) {
    const token = tokenRe.exec(html);
    if (!token) {
      break;
    }
    if (token[0].startsWith("</div")) {
      depth -= 1;
    } else {
      depth += 1;
    }
    if (depth === 0) {
      endIndex = tokenRe.lastIndex;
      break;
    }
  }

  if (endIndex === -1) {
    throw new Error("Cannot compute balanced end for content root div");
  }

  return html.slice(startMatch.index, endIndex);
}

async function writeFixture(fileName, content) {
  const targetPath = path.join(FIXTURE_DIR, fileName);
  await fs.writeFile(targetPath, `${content}\n`, "utf8");
  return targetPath;
}

async function writeJsonFixture(fileName, data) {
  const targetPath = path.join(FIXTURE_DIR, fileName);
  await fs.writeFile(targetPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return targetPath;
}

async function syncStylesheetsToPublic(absoluteUrls) {
  await fs.mkdir(PUBLIC_CSS_DIR, { recursive: true });
  const localUrls = [];

  for (const cssUrl of absoluteUrls) {
    const response = await fetch(cssUrl, {
      headers: { "user-agent": USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch stylesheet: ${cssUrl}`);
    }
    const cssText = await response.text();
    const fileName = path.basename(new URL(cssUrl).pathname);
    const targetPath = path.join(PUBLIC_CSS_DIR, fileName);
    await fs.writeFile(targetPath, cssText, "utf8");
    localUrls.push(`/css/${fileName}`);
  }

  return localUrls;
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: { "user-agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  const inlineStyles = extractInlineStyles(html);
  const stylesheetUrls = extractStylesheetUrls(html);
  const localStylesheetUrls = await syncStylesheetsToPublic(stylesheetUrls);
  const content = extractBalancedDivByClassPair(
    html,
    "LayoutContent_root__",
    "LayoutContent_homepage__"
  );

  await fs.mkdir(FIXTURE_DIR, { recursive: true });
  const files = await Promise.all([
    writeFixture("source-inline-styles.html", inlineStyles),
    writeFixture("source-content.html", content),
    writeJsonFixture("source-css-urls.json", localStylesheetUrls),
  ]);

  console.log("Updated portal home fixtures:");
  for (const file of files) {
    console.log(`- ${file}`);
  }
}

await main();
