import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const browserRunnerSource = readFileSync("src-tauri/src/browser_runner.rs", "utf8");
const camoufoxBranchStart = browserRunnerSource.indexOf("BrowserType::Camoufox => {");
const camoufoxBranchEnd = browserRunnerSource.indexOf("BrowserType::Wayfern => {");

assert.ok(camoufoxBranchStart >= 0, "Camoufox branch should exist");
assert.ok(camoufoxBranchEnd > camoufoxBranchStart, "Camoufox branch should be bounded");

const camoufoxBranch = browserRunnerSource.slice(camoufoxBranchStart, camoufoxBranchEnd);

assert.ok(
  camoufoxBranch.includes("open_url_in_existing_browser_firefox_like"),
  "Camoufox branch should use the Firefox-like existing-instance opener",
);

assert.ok(
  !camoufoxBranch.includes("URL opening in existing Camoufox instance is not supported"),
  "Camoufox should not fall back to unsupported-open handling",
);

console.log("camoufox open-url guard passed");
