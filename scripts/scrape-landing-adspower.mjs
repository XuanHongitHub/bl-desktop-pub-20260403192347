#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const TARGETS = [
  "https://www.adspower.com/",
  "https://www.adspower.com/vn/",
  "https://www.adspower.com/pricing",
];

const OUT_DIR = path.resolve("docs/workflow/references/landing-intake/adspower");

const toSlug = (url) =>
  url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const decodeEntities = (text) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const stripHtml = (html) =>
  decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

const extractMeta = (html, name) => {
  const byName = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i");
  const byProperty = new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i");
  return html.match(byName)?.[1] || html.match(byProperty)?.[1] || "";
};

const extractTitle = (html) => decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "");

const extractTagTexts = (html, tag) => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out = [];
  for (const match of html.matchAll(regex)) {
    const value = stripHtml(match[1]);
    if (value) out.push(value);
  }
  return [...new Set(out)];
};

const extractLinks = (html, baseUrl) => {
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const links = [];
  for (const match of html.matchAll(regex)) {
    const href = match[1]?.trim();
    if (!href || href.startsWith("javascript:")) continue;
    const text = stripHtml(match[2] || "");
    let absolute = href;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      absolute = href;
    }
    links.push({ text, href: absolute });
  }
  return links;
};

const CTA_KEYWORDS = [
  "start",
  "free",
  "trial",
  "download",
  "register",
  "sign up",
  "login",
  "contact",
  "book",
  "demo",
  "learn more",
  "pricing",
  "get",
  "try",
];

const pickCtas = (texts) => {
  const out = [];
  for (const text of texts) {
    const t = text.toLowerCase();
    if (CTA_KEYWORDS.some((k) => t.includes(k))) out.push(text);
  }
  return [...new Set(out)].slice(0, 40);
};

const topWords = (input, limit = 30) => {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "you",
    "your",
    "that",
    "this",
    "from",
    "are",
    "our",
    "can",
    "more",
    "use",
    "all",
    "not",
    "have",
    "will",
    "get",
    "ads",
    "adspower",
    "browser",
  ]);
  const counts = new Map();
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));

  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
};

const fetchPage = async (url, html) => {
  const headings = {
    h1: extractTagTexts(html, "h1"),
    h2: extractTagTexts(html, "h2"),
    h3: extractTagTexts(html, "h3"),
  };

  const buttons = extractTagTexts(html, "button");
  const links = extractLinks(html, url);
  const linkTexts = links.map((l) => l.text).filter(Boolean);
  const allCandidateTexts = [...buttons, ...linkTexts];
  const ctas = pickCtas(allCandidateTexts);

  const bodyText = stripHtml(html);

  return {
    url,
    fetched_at_utc: new Date().toISOString(),
    title: extractTitle(html),
    meta_description: extractMeta(html, "description"),
    og_title: extractMeta(html, "og:title"),
    og_description: extractMeta(html, "og:description"),
    headings,
    cta_texts: ctas,
    internal_links: links.filter((l) => l.href.includes("adspower.com")).slice(0, 120),
    external_links: links.filter((l) => !l.href.includes("adspower.com")).slice(0, 60),
    top_keywords: topWords(bodyText),
    text_sample: bodyText.slice(0, 3000),
    stats: {
      html_length: html.length,
      heading_count: headings.h1.length + headings.h2.length + headings.h3.length,
      button_count: buttons.length,
      link_count: links.length,
    },
    raw_html_filename: `${toSlug(url)}.raw.html`,
  };
};

const toMarkdown = (pages) => {
  const lines = [];
  lines.push("# AdsPower Landing Intake");
  lines.push("");
  lines.push(`Generated (UTC): ${new Date().toISOString()}`);
  lines.push("");

  for (const page of pages) {
    lines.push(`## ${page.url}`);
    lines.push("");
    lines.push(`- Title: ${page.title || "(none)"}`);
    lines.push(`- Meta description: ${page.meta_description || "(none)"}`);
    lines.push(`- H1/H2/H3: ${page.headings.h1.length}/${page.headings.h2.length}/${page.headings.h3.length}`);
    lines.push(`- Buttons: ${page.stats.button_count}`);
    lines.push(`- Links: ${page.stats.link_count}`);
    lines.push("");

    if (page.headings.h1.length) {
      lines.push("### H1");
      lines.push("");
      for (const item of page.headings.h1) lines.push(`- ${item}`);
      lines.push("");
    }

    if (page.headings.h2.length) {
      lines.push("### Top H2");
      lines.push("");
      for (const item of page.headings.h2.slice(0, 20)) lines.push(`- ${item}`);
      lines.push("");
    }

    if (page.cta_texts.length) {
      lines.push("### CTA Texts");
      lines.push("");
      for (const item of page.cta_texts) lines.push(`- ${item}`);
      lines.push("");
    }

    if (page.top_keywords.length) {
      lines.push("### Top Keywords");
      lines.push("");
      for (const item of page.top_keywords.slice(0, 15)) lines.push(`- ${item.word}: ${item.count}`);
      lines.push("");
    }

    lines.push("### Internal Links (sample)");
    lines.push("");
    for (const link of page.internal_links.slice(0, 25)) {
      lines.push(`- ${link.text || "(no text)"} -> ${link.href}`);
    }
    lines.push("");
  }

  return lines.join("\n");
};

const main = async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const pages = [];
  for (const target of TARGETS) {
    const res = await fetch(target, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9,vi;q=0.8",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${target}`);
    }

    const html = await res.text();
    await fs.writeFile(path.join(OUT_DIR, `${toSlug(target)}.raw.html`), html, "utf8");

    const page = await fetchPage(target, html);
    pages.push(page);
    console.log(`Scraped ${target}`);
  }

  await fs.writeFile(path.join(OUT_DIR, "adspower-landing-intake.json"), JSON.stringify({ pages }, null, 2), "utf8");
  await fs.writeFile(path.join(OUT_DIR, "adspower-landing-intake.md"), toMarkdown(pages), "utf8");

  console.log(`Done. Output: ${OUT_DIR}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
