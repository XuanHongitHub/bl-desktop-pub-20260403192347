#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const HARD_CODED_BASELINE_PATH = path.join(
  ROOT,
  "scripts/audit-ui-hardcoded-baseline.txt",
);
const LOCALE_FILES = {
  en: path.join(ROOT, "src/i18n/locales/en.json"),
  vi: path.join(ROOT, "src/i18n/locales/vi.json"),
};
const SOURCE_ROOTS = [
  path.join(ROOT, "src/app"),
  path.join(ROOT, "src/components"),
];
const SOURCE_EXTENSIONS = new Set([".tsx", ".ts"]);
const EXCLUDED_PATH_SEGMENTS = [
  `${path.sep}ui${path.sep}`,
  `${path.sep}icons${path.sep}`,
  `${path.sep}types${path.sep}`,
];
const MAX_PRINTED = 120;
const args = new Set(process.argv.slice(2));
const shouldUpdateBaseline = args.has("--update-baseline");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function flattenKeys(input, prefix = "", out = new Set()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    if (prefix) {
      out.add(prefix);
    }
    return out;
  }

  const entries = Object.entries(input);
  if (entries.length === 0 && prefix) {
    out.add(prefix);
    return out;
  }

  for (const [key, value] of entries) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenKeys(value, nextPrefix, out);
      continue;
    }
    out.add(nextPrefix);
  }
  return out;
}

function collectSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, out);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }
    out.push(fullPath);
  }
  return out;
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, "/");
}

function shouldExclude(filePath) {
  return EXCLUDED_PATH_SEGMENTS.some((segment) => filePath.includes(segment));
}

function printList(title, items) {
  if (items.length === 0) {
    return;
  }
  console.log(`\n${title} (${items.length})`);
  const limit = Math.min(items.length, MAX_PRINTED);
  for (let index = 0; index < limit; index += 1) {
    console.log(`  - ${items[index]}`);
  }
  if (items.length > limit) {
    console.log(`  ... and ${items.length - limit} more`);
  }
}

function readBaseline() {
  if (!fs.existsSync(HARD_CODED_BASELINE_PATH)) {
    return new Set();
  }
  const content = fs.readFileSync(HARD_CODED_BASELINE_PATH, "utf8");
  return new Set(
    content
      .split("\n")
      .map((line) => normalizeWarningId(line))
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

function writeBaseline(items) {
  const sorted = [...items].map((item) => normalizeWarningId(item)).sort();
  fs.writeFileSync(HARD_CODED_BASELINE_PATH, `${sorted.join("\n")}\n`, "utf8");
}

function normalizeWarningId(warning) {
  return warning.replace(/:(\d+)\s+/u, " ");
}

const enLocale = readJson(LOCALE_FILES.en);
const viLocale = readJson(LOCALE_FILES.vi);
const enKeys = flattenKeys(enLocale);
const viKeys = flattenKeys(viLocale);

const missingInVi = Array.from(enKeys).filter((key) => !viKeys.has(key)).sort();
const missingInEn = Array.from(viKeys).filter((key) => !enKeys.has(key)).sort();

const sourceFiles = SOURCE_ROOTS.flatMap((root) => collectSourceFiles(root));

const translationKeyUsage = [];
const hardcodedWarnings = [];
const localeBypassWarnings = [];

const tCallRegex = /\bt\(\s*["'`]([^"'`]+)["'`]/g;
const toastLiteralRegex =
  /\b(?:showErrorToast|showSuccessToast|toast\.(?:error|success|info|warning))\(\s*["'`]([^"'`]+)["'`]/g;
const showToastLiteralFieldRegex =
  /\b(?:title|description)\s*:\s*["'`]([^"'`]+)["'`]/g;
const jsxLiteralRegex = />\s*([A-Za-z][^<{]{1,90})\s*</g;
const localeBypassRegex = /\.toLocale(?:String|DateString|TimeString)\(/;

for (const filePath of sourceFiles) {
  if (shouldExclude(filePath)) {
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const relative = toRelative(filePath);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    for (const match of line.matchAll(tCallRegex)) {
      const key = (match[1] || "").trim();
      if (!key || key.includes("${")) {
        continue;
      }
      translationKeyUsage.push({
        file: relative,
        line: lineIndex + 1,
        key,
      });
    }

    for (const match of line.matchAll(toastLiteralRegex)) {
      const literal = (match[1] || "").trim();
      if (!literal) {
        continue;
      }
      hardcodedWarnings.push(
        `${relative}:${lineIndex + 1} toast literal "${literal}"`,
      );
    }

    if (line.includes("showToast({")) {
      for (const match of line.matchAll(showToastLiteralFieldRegex)) {
        const literal = (match[1] || "").trim();
        if (!literal) {
          continue;
        }
        hardcodedWarnings.push(
          `${relative}:${lineIndex + 1} showToast field literal "${literal}"`,
        );
      }
    }

    const maybeInlineJsxText =
      line.includes("</") &&
      /<[/A-Za-z][^>]*>/.test(line);
    if (maybeInlineJsxText && !line.includes("{t(") && !line.includes(">{t(")) {
      for (const match of line.matchAll(jsxLiteralRegex)) {
        const literal = (match[1] || "").trim();
        if (!literal) {
          continue;
        }
        if (literal.length < 2) {
          continue;
        }
        if (
          literal.startsWith("http") ||
          literal.startsWith("www.") ||
          literal.startsWith("var(") ||
          literal === "BugLogin"
        ) {
          continue;
        }
        hardcodedWarnings.push(
          `${relative}:${lineIndex + 1} jsx literal "${literal}"`,
        );
      }
    }

    if (localeBypassRegex.test(line)) {
      const warning =
        `${relative}:${lineIndex + 1} locale bypass "${line.trim()}"`;
      localeBypassWarnings.push(warning);
      hardcodedWarnings.push(warning);
    }
  }
}

const missingUsedKeys = translationKeyUsage
  .filter((usage) => !enKeys.has(usage.key) || !viKeys.has(usage.key))
  .map(
    (usage) =>
      `${usage.file}:${usage.line} missing key "${usage.key}" in ` +
      `${!enKeys.has(usage.key) ? "en" : ""}${!enKeys.has(usage.key) && !viKeys.has(usage.key) ? "," : ""}${!viKeys.has(usage.key) ? "vi" : ""}`,
  )
  .sort();

const sortedHardcodedWarnings = hardcodedWarnings.sort();
const warningEntries = sortedHardcodedWarnings.map((full) => ({
  full,
  id: normalizeWarningId(full),
}));
const hardcodedBaseline = readBaseline();
const newHardcodedWarnings = warningEntries
  .filter((entry) => !hardcodedBaseline.has(entry.id))
  .map((entry) => entry.full);
const currentWarningIds = new Set(warningEntries.map((entry) => entry.id));
const resolvedHardcodedWarnings = [...hardcodedBaseline].filter(
  (item) => !currentWarningIds.has(item),
);

if (shouldUpdateBaseline) {
  writeBaseline(sortedHardcodedWarnings);
}

console.log("UI consistency audit summary");
console.log(`- Source files scanned: ${sourceFiles.length}`);
console.log(`- Locale keys (en): ${enKeys.size}`);
console.log(`- Locale keys (vi): ${viKeys.size}`);
console.log(`- Missing locale keys in vi: ${missingInVi.length}`);
console.log(`- Missing locale keys in en: ${missingInEn.length}`);
console.log(`- Missing i18n keys referenced by t(...): ${missingUsedKeys.length}`);
console.log(`- Locale formatting bypass warnings: ${localeBypassWarnings.length}`);
console.log(`- Hardcoded UI warnings (total): ${hardcodedWarnings.length}`);
console.log(`- Hardcoded UI warnings (new): ${newHardcodedWarnings.length}`);
console.log(
  `- Hardcoded UI warnings (resolved vs baseline): ${resolvedHardcodedWarnings.length}`,
);

printList("Missing locale keys in vi", missingInVi);
printList("Missing locale keys in en", missingInEn);
printList("Missing keys referenced by t(...)", missingUsedKeys);
printList("Locale formatting bypass warnings", localeBypassWarnings);
printList("New hardcoded UI warnings", newHardcodedWarnings);
if (resolvedHardcodedWarnings.length > 0) {
  printList(
    "Resolved hardcoded warnings (can remove from baseline)",
    resolvedHardcodedWarnings,
  );
}

const shouldFail =
  !shouldUpdateBaseline &&
  (missingInVi.length > 0 ||
    missingInEn.length > 0 ||
    missingUsedKeys.length > 0 ||
    newHardcodedWarnings.length > 0);

if (shouldFail) {
  process.exitCode = 1;
}
