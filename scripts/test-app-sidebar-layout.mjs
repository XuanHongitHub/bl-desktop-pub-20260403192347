import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/components/app-sidebar.tsx", "utf8");

assert.doesNotMatch(
  source,
  /<span[^>]*>\s*BugLogin\s*<\/span>/,
  "App sidebar should use the logo component for branding instead of rendering a raw BugLogin text node",
);

assert.match(
  source,
  /import\s+\{\s*Logo\s*\}\s+from\s+"\.\/icons\/logo";/,
  "App sidebar should import and render the shared logo component",
);

assert.doesNotMatch(
  source,
  /collapsed && \(\n\s*<div className="px-3 pb-2">/,
  "Collapsed sidebar should not render a separate expand button block below the header",
);

assert.match(
  source,
  /onClick=\{\(\) => onCollapsedChange\(true\)\}/,
  "Sidebar should expose a collapse trigger in expanded mode",
);

assert.match(
  source,
  /onClick=\{\(\) =>\s*\{\s*if \(onCollapsedChange\) \{\s*onCollapsedChange\(false\);/s,
  "Sidebar should expose an expand trigger in collapsed mode",
);

console.log("app sidebar layout guard passed");
