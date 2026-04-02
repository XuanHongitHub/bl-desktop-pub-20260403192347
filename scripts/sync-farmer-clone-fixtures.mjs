#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const TARGETS = [
  {
    slug: "create-collaborate-go-live",
    url: "https://www.framer.com/",
  },
  {
    slug: "scale-without-switching-tools",
    url: "https://www.framer.com/features/",
  },
  {
    slug: "pro-help-handpicked-experts",
    url: "https://www.framer.com/enterprise/",
  },
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const FIXTURE_ROOT = path.join(
  process.cwd(),
  "src/features/web/farmer-clone/fixtures",
);

async function writeFixture(slug, fileName, content) {
  const fixtureDir = path.join(FIXTURE_ROOT, slug);
  await fs.mkdir(fixtureDir, { recursive: true });
  const targetPath = path.join(fixtureDir, fileName);
  await fs.writeFile(targetPath, `${content}\n`, "utf8");
  return targetPath;
}

async function writeJsonFixture(slug, fileName, data) {
  return writeFixture(slug, fileName, JSON.stringify(data, null, 2));
}

async function main() {
  await fs.mkdir(FIXTURE_ROOT, { recursive: true });

  const manifest = [];

  for (const target of TARGETS) {
    const response = await fetch(target.url, {
      headers: { "user-agent": USER_AGENT },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${target.url}: ${response.status} ${response.statusText}`,
      );
    }

    let html = await response.text();
    const baseTag = `<base href="${target.url}" />`;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>\n${baseTag}`);
    } else {
      html = `${baseTag}\n${html}`;
    }

    await Promise.all([
      writeFixture(target.slug, "source-document.html", html),
      writeJsonFixture(target.slug, "source-meta.json", {
        slug: target.slug,
        sourceUrl: target.url,
        syncedAtUtc: new Date().toISOString(),
      }),
    ]);

    manifest.push({ slug: target.slug, sourceUrl: target.url });
    console.log(`[farmer-clone] synced ${target.slug} -> ${target.url}`);
  }

  await fs.writeFile(
    path.join(FIXTURE_ROOT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`[farmer-clone] manifest updated (${manifest.length} pages)`);
}

await main();
